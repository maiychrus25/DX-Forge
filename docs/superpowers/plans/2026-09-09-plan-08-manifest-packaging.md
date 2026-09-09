# DX-Forge Plan 08 — Manifest export target, packaging (`npx dxforge`, Docker), second industry pack, release 1.0.0

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three things that make DX-Forge a finished product: (1) a `manifest` target that exports a plan as a plugin package (`manifest.yaml`, `db/seed.sql`, `workflows/*.json`, `dashboards/*.json`) for platforms that consume one, with a published JSON schema; (2) real packaging — built `dist/` for every package, a `dxforge` binary usable via `npx dxforge` and `npm i -g`, one Docker image for the wizard, a tagged GitHub release with tarballs and a changelog; (3) a second industry pack (`truong-hoc`, school) proving the engine is unchanged when the domain changes, plus the release checklist (stress rounds, acceptance timing, open-source compliance documents complete).

**Architecture:** `packages/providers/manifest` is a provider whose adapters write files instead of calling APIs; it reuses the oss generators (DDL, n8n builders, Metabase card SQL) so exports stay consistent with what `oss` deploys. Packaging switches each workspace package from `main: src/index.ts` to `exports` pointing at `dist/` with `tsc -b`, adds `bin` to the CLI, and a release workflow.

**Tech Stack:** TypeScript, `tsc -b`, npm workspaces, GitHub Actions (release on tag), Docker, Playwright for the stress rounds.

**Spec:** master spec §5 manifest row, §7 open-source compliance and acceptance criteria for v1.0.0 (from a clean clone: `plan` + `apply --target oss` ≤ 10 min and verify 100 % green; `apply --target gws` with a test account; wizard runs the whole pipeline; CLI installable with `npm i -g` or `npx`; wizard via one-container compose), §4 `packs/` "sau thêm truong-hoc, ban-le"; SRS FR-A-10, FR-K-01..03, FR-C; BA `15-project-rules.md`.

**Plan series:** 01–07 → **08 this**.

## Global Constraints

- Plans 01–07 Global Constraints still apply.
- Manifest format (defined here, published at `docs/manifest-schema.json` and as `ManifestSchema` in `packages/providers/manifest/src/schema.ts`):
  ```yaml
  apiVersion: dxforge.manifest/v1
  name: <short_code>-<pack or "plan">
  version: <plan.generated_at date>.<intent_hash[:8]>
  description: <Vietnamese, from intent>
  layers: { H: [ids], P: [ids], D: [ids], I: [ids] }
  database: { schema: biz, seed: db/seed.sql }
  workflows: [{ id, file: workflows/<id>.json, engine: n8n }]
  dashboards: [{ id, file: dashboards/<id>.json, engine: metabase }]
  identity: { realm, roles: [...], groups: [...] }
  storage: { root, branches: [...], acl: [...] }
  comms: { channel, topics: [...] }
  gated: [{ id, why }]
  ```
  Everything in the manifest is derivable from `plan.yaml` alone; no credentials, no target ids.
- Export directory default `out/manifest/<name>/`; `apply --target manifest` writes files and records the paths in state (`externalId = relative path`); `verify` re-validates the written files against `ManifestSchema` and checks every referenced file exists; `destroy` removes the directory.
- Packaging: every package builds to `dist/` with `tsc -b` (`exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } }`), `files` limited to `dist`, `packs` and `README`; `apps/cli` publishes as `dxforge` with `bin: { dxforge: "dist/bin.js" }`; `npx dxforge --version` works from a tarball built by `npm pack`; the packs directory is resolved relative to the installed package by default and overridable with `--packs-dir`.
- Versions: `1.0.0` across all packages at release; CHANGELOG `[1.0.0]` section; git tag `v1.0.0` on `main`; release workflow builds tarballs and the wizard image and attaches `dxforge-1.0.0.tgz`, `SHA256SUMS`.
- The second pack must not require any engine change: the planner tests for `truong-hoc` pass with the plan-01 engine (only `packs/` and docs change).
- Release checklist is a document with evidence fields; nothing is released until each line has a link or a pasted output.

---

## File structure

