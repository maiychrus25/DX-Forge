# DX-Forge Plan 04 — Apply engine and provider `oss`, layer H (Keycloak, Nextcloud, Telegram/Mattermost)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `dxforge apply plan.yaml --target oss` creates the H layer of a plan on a real open-source stack (Keycloak realm/roles/groups, Nextcloud P.A.R.A tree and ACL, portal files, Telegram or Mattermost channel/topics), records `state.json`, is idempotent (second run all `skip`), resumes after a failure, prunes with `--prune`, and `dxforge verify` proves each resource on the live target with a green/red report. `dxforge destroy --prune` removes everything it created.

**Architecture:** forge-core gains the provider-neutral engine: `Adapter`/`Provider` interfaces, state file I/O, `applyPlan`, `verifyPlan`, `destroyPlan`, report rendering, and credentials loading from one environment variable. `packages/providers/oss` implements one adapter per resource type using `fetch` only (Keycloak Admin REST, Nextcloud OCS + WebDAV, Telegram Bot API, Mattermost API v4). Every adapter is tested with stubbed `fetch`; a contract test suite runs against a Docker compose target (`deploy/target-core.yml`) when `DXFORGE_CONTRACT=1`.

**Tech Stack:** TypeScript, zod, `fetch`, vitest; Docker compose with Keycloak 26, Nextcloud 31 (+ groupfolders), PostgreSQL 16 for contract tests.

**Spec:** forge-core spec §1.1 (StateV1), §1.4 (apply, state, diff, resume, prune), §1.5 (verify, report), §2 (provider oss layer H table), §5 (tests). Master spec §4 (`Provider` interface: plan/apply/verify/destroy), §5 targets, §7 acceptance ("apply --target oss dựng được DX-Lab … verify 100 % xanh").

**Plan series:** 01 done → 02 wizard → 03 AI → **04 this** → 05 oss P/D/I → 06 wizard plan/apply → 07 gws → 08 manifest + packaging.

## Global Constraints

- Plans 01–03 Global Constraints still apply (SPDX, English code, Vietnamese operator strings, commit identity, no trailers, no credentials on disk, validator untouched).
- **Credentials** come from the environment variable named by `intent.target.credentials_ref` (default `DXFORGE_OSS_CREDENTIALS`) as a JSON object:
  ```json
  { "keycloak": { "url": "https://kc.example.org", "admin": "admin", "password": "…" },
    "nextcloud": { "url": "https://nc.example.org", "user": "admin", "password": "…", "staffUser": "staff.test", "staffPassword": "…" },
    "telegram": { "botToken": "…", "chatId": "-100123" },
    "mattermost": { "url": "https://mm.example.org", "token": "…", "teamId": "…" } }
  ```
  Parsed with zod (`CredentialsSchema`); every section optional; an adapter that needs a missing section fails its resource with `MissingCredentials("keycloak")`. Credential values never appear in state, reports, logs or error messages (errors carry status + a 200-char body snippet with the token redacted).
- **StateV1 gains** `layer: Layer` and `spec: Record<string, unknown>` per entry (so `--dry-run` shows a real diff and prune destroys in reverse layer order). `StateV1.version` stays `1`; entries without the two fields are accepted and treated as `layer: "H"`, `spec: {}` (older files).
- **Apply order** = `topoSort` from plan 01; **destroy/prune order** = reverse of apply order, computed from state entries' `layer` then their insertion order.
- **Resume:** on the first adapter failure `applyPlan` writes the state so far, then throws `ApplyError { resourceId, cause }`. Re-running continues: done resources `skip`, the failed one retries.
- **Dry-run** never calls an adapter and never writes state.
- Each adapter is idempotent by lookup: it searches the target for the object (by name/path/mountpoint) before creating, and stores the target's id as `externalId`. `update` re-applies the spec and keeps the id.
- Naming on the target: Keycloak realm `dxlab`; groups `/departments/<code>` (child of a parent group `departments`) with attribute `code`; Nextcloud group ids `all-staff`, `dx-admin`, `dept-<code>` (plan resources say `departments/<code>` — the adapter maps `departments/<x>` → `dept-<x>`); group folder mount point `[<SHORT_CODE>] DX-OS` from `storage.tree.spec.root`; Telegram forum topics named `spec.name`; Mattermost channel names slugified from `spec.name`.
- Reports: `verify` writes `<dataDir>/verify-report.json` (`VerifyReport`) and `<dataDir>/verify-report.md`; exit 0 when every check passes, 1 otherwise.
- CLI defaults: state file `.dxforge/state.json`; `--target` defaults to `plan.target`.
- Unit tests must not touch the network (stubbed `fetch`); contract tests live in `packages/providers/oss/contract/` and are skipped unless `DXFORGE_CONTRACT=1`.

---

## File structure

```
packages/forge-core/src/
├── provider.ts        Adapter, Provider, ApplyContext, Check (re-export), MissingCredentials, AdapterError
├── credentials.ts     CredentialsSchema, loadCredentials(ref, env)
├── state.ts           readState(path, target), writeState(path, state), entryFor()
├── apply.ts           applyPlan(), ApplyError, ApplyResult, renderDryRun()
├── verify.ts          verifyPlan(), VerifyReport, renderVerifyReport()
├── destroy.ts         destroyPlan()
└── differ.ts          (modify) before from state.spec; gated handling unchanged
packages/providers/oss/
├── package.json  tsconfig.json
├── src/index.ts               ossProvider(creds): Provider
├── src/http.ts                json(), text(), basicAuth(), bearer(), redact(), HttpError
├── src/keycloak.ts            identity.realm / identity.role / identity.group
├── src/nextcloud.ts           storage.tree / storage.acl / portal.site
├── src/telegram.ts            comms.channel / comms.topic (telegram)
├── src/mattermost.ts          comms.channel / comms.topic (mattermost)
├── test/{keycloak,nextcloud,telegram,mattermost,provider}.test.ts
└── contract/{core.contract.test.ts, README.md}
apps/cli/src/commands/{apply,verify,destroy}.ts   (+ index.ts registration)
deploy/target-core.yml, deploy/target-core.env.example, deploy/nextcloud-init.sh
```

---

### Task 1: Provider interfaces, credentials, state file, richer StateEntry

