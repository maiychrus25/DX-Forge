# Plan 02 — Execution runbook (subagent dispatch)

Companion to `2026-09-09-plan-02-measure-wizard.md`. That file is **what** to build; this file is
**how the work is handed out and accepted**. The plan stays the single source of truth for code: if
this runbook and the plan disagree about a file's contents, the plan wins and the disagreement is
reported.

Orchestrator: the session that dispatches tasks and runs the acceptance gate.
Workers: one subagent per task, model Sonnet, executing exactly one task then stopping.

---

## 1. Pre-flight (verified 2026-09-09, do not re-verify)

The orchestrator ran these before dispatch. Workers should trust them and must report immediately if
reality differs.

| Fact | Value | Consequence |
|---|---|---|
| Node / npm | v24.18.0 / 11.16.0 | Plan's `>=22` satisfied. CI pins Node 22; do not add a Node 24 dependency. |
| Baseline suite | 104 tests green, `typecheck` clean | Any red test after your change is **yours**. |
| Branch | `develop`, 1 commit ahead of `origin/develop` | Never commit to `main`. Never push. |
| `next` on registry | 16.3.4 | Plan's `^16.0.0` resolves. |
| `react` / `react-dom` | 19.2.8 | Plan's `^19.0.0` resolves. |
| `tailwindcss` | 4.3.3 | Plan's `^4.1.0` resolves. |
| `recharts` | 3.10.1 | Plan's `^3.0.0` resolves. |
| `@playwright/test` | 1.63.0 | Plan's `^1.55.0` resolves. |
| `better-sqlite3` | `^12.2.0` → 12.11.1, engines include Node 24 | Verified: binding loads and executes SQL on this machine **despite** npm's `allow-scripts` warning, because 12.x ships a prebuilt binary. Do not "fix" this warning, do not add `--allow-scripts`, do not switch to v13. |
| `zod` installed | 3.25.76 (v3 line) | `apps/web` must use `^3.24.0` as the plan says. **Do not install zod 4** — registry latest is 4.5.4 and would split the workspace. |
| Native build tools | python3, make, g++ present | Fallback compile possible if a prebuild is ever missing. |

---

## 2. Non-negotiable rules (from `AGENTS.md`, condensed)

Every worker prompt embeds this list. A worker that breaks one has failed the task even if tests pass.

1. **Scope.** Implement exactly your task: its `Files:` list, its tests, its one commit. Do not
   touch files outside that list. No refactoring, renaming or reformatting of neighbouring code.
2. **No unplanned dependencies.** Only packages named in your task. Need another? Stop and report.
3. **Test-first.** Write the failing test exactly as the plan gives it → run it → confirm it fails
   for the expected reason (paste the output) → minimal implementation → run again → green.
4. **Never weaken a test or a schema to get green.** If you believe a test is wrong, report it.
5. **Language.** Code, identifiers, comments, tests, commit messages: English. Strings shown to end
   users: Vietnamese, and only inside `apps/web/src/lib/i18n.vi.ts` — never inline in JSX.
6. **SPDX.** First line of every `.ts`/`.tsx`/`.js`/`.mjs`/`.sql`/`.sh` you create:
   `// SPDX-License-Identifier: AGPL-3.0-or-later` (`--` for `.sql`, `#` for `.sh`/`.yaml`,
   `/* */` for `.css`). CI fails without it.
7. **ESM with `.js` suffixes** in relative TypeScript imports; `@/*` alias inside `apps/web`.
8. **Secrets.** Never write a credential, token or password into code, tests, fixtures, YAML, logs
   or commit messages. Never commit `.dxforge/`, `node_modules/`, `.next/`, generated `plan.yaml`.
9. **Green before commit.** `npm test` and `npm run typecheck` must both pass on the **whole**
   repository, not just your files.
10. **Commit.** Exactly one, on `develop`, with the message the plan gives, using:
    ```bash
    git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "<message>"
    ```
    **No trailers.** No `Co-Authored-By`, no `Signed-off-by`, no tool or AI attribution. Subject and
    optional body only. `git add` only your task's files. **Never `git push`.**
11. **Report honestly.** Say what you ran and what it printed. Never "should work" or "probably
    passes". If something is impossible, finish everything else and report the exact command and
    error.

---

## 3. Dependency graph and order

```
T1 scaffold
 ├─► T2 db + repo ──► T4 survey ──► T5 rounds/latest ──► T6 dashboards ──► T7 prescriptions ──► T8 kit
 ├─► T3 auth                                                                                      │
 └─► T9 about + docker ◄──────────────────────────────────────────────────────────────────────────┘
                                                                                                  │
                                                                              T10 e2e + CI ◄───────┘
```

**Execution is strictly sequential: T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10.**