```
packages/providers/manifest/
├── package.json  tsconfig.json  src/index.ts  (manifestProvider(outDir))
├── src/schema.ts            ManifestSchema (zod) + toJsonSchema() writer
├── src/adapters.ts          one adapter per resource type: collects into an in-memory manifest, writes files on a final "portal.site" or via provider.finalize()
├── src/writers.ts           writeSeedSql (oss ddl + triggers), writeWorkflows (oss n8n builders), writeDashboards (oss metabase cards), writeManifestYaml
└── test/*.test.ts
docs/manifest-schema.json
packs/truong-hoc/pack.yaml            student request / absence / grade appeal process pack
examples/intent.truong-hoc.yaml
apps/cli/src/bin.ts                    #!/usr/bin/env node entry (after build)
scripts/{build-all.sh,release-check.sh}
.github/workflows/release.yml
docs/release-checklist.md, docs/demo-script.md, docs/stress-rounds.md
```

---

### Task 1: Manifest schema and JSON schema file
- `ManifestSchema` per the constraint block; `toJsonSchema()` via `zod-to-json-schema`? → ponytail: hand-write `docs/manifest-schema.json` (draft 2020-12) once and add a test that validates a sample manifest against both zod and the JSON schema (using `ajv` as a devDependency only).
- Commit `feat(provider-manifest): manifest schema and published JSON schema`.

### Task 2: Manifest provider — adapters and writers
- Adapters for every plan type append to a per-run `ManifestBuilder` stored in a `WeakMap<ApplyContext, ManifestBuilder>`; the provider exposes `finalize(ctx)` which `applyPlan` calls when `provider.finalize` exists (forge-core: add optional `finalize?(ctx): Promise<void>` to `Provider`, called after the last successful apply and before returning).
- Writers reuse `entityDdl`, `ruleTrigger`, `stateMachineTrigger`, n8n builders and Metabase `cardsFor` from `@dx-forge/provider-oss` (export them from its index); topic placeholders (`{{topic:alerts}}`) replace target ids in workflow JSON.
- verify: schema validation + file existence; destroy: `rm -rf` of the export dir recorded in state.
- Tests: exporting the diamond example produces `manifest.yaml` with 4 layer lists (35 ids), `db/seed.sql` containing `CREATE TABLE IF NOT EXISTS biz.ticket_cskh`, 3 workflow files, 2 dashboard files, `gated: []`; the transitional example lists 3 gated ids and no I files.
- Commit `feat(provider-manifest): export a plan as a plugin package`.

### Task 3: CLI and wizard support for the manifest target
- `providerFor("manifest")` → `manifestProvider(outDir)` with `--out out/manifest` (CLI) and `dataDir/out` (wizard); no credentials required (skip `loadCredentials` for this target); wizard verify screen shows the file list with download links (zip of the export dir via `jszip`).
- Tests: CLI `apply --target manifest` on the example plan exits 0 and writes the files; `verify` green; `destroy` removes them.
- Commit `feat(cli,web): manifest target without credentials, zip download`.

### Task 4: Second industry pack `truong-hoc`
- `packs/truong-hoc/pack.yaml` (process scope): entity `request_<process>` (student_code pii, class, request_type enum [absence, grade_appeal, certificate], reason, status, handler, due_at), form (≤ 5 required, student_code pattern `^[A-Z]{2}\d{6}$`), state machine (new → received → processing → answered → closed, A = `{{process.actors.A}}` on received/closed), rule (cannot answer without handler), workflow (created → alerts; sla_breach → approvals), app; `examples/intent.truong-hoc.yaml` (organisation "Trường THPT Mẫu", departments `vp` Văn phòng, `hs` Học sinh, process `don-hs` pack `truong-hoc`, actors R `van-phong`, A `hieu-pho`).
- Tests: planner snapshot for the school intent (H 16 + P 8 + D 6 + I 3 + audit/ingest 2 = 35), validator clean, manifest export works, **no change under `packages/`**.
- Commit `feat(packs): truong-hoc pack and example intent`.

### Task 5: Build outputs, `exports`, `bin`, `npx dxforge`
- `tsconfig` per package already emits `dist/`; switch `main/types` → `exports` with `dist`; keep `src` for tests via vitest alias (`resolve.alias` mapping `@dx-forge/*` → `packages/*/src/index.ts` in `vitest.config.ts`) so tests keep running without a build; Next.js `transpilePackages` removed (consumes `dist`).
- `apps/cli`: `src/bin.ts` with shebang importing `./index.js`; `package.json` `name: dxforge`, `bin`, `files: ["dist", "packs"]`, `postbuild` copies `packs/` into the package; default packs dir = `new URL("../packs", import.meta.url)`.
- `scripts/build-all.sh`: `npm run typecheck && tsc -b packages/hpdi-engine packages/forge-core packages/ai packages/providers/oss packages/providers/gws packages/providers/manifest apps/cli && npm run web:build`.
- Tests: `npm pack -w dxforge` → install the tarball into a temp dir → `npx dxforge plan -f examples/intent.example.yaml -o /tmp/p.yaml` exits 0 (a shell test in `apps/cli/test/pack.test.ts`, skipped on CI without network is fine since it is local install).
- Commit `build: dist outputs, package exports and the dxforge binary`.

