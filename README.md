<p align="center">
  <img src="docs/brand/logo-256.png" width="120" alt="DX-Forge mark">
</p>

<h1 align="center">DX-Forge</h1>

<p align="center">
  A compiler for the Digital Enterprise Operating System (DX-OS).<br>
  Measure an organisation, interview it into an intent, compile a four-layer plan, apply it to a real target, verify, write the handbook.
</p>

<p align="center">
  <a href="https://github.com/maiychrus25/DX-Forge/actions/workflows/ci.yml"><img src="https://github.com/maiychrus25/DX-Forge/actions/workflows/ci.yml/badge.svg?branch=develop" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0--or--later-blue.svg" alt="AGPL-3.0-or-later"></a>
  <img src="https://img.shields.io/badge/node-%E2%89%A522-339933.svg" alt="Node 22+">
  <img src="https://img.shields.io/badge/status-alpha-orange.svg" alt="alpha">
</p>

---

## What it is

Most "digital transformation platforms" are something you install. DX-Forge is the thing that **generates what you install**.

It takes the methodology of the open book *Xây dựng Hệ điều hành Doanh nghiệp số: Từ Tư duy đến Hành động* (Tạ Tuấn Anh, CC BY 4.0)
and turns it into a pipeline:

```
measure ──► interview ──► plan ──► apply ──► verify ──► handbook ──► (measure again)
ResultV1    intent.yaml   plan.yaml  state.json  report     Resources/00. Portal
```

| Stage | What happens | Output |
|---|---|---|
| **measure** | Anonymous survey across three tiers (executive, manager, staff), six DTI pillars, three evidence questions. Scores are mapped to the book's **HPDI** model, classified into one of four radar shapes, and given a maturity level. | `ResultV1` |
| **interview** | An AI assistant (or a plain form) turns the result plus a short conversation into a small, human-readable intent: organisation, core processes, actors, channels, target. | `intent.yaml` (≤ 80 lines) |
| **plan** | The engine expands industry packs and rules into a plan of resources across four layers, **H**ạ tầng · **P**rocess · **D**ata · **I**ntelligence, each with a reason, dependencies, and a maturity gate. A validator that cannot be switched off enforces the book's guardrails. | `plan.yaml` |
| **apply** | A provider creates the resources on the chosen target, idempotently, with dry-run, resume, and prune. | `state.json` |
| **verify** | Every resource is checked against the live target: can staff log in, is RESOURCES read-only, does the form reject bad data, does the workflow notify. | report |
| **handbook** | The digital operating handbook is written from the plan and pushed into the target's portal. | markdown |

Targets:

- **oss**: Keycloak, Nextcloud, PostgreSQL, n8n, Appsmith, Metabase, Qdrant, Telegram or Mattermost
- **gws**: Google Drive, Sheets, Forms, Apps Script, Looker Studio, AppSheet (guided)
- **manifest**: a plugin manifest for platforms that consume one, so Forge sits above them rather than beside them

## Why a compiler and not a platform

- **The order is enforced, not suggested.**
  The maturity gate reads the measured shape and locks layers.
  A "spear" organisation (infrastructure only) gets H alone.
  An "illusion" organisation (dashboards without process) is denied the I layer, reason: *GIGO*.
- **Every resource explains itself.**
  `dxforge explain <id>` prints why it exists, what it depends on, and whether its gate is open.
- **Guardrails are code.**
  One accountable role per transition. At most five required fields per form.
  RESOURCES read-only for all staff. PII masked on every dashboard.
  Every agent policy has an approval channel and a 24-hour expiry. No dependency cycles.
  AI can propose; it cannot bypass the validator.
- **The output runs without Forge.**
  What Forge produces is a real DX-Lab on real open-source software.
  Forge itself is a CLI and a small wizard.

## Quick start

Requirements: Node 22+ and npm 10+. Nothing else for the `plan` stage.

```bash
git clone git@github.com:maiychrus25/DX-Forge.git && cd DX-Forge
npm ci
npm test                    # 104 tests: engine, core, CLI
npm run dxforge -- plan -f examples/intent.example.yaml -o plan.yaml
npm run dxforge -- explain i.policy.cskh -p plan.yaml
npm run dxforge -- packs list
```

