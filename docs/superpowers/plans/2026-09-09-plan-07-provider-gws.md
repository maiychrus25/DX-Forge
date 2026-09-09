# DX-Forge Plan 07 — Provider `gws`: Google Drive, Sheets, Forms, Apps Script, Looker Studio, AppSheet guide

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `dxforge apply --target gws` builds the same plan on Google Workspace with a test account: Drive folder tree with permissions (H), Sheets tables with data validation and protected headers plus Forms with validation (P), Apps Script projects generated from workflows and deployed with triggers (P), Looker Studio linking URLs (D), an AppSheet configuration plus a step-by-step guide (P, semi-automatic), Telegram topics (H, reused). `verify` reads everything back through the same APIs.

**Architecture:** `packages/providers/gws` mirrors the oss provider: pure generators (Sheets batchUpdate requests, Forms batchUpdate requests, `Code.gs` source from workflow specs, Looker URLs, AppSheet JSON + guide markdown) and thin adapters over Google REST APIs using a service account JWT (`google-auth-library`) with optional domain-wide delegation, or an OAuth refresh token for personal accounts. State entries store Drive/Sheets/Forms/Script ids.

**Tech Stack:** TypeScript, `google-auth-library` ^9 (JWT/OAuth2 only; REST calls via `fetch`), vitest with a fetch router; a manual contract run against a real test Workspace account (no CI target).

**Spec:** master spec §5 gws row ("đúng 0 đồng của sách"); SRS FR-A-09 (tree/acl → Drive; entity → Sheets with validation and protected header; form → Forms with regex/required; workflow → Apps Script from template, create, deploy, trigger; dashboard → Looker Studio linking URL; app → appsheet-config.json + markdown guide; channel → Telegram; AC: with a test account apply creates folder/sheet/form/script and verify reads them back).

**Plan series:** 01–06 → **07 this** → 08 manifest + packaging.

## Global Constraints

- Plans 01–06 Global Constraints still apply. Credentials JSON gains `gws: { auth: { type: "service_account", clientEmail, privateKey, impersonate? } | { type: "oauth", clientId, clientSecret, refreshToken }, rootFolderId?, groups?: Record<string, string /* group email */>, shareWith?: string[] }` and reuses `telegram`.
- Scopes: `drive`, `spreadsheets`, `forms.body`, `script.projects`, `script.deployments`, `script.processes` (and `admin.directory.group.readonly` only if `groups` mapping is used with delegation). Tokens are fetched once per run and never logged; every error snippet is redacted of `Bearer …`.
- Naming on the target: root folder `[<SHORT_CODE>] DX-OS` under `rootFolderId` (or My Drive); each P.A.R.A branch is a folder; permissions: `all-staff` → `groups["all-staff"]` reader on RESOURCES, department groups writer on their AREAS folder, `dx-admin` group organizer on ARCHIVES; when no group email is mapped, the adapter records a check `⚠ nhóm chưa ánh xạ` in verify instead of failing apply.
- One spreadsheet per `process.entity` named `<table>` inside `2. [A] AREAS/<department>/Dữ liệu`, sheet `data` with header row = field names (protected range for row 1), data validation per field (enum → ONE_OF_LIST, int/numeric → NUMBER, date → DATE_IS_VALID, `pattern` → CUSTOM_FORMULA `=REGEXMATCH(TO_TEXT(A2);"<pattern>")`), a second sheet `transitions` for the state machine; `process.rule` becomes a conditional-format highlight + a note (Sheets cannot enforce cross-column rules; the Apps Script `onEdit` enforces them — generated in Task 5).
- One Google Form per `process.form`, linked to the entity spreadsheet as its response destination; required + regex validation per field; `external_entry` → "anyone with the link".
- Apps Script: one project per `process.workflow`, files `Code.gs` (generated), `appsscript.json` (time-based + form-submit triggers created by an `install()` function that the adapter runs through the Apps Script API `scripts.run` after deploying an API executable). The generated code sends Telegram messages via `UrlFetchApp`, writes updates back to the sheet, and enforces the state machine and rules in `onEdit`.
- Looker Studio: no write API; `data.dashboard` produces a Linking API URL prefilled with the spreadsheet connector and stores it as `externalId`; verify checks the spreadsheet is readable and the URL builds; masking is implemented as a hidden-column report sheet (`report` sheet without PII columns) that the Looker URL points at.
- AppSheet: `process.app` writes `appsheet-config.json` (tables, columns, views, security filter) and `HUONG_DAN_APPSHEET.md` into the department folder; verify confirms both files exist and the referenced sheet has the header row; there is no API to create the app.
- Contract run is manual (`npm run contract:gws` with a real test account, documented), not in CI.