### Task 6: Release workflow and Docker image
- `.github/workflows/release.yml`: on tag `v*` → `npm ci`, `scripts/build-all.sh`, `npm test`, `npm pack -w dxforge`, `sha256sum`, build `apps/web/Dockerfile` tagged `ghcr.io/maiychrus25/dx-forge-wizard:<tag>` and `:latest`, create the GitHub release with the tarball, checksums, and the CHANGELOG section as body.
- `deploy/docker-compose.wizard.yml` uses the published image by default (`image: ghcr.io/…:${TAG:-latest}`) with `build` as an override file `deploy/docker-compose.wizard.build.yml`.
- Commit `ci: release workflow with tarball, checksums and wizard image`.

### Task 7: Open-source compliance completeness and documents
- `LICENSE_NOTICE.md`: compatibility matrix (AGPL with each target's licence, the CC BY 4.0 methodology, MIT/Apache deps); `DEPENDENCIES.md` regenerated from `npm ls --omit=dev --all --json` by `scripts/deps-table.mjs` (name, version, licence, purpose); `BUILDING.md` bare-metal + Docker + `npx`; `CONTRIBUTING.md` + `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1, Vietnamese translation appended); `SECURITY.md` (reporting, credential handling); `CHANGELOG.md` `[1.0.0]`.
- `docs/release-checklist.md`: acceptance timing (`scripts/acceptance.sh` output), contract runs (core, full, gws manual), E2E desktop + mobile, stress rounds ×2 (see below), `npm audit` result, SPDX check, screenshots current, README commands executed.
- `docs/stress-rounds.md`: two rounds, each on desktop 1440 and mobile 375, light and dark: survey end-to-end under 8 minutes, plan tree with 60+ resources (two processes) scrolls without overflow, apply log with a forced failure and resume, verify report with 5 reds readable, handbook editor with a 300-line document; evidence = Playwright screenshots + timings.
- `docs/demo-script.md`: 10-minute narrative from measure to a logged-in DX-Lab, ending with the verify report and the manifest export (no mention of contests or other products).
- Commit `docs: open-source compliance documents, release checklist, stress rounds and demo script`.

### Task 8: Release 1.0.0
- Bump versions (`npm version 1.0.0 --workspaces --no-git-tag-version` + root), CHANGELOG date, run `scripts/release-check.sh` (= every checklist line automated where possible), merge `develop` → `main` (no fast-forward), tag `v1.0.0`, push; verify the release workflow output and the published image runs (`docker run … /api/health`).
- Commit(s): `chore(release): 1.0.0`; the merge and tag are done by a person after reviewing the checklist.

---

## Self-review

**Spec coverage:** §5 manifest row → Tasks 1–3 (schema, export with seed SQL, workflows, dashboards; verify by schema); §4 second pack → Task 4 (engine untouched); §7 open-source compliance list (AGPL, SPDX, LICENSE_NOTICE with compatibility, DEPENDENCIES, BUILDING with `npm i -g`/`npx` and one-container wizard, CHANGELOG, issue templates, CI) → Tasks 5–7; §7 acceptance for v1.0.0 → `scripts/acceptance.sh` (plan 05) run in the checklist, gws manual run (plan 07), wizard pipeline E2E (plan 06), all recorded in Task 7's checklist and executed in Task 8; stress 2 rounds desktop/mobile → Task 7.

**Placeholder scan:** the manifest format is fully specified; writers reuse named generators; release steps are concrete commands; the one human action (merge + tag after checklist) is stated as such.

**Type consistency:** `Provider.finalize?` is a backward-compatible addition consumed by `applyPlan`; generators are re-exported from `@dx-forge/provider-oss` (Task 2 adds the exports); the vitest alias keeps `src` imports working after `exports` switch to `dist`.
