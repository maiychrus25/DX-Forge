# DX-Forge Plan 05 — Provider `oss`, layers P/D/I (PostgreSQL, n8n, Appsmith, Metabase, Qdrant) and the end-to-end acceptance

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From a clean clone, `dxforge plan` + `dxforge apply --target oss` builds a complete DX-Lab for the `dx-ticket` pack on the compose target in ≤ 10 minutes, `dxforge verify` is 100 % green, a second `apply` is all `skip`, and `dxforge destroy --prune` leaves the target clean. Layers P (entity, form, state machine, rule, workflow, app), D (dashboard, snapshot, LOD context) and I (RAG source, agent policy, assistant) get real adapters.

**Architecture:** Same engine as plan 04; `packages/providers/oss` grows one module per system. Generators are pure functions (DDL from `process.entity`, PL/pgSQL from `process.rule`/`state_machine`, n8n workflow JSON from `process.workflow`/`data.snapshot`/`intel.*`, Appsmith app JSON from `process.form`/`process.app`, Metabase cards from `data.dashboard`) so they are unit-tested without a target; adapters only ship the generated artefact and read it back for verify. `pg` is the only new runtime dependency; every other system is reached over `fetch`.

**Tech Stack:** TypeScript, `pg` ^8, `fetch`, vitest; compose target `full` = core (plan 04) + n8n 1.x + Appsmith CE + Metabase + Qdrant (+ optional Ollama).

**Spec:** forge-core spec §3 (P/D/I mapping table), §4 (offboarding as a `process.workflow` on n8n), §5 (integration sequence); master spec §5 (oss automatic column), §7 acceptance (≤ 10 min, verify 100 %), SRS FR-A-03..08, FR-K-02.

**Plan series:** 01–04 → **05 this** → 06 wizard plan/apply → 07 gws → 08 manifest + packaging.

## Global Constraints

- Plans 01–04 Global Constraints still apply. Credentials JSON gains sections `postgres { host, port, database, user, password, schema: "biz" }`, `n8n { url, apiKey }`, `appsmith { url, email, password, workspaceId }`, `metabase { url, user, password }`, `qdrant { url, apiKey? }`, `embeddings { provider: "ollama"|"gemini", model, size }` (all optional, validated by `CredentialsSchema`).
- Generated SQL uses schema `biz`; table names come from `process.entity.spec.table` (already `^[a-z][a-z0-9_]*$`); every table gets `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`; `enum` fields become `text` with a `CHECK (col IN (...))`; `pii: true` columns get a `COMMENT ON COLUMN … IS 'pii'`.
- Idempotence: DDL is `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE … ADD COLUMN IF NOT EXISTS`; triggers are `CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`; n8n/Appsmith/Metabase objects are found by name before creation and their ids stored as `externalId`.
- n8n workflows are created **inactive**, then activated; credentials n8n needs (Postgres, Telegram, WebDAV basic auth, Qdrant, embeddings) are created through the n8n public API once per target (`n8n.credentials` adapter helper, ids cached in `state.entries["n8n.credentials"]`).
- Notifications from workflows go to the topic ids recorded in state by plan 04 (`h.topic.*` entries: Telegram `chatId` + `thread id`, Mattermost channel id); a workflow whose topic is missing from state fails apply with `AdapterError` naming the missing id.
- Verify is behavioural where cheap: insert a row through the form's constraints (a bad phone must be rejected by the Appsmith-side regex **and** by a DB `CHECK` when `pattern` is present), fire a workflow test run (`POST /api/v1/workflows/{id}/run` when available, otherwise the webhook test URL), read a Metabase card result, count Qdrant points ≥ 0 and collection size matches.
- Everything a target user sees (Appsmith labels, Metabase card names, n8n notification texts, trigger error messages) is Vietnamese and comes from the plan's specs, not hard-coded English.
- Contract tests run with `DXFORGE_CONTRACT=1` against `deploy/target-full.yml`; Appsmith is optional (`DXFORGE_CONTRACT_APPSMITH=1`) because its image is large.

---

## File structure

