# DX-Forge Plan 06 — Wizard: plan tree, inline edit, dry-run diff, apply progress, verify report, handbook, packs, settings

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The whole pipeline runs from the browser: measure (plan 02) → interview (plan 03) → **plan** (tree by layer, reasons, gates, inline spec editing, validator errors) → **apply** (dry-run diff, live progress, resume) → **verify** (green/red by layer with evidence) → **handbook** (render, edit, push to the target) → packs library → settings. The wizard and the CLI share the same files under `.dxforge/` (`intent.yaml`, `plan.yaml`, `state.json`, reports), so either tool can continue what the other started.

**Architecture:** Next.js route handlers call forge-core directly (`compile`, `applyPlan`, `verifyPlan`, `destroyPlan`, `renderHandbook`) with the provider chosen from the plan's target and credentials from the environment. Long operations stream progress over Server-Sent Events. A test seam `DXFORGE_PROVIDER=fake` registers an in-memory provider so Playwright can exercise apply/verify without a target. UI follows `DESIGN.md`; every string in `i18n.vi.ts`.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, `yaml`, forge-core, provider-oss, Playwright.

**Spec:** master spec §6 (wizard: 7 screens + packs + settings; plan tree with reasons, inline edit, diff before apply, apply progress per resource, verify green/red), §2 (all stages from CLI and wizard, same library); SRS FR-W-01..06, FR-P-01..06 (UI side), FR-A-01..02, FR-H-01, FR-K-03; BA screens SC-04..SC-10 and swimlanes 02–04.

**Plan series:** 01–05 → **06 this** → 07 gws → 08 manifest + packaging.

## Global Constraints

- Plans 01–05 Global Constraints still apply (SPDX, English code, Vietnamese UI in `i18n.vi.ts`, DESIGN tokens, mobile 375 px no horizontal overflow, light/dark consistent, commit identity, no trailers, no credentials on disk or in the browser).
- Working files: `<dataDir>/intent.yaml`, `<dataDir>/plan.yaml`, `<dataDir>/state.json`, `<dataDir>/verify-report.{json,md}`, `<dataDir>/handbook.md`. The wizard never keeps a second copy in SQLite; it reads and writes these files through forge-core's loaders, so the CLI sees the same state.
- Credentials for apply/verify/destroy come only from the server's environment variable named by `intent.target.credentials_ref`; the settings screen shows the **name** and whether it is set, never the value; there is no input field for secrets.
- Long-running routes (`apply`, `verify`, `destroy`) stream `text/event-stream` with one JSON event per `ProgressEvent` and a final `{ type: "done" | "error", … }`; a second concurrent run of the same kind is refused with 409 (`Đang chạy, đợi xong.`), guarded by an in-process mutex per data dir.
- The plan tree edit writes `plan.yaml` only after a successful `PlanV1.parse`; the validator re-runs on every save and the errors panel updates; saving is refused when any Critical validator error exists (the same rule as the CLI: no plan file with errors).
- Gated resources are shown with the lock icon and the `why` text and cannot be un-gated from the UI (the gate is not editable).
- `DXFORGE_PROVIDER=fake` (test seam) is honoured only when `NODE_ENV !== "production"`.
- Every screen has an empty state that links to the previous stage (no intent → "Phỏng vấn trước"; no plan → "Sinh plan"; no state → "Apply trước").

---

## File structure

```
apps/web/src/lib/
├── files.ts          paths under dataDir; readIntent/writeIntent, readPlan/writePlan, readStateFile/writeStateFile, readReport
├── providers.ts      providerFor(kind, creds) (+ fake provider behind DXFORGE_PROVIDER=fake)
├── runs.ts           mutex per dataDir; sse() helper turning an async job with onProgress into a ReadableStream
└── i18n.vi.ts        (modify) plan/apply/verify/handbook/packs/settings strings
apps/web/src/app/api/
├── plan/route.ts             GET current plan+errors | POST compile from intent (body { ai?: boolean })
├── plan/resource/route.ts    PUT { id, spec, reason } → save + revalidate
├── apply/route.ts            POST { dryRun?, prune?, layers? } → SSE (dry-run returns JSON changes instead)
├── verify/route.ts           POST → SSE, then report saved
├── destroy/route.ts          POST { prune?, confirm: "xoa" } → SSE
├── handbook/route.ts         (plan 03; add) PUT { markdown } save, POST { push: true } → WebDAV/Drive push via provider portal adapter
├── packs/route.ts            GET list (id, name, version, scope, resources, description)
└── settings/route.ts         GET { target, credentialsRef, credentialsSet, llmProvider, dataDir, versions }
apps/web/src/app/{plan,apply,verify,handbook,packs,settings}/page.tsx
apps/web/src/components/{PlanTree,ResourceEditor,ValidatorPanel,DiffTable,RunLog,VerifyReport,HandbookEditor,PackCard,Stepper}.tsx
apps/web/e2e/pipeline.spec.ts
```