T3 and T9 are logically parallelisable, but every task appends keys to the single
`apps/web/src/lib/i18n.vi.ts` and several touch root `package.json`, so concurrent workers would
collide on the same lines. One worker at a time; the orchestrator gates between them.

Cross-task couplings a worker must not break:

| Producer | Consumer | Contract |
|---|---|---|
| T1 | all | `vi` strings object, `getEnv()`, `@/*` alias, design tokens in `globals.css` |
| T2 | T4–T8 | `openDb(path)`, `getDb()`, `Repo` functions, the eight spec §4 tables |
| T3 | T10 | `SESSION_COOKIE`, `signSession`/`verifySession`, `isPublicPath` |
| T4 | T5, T10 | `questionsForTier`, `validateAnswers`, `linkState` |
| T5 | T6, T7, T8 | persisted `results` row, `GET /api/pulse/latest`, `toMaturity` in forge-core |
| T7 | T8 | `FiveRo` and `PokaYoke` shapes are written into the kit zip |

---

## 4. Dispatch cards

Every worker prompt is built from this template:

> Read `AGENTS.md` completely, then read **only** `### Task N` of
> `docs/superpowers/plans/2026-09-09-plan-02-measure-wizard.md` plus that plan's
> "Global Constraints" and "File structure" sections. Implement that task and only that task,
> step by step, test-first. Do not read or implement other tasks.
> [rules digest from §2] [pre-flight facts from §1] [task-specific notes below]
> Finish with the four commands in `AGENTS.md` §7 and report in that order.

| # | Task | Commit message | Task-specific note for the worker |
|:-:|---|---|---|
| 1 | scaffold, DESIGN.md, root scripts | `feat(web): scaffold Next.js wizard with design tokens, i18n strings and env parsing` | `next-env.d.ts` is generated by the first `next build`; run `npx next typegen` in `apps/web` if `tsc` complains. Add it to `.gitignore`, do not commit it. Copy the two brand assets from `docs/brand/`. |
| 2 | SQLite schema, `openDb`, repo | `feat(web): sqlite schema, openDb and typed repository` | This task is allowed to modify **two lines** of `docs/superpowers/specs/2026-09-09-m0-measurement-design.md` (Prisma → better-sqlite3, §3 and the §4 heading). That is the only docs edit any worker may make. Tests use `openDb(":memory:")`. |
| 3 | admin auth | `feat(web): admin password login with signed session cookie and route gate` | Constant-time password compare. Cookie `HttpOnly; SameSite=Lax; Path=/`, 12 h. Survey paths `/pulse/s/**` and `/api/pulse/survey/**` must stay public — a regression here silently breaks T4 and T10. |
| 4 | survey API + page | `feat(web): anonymous survey API and one-question-per-screen survey page` | No IP, no user-agent, no identifying cookie is stored. `questionsForTier` must not leak `pillar`, `weightEvidence` or `supp.axis` to the client. Closed round → 409. |
| 5 | rounds, latest, notifier | `feat(web): open and close rounds, latest result with maturity block, notifier` | Also touches `packages/forge-core` (new `maturity.ts` + index export). `InsufficientResponses` → HTTP 409 with the exact Vietnamese sentence in Global Constraints; the round stays open. |
| 6 | dashboards, radar, pillar table | `feat(web): organisation and round dashboards with HPDI radar and pillar table` | Axis colours are fixed: H `#64748B`, P `#16A34A`, D `#F59E0B`, I `#7C3AED`, in the order H, P, D, I. Radar needs a table twin for screen readers. Run `next build` in this task's gate, not just tests. |
| 7 | rule-based prescriptions | `feat(web): rule-based prescriptions with shared schemas and cached rows` | Export `RoadmapSchema`, `DiscrepancySchema`, `FiveRoSchema`, `PokaYokeSchema` — plan 03's LLM output must satisfy the same schemas. Cache rows with `provider: "none", fallback: true`. No AI in this task. |
| 8 | P.A.R.A kit | `feat(web): P.A.R.A discipline kit builder, preview and download` | Tree is exactly M0 spec §7. `00. Portal` belongs to the planner, **not** the kit — do not add it. Zip is written under `.dxforge/artifacts/<assessmentId>/`. |
| 9 | about page, Docker, docs | `feat(web): about page, Dockerfile and compose for the wizard` | Attribution on the About page must match `LICENSE_NOTICE.md` exactly (Tạ Tuấn Anh / FDS, CC BY 4.0). Update `BUILDING.md` and `CHANGELOG.md`. `deploy/` is the wizard container only — targets arrive in plan 04. |
| 10 | Playwright E2E + CI | `test(web): Playwright end-to-end smoke on desktop and mobile, CI job` | Runs against `next dev` on port 3100 with a temp data dir. Journey: open round → fill three tiers → close → radar → prescription → kit. Desktop 1440 and mobile 375. Add the `e2e` job to `.github/workflows/ci.yml`. |