```
packages/providers/oss/src/
├── postgres/{ddl,triggers}.ts      pure generators
├── postgres/adapter.ts             process.entity, process.rule, process.state_machine
├── n8n/{client,builders}.ts        API client (+credentials helper), workflow JSON builders
├── n8n/adapter.ts                  process.workflow, data.snapshot, storage.audit_job, intel.agent_policy, intel.assistant, rag ingest
├── appsmith/{template.json,builder,adapter}.ts   process.form + process.app
├── metabase/{client,builder,adapter}.ts          data.dashboard (+ PII masking)
├── qdrant/adapter.ts               intel.rag_source (collection) — ingest workflow via n8n
├── lod/adapter.ts                  data.lod_context → context.jsonld on Nextcloud
└── index.ts                        ossProvider registers all adapters
packages/forge-core/src/planner/rules.ts   (modify) h.audit (storage.audit_job) and i.rag ingest dependency
deploy/target-full.yml, deploy/target-full.env.example
examples/intent.diamond.yaml                same org measured as diamond → all layers open
scripts/acceptance.sh                       plan → apply → verify → apply → destroy with timing
```

---

### Task 1: PostgreSQL generators — DDL, rule triggers, state-machine triggers

**Files:**
- Create: `packages/providers/oss/src/postgres/ddl.ts`, `packages/providers/oss/src/postgres/triggers.ts`
- Test: `packages/providers/oss/test/postgres-gen.test.ts`

**Interfaces:**
```ts
export function entityDdl(schema: string, spec: EntitySpecT): string[];          // ordered statements: CREATE SCHEMA IF NOT EXISTS, CREATE TABLE IF NOT EXISTS (id, created_at, updated_at only), ALTER TABLE ADD COLUMN IF NOT EXISTS per field, CHECK constraints (enum, required NOT NULL via ALTER … SET NOT NULL guarded), COMMENT pii, updated_at trigger
export function ruleTrigger(schema: string, table: string, rule: { name: string; when: string; require: string; message: string }): string[];   // function biz.<table>_<name>() RAISE EXCEPTION USING MESSAGE = <message> when (<when>) AND NOT (<require>); DROP TRIGGER IF EXISTS; CREATE TRIGGER BEFORE INSERT OR UPDATE
export function stateMachineTrigger(schema: string, table: string, sm: StateMachineSpecT): string[];   // table <table>_transitions(from_state, to_state, role) filled by INSERT … ON CONFLICT DO NOTHING; trigger rejecting status changes not in the table (Vietnamese message 'Chuyển trạng thái không hợp lệ: % → %')
export function dropEntity(schema: string, table: string): string[];
```
Column type map: text→`text`, int→`integer`, numeric→`numeric(14,2)`, bool→`boolean`, date→`date`, timestamp→`timestamptz`, enum→`text` + CHECK. Identifiers are validated against `^[a-z][a-z0-9_]*$` and quoted; any other input throws `InvalidIdentifier` (SQL injection guard for `when`/`require` is **not** attempted: those fragments come from packs/validator-checked plans, and the statement runs as the service user on schema `biz` only — documented in the adapter header).

- [ ] **Step 1: Failing tests** — snapshot the statements for the dx-ticket `cskh.entity` (10 columns, `priority`/`status` CHECKs, `customer_*` pii comments); `ruleTrigger` output contains `RAISE EXCEPTION` with the Vietnamese message and `WHEN ((NEW.status IN ('resolved','closed')) AND NOT (NEW.assignee IS NOT NULL))` semantics; `stateMachineTrigger` inserts the four transitions with the A role and its trigger references `OLD.status`/`NEW.status`; identifiers with a dash throw.
- [ ] **Step 2–4:** implement, run, commit `feat(provider-oss): PostgreSQL DDL and trigger generators`.

---

### Task 2: PostgreSQL adapter (`process.entity`, `process.rule`, `process.state_machine`)

**Files:**
- Create: `packages/providers/oss/src/postgres/adapter.ts`, `packages/providers/oss/src/postgres/client.ts`
- Modify: `packages/providers/oss/src/index.ts`, `packages/providers/oss/package.json` (dep `pg`, devDep `@types/pg`)
- Test: `packages/providers/oss/test/postgres-adapter.test.ts` (a fake `Client` recording `query(sql)`; contract test extended in Task 9)