---

### Task 1: Working files, provider factory, fake provider, run mutex + SSE helper

**Files:**
- Create: `apps/web/src/lib/files.ts`, `apps/web/src/lib/providers.ts`, `apps/web/src/lib/runs.ts`
- Test: `apps/web/test/{files,runs}.test.ts`

**Interfaces:**
```ts
export const paths = (dataDir: string) => ({ intent, plan, state, verifyJson, verifyMd, handbook });
export function readIntent(dataDir): IntentV1 | null; export function writeIntent(dataDir, intent): void;
export function readPlan(dataDir): PlanV1 | null;     export function writePlan(dataDir, plan): void;
export function readStateFile(dataDir, target): StateV1; export function writeStateFile(dataDir, state): void;
export function readReport(dataDir): VerifyReport | null;
export function providerFor(kind: TargetKind, creds: Credentials): Provider;   // oss → ossProvider; gws → gwsProvider (plan 07, throws NotYetSupported until then); fake when DXFORGE_PROVIDER=fake && NODE_ENV!=="production"
export function fakeProvider(): Provider;   // every plan type; apply resolves after 30 ms with externalId "fake-<id>"; verify returns two ok checks, except when resource.spec.__fail === true → one failing check; destroy resolves
export async function withRunLock<T>(dataDir, kind: "apply"|"verify"|"destroy", job: () => Promise<T>): Promise<T>;   // throws RunInProgress
export function sse(job: (emit: (event: object) => void) => Promise<object>): Response;   // ReadableStream of `data: <json>\n\n`; final done/error event; heartbeat comment every 15 s
```

- [ ] **Step 1: Failing tests** — `files.test.ts` round-trips intent/plan/state in a temp dir and returns `null` for missing files; `runs.test.ts`: second `withRunLock` of the same kind while the first is pending throws `RunInProgress`, different kinds run concurrently; `sse` output contains the emitted events in order and ends with `done`.
- [ ] **Step 2–4:** implement, commit `feat(web): shared working files, provider factory with fake seam, run lock and SSE helper`.

---

### Task 2: Plan API and plan screen (tree by layer, reasons, gates, validator panel, inline editor)

**Files:**
- Create: `apps/web/src/app/api/plan/route.ts`, `apps/web/src/app/api/plan/resource/route.ts`, `apps/web/src/app/plan/page.tsx`, `apps/web/src/components/{Stepper,PlanTree,ResourceEditor,ValidatorPanel}.tsx`
- Modify: `apps/web/src/lib/i18n.vi.ts`, `apps/web/src/app/layout.tsx` (nav: Đo lường · Phỏng vấn · Plan · Apply · Verify · Sổ tay · Gói · Thiết lập)
- Test: `apps/web/test/plan-api.test.ts` (route handlers called directly with a temp data dir), Playwright in Task 7

**Behaviour:**
- `POST /api/plan { ai }` → `compile(intent, packs, { proposer: ai ? proposePatches(...) : undefined })` → writes `plan.yaml` when no errors; response `{ plan, errors, notes, written: boolean }`.
- `GET /api/plan` → `{ plan, errors }` (re-validated on read so hand edits via CLI show their errors).
- `PUT /api/plan/resource { id, spec, reason }` → replaces the resource (id/layer/type/gate/depends_on unchanged), re-validates, writes when clean, returns `{ errors, written }`.
- Screen: `Stepper` (6 stages with current highlighted, links to each page); left: `PlanTree` grouped by layer with counts, each row `✓/⛔ id · type · reason` (reason truncated, full on hover), gated rows greyed with the `why`; right: `ResourceEditor` = YAML textarea for `spec` (monospace, 12 px, `yaml.stringify` on load, `yaml.parse` on save with the parse error shown inline), `reason` input, Save button; bottom: `ValidatorPanel` listing `[rule] id: message` with a click that selects the resource; header buttons: "Sinh plan" (with an "AI đề xuất" checkbox when the provider is not `none`), "Xem dry-run" (goes to /apply), "Tải plan.yaml".