---

## 5. Acceptance gate (orchestrator runs this, not the worker)

After each worker returns, before dispatching the next:

```bash
npm test                       # expect the previous count + the task's new tests, 0 failed
npm run typecheck              # clean
git log --oneline -1           # exactly the task's message, no trailer
git show --stat HEAD           # only the task's Files: list
git status --short             # clean tree
grep -rL "SPDX-License-Identifier" --include='*.ts' --include='*.tsx' apps/web/src packages apps/cli
```

Additionally:

- `git show HEAD | grep -iE 'co-authored-by|signed-off-by|generated'` → must print nothing.
- New user-facing Vietnamese text appears **only** in `i18n.vi.ts`.
- **From Task 3 on** (not Task 6 — see deviation 9): `cd apps/web && rm -rf .next && FORGE_ADMIN_PASSWORD=x FORGE_SESSION_SECRET=0123456789abcdef npx next build` succeeds. `npm test` and `tsc` both pass on code Turbopack cannot bundle, so a green suite is **not** evidence the app builds.

A task is rejected and re-dispatched with the specific failure if any check fails. A rejected task
is fixed by the **same** worker where possible, so context is not lost.

---

## 6. Stop-and-report conditions

A worker must stop, leave the tree clean, and report instead of improvising when:

- a package named in the plan cannot be installed, or resolves to a major version other than the
  plan's range;
- a test in the plan cannot pass without changing the test or widening a schema;
- the task needs a file outside its `Files:` list;
- `npm test` was already red before the worker's first change;
- anything requires a credential, a network call to a real target, or a `git push`.

---

## 7. Deviation register

Filled in as work proceeds. Every entry needs the reason and the evidence.