The example intent describes a small retail company with one core process: customer requests, pack `dx-ticket`.
It was measured as *transitional* with P = 25.
The compiled plan holds 33 resources. The three Intelligence resources are present but gated:

```
[H] Hạ tầng (16)
  ✓ h.realm  identity.realm
  ✓ h.role.dx-admin  identity.role
  …
[I] Trí tuệ (3)
  ⛔ i.policy.cskh  intel.agent_policy  — transitional: lớp I mở khi hình dạng đạt diamond (H ≤ 25 và P, D, I ≥ 20), đúng trật tự P → D → I.
```

Exit codes: `0` plan written, `1` validator errors (nothing written), `2` bad input.

## Repository layout

```
packages/hpdi-engine/   questionnaire v1, scoring, HPDI mapping, shapes, prescriptions (pure TypeScript)
packages/forge-core/    zod schemas (intent, plan, state), pack loader, planner, validator, differ
packs/                  industry packs: core (offboarding), dx-ticket (customer requests)
apps/cli/               dxforge plan | packs list | explain
examples/               intent.example.yaml
docs/                   BRD, SRS, BA set with Excalidraw diagrams, specs, plans, brand
```

The engine depends on neither the web nor a database.
forge-core depends on no provider.
Providers, the AI layer, and the wizard are separate packages, added by the roadmap below.

## Roadmap

| Plan | Scope | Status |
|---|---|---|
| 01 | monorepo, hpdi-engine, forge-core, packs, CLI `plan` | **done**, `v0.1.0-alpha.1` |
| 02 | measurement wizard (Next.js, SQLite): survey links, radar, prescriptions, P.A.R.A kit | next |
| 03 | AI layer (Gemini / Anthropic / Ollama / none) for interview, plan patches, handbook, explain | |
| 04 | provider `oss`, layer H: Keycloak, Nextcloud, Telegram/Mattermost; apply, state, verify, destroy | |
| 05 | provider `oss`, layers P/D/I: PostgreSQL, n8n, Appsmith, Metabase, Qdrant | |
| 06 | wizard: plan tree, diff, apply progress, verify report | |
| 07 | provider `gws` | |
| 08 | manifest export, packaging (`npx dxforge`), v1.0.0 | |

## Documents

- [Business Requirements (BRD)](docs/BRD.md) · [Software Requirements (SRS)](docs/SRS.md)
- [BA document set](docs/ba/00-README.md): BPMN, swimlanes, state diagrams, use cases, activity diagrams, screens, permissions, NFR
- [Design specs](docs/superpowers/specs/) · [Implementation plans](docs/superpowers/plans/)
- [Building](BUILDING.md) · [Dependencies](DEPENDENCIES.md) · [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md) · [Rules for coding agents](AGENTS.md)

## Giới thiệu ngắn (tiếng Việt)

DX-Forge là **bộ biên dịch Hệ điều hành Doanh nghiệp số**.

- Đo tổ chức bằng khảo sát ba tầng, sáu trụ cột.
- Chuyển kết quả thành đặc tả `intent.yaml` qua phỏng vấn có AI hỗ trợ.
- Sinh kế hoạch bốn lớp H-P-D-I, mỗi tài nguyên có lý do và cổng trưởng thành.
- Cấp phát lên đích nguồn mở (Keycloak, Nextcloud, PostgreSQL, n8n, Appsmith, Metabase, Qdrant, Telegram) hoặc Google Workspace.
- Kiểm chứng trên hệ thống thật, rồi viết sổ tay nghiệp vụ số.

Forge không phải nền tảng vận hành. Thứ Forge sinh ra mới là DX-Lab chạy thật.

## License and attribution

- **Code:** [AGPL-3.0-or-later](LICENSE)
- **Methodology:** *Xây dựng Hệ điều hành Doanh nghiệp số* by Tạ Tuấn Anh, [CC BY 4.0](https://opendigitransform.gitbook.io/dx-os). Details in [LICENSE_NOTICE.md](LICENSE_NOTICE.md).
- **Third-party systems** that Forge targets are neither vendored nor modified. See [DEPENDENCIES.md](DEPENDENCIES.md).