- [ ] **Step 1: Failing tests** — plan API: compile from the example intent writes `plan.yaml` (33 resources), PUT with a six-required-field form returns `max_required` and does not write, PUT with a valid change writes and `GET` reflects it; GET without intent → 404 `{ error: vi.plan.noIntent }`.
- [ ] **Step 2–4:** implement, commit `feat(web): plan screen with layer tree, validator panel and inline resource editor`.

---

### Task 3: Apply screen — dry-run diff table, live progress, resume, prune

**Files:**
- Create: `apps/web/src/app/api/apply/route.ts`, `apps/web/src/app/apply/page.tsx`, `apps/web/src/components/{DiffTable,RunLog}.tsx`
- Test: `apps/web/test/apply-api.test.ts` (fake provider)

**Behaviour:**
- `POST /api/apply { dryRun: true, layers? }` → JSON `{ changes, summary }` from `applyPlan(..., { dryRun: true })`.
- `POST /api/apply { prune?, layers? }` → SSE of `ProgressEvent`s; state written after success and after `ApplyError` (event `error` includes `resourceId` and the Vietnamese message; the page shows "Chạy tiếp" which re-POSTs).
- `DiffTable`: rows action/id/layer/type/diff-keys, coloured chips (create green, update amber, skip grey, gated locked, destroy red); "Áp dụng N thay đổi" button disabled until a dry-run was shown for the current plan checksum.
- `RunLog`: live list with spinner per resource, `✓`, `✗` and the failure message, elapsed time, final summary; when credentials are missing the page shows `vi.apply.noCredentials` with the env var name from `intent.target.credentials_ref`.

- [ ] **Step 1: Failing tests** — dry-run returns 30 creates + 3 gated for the example; a streamed apply with the fake provider ends with `done` and `state.json` holds 30 entries; a fake failure (`spec.__fail`) ends with `error` and a partial state; a second POST while running → 409.
- [ ] **Step 2–4:** implement, commit `feat(web): apply screen with dry-run diff and streamed progress`.

---

### Task 4: Verify screen — report by layer, evidence, re-run

**Files:**
- Create: `apps/web/src/app/api/verify/route.ts`, `apps/web/src/app/verify/page.tsx`, `apps/web/src/components/VerifyReport.tsx`
- Test: `apps/web/test/verify-api.test.ts`

**Behaviour:** `POST /api/verify` → SSE per resource (`start`/`done` with `ok`) then `done` with the `VerifyReport`; report saved as JSON + markdown; `GET /api/verify` returns the last report. Page: totals bar (passed/total, per-layer mini bars in axis colours), list grouped by layer with `✅/❌`, each failing item expanded showing checks and evidence text, "Chạy lại verify", "Tải báo cáo (.md)" link, and "Xem sổ tay" when all green.

- [ ] **Step 1–4:** tests with the fake provider (one `__fail` resource → report `ok=false`, `passed = total − 1`), implement, commit `feat(web): verify screen with per-layer report and evidence`.

---

### Task 5: Handbook screen — render, edit, AI polish, push to target

**Files:**
- Create: `apps/web/src/app/handbook/page.tsx`, `apps/web/src/components/HandbookEditor.tsx`
- Modify: `apps/web/src/app/api/handbook/route.ts` (plan 03: add `GET` saved, `PUT` save, `POST { push: true }`), `packages/providers/oss/src/nextcloud.ts` (export `putPortalFile(creds, path, content)` used by the push)

**Behaviour:** page renders `renderHandbook(plan, intent)` on first visit (or the saved `handbook.md`), a two-pane editor (markdown left, preview right using a tiny markdown-to-HTML renderer in `src/lib/markdown.ts`: headings, lists, tables, bold, code; no external dependency), buttons "Sinh lại từ plan", "Chỉnh bằng AI" (calls `polishHandbook`, shows fallback chip), "Lưu", "Đẩy lên đích" (PUT to `00. Portal/handbook/index.md` on the target through the provider; gws in plan 07). Push result shows the target URL when the adapter returns one.