**Files:**
- Create: `packages/forge-core/src/provider.ts`, `packages/forge-core/src/credentials.ts`, `packages/forge-core/src/state.ts`
- Modify: `packages/forge-core/src/schema/state.ts` (add `layer`, `spec`), `packages/forge-core/src/differ.ts` (`before` from state), `packages/forge-core/src/index.ts`
- Test: `packages/forge-core/test/{credentials,state}.test.ts`; update `differ.test.ts` (`before` now defined after an update)

**Interfaces:**
```ts
export type ApplyContext = { target: TargetKind; credentials: Credentials; state: StateV1; log: (line: string) => void; now: () => Date };
export interface Adapter {
  readonly type: string;
  apply(ctx: ApplyContext, resource: Resource, previous?: StateEntry): Promise<{ externalId: string }>;
  verify(ctx: ApplyContext, resource: Resource, entry: StateEntry): Promise<Check[]>;
  destroy(ctx: ApplyContext, resource: Resource, entry: StateEntry): Promise<void>;
}
export interface Provider { readonly name: TargetKind; readonly adapters: Record<string, Adapter>; }
export class MissingCredentials extends Error { constructor(section: string) }
export class AdapterError extends Error { constructor(public readonly resourceId: string, message: string, public readonly status?: number) }
export const CredentialsSchema = z.object({ keycloak: …optional, nextcloud: …optional, telegram: …optional, mattermost: …optional }).passthrough();
export type Credentials = z.infer<typeof CredentialsSchema>;
export function loadCredentials(ref: string, env = process.env): Credentials;   // throws CredentialsError with a Vietnamese operator message; never echoes the value
export function readState(path: string, target: TargetKind): StateV1;           // missing file → emptyState(target); wrong target → StateTargetMismatch
export function writeState(path: string, state: StateV1): void;                 // mkdir -p, atomic rename, mode 0600
export function entryFor(resource: Resource, externalId: string, now: Date): StateEntry;  // checksum = resourceChecksum, layer, spec copy
```

- [ ] **Step 1: Failing tests**

`packages/forge-core/test/credentials.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { CredentialsError, loadCredentials } from "../src/credentials.js";

describe("loadCredentials", () => {
  it("parses the JSON in the named env var and accepts partial sections", () => {
    const c = loadCredentials("X", { X: JSON.stringify({ keycloak: { url: "https://kc", admin: "a", password: "p" }, telegram: { botToken: "t", chatId: "-1" } }) });
    expect(c.keycloak?.url).toBe("https://kc");
    expect(c.nextcloud).toBeUndefined();
  });
  it("fails clearly when the variable is missing or not JSON, without echoing the value", () => {
    expect(() => loadCredentials("X", {})).toThrow(CredentialsError);
    expect(() => loadCredentials("X", {})).toThrow(/biến môi trường X/);
    try { loadCredentials("X", { X: "secret-not-json" }); } catch (e) { expect((e as Error).message).not.toContain("secret-not-json"); }
    expect(() => loadCredentials("X", { X: JSON.stringify({ keycloak: { url: "not a url" } }) })).toThrow(CredentialsError);
  });
});
```

`packages/forge-core/test/state.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { entryFor, readState, StateTargetMismatch, writeState } from "../src/state.js";
import type { Resource } from "../src/schema/plan.js";

const r: Resource = { id: "h.realm", layer: "H", type: "identity.realm", spec: { realm: "dxlab" }, reason: "x", depends_on: [], gate: { allowed: true } };

describe("state file", () => {
  it("returns an empty state for a missing file and round-trips entries with layer and spec", () => {
    const dir = mkdtempSync(join(tmpdir(), "dxf-"));
    const path = join(dir, "state.json");
    const s = readState(path, "oss");
    expect(s).toEqual({ version: 1, target: "oss", entries: {} });
    s.entries["h.realm"] = entryFor(r, "dxlab", new Date("2026-09-10T00:00:00Z"));
    writeState(path, s);
    expect(readState(path, "oss").entries["h.realm"]).toMatchObject({ externalId: "dxlab", layer: "H", spec: { realm: "dxlab" }, appliedAt: "2026-09-10T00:00:00.000Z" });
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(readFileSync(path, "utf8")).not.toContain("password");
  });
  it("refuses a state written for another target and tolerates old entries without layer/spec", () => {
    const dir = mkdtempSync(join(tmpdir(), "dxf-"));
    const path = join(dir, "state.json");
    writeState(path, { version: 1, target: "gws", entries: {} });
    expect(() => readState(path, "oss")).toThrow(StateTargetMismatch);
    writeState(path, { version: 1, target: "oss", entries: { old: { externalId: "e", checksum: "0".repeat(64), appliedAt: "2026-01-01T00:00:00.000Z" } as never } });
    expect(readState(path, "oss").entries.old).toMatchObject({ layer: "H", spec: {} });
  });
});
```

`differ.test.ts` change: in "same checksum → skip; changed spec → update with before/after", the state built by `stateFor` now carries `spec` (use `entryFor`), and the assertion becomes `expect(byId["h.role.staff"].before).toEqual({ name: "staff" })` after mutating the checksum only.

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement**

`packages/forge-core/src/schema/state.ts` — `StateEntry` gains `layer: Layer.default("H")` and `spec: z.record(z.string(), z.unknown()).default({})`.

`packages/forge-core/src/credentials.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";

export const CredentialsSchema = z.object({
  keycloak: z.object({ url: z.string().url(), admin: z.string().min(1), password: z.string().min(1), realmAdminClient: z.string().default("admin-cli") }).optional(),
  nextcloud: z.object({ url: z.string().url(), user: z.string().min(1), password: z.string().min(1), staffUser: z.string().optional(), staffPassword: z.string().optional() }).optional(),
  telegram: z.object({ botToken: z.string().min(1), chatId: z.string().min(1) }).optional(),
  mattermost: z.object({ url: z.string().url(), token: z.string().min(1), teamId: z.string().min(1) }).optional(),
}).passthrough();
export type Credentials = z.infer<typeof CredentialsSchema>;

export class CredentialsError extends Error { constructor(message: string) { super(message); this.name = "CredentialsError"; } }

/** Reads and validates the JSON credentials held in the environment variable `ref`. The value is never included in errors. */
export function loadCredentials(ref: string, env: Record<string, string | undefined> = process.env): Credentials {
  const raw = env[ref];
  if (!raw) throw new CredentialsError(`Thiếu biến môi trường ${ref} chứa thông tin đăng nhập đích (JSON).`);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new CredentialsError(`Biến môi trường ${ref} không phải JSON hợp lệ.`); }
  const res = CredentialsSchema.safeParse(parsed);
  if (!res.success) throw new CredentialsError(`Thông tin đăng nhập trong ${ref} sai cấu trúc: ${res.error.issues.map((i) => i.path.join(".")).join(", ")}.`);
  return res.data;
}
```