**Interfaces:**
- `pgClient(creds)` → `{ query(sql, params?): Promise<{ rows }>, end() }` (thin wrapper around `pg.Client`, one connection per apply run cached in `ctx` via a `WeakMap<ApplyContext, Client>`).
- `processEntity` adapter: apply runs `entityDdl` statements in one transaction; `externalId = "biz.<table>"`; verify: `information_schema.columns` contains every field with the mapped type, `pg_constraint` has the enum CHECKs, pii comments present → one check per group; destroy: `dropEntity`.
- `processRule` / `processStateMachine`: resolve the table from the entity resource referenced by `spec.entity` through `ctx.state.entries[<entity id>].externalId`; apply runs the trigger statements; verify: `pg_trigger` has the trigger, plus a behavioural probe in a rolled-back transaction (`BEGIN; INSERT … status='resolved', assignee NULL` must raise; `ROLLBACK`); destroy drops trigger + function (+ transitions table).

- [ ] **Step 1–4:** tests (fake client asserts statement order and the rolled-back probe), implementation, commit `feat(provider-oss): PostgreSQL adapters for entity, rule and state machine`.

---

### Task 3: n8n client, credentials helper and workflow builders

**Files:**
- Create: `packages/providers/oss/src/n8n/client.ts`, `packages/providers/oss/src/n8n/builders.ts`
- Test: `packages/providers/oss/test/n8n-builders.test.ts`, `packages/providers/oss/test/n8n-client.test.ts`