| # | Task | Plan said | Reality | Decision |
|:-:|---|---|---|---|
| 1 | 02 (plan-level) | persistence via Prisma (M0 spec §3–4) | plan 02 Global Constraints rules better-sqlite3 + `schema.sql` | Accepted before dispatch; Task 2 patches the two spec lines. |
| 2 | 1 | `apps/web/tsconfig.json` with `"rootDir": "src"` and `"outDir": "dist"` | Next 16.3.4 emits `.next/types/validator.ts`, which the same file's `include` list requires; `tsc` then fails with TS6059 on every `next build`. Reported by the Task 1 worker, reproduced by the orchestrator. | Both keys dropped — they are inert under `noEmit: true`, and Next's own scaffold omits them. `next build` green, `/api/health` in the route table, root `typecheck` green with `.next/` present. Plan file patched at the source so later tasks inherit the fix. |
| 3 | 2 | `listResponses` body returns `{ tier, answers, freeText? }` | The Interfaces contract (plan L481), the task's own test (L535) and the only consumer, `closeRound` (L1420, which maps the result down to `{tier, answers}`), all say `{ tier, answers }`. Only the body disagreed. Found by the Task 2 worker, which stopped rather than editing the test. | Body corrected to match the other three. `addResponse` still stores `free_text` and the column stays; only the read path narrowed. Free text is the most PII-sensitive column, so not carrying it by default is also the safer default. Plan patched at the source. |
| 4 | 2 | `listResponses` orders by `ORDER BY r.submitted_at, r.id` | `submitted_at` has millisecond precision so same-tier responses routinely tie, and `id` is `randomUUID()` — the tiebreak is a coin flip. Orchestrator probe over 300 trials: wrong order **157/300** with `id`, **0/300** with `rowid`. Not a test flake; the read path was non-deterministic. | Tiebreaker changed to `r.rowid`, which SQLite increments monotonically on insert (`responses` is a normal rowid table — no `WITHOUT ROWID` in `schema.sql`). Plan patched at the source. |
| — | 7 | *(latent, investigated at Task 7 — closed)* `getPrescription` uses `ORDER BY created_at DESC LIMIT 1` | Task 7 worker traced the call path: `getOrBuildPrescriptions` guards its writes with a prior read and contains **no `await`** between the read and the four writes, and `better-sqlite3` is a synchronous driver. Node's run-to-completion semantics therefore make the read-check-write sequence atomic within one process, so the tie can never be reached the way the `listResponses` one was. Verified independently at the gate. | **No change needed today.** The exposure is multi-process only (cluster/PM2/serverless), which nothing in plan 02 configures — `web:start` is a single process. If a later plan introduces multiple workers, add `UNIQUE(assessment_id, kind)` to `prescriptions` rather than a `rowid` tiebreak. `getArtifact` carries the same shape; re-check it if Task 8's writer is not similarly guarded. |
| 5 | 3 | `checkPassword` returns early when the two buffers differ in length | A wrong password of the wrong length then answers measurably faster than a wrong password of the right length, leaking the admin password's length through response timing. Caught by the orchestrator at the gate; the plan's literal code was correct-looking and every test passed. | Both sides hashed with SHA-256 first, so every comparison runs over 32 bytes. Plan patched at the source. |
| 6 | 4 | Global Constraints: "a closed assessment rejects new responses with **409**" | The survey endpoint uses **410 Gone** in four places — the API contract (L1028), both route handlers (L1137, L1145) and the client branches (L1190, L1214). 409 belongs to a different endpoint, closing a round. Caught by the orchestrator before dispatch. | Global Constraints corrected to 410, with a note on where 409 does belong. No code change. |
| 7 | 5 | `assess.test.ts` helper `answersFor(tier, scale, supp: number)` applies one scalar to every supp question, yet the test asserts `{H:90,P:10,D:0,I:0}` | The three supp questions feed different axes (OPS-06→P, DAT-06→D, TEC-06→I). Orchestrator ran both variants against the engine: uniform 0.33 gives `{H:70,P:10,D:10,I:10}` (shape illusion); per-axis `{P:0.33,D:0,I:0}` gives `{H:90,P:10,D:0,I:0}` (shape spear), which is the book example already golden-tested in `hpdi-engine`. Found by the Task 5 worker, which refused to edit the test. | The **helper** was wrong, not the expectation — the author plainly meant the web layer to reproduce the book case end to end. Helper now takes one coefficient per axis; every expected value untouched. Orchestrator overruled the plan's test and patched the plan at the source. |
| 8 | 5 | `maturity.ts` declares `export type Maturity`, and `index.ts` star-exports both it and `schema/intent.js` | `schema/intent.ts` already exports a `Maturity` const, so the two star re-exports collide: `tsc -b` fails with TS2308 and takes the CLI down with it, before `apps/web` is even reached. Found by the Task 5 worker. | `schema/intent.ts` gains `export type Maturity = z.infer<typeof Maturity>;` beside the const — the pairing it already uses for `Layer`, `TargetKind` and `ShapeName` — and `maturity.ts` imports that type instead of inventing one. Task 5's Files list extended to include `schema/intent.ts`. Plan patched at the source. |
| 9 | 3–5 | Gate ran `next build` only from Task 6 on; plan 02 assumes Turbopack can bundle the workspace packages and `apps/web`'s own relative `.js` imports | `next build` had in fact been broken since Task 3 and nobody noticed, because `npm test` and `tsc -b` both stayed green. Three independent causes: (a) the workspace packages are TS sources whose NodeNext `.js` specifiers Turbopack cannot rewrite, and it has no `extensionAlias` option; (b) `middleware.ts` imported `@/lib/auth`, dragging `node:crypto` into the Edge Runtime; (c) three files in `apps/web/src/lib` used relative `./x.js` imports while the rest of the app used the `@/` alias. | (a) `packages/*/package.json` `main`/`types` now point at `dist/`, with a root `prepare` running `tsc -b` so `npm ci` produces it — `main` no longer points at `src`, but the CLI and tests still run without a manual build, so BUILDING.md's promise holds. This brings forward the smallest possible slice of plan 08 Task 5. (b) `SESSION_COOKIE` and `isPublicPath` moved to a crypto-free `src/lib/session.ts`; `auth.ts` re-exports them so existing importers and the Task 3 test are untouched; `middleware.ts` imports from `@/lib/session`. (c) the three imports switched to `@/lib/...`, matching the rest of the app; `vitest.config.ts` gained the matching `@` alias, which it needs because it reads neither Next's resolver nor `apps/web/tsconfig.json`. **Gate corrected to run `next build` from Task 3 on.** |
| 10 | 8 | `getArtifact` reads `ORDER BY created_at DESC LIMIT 1`, and the kit `POST` writes an artifact row unconditionally | Unlike the prescriptions writer closed at Task 7, this one is **not** safe by construction: the handler awaits `req.json()` and `buildZip` (real async work — JSZip deflates) before `saveArtifact`, and `KitForm`'s button had no in-flight guard. A double click therefore produces two `para-kit` rows for one assessment, and `created_at` is millisecond-precision, so the subsequent read is the same coin flip as deviation 4. Found by the Task 8 worker; all three links verified independently at the gate. | Fixed at both ends: `getArtifact` gains a `rowid DESC` tiebreak so "latest" is deterministic even if duplicates exist, and `KitForm` disables its button while a build is in flight so the duplicate is not created in the first place. Plan patched at the source. |
| | | | | |