`packages/forge-core/src/provider.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Credentials } from "./credentials.js";
import type { TargetKind } from "./schema/intent.js";
import type { Resource } from "./schema/plan.js";
import type { Check, StateEntry, StateV1 } from "./schema/state.js";

export type ApplyContext = { target: TargetKind; credentials: Credentials; state: StateV1; log: (line: string) => void; now: () => Date };

export interface Adapter {
  readonly type: string;
  apply(ctx: ApplyContext, resource: Resource, previous?: StateEntry): Promise<{ externalId: string }>;
  verify(ctx: ApplyContext, resource: Resource, entry: StateEntry): Promise<Check[]>;
  destroy(ctx: ApplyContext, resource: Resource, entry: StateEntry): Promise<void>;
}

export interface Provider { readonly name: TargetKind; readonly adapters: Record<string, Adapter>; }

export class MissingCredentials extends Error {
  constructor(public readonly section: string) { super(`Thiếu thông tin đăng nhập cho ${section} trong credentials.`); this.name = "MissingCredentials"; }
}
export class AdapterError extends Error {
  constructor(public readonly resourceId: string, message: string, public readonly status?: number) { super(message); this.name = "AdapterError"; }
}
export type { Check };
```

`packages/forge-core/src/state.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { resourceChecksum } from "./differ.js";
import type { TargetKind } from "./schema/intent.js";
import type { Resource } from "./schema/plan.js";
import { emptyState, StateV1, type StateEntry } from "./schema/state.js";

export class StateTargetMismatch extends Error {
  constructor(expected: string, found: string) { super(`state.json thuộc đích ${found}, không phải ${expected}. Dùng --state khác hoặc destroy trước.`); this.name = "StateTargetMismatch"; }
}

export function readState(path: string, target: TargetKind): StateV1 {
  if (!existsSync(path)) return emptyState(target);
  const s = StateV1.parse(JSON.parse(readFileSync(path, "utf8")));
  if (s.target !== target) throw new StateTargetMismatch(target, s.target);
  return s;
}

export function writeState(path: string, state: StateV1): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(StateV1.parse(state), null, 2), { mode: 0o600 });
  renameSync(tmp, path);
}

export function entryFor(resource: Resource, externalId: string, now: Date): StateEntry {
  return { externalId, checksum: resourceChecksum(resource), appliedAt: now.toISOString(), layer: resource.layer, spec: structuredClone(resource.spec) };
}
```

`differ.ts`: in the `update` branch set `before: entry.spec`. Export the three new modules from `index.ts`.

- [ ] **Step 4: Run all forge-core tests, typecheck, commit**

```bash
npx vitest run packages/forge-core && npm run typecheck
git add packages/forge-core && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(core): provider interfaces, credentials loading and state file with layer and spec"
```

---

### Task 2: `applyPlan` — dry-run, create/update/skip, resume after failure, prune

**Files:**
- Create: `packages/forge-core/src/apply.ts`
- Modify: `packages/forge-core/src/index.ts`
- Test: `packages/forge-core/test/apply.test.ts` (uses an in-memory fake provider that records calls and can fail on demand)

**Interfaces:**
```ts
export type ApplyOptions = { dryRun?: boolean; prune?: boolean; onProgress?: (e: ProgressEvent) => void; now?: () => Date; log?: (line: string) => void };
export type ProgressEvent = { id: string; action: ChangeAction; status: "start" | "done" | "failed" | "skipped"; message?: string };
export type ApplyResult = { state: StateV1; changes: Change[]; applied: string[]; skipped: string[]; destroyed: string[]; gated: string[] };
export class ApplyError extends Error { resourceId: string; state: StateV1; cause: unknown }
export async function applyPlan(plan: PlanV1, provider: Provider, credentials: Credentials, state: StateV1, opts?: ApplyOptions): Promise<ApplyResult>;
export function renderDryRun(changes: Change[]): string;   // table: action | id | layer | type | diff summary (added/removed/changed keys)
export class NoAdapter extends Error { constructor(type: string) }
```
Rules: iterate `diffPlan(plan, state, { prune })`; `gated` → progress skipped, not in state; `skip` → nothing; `create`/`update` → `adapter.apply(ctx, resource, state.entries[id])`, then `state.entries[id] = entryFor(...)`; unknown adapter type → `NoAdapter` (thrown before any call in the run: pre-flight over all non-gated resources); on adapter throw → `ApplyError` carrying the state so far (caller writes it); `destroy` changes (prune) run after all creates, in reverse order of state layer/insertion, calling `adapter.destroy` and deleting the entry; dry-run returns `changes` only.

- [ ] **Step 1: Failing tests**