- [ ] **Step 1–4:** tests for `markdown.ts` (tables and headings), handbook API save/push with the fake provider (push records `portal:handbook` in state), commit `feat(web): handbook editor with AI polish and push to target`.

---

### Task 6: Packs library and settings screens

**Files:**
- Create: `apps/web/src/app/api/packs/route.ts`, `apps/web/src/app/packs/page.tsx`, `apps/web/src/components/PackCard.tsx`, `apps/web/src/app/api/settings/route.ts`, `apps/web/src/app/settings/page.tsx`
- Modify: `apps/web/src/app/settings/ai/page.tsx` (link from settings), `apps/web/src/lib/i18n.vi.ts`

**Behaviour:** Packs: cards with id, name, version, scope, resource count and the resource type list, "Xem YAML" expander; the intent's `core_processes[].pack` values are marked "đang dùng". Settings: target kind (from intent), `credentials_ref` name + "đã đặt / chưa đặt" badge, LLM provider + model, data dir path, versions of engine/core/web, links to AI stats and to the CLI equivalents (`dxforge …` commands listed for each screen).

- [ ] **Step 1–4:** API tests (packs list equals `loadPacks`; settings never contains the credential value even when set), implement, commit `feat(web): packs library and settings screens`.

---

### Task 7: End-to-end pipeline test (fake provider), mobile checks, CI

**Files:**
- Create: `apps/web/e2e/pipeline.spec.ts`
- Modify: `apps/web/playwright.config.ts` (`DXFORGE_PROVIDER: "fake"`, `DXFORGE_OSS_CREDENTIALS: "{}"` in `webServer.env`), `.github/workflows/ci.yml` (e2e job unchanged, now covers this spec)

**Scenario (desktop + mobile projects):** login → measure round closed via API (reuse plan 02 helpers) → `/interview` scripted flow (6 answers) → intent saved → `/plan` "Sinh plan" → 33 rows, 3 locked, no validator errors → edit `cskh.form` to 6 required fields → error `max_required` shown, not saved → revert → `/apply` dry-run shows `create 30` → apply → log ends with `✓ 30` → `/verify` → all green → `/handbook` → push → `/packs` shows `dx-ticket` "đang dùng" → `/settings` shows `credentials_ref` set. Mobile: at 375 px every page has `scrollWidth === clientWidth`, the plan tree collapses to a list with an accordion editor, the run log is readable.

- [ ] **Step 1–3:** write the spec, run `npm run e2e` (both projects), commit `test(web): end-to-end pipeline on desktop and mobile with the fake provider`.

---

### Task 8: Docs and screenshots

- Capture screenshots (Playwright `page.screenshot`) of plan, apply, verify, handbook at 1440 px into `docs/screenshots/` (light and dark); README gets a "Giao diện" section with four images and roadmap 06 ✅; BA `docs/ba/07-screens.md` updated with the final field tables for SC-04..SC-10; CHANGELOG.
- Commit `docs: wizard screenshots and screen specs`.

---

## Self-review

**Spec coverage:** master §6 wizard list (đo lường ✔ plan 02, phỏng vấn ✔ plan 03, xem/sửa plan → Task 2, apply với diff và tiến trình → Task 3, verify xanh/đỏ theo lớp → Task 4, handbook → Task 5, thư viện gói + thiết lập → Task 6); "wizard chỉ là vỏ gọi cùng thư viện" → Task 1 (`files.ts` shares `.dxforge/` with the CLI); FR-H-01 push to `00. Portal/handbook/` → Task 5; FR-K-03 packs list → Task 6; stress on desktop and mobile → Task 7.

**Placeholder scan:** behaviours, endpoints, event shapes and test expectations are explicit; component markup is left to the implementer within `DESIGN.md` and the existing components from plan 02 (`Radar`, `CopyField`, cards, chips), which is the same level of detail plan 02's Task 6 used.

**Type consistency:** `ProgressEvent`, `Change`, `VerifyReport`, `ApplyError` come from plan 04's forge-core; the fake provider implements plan 04's `Provider`; `polishHandbook`/`proposePatches` come from plan 03; `putPortalFile` is the only new export required from provider-oss.