---

## File structure

```
packages/providers/gws/
├── package.json  tsconfig.json  src/index.ts  (gwsProvider)
├── src/auth.ts               accessToken(creds) via google-auth-library (JWT with subject or OAuth2 refresh)
├── src/http.ts               gapi(url, init) with bearer + redaction (reuse pattern from oss/http.ts)
├── src/drive.ts              storage.tree, storage.acl, portal.site, data.lod_context
├── src/sheets/{builder,adapter}.ts   process.entity, process.state_machine, process.rule (validation + notes)
├── src/forms/{builder,adapter}.ts    process.form
├── src/script/{codegen,adapter}.ts   process.workflow, data.snapshot (time trigger → CSV export to Drive), intel.agent_policy (Telegram webhook → approval)
├── src/looker.ts             data.dashboard
├── src/appsheet/{builder,adapter}.ts process.app
├── src/telegram.ts           re-export of the oss adapters for comms.channel/topic
└── test/*.test.ts, contract/gws.contract.test.ts
```

---

### Task 1: Package, auth, HTTP helper, Drive tree/ACL/portal adapters
- `auth.ts`: `accessToken(creds.gws.auth, scopes)`; service account → `JWT({ email, key, scopes, subject: impersonate })`; oauth → `OAuth2Client` with refresh token; cached per run.
- Drive: `files.list` by `name` + `'<parent>' in parents` + `mimeType = folder` (idempotent), `files.create`, `permissions.create` (`type: group|user|anyone`, `role: reader|writer|organizer|fileOrganizer`), `files.update` (rename), `files.delete`; README files as Google Docs? → plain `text/markdown` files uploaded with multipart.
- Tests: router asserting query strings, multipart bodies, permission roles per ACL mode; missing group mapping → warning check.
- Commit `feat(provider-gws): auth, Drive tree, ACL and portal adapters`.

### Task 2: Sheets builder and adapter (`process.entity`, `process.state_machine`)
- Builder: `spreadsheetRequests(entity, sm?)` → `batchUpdate` requests: `updateSheetProperties`, `appendCells` header, `addProtectedRange` (warningOnly false, editors = admin), `setDataValidation` per column, `addSheet transitions` with rows, `repeatCell` header bold.
- Adapter: find spreadsheet by name in the department folder (`files.list`), else `spreadsheets.create` + `files.update` move to folder; apply requests; `externalId = spreadsheetId`; verify: `spreadsheets.get(includeGridData for row 1)` header equals fields, `protectedRanges` non-empty, validation present on the enum column; destroy: `files.delete`.
- Tests: snapshot of requests for `cskh.entity`; adapter router.
- Commit `feat(provider-gws): Sheets tables with validation and protected headers`.

### Task 3: Forms builder and adapter (`process.form`)
- Builder: `forms.create` body + `batchUpdate` `createItem` per field (text with `textQuestion`, `choiceQuestion` for options, `required`), validation via `textQuestion.validation`? (Forms API supports `TextQuestion` without regex; regex validation is only in the UI) → **ruling**: regex is enforced by the linked sheet's data validation and the Apps Script `onFormSubmit` (rejects and notifies); the form gets `description` text stating the format; note recorded in the adapter header and in verify evidence.
- Adapter: create form, set `responderUri` sharing (`external_entry` → anyone with link via Drive permission), link responses to the entity spreadsheet (`forms` API does not link; the Apps Script `onFormSubmit` appends the row — Task 5); `externalId = formId`; verify `forms.get` items count equals fields; destroy `files.delete`.
- Commit `feat(provider-gws): Google Forms from process.form`.