**Interfaces:**
- `n8nClient(creds)`: `list(name)`, `create(workflow)`, `update(id, workflow)`, `activate(id)`, `deactivate(id)`, `remove(id)`, `get(id)`, `run(id)` (`POST /api/v1/workflows/{id}/run` when the instance supports it; otherwise `null`), `ensureCredential(type, name, data)` → id (`GET /api/v1/credentials?…` is not searchable in the public API → ids cached in `ctx.state.entries["n8n.credentials"].spec` keyed by name; create when absent).
- Builders return n8n workflow JSON (`{ name, nodes, connections, settings: { executionOrder: "v1" } }`):
  - `workflowFromProcess(spec, ctx)`: for `on: created` → **Postgres Trigger** node (`LISTEN` on a channel; the entity adapter installs `NOTIFY` triggers `biz.<table>_notify` in Task 2 — add that statement to `entityDdl`) → **Telegram** node (`sendMessage`, `chatId`, `additionalFields.message_thread_id` from the topic's state entry, text from `template` with `{code}` → `{{$json.code}}`) or **Mattermost** node; for `on: sla_breach` → **Schedule Trigger** hourly → **Postgres** node `SELECT … WHERE due_at < now() AND status NOT IN ('resolved','closed')` → **Telegram**; actions `update` → Postgres node `UPDATE … SET …`; `identity.disable`/`storage.transfer`/`comms.remove` (core offboarding) → **HTTP Request** nodes against Keycloak (disable user), Nextcloud (MOVE to ARCHIVES), Telegram (`banChatMember` + `unbanChatMember`) using n8n credentials created by the helper.
  - `snapshotWorkflow(spec, ctx)`: Schedule Trigger with `spec.schedule` cron → Postgres `SELECT *` → **Convert to File** (CSV) → HTTP Request `PUT` to Nextcloud WebDAV `<destination>/<table>/<yyyy-mm>.csv` (basic auth credential) → second branch builds JSON-LD (`Code` node using the `data.lod_context` from state) → PUT `.jsonld`.
  - `auditWorkflow(tree, ctx)`: nightly Schedule → HTTP Request PROPFIND depth infinity on the group folder → Code node checking names against the NAMING_CONVENTION regex (`^\d{4}-\d{2}-\d{2}_` or `^[A-Za-z]+_[A-Za-z0-9]+_`) inside RESOURCES → Telegram to `alerts` with the violation list.
  - `agentPolicyWorkflow(spec, ctx)`: **Telegram Trigger** (message + callback_query) → **Code** parse `/lenh <action> <args>` and check `spec.actions` whitelist → **Telegram** approval message with inline keyboard (approve/deny) to `approval_channel` thread → **Wait** node (resume on webhook, timeout `expire_hours`) → **IF** approved → **Postgres** execute (`<process>.assign` → `UPDATE … SET assignee`, `<process>.comment` → insert into `biz.<table>_comments` created by the entity adapter, `<process>.read` → SELECT) → Telegram reply; denied/expired → reply "Hết hạn duyệt".
  - `ragIngestWorkflow(spec, ctx)`: Schedule daily → HTTP Request PROPFIND on `spec.paths` → loop GET each `.md/.txt/.pdf` → **Default Data Loader** → **Embeddings Ollama/Google Gemini** (per `credentials.embeddings`) → **Qdrant Vector Store** insert into `spec.collection`.
  - `assistantWorkflow(spec, ctx)`: **Chat Trigger** (public) → **Question and Answer Chain** with Qdrant retriever (collection from the rag resource) and the chat model from `credentials.embeddings.provider` → system prompt = `spec.system_prompt`.
- Node type names and parameter shapes are captured from n8n 1.9x exports in `packages/providers/oss/src/n8n/nodes.ts` (typed constants); this file is the single place to adjust when a node version changes.

- [ ] **Step 1: Failing tests** — each builder's JSON: node count, trigger type, connections graph (every node reachable), Telegram node carries `message_thread_id` from state, cron matches spec, whitelist array embedded in the Code node, Wait timeout equals `expire_hours` hours; client: `create` → POST with `X-N8N-API-KEY`, `activate` → POST `/activate`, `ensureCredential` caches ids in state.
- [ ] **Step 2–4:** implement, commit `feat(provider-oss): n8n client and workflow builders for P, D and I resources`.

---

### Task 4: n8n adapter (`process.workflow`, `data.snapshot`, `storage.audit_job`, `intel.agent_policy`, `intel.assistant`) and planner additions

**Files:**
- Create: `packages/providers/oss/src/n8n/adapter.ts`
- Modify: `packages/forge-core/src/planner/rules.ts` (add `h.audit` = `storage.audit_job` depends `h.tree`, `h.topic.alerts`; `i.rag.resources` gains `depends_on: ["h.tree", "i.rag.ingest"]`? — no: add a second resource `i.rag.ingest` of type `intel.rag_ingest` depending on `i.rag.resources`), planner snapshot and tests (`33 → 35` resources), `packages/providers/oss/src/index.ts`
- Test: `packages/providers/oss/test/n8n-adapter.test.ts`

**Interfaces:** one adapter object per type, all sharing `n8nWorkflowAdapter(type, builder)`: apply → build JSON → `list(name)` → create or update → activate → `externalId = workflowId`; verify → `get(id)` active + a run when `run()` is supported (`sla_breach` and snapshot workflows run cleanly; `created` workflow verified by an INSERT into the entity inside a transaction that is committed then deleted, expecting one Telegram/Mattermost post read back via the topic's verify method); destroy → deactivate + delete. Workflow names are `dxforge:<resource id>` so lookup is exact.

- [ ] **Step 1–4:** tests with the fetch router (`GET /api/v1/workflows?name=` → `[]` then `POST`, then `POST …/activate`), planner tests updated (`35` resources; new ids `h.audit`, `i.rag.ingest`), implementation, commit `feat(provider-oss,core): n8n adapters and audit/ingest resources`.

---

### Task 5: Appsmith builder and adapter (`process.form`, `process.app`)

**Files:**
- Create: `packages/providers/oss/src/appsmith/template.json`, `packages/providers/oss/src/appsmith/builder.ts`, `packages/providers/oss/src/appsmith/adapter.ts`
- Test: `packages/providers/oss/test/appsmith.test.ts`

**Interfaces:**
- `template.json`: a minimal Appsmith application export (one page, a Form widget, a Table widget, two queries) captured from Appsmith CE 1.9x (assumption to confirm in Task 9; the builder only rewrites named nodes so a re-captured template keeps working).
- `buildApp(form: FormSpecT, app: AppSpecT | undefined, entity: { table; fields }, datasourceName)`: sets page name = process name, form widgets per field (`Input` with `regex` = `pattern`, `isRequired`, `Select` for `options`), Vietnamese labels from `label`, insert query `INSERT INTO biz.<table> (…) VALUES ({{Form.data.x}})`, list query `SELECT … FROM biz.<table> ORDER BY created_at DESC` with the row filter from `app.spec.security.row_filter` when present, Table columns from entity fields with PII columns hidden unless role ∈ `app.spec.security.roles`.
- Adapter: login `POST /api/v1/login` (cookie), ensure datasource (`GET /api/v1/datasources?workspaceId=` by name → `POST` Postgres datasource with the target's connection), `POST /api/v1/applications/import?workspaceId=` multipart with the JSON; `externalId = applicationId`; update = re-import over the same app (`applicationId` query param); verify: `GET /api/v1/applications/{id}` 200, page count 1, and a Postgres probe that a phone violating `pattern` is rejected at the DB `CHECK` (added by Task 1 when `pattern` exists on the form field); destroy: `DELETE /api/v1/applications/{id}`.

- [ ] **Step 1–4:** builder snapshot tests (widgets, regex, labels, queries), adapter router tests, commit `feat(provider-oss): Appsmith form and app import`.

---

### Task 6: Metabase adapter (`data.dashboard` with PII masking)

**Files:**
- Create: `packages/providers/oss/src/metabase/client.ts`, `packages/providers/oss/src/metabase/builder.ts`, `packages/providers/oss/src/metabase/adapter.ts`
- Test: `packages/providers/oss/test/metabase.test.ts`

**Interfaces:**
- `metabaseClient(creds)`: session (`POST /api/session`), `databaseId(name)` (create the Postgres database entry `dxlab` if absent, trigger `POST /api/database/{id}/sync_schema`), `tableId(schema, table)`, `fieldId(tableId, name)`, `card(name)`/`createCard`/`updateCard`, `dashboard(name)`/`createDashboard`/`setCards`, `setFieldVisibility(fieldId, "sensitive")`, `archiveCard`, `archiveDashboard`.
- `cardsFor(spec, table)`: `count_by_state` → native SQL grouped by `status` as a bar chart; `sla_breach` → scalar count overdue; `trend` → created per day line chart; card names = `spec.cards[].name` (Vietnamese).
- Adapter: apply → ensure database + sync → cards → dashboard with cards laid out 2 per row → masking: every `spec.masking` field set `visibility_type: sensitive`; `externalId = dashboardId`; verify: dashboard has `cards.length` cards, each card query returns 200 (`POST /api/card/{id}/query`), every masked field is `sensitive`; destroy: archive dashboard and cards.

- [ ] **Step 1–4:** router tests + builder snapshot, commit `feat(provider-oss): Metabase dashboards with sensitive PII fields`.

---

### Task 7: Qdrant, LOD context and RAG ingest/assistant wiring

**Files:**
- Create: `packages/providers/oss/src/qdrant/adapter.ts`, `packages/providers/oss/src/lod/adapter.ts`
- Modify: `packages/providers/oss/src/index.ts`
- Test: `packages/providers/oss/test/{qdrant,lod}.test.ts`

**Interfaces:**
- `intelRagSource`: `PUT /collections/{name}` with `vectors: { size: credentials.embeddings.size, distance: "Cosine" }` (409/`already exists` tolerated); `externalId = name`; verify `GET /collections/{name}` 200 and `points_count >= 0`; destroy `DELETE`.
- `intel.rag_ingest` and `intel.assistant` use the n8n adapter (Task 4) with `ragIngestWorkflow`/`assistantWorkflow`; the assistant's verify posts one question through the chat webhook (`POST /webhook/<path>`, `{ chatInput: "Kho tài nguyên có gì?" }`) and expects a 200 with a non-empty `output`.
- `dataLodContext`: writes `context.jsonld` (`{"@context": spec.context}`) to Nextcloud `3. [R] RESOURCES/40. ASSETS/41. Structured_Data/<table>/context.jsonld` (WebDAV, reusing plan 04's helper); `externalId = path`; verify PROPFIND 207; destroy DELETE.

- [ ] **Step 1–4:** tests, implementation, commit `feat(provider-oss): Qdrant collections, LOD context files, assistant wiring`.

---

### Task 8: Full target compose and the diamond example intent

**Files:**
- Create: `deploy/target-full.yml`, `deploy/target-full.env.example`, `examples/intent.diamond.yaml`
- Modify: `deploy/nextcloud-init.sh` (nothing new), `BUILDING.md`

- `target-full.yml` extends core with: `n8n` (`n8nio/n8n:1`, `N8N_PUBLIC_API_DISABLED=false`, `N8N_ENCRYPTION_KEY`, Postgres DB `n8n`), `appsmith` (`appsmith/appsmith-ce`, profile `appsmith`), `metabase` (`metabase/metabase`, Postgres DB `metabase`), `qdrant` (`qdrant/qdrant`), optional `ollama` (profile `ollama`, pulls `nomic-embed-text` and `qwen2.5:7b` in an init container). `deploy/pg-init.sql` creates databases `nextcloud`, `n8n`, `metabase`.
- `examples/intent.diamond.yaml`: the example organisation with `maturity.shape: diamond`, `hpdi {H:10,P:30,D:30,I:30}`, `dti_level: 5` → all four layers open (35 resources, 0 gated).

- [ ] **Step 1–2:** compose up locally (`docker compose --profile appsmith -f deploy/target-full.yml up -d --wait`), `dxforge plan -f examples/intent.diamond.yaml` shows 0 gated; commit `chore(deploy): full oss target compose and diamond example intent`.

---

### Task 9: Contract tests for P/D/I and the acceptance script

**Files:**
- Create: `packages/providers/oss/contract/full.contract.test.ts`, `scripts/acceptance.sh`
- Modify: `.github/workflows/ci.yml` (job `contract-full`, `if: github.ref == 'refs/heads/develop'`, services n8n/metabase/qdrant + postgres; Appsmith skipped in CI)

- `full.contract.test.ts`: plan from `intent.diamond.yaml` (Appsmith resources filtered out unless `DXFORGE_CONTRACT_APPSMITH=1`; Telegram resources filtered out unless `TELEGRAM_*` env present) → `applyPlan` → `verifyPlan.ok === true` → `applyPlan` again → every id in `skipped` → `destroyPlan` → `information_schema` has no `biz` tables, n8n has no `dxforge:` workflows, Qdrant has no collection.
- `scripts/acceptance.sh`: `time` of `npm ci && dxforge plan … && dxforge apply … && dxforge verify …` and fails if > 600 s or any verify item is red; used by plan 08's release checklist.
- This task is where every "assumption to confirm" from Tasks 3, 5, 6 is settled against real APIs; corrections go into `nodes.ts`, `template.json`, and the adapters' header comments, and the report lists each one.

- [ ] **Step 1–3:** run locally against the full compose, fix, run twice for idempotence, commit `test(provider-oss): full-target contract tests and acceptance script`.

---

### Task 10: Docs

- README roadmap 05 ✅; "Đích" table stays; new "Chạy DX-Lab đầy đủ" section (compose full + acceptance script); BUILDING credentials sections for each system; DEPENDENCIES adds `pg`; CHANGELOG; spec §3 patched with the final n8n node choices and the `h.audit`/`i.rag.ingest` resources; SRS FR-A-03..08 marked implemented with the verify probes listed.
- Commit `docs: document the full oss target and acceptance run`.

---

## Self-review

**Spec coverage:** §3 mapping table → Tasks 1–7 one-to-one (entity/rule/state machine → Postgres; form/app → Appsmith; workflow → n8n; dashboard → Metabase; snapshot → n8n + Nextcloud; lod_context → file on Nextcloud; rag_source → Qdrant + n8n ingest; agent_policy → n8n HITL; assistant → n8n chat); §4 offboarding as `core.offboarding.workflow` on n8n → Task 3 (`identity.disable`, `storage.transfer`, `comms.remove` actions) and verified by the workflow run in Task 4; `storage.audit_job` (plan 04 deferral) → Tasks 3–4; §5 integration sequence and master §7 ≤ 10 min → Task 9.

**Placeholder scan:** builders and adapters are specified by node/endpoint and by the exact verify probes; the two artefacts that must be captured from real software (`nodes.ts` node parameter shapes, Appsmith `template.json`) are named as capture steps with the version to capture from, and Task 9 is the confirmation step.

**Type consistency:** `EntitySpecT`/`FormSpecT`/`StateMachineSpecT`/`DashboardSpecT` are `z.infer` of the plan-01 spec schemas (export the inferred types from `schema/specs.ts` in Task 1); topic ids are read from `ctx.state.entries["h.topic.<purpose>"].externalId`, which plan 04's Telegram/Mattermost adapters write as `<chatId>:<threadId>` / `<channelId>`; the n8n credentials cache lives in a synthetic state entry `n8n.credentials` (layer H, spec = name → id) that `diffPlan` ignores because no plan resource has that id and prune only touches ids returned by the differ — add that exclusion explicitly in `applyPlan` (`STATE_INTERNAL_IDS = ["n8n.credentials"]`).