`packages/forge-core/test/apply.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { compile } from "../src/compile.js";
import { loadPacks } from "../src/packs/loader.js";
import { loadIntentFile } from "../src/schema/intent.js";
import { emptyState } from "../src/schema/state.js";
import { applyPlan, ApplyError, NoAdapter, renderDryRun } from "../src/apply.js";
import type { Adapter, Provider } from "../src/provider.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const intent = loadIntentFile(`${ROOT}examples/intent.example.yaml`);
const packs = loadPacks(`${ROOT}packs`);
const NOW = () => new Date("2026-09-10T00:00:00Z");

function fakeProvider(failOn?: string) {
  const calls: string[] = [];
  const mk = (type: string): Adapter => ({
    type,
    async apply(_c, r) { calls.push(`apply ${r.id}`); if (r.id === failOn) throw new Error("boom"); return { externalId: `ext-${r.id}` }; },
    async verify() { return [{ name: "ok", ok: true, evidence: "" }]; },
    async destroy(_c, r) { calls.push(`destroy ${r.id}`); },
  });
  const types = ["identity.realm", "identity.role", "identity.group", "storage.tree", "storage.acl", "portal.site", "comms.channel", "comms.topic", "process.entity", "process.form", "process.state_machine", "process.rule", "process.workflow", "process.app", "data.dashboard", "data.snapshot", "data.lod_context"];
  const provider: Provider = { name: "oss", adapters: Object.fromEntries(types.map((t) => [t, mk(t)])) };
  return { provider, calls };
}

async function plan() { return (await compile(intent, packs, { now: NOW() })).plan; }

describe("applyPlan", () => {
  it("dry-run lists creates and gated resources and calls no adapter", async () => {
    const { provider, calls } = fakeProvider();
    const r = await applyPlan(await plan(), provider, {}, emptyState("oss"), { dryRun: true, now: NOW });
    expect(calls).toEqual([]);
    expect(r.changes.filter((c) => c.action === "create").length).toBe(30);
    expect(r.gated).toEqual(["i.rag.resources", "i.policy.cskh", "i.assistant"]);
    expect(renderDryRun(r.changes)).toMatch(/create\s+h\.realm/);
  });
  it("creates everything in topological order, then a second run skips everything", async () => {
    const { provider, calls } = fakeProvider();
    const p = await plan();
    const r1 = await applyPlan(p, provider, {}, emptyState("oss"), { now: NOW });
    expect(calls[0]).toBe("apply h.realm");
    expect(calls.indexOf("apply h.acl.areas.cskh")).toBeGreaterThan(calls.indexOf("apply h.group.cskh"));
    expect(Object.keys(r1.state.entries).length).toBe(30);
    expect(r1.state.entries["h.realm"]).toMatchObject({ externalId: "ext-h.realm", layer: "H" });
    calls.length = 0;
    const r2 = await applyPlan(p, provider, {}, r1.state, { now: NOW });
    expect(calls).toEqual([]);
    expect(r2.skipped.length).toBe(30);
  });
  it("stops at the first failure, keeps the state so far, and resumes from there", async () => {
    const { provider, calls } = fakeProvider("h.tree");
    const p = await plan();
    let saved;
    try { await applyPlan(p, provider, {}, emptyState("oss"), { now: NOW }); } catch (e) { expect(e).toBeInstanceOf(ApplyError); saved = (e as ApplyError).state; expect((e as ApplyError).resourceId).toBe("h.tree"); }
    expect(saved!.entries["h.realm"]).toBeDefined();
    expect(saved!.entries["h.tree"]).toBeUndefined();
    const ok = fakeProvider();
    const r = await applyPlan(p, ok.provider, {}, saved!, { now: NOW });
    expect(ok.calls[0]).toBe("apply h.tree");
    expect(r.skipped).toContain("h.realm");
  });
  it("prunes stale entries in reverse layer order and only with --prune", async () => {
    const { provider, calls } = fakeProvider();
    const p = await plan();
    const state = (await applyPlan(p, provider, {}, emptyState("oss"), { now: NOW })).state;
    state.entries["zz.old"] = { externalId: "e", checksum: "1".repeat(64), appliedAt: "2026-09-10T00:00:00.000Z", layer: "P", spec: {} };
    state.entries["aa.old"] = { externalId: "e", checksum: "1".repeat(64), appliedAt: "2026-09-10T00:00:00.000Z", layer: "H", spec: {} };
    calls.length = 0;
    await applyPlan(p, provider, {}, state, { now: NOW });
    expect(calls).toEqual([]);
    const r = await applyPlan(p, provider, {}, state, { now: NOW, prune: true });
    expect(r.destroyed).toEqual(["zz.old", "aa.old"]);        // P before H
    expect(r.state.entries["zz.old"]).toBeUndefined();
  });
  it("refuses a plan with a resource type the provider cannot handle, before touching the target", async () => {
    const { provider, calls } = fakeProvider();
    delete provider.adapters["storage.acl"];
    await expect(applyPlan(await plan(), provider, {}, emptyState("oss"), { now: NOW })).rejects.toBeInstanceOf(NoAdapter);
    expect(calls).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: apply.ts**

`packages/forge-core/src/apply.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Credentials } from "./credentials.js";
import { diffPlan, type Change, type ChangeAction } from "./differ.js";
import { LAYER_ORDER } from "./order.js";
import type { ApplyContext, Provider } from "./provider.js";
import type { PlanV1, Resource } from "./schema/plan.js";
import type { StateV1 } from "./schema/state.js";
import { entryFor } from "./state.js";

export type ProgressEvent = { id: string; action: ChangeAction; status: "start" | "done" | "failed" | "skipped"; message?: string };
export type ApplyOptions = { dryRun?: boolean; prune?: boolean; onProgress?: (e: ProgressEvent) => void; now?: () => Date; log?: (line: string) => void };
export type ApplyResult = { state: StateV1; changes: Change[]; applied: string[]; skipped: string[]; destroyed: string[]; gated: string[] };

export class NoAdapter extends Error { constructor(type: string) { super(`Provider không có adapter cho loại tài nguyên ${type}.`); this.name = "NoAdapter"; } }
export class ApplyError extends Error {
  constructor(public readonly resourceId: string, public readonly state: StateV1, public readonly cause: unknown) {
    super(`Cấp phát ${resourceId} thất bại: ${(cause as Error)?.message ?? String(cause)}. State đã ghi; chạy lại apply để tiếp tục.`);
    this.name = "ApplyError";
  }
}