### Task 4: Apps Script code generation
- `codegen.ts`: `generateCode(workflow, entity, sm, rule, topics, sheetId)` → `Code.gs` string with functions `onFormSubmit(e)` (append row with generated code, notify Telegram `created` template), `checkSla()` (time trigger hourly, overdue rows → Telegram `sla_breach`), `onEdit(e)` (state machine + rule enforcement: revert the edit and show a toast in Vietnamese), `install()` creating the triggers idempotently, `snapshotMonthly()` for `data.snapshot` (CSV to the Drive destination folder), `agentWebhook(e)` for `intel.agent_policy` (Telegram webhook → whitelist → approval message → callback → sheet update). Secrets (bot token) are read from Script Properties set by the adapter, never embedded in code.
- Tests: generated code contains the functions, the templates interpolate `{code}` → `row.code`, regex pattern escaped correctly, no token literal.
- Commit `feat(provider-gws): Apps Script code generation for workflows, rules and agent policy`.

### Task 5: Apps Script adapter (create project, push files, deploy, install triggers)
- `script.projects.create` (parentId = spreadsheet id so the script is bound), `projects.updateContent` (`Code.gs`, `appsscript.json` with `timeZone: Asia/Ho_Chi_Minh`, `executionApi.access: MYSELF`), `projects.deployments.create` (API executable), `scripts.run` `install` (requires the caller's OAuth client on the same GCP project — documented prerequisite; with a service account this step is reported as a manual check `⚠ chạy install() thủ công`), set `TELEGRAM_BOT_TOKEN` via `PropertiesService` inside `install()` reading from a one-time parameter passed to `scripts.run`.
- verify: `projects.get` + `projects.getContent` contains the generated functions, `processes.list` shows the trigger installs when run; destroy: `files.delete` of the script project.
- Commit `feat(provider-gws): Apps Script project deployment and trigger installation`.

### Task 6: Looker Studio linking and AppSheet guide
- `looker.ts`: build `https://lookerstudio.google.com/reporting/create?c.reportId=<template?>&r.reportName=<name>&ds.connector=googleSheets&ds.spreadsheetId=<id>&ds.worksheetId=<report gid>&ds.hasHeader=true`; the `report` sheet is added to the entity spreadsheet without PII columns (masking); `externalId = url`; verify: sheet exists, URL parses.
- `appsheet/builder.ts`: `appsheet-config.json` (`tables[{name, sheetId, keyColumn:"id", columns:[{name,type,required,showIf}] }], views: [list, detail, board by status], securityFilter: row_filter`), `HUONG_DAN_APPSHEET.md` (numbered steps in Vietnamese: create app from the sheet, import config, set security filter, publish); adapter writes both files to the department folder; verify: both exist and the sheet header matches.
- Commit `feat(provider-gws): Looker Studio linking URL and AppSheet configuration guide`.

### Task 7: Provider assembly, CLI/wizard wiring, manual contract run
- `gwsProvider(creds)` registers all adapters (comms reused from oss); `providerFor("gws")` in CLI and wizard; `examples/intent.gws.yaml` (target gws, `credentials_ref: DXFORGE_GWS_CREDENTIALS`).
- `packages/providers/gws/contract/gws.contract.test.ts` + `contract/README.md` (how to create the service account or OAuth client, which APIs to enable, how to obtain a refresh token with a 20-line script `scripts/gws-oauth.ts`); acceptance: apply H+P+D on the test account → verify all green except the documented manual checks → destroy.
- Commit `feat(provider-gws): provider assembly, CLI and wizard support, contract run guide`.

### Task 8: Docs
- README targets table row gws "✅ tự động" for Drive/Sheets/Forms/Script/Looker, "bán tự động" AppSheet; BUILDING gws credentials; DEPENDENCIES adds `google-auth-library`; CHANGELOG; SRS FR-A-09 notes (Forms regex ruling, scripts.run prerequisite).
- Commit `docs: document the Google Workspace target`.

---

## Self-review

**Spec coverage:** FR-A-09 items map to Tasks 1 (tree/acl → Drive), 2 (entity → Sheets validation + protected header), 3 (form → Forms), 4–5 (workflow → Apps Script create/deploy/trigger), 6 (dashboard → Looker URL; app → AppSheet config + guide), 7 (channel → Telegram, acceptance with a test account). Two API limits are turned into explicit rulings with verify evidence (Forms regex; `scripts.run` with a service account).

**Placeholder scan:** each task names the Google endpoints, request shapes at the field level that matter for tests, and the verify probes; codegen output is specified by function list and behaviour.

**Type consistency:** adapters implement plan 04's `Adapter`; state ids per system are Drive file ids / spreadsheet ids / form ids / script ids / a URL, all strings; `credentials.gws` is validated in `CredentialsSchema` (extend in Task 1).