export async function applyPlan(plan: PlanV1, provider: Provider, credentials: Credentials, initial: StateV1, opts: ApplyOptions = {}): Promise<ApplyResult> {
  const state: StateV1 = structuredClone(initial);
  const now = opts.now ?? (() => new Date());
  const progress = opts.onProgress ?? (() => {});
  const ctx: ApplyContext = { target: provider.name, credentials, state, log: opts.log ?? (() => {}), now };
  const byId = new Map(plan.resources.map((r) => [r.id, r] as [string, Resource]));
  const changes = diffPlan(plan, state, { prune: opts.prune });
  for (const c of changes) if ((c.action === "create" || c.action === "update") && !provider.adapters[c.type!]) throw new NoAdapter(c.type!);
  const result: ApplyResult = { state, changes, applied: [], skipped: [], destroyed: [], gated: [] };
  if (opts.dryRun) { result.gated = changes.filter((c) => c.action === "gated").map((c) => c.id); return result; }

  for (const c of changes) {
    if (c.action === "gated") { result.gated.push(c.id); progress({ id: c.id, action: c.action, status: "skipped", message: c.why }); continue; }
    if (c.action === "skip") { result.skipped.push(c.id); progress({ id: c.id, action: c.action, status: "skipped" }); continue; }
    if (c.action === "destroy") continue;
    const r = byId.get(c.id)!;
    progress({ id: c.id, action: c.action, status: "start" });
    try {
      const { externalId } = await provider.adapters[r.type].apply(ctx, r, state.entries[c.id]);
      state.entries[c.id] = entryFor(r, externalId, now());
      result.applied.push(c.id);
      progress({ id: c.id, action: c.action, status: "done" });
    } catch (e) {
      progress({ id: c.id, action: c.action, status: "failed", message: (e as Error).message });
      throw new ApplyError(c.id, state, e);
    }
  }

  if (opts.prune) {
    const stale = changes.filter((c) => c.action === "destroy").map((c) => c.id);
    const order = Object.keys(state.entries).filter((id) => stale.includes(id));
    order.sort((a, b) => LAYER_ORDER.indexOf(state.entries[b].layer) - LAYER_ORDER.indexOf(state.entries[a].layer) || order.indexOf(b) - order.indexOf(a));
    for (const id of order) {
      const entry = state.entries[id];
      const ghost: Resource = { id, layer: entry.layer, type: "unknown.unknown", spec: entry.spec, reason: "stale", depends_on: [], gate: { allowed: true } };
      const adapter = provider.adapters[typeOf(entry) ?? ""];
      progress({ id, action: "destroy", status: "start" });
      try {
        if (adapter) await adapter.destroy(ctx, ghost, entry);
        delete state.entries[id];
        result.destroyed.push(id);
        progress({ id, action: "destroy", status: "done" });
      } catch (e) {
        progress({ id, action: "destroy", status: "failed", message: (e as Error).message });
        throw new ApplyError(id, state, e);
      }
    }
  }
  return result;
}

/** State entries do not store the type; adapters that need it read `entry.spec.__type` written by `entryFor`. */
function typeOf(entry: StateV1["entries"][string]): string | undefined {
  return typeof entry.spec.__type === "string" ? (entry.spec.__type as string) : undefined;
}

export function renderDryRun(changes: Change[]): string {
  const rows = changes.map((c) => {
    const diff = c.action === "update" ? diffKeys(c.before as Record<string, unknown> | undefined, c.after as Record<string, unknown>) : "";
    return `${c.action.padEnd(8)} ${c.id.padEnd(28)} ${(c.layer ?? "").padEnd(2)} ${(c.type ?? "").padEnd(22)} ${c.why ?? diff}`;
  });
  const count = (a: ChangeAction) => changes.filter((c) => c.action === a).length;
  return [...rows, "", `create ${count("create")} · update ${count("update")} · skip ${count("skip")} · destroy ${count("destroy")} · gated ${count("gated")}`].join("\n");
}

function diffKeys(before: Record<string, unknown> | undefined, after: Record<string, unknown>): string {
  const b = before ?? {};
  const keys = new Set([...Object.keys(b), ...Object.keys(after)]);
  const out: string[] = [];
  for (const k of keys) {
    if (!(k in b)) out.push(`+${k}`);
    else if (!(k in after)) out.push(`-${k}`);
    else if (JSON.stringify(b[k]) !== JSON.stringify(after[k])) out.push(`~${k}`);
  }
  return out.join(" ");
}
```
Ruling in this task: `entryFor` also stores `__type: resource.type` inside `spec` so prune can find the adapter for stale entries (the checksum ignores it because `resourceChecksum` hashes the resource, not the entry). Adjust Task 1's `entryFor`: `spec: { ...structuredClone(resource.spec), __type: resource.type }` and make `differ.before` strip `__type`. Update `state.test.ts` expectation to `toMatchObject` (already tolerant).

- [ ] **Step 4: Run, commit**

```bash
npx vitest run packages/forge-core && npm run typecheck
git add packages/forge-core && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(core): applyPlan with dry-run, idempotent state, resume after failure and prune"
```

---

### Task 3: `verifyPlan`, `destroyPlan`, report rendering

**Files:**
- Create: `packages/forge-core/src/verify.ts`, `packages/forge-core/src/destroy.ts`
- Modify: `packages/forge-core/src/index.ts`
- Test: `packages/forge-core/test/verify.test.ts`

**Interfaces:**
```ts
export type VerifyItem = { id: string; layer: Layer; type: string; ok: boolean; checks: Check[]; error?: string };
export type VerifyReport = { target: TargetKind; verifiedAt: string; ok: boolean; total: number; passed: number; byLayer: Record<Layer, { total: number; passed: number }>; items: VerifyItem[]; notApplied: string[] };
export async function verifyPlan(plan, provider, credentials, state, opts?: { now?: () => Date; onProgress? }): Promise<VerifyReport>;
// each applied, non-gated resource → adapter.verify; adapter throw → item ok=false, error message (redacted); resources in plan but not in state → notApplied (report ok=false)
export function renderVerifyReport(r: VerifyReport): string;   // markdown: header with totals, per-layer table, ✅/❌ per resource, evidence lines
export async function destroyPlan(plan, provider, credentials, state, opts?: { prune?: boolean; onProgress?; now? }): Promise<{ state: StateV1; destroyed: string[] }>;
// destroys every state entry (reverse layer/insertion order); with prune=false only entries whose id is in the plan; throws ApplyError on failure (state saved so far)
```

- [ ] **Step 1: Failing tests** — `verify.test.ts`: fake provider whose `verify` returns two checks (one failing for `h.acl.resources`); after `applyPlan`, `verifyPlan` gives `ok=false`, `passed=29`, `byLayer.H.passed=15`, item for `h.acl.resources` has the failing check; an adapter that throws yields `ok=false` with `error`; a plan resource not in state lands in `notApplied`; `renderVerifyReport` contains `❌ h.acl.resources` and the totals line `29/30`. `destroyPlan` removes all entries in reverse order and returns the ids; failure mid-way throws `ApplyError` with the partial state.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement** per the interfaces (the sort for destroy order is the same comparator as in `applyPlan` prune; extract it as `destroyOrder(state, ids)` in `destroy.ts` and reuse from `apply.ts`).
- [ ] **Step 4: Run, commit** — `git commit -m "feat(core): verifyPlan with markdown report and destroyPlan"`.

---

### Task 4: `@dx-forge/provider-oss` package, HTTP helpers, Keycloak adapter

**Files:**
- Create: `packages/providers/oss/package.json`, `tsconfig.json`, `src/index.ts`, `src/http.ts`, `src/keycloak.ts`
- Modify: root `package.json` typecheck (`packages/providers/oss`)
- Test: `packages/providers/oss/test/keycloak.test.ts`

**Interfaces:**
```ts
// http.ts
export class HttpError extends Error { constructor(public status: number, public url: string, bodySnippet: string) }
export function redact(s: string, secrets: string[]): string;
export async function request(url: string, init: RequestInit & { expect?: number[] }, secrets?: string[]): Promise<Response>;  // throws HttpError on unexpected status; 30 s timeout
export const json = <T>(res: Response) => res.json() as Promise<T>;
export const basicAuth = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
// keycloak.ts
export function keycloakClient(creds: NonNullable<Credentials["keycloak"]>): { token(): Promise<string>; get(path): Promise<Response>; post(path, body): Promise<Response>; put(path, body); del(path) }  // token cached until 30 s before expiry
export const identityRealm: Adapter;   // apply: GET /admin/realms/{realm} → 404 ? POST /admin/realms {realm, enabled:true, displayName} ; ensure clients from spec.clients (GET ?clientId= then POST {clientId, publicClient:false, standardFlowEnabled:true, redirectUris:["*"]}) ; externalId = realm
                                       // verify: GET realm 200 → check "realm exists"; each client exists → one check per client
                                       // destroy: DELETE /admin/realms/{realm}
export const identityRole: Adapter;    // realm from state entry of depends_on[0] (h.realm) → spec.realm; GET /roles/{name} 404 → POST; externalId = name; verify GET 200; destroy DELETE /roles/{name}
export const identityGroup: Adapter;   // path "/departments/<code>": ensure parent "departments" (GET /groups?search=departments&exact=true → POST /groups), then child (GET /groups/{parentId}/children?search) → POST /groups/{parentId}/children {name: code, attributes: {code:[code], name:[name]}}; externalId = child id; verify GET /groups/{id} 200 and attributes.code[0]===code; destroy DELETE /groups/{id}
```
Realm lookup for role/group adapters: `ctx.state.entries["h.realm"]?.spec.realm ?? "dxlab"`.

- [ ] **Step 1: Failing tests** (`vi.stubGlobal("fetch", …)` with a small router that records requests; assertions on method, path, body, and the `Authorization: Bearer` header; token endpoint called once for several calls; 404 → create; existing → no POST; `verify` checks; `destroy` DELETE; `MissingCredentials` when `ctx.credentials.keycloak` is absent; `HttpError` message does not contain the password).
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement** `http.ts` (timeout via `AbortSignal.timeout(30_000)`, redaction of every secret string passed), `keycloak.ts` per the interface, `index.ts` exporting `ossProvider` with the three adapters registered so far.

`packages/providers/oss/package.json`: name `@dx-forge/provider-oss`, deps `@dx-forge/forge-core`, `zod`.

- [ ] **Step 4: Run, commit** — `git commit -m "feat(provider-oss): package skeleton, http helpers and Keycloak realm/role/group adapters"`.

---

### Task 5: Nextcloud adapter — group folder tree, ACL, portal files

**Files:**
- Create: `packages/providers/oss/src/nextcloud.ts`, `packages/providers/oss/src/webdav.ts`
- Modify: `packages/providers/oss/src/index.ts`
- Test: `packages/providers/oss/test/nextcloud.test.ts`

**Interfaces and target calls (assumptions to confirm against Nextcloud 31 + groupfolders 19 at contract-test time):**
- OCS base `${url}/ocs/v2.php` with headers `OCS-APIRequest: true`, `Accept: application/json`, basic auth. Provisioning: `GET /cloud/groups?search=<id>` → `POST /cloud/groups` body `groupid=<id>`. Group folders: `GET /apps/groupfolders/folders` (find by `mount_point`) → `POST /apps/groupfolders/folders` body `mountpoint=<root>` → id; `POST /folders/{id}/groups` body `group=<gid>`; `POST /folders/{id}/groups/{gid}` body `permissions=<mask>` (read 1, write 2|4|8|16=31 for full); `POST /folders/{id}/acl` body `acl=1` enables advanced permissions; per-path ACL rule via WebDAV `PROPPATCH` on the folder with property `{http://nextcloud.org/ns}acl-list` containing `<nc:acl><nc:acl-mapping-type>group</nc:acl-mapping-type><nc:acl-mapping-id>gid</nc:acl-mapping-id><nc:acl-mask>31</nc:acl-mask><nc:acl-permissions>1</nc:acl-permissions></nc:acl>`.
- WebDAV base `${url}/remote.php/dav/files/${user}/${root}/`: `MKCOL` per branch (405 = exists), `PUT` README.md, `PROPFIND` depth 1 for verify.
- `storageTree` adapter: ensure groups `all-staff`, `dx-admin`, `dept-<code>` for each department found in the plan's `identity.group` resources; ensure group folder for `spec.root` with `all-staff` read; MKCOL every `spec.branches` path in order (parents first); PUT `README.md` in each leaf with a Vietnamese one-liner; `externalId = folderId`; verify: PROPFIND lists every branch; destroy: `DELETE /apps/groupfolders/folders/{id}`.
- `storageAcl` adapter: `spec.group` mapping (`all-staff` → `all-staff`, `departments/<x>` → `dept-<x>`, `dx-admin` → `dx-admin`); read → mask 1; write → 31; admin → 31 plus the group added to the folder with full permissions; applies `PROPPATCH` on `spec.path`; `externalId = "<folderId>:<path>:<gid>"`; verify: for `read` with `staffUser` credentials, `PUT` a probe file into the path must return 403 and into an `AREAS/<own dept>` path must return 201 (probe then `DELETE`); without staff credentials, verify reads the ACL back via `PROPFIND` `acl-list` and checks the rule; destroy: remove the ACL rule (PROPPATCH with the rule omitted).
- `portalSite` adapter: `PUT` each file in `spec.files` under `00. Portal/` with a template body (`news.md`: Vietnamese greeting + date; `handbook/index.md`: "Sổ tay sẽ được cập nhật bởi dxforge handbook"); `externalId = "portal"`; verify: `PROPFIND` each file exists; destroy: `DELETE` the files.

- [ ] **Step 1: Failing tests** — router stub covering: group creation only when search returns none; folder lookup by mount point then create; MKCOL 405 tolerated, other 4xx → `AdapterError`; README PUT count equals number of leaf branches; ACL PROPPATCH body contains `acl-mapping-id` = `dept-cskh` and `acl-permissions` 31 for write; verify PROPFIND parsing (multistatus XML with hrefs) finds all branches; staff probe PUT 403 → check ok; destroy deletes folder.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement** (`webdav.ts`: `mkcol`, `put`, `del`, `propfind(depth) → hrefs[]` with a minimal XML href extractor `/<d:href>([^<]+)<\/d:href>/g`, `proppatch(path, xml)`).
- [ ] **Step 4: Run, commit** — `git commit -m "feat(provider-oss): Nextcloud group folder tree, ACL and portal adapters"`.

---

### Task 6: Telegram and Mattermost adapters; provider assembly

**Files:**
- Create: `packages/providers/oss/src/telegram.ts`, `packages/providers/oss/src/mattermost.ts`
- Modify: `packages/providers/oss/src/index.ts`
- Test: `packages/providers/oss/test/{telegram,mattermost,provider}.test.ts`

**Interfaces:**
- `commsChannel` adapter dispatches on `spec.kind` (`telegram` | `mattermost`): Telegram → verify the bot can `getChat(chatId)` and it is a forum supergroup (`is_forum`), `externalId = chatId`; Mattermost → ensure a channel `spec.name` in `teamId` (`GET /api/v4/teams/{teamId}/channels/name/{name}` 404 → `POST /api/v4/channels`), `externalId = channelId`.
- `commsTopic` adapter: Telegram → find topic by name in a local cache stored in the channel entry? (Bot API cannot list topics) → ruling: `createForumTopic` on create; on update keep the thread id from `previous.externalId`; `externalId = message_thread_id`; verify: `sendMessage(chat_id, message_thread_id, "kiểm tra DX-Forge")` returns `message_id` → check ok, then `deleteMessage`; destroy: `deleteForumTopic`. Mattermost → topic = channel named `<channel>-<topic>` (`POST /api/v4/channels` type `O`), verify `POST /api/v4/posts` then `DELETE /api/v4/posts/{id}`, destroy `DELETE /api/v4/channels/{id}`.
- `ossProvider(creds)` registers: identity.realm/role/group, storage.tree/acl, portal.site, comms.channel/topic. `provider.test.ts` asserts the adapter set equals exactly the eight H types generated by the planner and that `applyPlan` over the example plan with all adapters stubbed produces 16 H entries and `NoAdapter` for P types (P/D/I are plan 05; the CLI test for `apply` therefore uses a plan filtered to H — see Task 7).

- [ ] **Step 1–4:** tests with a fetch router (Telegram JSON `{ok:true,result:…}` envelope; Mattermost bearer header), implementation, commit `feat(provider-oss): Telegram and Mattermost channel/topic adapters, provider assembly`.

---

### Task 7: CLI `apply`, `verify`, `destroy`; `--layers` filter; reports

**Files:**
- Create: `apps/cli/src/commands/apply.ts`, `apps/cli/src/commands/verify.ts`, `apps/cli/src/commands/destroy.ts`, `apps/cli/src/providers.ts`
- Modify: `apps/cli/src/index.ts`, `apps/cli/package.json` (dep `@dx-forge/provider-oss`)
- Test: `apps/cli/test/cli.test.ts` (new cases)

**Interfaces:**
- `apps/cli/src/providers.ts`: `providerFor(kind: TargetKind, creds): Provider` (`oss` → `ossProvider`; others → exit 2 `Đích <kind> có ở plan 07/08`).
- `dxforge apply <plan.yaml> [--target oss] [--dry-run] [--prune] [--state .dxforge/state.json] [--credentials-ref DXFORGE_OSS_CREDENTIALS] [--layers H,P]`: loads plan, filters resources to `--layers` when given (default all), loads state, loads credentials (not for dry-run), runs `applyPlan` with a progress printer (`✓ id`, `↻ id` update, `· id` skip, `⛔ id` gated, `✗ id` failed), writes state after success **and** after `ApplyError` (from `e.state`), prints summary; exit 0 / 1 (apply error) / 2 (input, credentials, no adapter).
- `dxforge verify <plan.yaml> [--state] [--target] [--credentials-ref] [--out .dxforge]`: runs `verifyPlan`, writes `verify-report.json` and `.md`, prints per-layer totals and each ❌ with evidence; exit 0 all green, 1 otherwise.
- `dxforge destroy <plan.yaml> [--prune] [--yes]`: asks for confirmation `Xoá N tài nguyên trên đích <target>? (gõ "xoa")` unless `--yes`; runs `destroyPlan`, writes state; exit codes as apply.
- Tests: `apply --dry-run` on the example plan (no credentials needed) exits 0, prints `create 30` and `gated 3`, writes no state file; `apply` without the env var exits 2 with the Vietnamese message; `apply --layers H --dry-run` prints `create 16`; `verify` with no state exits 1 and reports `notApplied`.

- [ ] **Step 1–4:** tests, implementation, `npm test`, commit `feat(cli): apply, verify and destroy commands with state and reports`.

---

### Task 8: Compose target `core`, contract tests, CI job

**Files:**
- Create: `deploy/target-core.yml`, `deploy/target-core.env.example`, `deploy/nextcloud-init.sh`, `packages/providers/oss/contract/core.contract.test.ts`, `packages/providers/oss/contract/README.md`
- Modify: `.github/workflows/ci.yml` (job `contract`, `if: github.event_name == 'push'`), `vitest.config.ts` (contract dir excluded from the default run), root `package.json` (`"contract": "DXFORGE_CONTRACT=1 vitest run packages/providers/oss/contract"`)

- [ ] **Step 1: Compose**

`deploy/target-core.yml`:
```yaml
# SPDX-License-Identifier: AGPL-3.0-or-later
# Target "core": the minimum stack for layer H. Not part of Forge; this is what Forge provisions.
services:
  postgres:
    image: postgres:16
    environment: { POSTGRES_USER: dxlab, POSTGRES_PASSWORD: ${PG_PASSWORD}, POSTGRES_DB: dxlab }
    volumes: ["pg:/var/lib/postgresql/data"]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U dxlab"], interval: 5s, retries: 20 }
  keycloak:
    image: quay.io/keycloak/keycloak:26.0
    command: ["start-dev", "--http-port=8080"]
    environment: { KC_BOOTSTRAP_ADMIN_USERNAME: ${KC_ADMIN}, KC_BOOTSTRAP_ADMIN_PASSWORD: ${KC_PASSWORD}, KC_DB: postgres, KC_DB_URL: "jdbc:postgresql://postgres:5432/dxlab", KC_DB_USERNAME: dxlab, KC_DB_PASSWORD: ${PG_PASSWORD} }
    ports: ["${KC_PORT:-8080}:8080"]
    depends_on: { postgres: { condition: service_healthy } }
    healthcheck: { test: ["CMD-SHELL", "exec 3<>/dev/tcp/127.0.0.1/9000 && echo -e 'GET /health/ready HTTP/1.1\\r\\nhost: localhost\\r\\n\\r\\n' >&3 && grep -q UP <&3"], interval: 10s, retries: 30 }
  nextcloud:
    image: nextcloud:31-apache
    environment: { POSTGRES_HOST: postgres, POSTGRES_DB: nextcloud, POSTGRES_USER: dxlab, POSTGRES_PASSWORD: ${PG_PASSWORD}, NEXTCLOUD_ADMIN_USER: ${NC_ADMIN}, NEXTCLOUD_ADMIN_PASSWORD: ${NC_PASSWORD}, NEXTCLOUD_TRUSTED_DOMAINS: "localhost nextcloud" }
    ports: ["${NC_PORT:-8081}:80"]
    volumes: ["nc:/var/www/html", "./nextcloud-init.sh:/docker-entrypoint-hooks.d/post-installation/init.sh:ro"]
    depends_on: { postgres: { condition: service_healthy } }
    healthcheck: { test: ["CMD-SHELL", "curl -fsS http://localhost/status.php | grep -q installed\\\":true"], interval: 10s, retries: 60 }
volumes: { pg: {}, nc: {} }
```
`deploy/nextcloud-init.sh`: `php occ app:install groupfolders; php occ app:enable groupfolders; php occ user:add --password-from-env staff.test` with `OC_PASS=$NC_STAFF_PASSWORD` (creates the staff test user and the `nextcloud` database via `POSTGRES_DB` for Nextcloud — note the compose uses a second database name; add `POSTGRES_MULTIPLE_DATABASES` init script or create `nextcloud` db in `deploy/pg-init.sql` mounted to `/docker-entrypoint-initdb.d/`).
`deploy/target-core.env.example`: `PG_PASSWORD`, `KC_ADMIN=admin`, `KC_PASSWORD`, `NC_ADMIN=admin`, `NC_PASSWORD`, `NC_STAFF_PASSWORD`, ports.

- [ ] **Step 2: Contract test**

`core.contract.test.ts` (skipped unless `DXFORGE_CONTRACT=1`): builds the example plan filtered to H minus comms (no Telegram in CI), constructs credentials from `KC_*`/`NC_*` env, runs `applyPlan` → expects 13 entries; `verifyPlan` → `ok === true`; second `applyPlan` → all skip; `destroyPlan` → target clean (realm 404, folder gone). Asserts on the live target with direct `fetch` calls (GET realm, PROPFIND).

- [ ] **Step 3: CI job**

```yaml
  contract:
    runs-on: ubuntu-latest
    needs: test
    if: github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: cp deploy/target-core.env.example deploy/.env.core && docker compose --env-file deploy/.env.core -f deploy/target-core.yml up -d --wait
      - run: DXFORGE_CONTRACT=1 KC_URL=http://localhost:8080 NC_URL=http://localhost:8081 npm run contract
        env: { KC_ADMIN: admin, KC_PASSWORD: admin-ci, NC_ADMIN: admin, NC_PASSWORD: admin-ci, NC_STAFF_PASSWORD: staff-ci }
      - run: docker compose -f deploy/target-core.yml down -v
        if: always()
```

- [ ] **Step 4: Run locally** (`docker compose … up -d --wait`, `npm run contract`), fix the adapter assumptions marked above against the real APIs (this is the step where the groupfolders ACL PROPPATCH shape and the Keycloak child-group endpoint are confirmed; record any correction in the report and in the adapter's doc comment), commit `test(provider-oss): contract tests against the compose core target, CI job`.

---

### Task 9: Docs — README roadmap, BUILDING target section, CHANGELOG, spec patch

- [ ] README: roadmap 04 ✅; CLI table rows for `apply`, `verify`, `destroy` with exit codes; "Đích" table unchanged; a short "Chạy thử đích core" snippet. BUILDING: target compose + credentials JSON example with placeholder values. CHANGELOG. Spec §1.1: StateEntry gains `layer`, `spec`; §2 Nextcloud group naming `dept-<code>`; `storage.audit_job` moved to plan 05 (needs n8n).
- [ ] `npm test && npm run typecheck`; commit `docs: document apply, verify, destroy and the core target`.

---

## Self-review

**Spec coverage:** §1.4 (order, checksum skip/update/create, prune destroy, dry-run diff, failure → state saved → resume) → Tasks 1–2; §1.5 (checks, markdown + JSON report) → Task 3; §2 table: realm/clients, roles, groups with attributes → Task 4; tree (group folder, MKCOL, README), ACL (RESOURCES read all-staff, AREAS write group, ARCHIVES admin; staff PUT probe 403/201) → Task 5; portal files → Task 5; Telegram topic / Mattermost channel with test message → Task 6; `storage.audit_job` deferred to plan 05 (n8n) and noted in Task 9; "credentials from `credentials_ref`, never in plan/state" → Task 1 + redaction in Task 4; §5 adapter HTTP mocks + contract with real Keycloak/Nextcloud in CI + integration sequence (apply → verify green → apply all skip → destroy clean) → Task 8. Master §7 acceptance for layer H is the contract test.

**Placeholder scan:** Tasks 3–8 give interfaces, exact target calls, test expectations and file lists rather than full listings for every adapter; the HTTP shapes are stated per endpoint so an implementer transcribes them. Two shapes are flagged as assumptions to confirm at contract time (groupfolders ACL `PROPPATCH`, Keycloak `children` endpoint) — that confirmation is Task 8 Step 4, not a TODO.

**Type consistency:** `StateEntry.layer/spec` (Task 1) are what `applyPlan` prune (Task 2), `destroyPlan` (Task 3) and the differ's `before` use; `Adapter`/`Provider` from Task 1 are implemented in Tasks 4–6 and consumed by the CLI in Task 7; `resourceChecksum` still hashes `{type, spec}` of the *resource*, so adding `__type` to the state entry's spec does not change skip/update decisions.
