// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Contract suite: exercises the `oss` provider's layer-H adapters against a real Keycloak +
 * Nextcloud target (`deploy/target-core.yml`), instead of the stubbed `fetch` every other test in
 * this repository uses. It is the only thing that can confirm or refute two guessed API shapes:
 *
 *  - the Nextcloud groupfolders ACL `PROPPATCH` body (`../src/nextcloud.ts` `aclXml`), and
 *  - the Keycloak child-group endpoint (`../src/keycloak.ts` `ensureParentGroup`/`identityGroup`).
 *
 * Skipped entirely unless `DXFORGE_CONTRACT=1` — see `./README.md` for how to bring the compose
 * target up in stages and which environment variables this file reads. `vitest.config.ts` also
 * excludes this directory from the default `vitest run`, so `npm test` never touches the network;
 * run this suite with `npm run contract`.
 *
 * Sequence per the plan's acceptance criteria: apply → verify all green → apply again (all skip) →
 * destroy --prune → verify reports everything gone. The `it`s below share mutable `state` across
 * steps on purpose (each step's precondition is the previous step's live result on the real
 * target, not a fixture) and rely on Vitest running the `it`s of one `describe` sequentially,
 * which is the default — do not add `.concurrent` to this file.
 */
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  applyPlan,
  compile,
  destroyPlan,
  emptyState,
  loadIntentFile,
  loadPacks,
  verifyPlan,
  type Credentials,
  type IntentV1,
  type PlanV1,
  type Provider,
  type StateV1,
} from "@dx-forge/forge-core";
import { ossProvider } from "../src/index.js";
import { keycloakClient } from "../src/keycloak.js";
import { basicAuth, json, text, request } from "../src/http.js";

const RUN = process.env.DXFORGE_CONTRACT === "1";
const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const NOW = () => new Date();

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`DXFORGE_CONTRACT=1 requires the environment variable ${name}. See packages/providers/oss/contract/README.md.`);
  }
  return v;
}

function hasEnv(...names: string[]): boolean {
  return names.every((n) => Boolean(process.env[n]));
}

async function compiledPlan(intent: IntentV1): Promise<PlanV1> {
  const packs = loadPacks(`${ROOT}packs`);
  const { plan, errors } = compile(intent, packs, NOW());
  if (errors.length > 0) throw new Error(`example intent fails to compile: ${errors.map((e) => e.message).join("; ")}`);
  return plan;
}

function exampleIntent(): IntentV1 {
  return loadIntentFile(`${ROOT}examples/intent.example.yaml`);
}

const CORE_IDS = [
  "h.realm",
  "h.role.dx-admin",
  "h.role.manager",
  "h.role.staff",
  "h.group.cskh",
  "h.group.kd",
  "h.tree",
  "h.acl.resources",
  "h.acl.areas.cskh",
  "h.acl.areas.kd",
  "h.acl.archives",
  "h.portal",
];

/** Layer H minus the two comms types: CI has no Telegram/Mattermost account and the compose
 * target `core` does not run either backend (see ./README.md). */
async function corePlan(): Promise<PlanV1> {
  const plan = await compiledPlan(exampleIntent());
  return { ...plan, resources: plan.resources.filter((r) => r.layer === "H" && r.type !== "comms.channel" && r.type !== "comms.topic") };
}

function coreCredentials(): Credentials {
  return {
    keycloak: {
      url: process.env.KC_URL ?? "http://localhost:8080",
      admin: process.env.KC_ADMIN ?? "admin",
      password: requiredEnv("KC_PASSWORD"),
      realmAdminClient: "admin-cli",
    },
    nextcloud: {
      url: process.env.NC_URL ?? "http://localhost:8081",
      user: process.env.NC_ADMIN ?? "admin",
      password: requiredEnv("NC_PASSWORD"),
      staffUser: process.env.NC_STAFF_USER ?? "staff.test",
      staffPassword: requiredEnv("NC_STAFF_PASSWORD"),
    },
  };
}

describe.skipIf(!RUN)("provider-oss contract: compose target core (Keycloak + Nextcloud)", () => {
  let plan: PlanV1;
  let credentials: Credentials;
  let provider: Provider;
  let state: StateV1;

  beforeAll(async () => {
    plan = await corePlan();
    credentials = coreCredentials();
    provider = ossProvider(credentials);
    state = emptyState("oss");
  });

  it("compiles to the expected 12 non-comms layer-H resources", () => {
    expect(plan.resources.map((r) => r.id).sort()).toEqual([...CORE_IDS].sort());
  });

  it("apply creates every resource on the live target", async () => {
    const result = await applyPlan(plan, provider, credentials, state);
    expect(result.applied.sort()).toEqual([...CORE_IDS].sort());
    expect(Object.keys(result.state.entries).sort()).toEqual([...CORE_IDS].sort());
    state = result.state;
  }, 120_000);

  it("Keycloak: the department groups are children of one 'departments' parent group, with attributes.code (confirms the guessed child-group endpoint)", async () => {
    const client = keycloakClient(credentials.keycloak!);
    const parents = await json<Array<{ id: string; name: string }>>(
      await client.get(`/admin/realms/dxlab/groups?search=departments&exact=true`),
    );
    expect(parents, "GET /admin/realms/dxlab/groups?search=departments&exact=true should return exactly the 'departments' parent").toHaveLength(1);

    const children = await json<Array<{ id: string; name: string; attributes?: Record<string, string[]> }>>(
      await client.get(`/admin/realms/dxlab/groups/${parents[0]!.id}/children`),
    );
    expect(children.map((c) => c.name).sort(), "children of the 'departments' group").toEqual(["cskh", "kd"]);
    for (const code of ["cskh", "kd"]) {
      const child = children.find((c) => c.name === code)!;
      expect(child.attributes?.code, `attributes.code on Keycloak child group "${code}"`).toEqual([code]);
    }
  });

  it("Nextcloud: the PROPPATCH on '2. [A] AREAS/Chăm sóc khách hàng' is readable back as a group acl-list rule (confirms the guessed groupfolders ACL body)", async () => {
    const nc = credentials.nextcloud!;
    const root = state.entries["h.tree"]!.spec.root as string;
    const path = "2. [A] AREAS/Chăm sóc khách hàng";
    const url = `${nc.url}/remote.php/dav/files/${encodeURIComponent(nc.user)}/${[root, ...path.split("/")].map(encodeURIComponent).join("/")}`;
    const body =
      `<?xml version="1.0"?>` + `<d:propfind xmlns:d="DAV:" xmlns:nc="http://nextcloud.org/ns"><d:prop><nc:acl-list/></d:prop></d:propfind>`;
    const res = await request(
      url,
      { method: "PROPFIND", headers: { Authorization: basicAuth(nc.user, nc.password), Depth: "0", "Content-Type": "application/xml; charset=utf-8" }, body, expect: [207] },
      [nc.password],
    );
    const raw = await text(res);
    expect(raw, "PROPFIND acl-list for AREAS/cskh should carry the dept-cskh mapping").toContain("<nc:acl-mapping-id>dept-cskh</nc:acl-mapping-id>");
    expect(raw, "PROPFIND acl-list for AREAS/cskh should carry write permissions (31)").toContain("<nc:acl-permissions>31</nc:acl-permissions>");
  });

  it("verify reports every resource green, including the staff ACL probes (403 into RESOURCES, 201 into the staff's own AREAS)", async () => {
    const report = await verifyPlan(plan, provider, credentials, state);
    if (!report.ok) {
      const failing = report.items
        .filter((i) => !i.ok)
        .map((i) => `${i.id}: ${i.error ?? i.checks.filter((c) => !c.ok).map((c) => `${c.name} (${c.evidence})`).join(", ")}`);
      throw new Error(`verify is not fully green — first culprit points at which call shape was wrong:\n${failing.join("\n")}\nnotApplied: ${report.notApplied.join(", ")}`);
    }
    expect(report.ok).toBe(true);
    expect(report.passed).toBe(report.total);
    expect(report.notApplied).toEqual([]);

    const resources = report.items.find((i) => i.id === "h.acl.resources")!;
    expect(resources.checks[0], "staff probe into 3. [R] RESOURCES must be refused").toMatchObject({ ok: true, evidence: expect.stringContaining("403") });

    const areasCskh = report.items.find((i) => i.id === "h.acl.areas.cskh")!;
    expect(areasCskh.checks[0], "staff probe into their own 2. [A] AREAS/<dept> must be accepted").toMatchObject({ ok: true, evidence: expect.stringContaining("201") });
  }, 120_000);

  it("a second apply is fully idempotent: every resource skips", async () => {
    const result = await applyPlan(plan, provider, credentials, state);
    expect(result.applied).toEqual([]);
    expect(result.skipped.sort()).toEqual([...CORE_IDS].sort());
    state = result.state;
  }, 60_000);

  it("destroy --prune removes every resource, and a fresh verify then reports them all gone", async () => {
    const destroyed = await destroyPlan(plan, provider, credentials, state, { prune: true });
    expect(destroyed.destroyed.sort()).toEqual([...CORE_IDS].sort());
    expect(Object.keys(destroyed.state.entries)).toEqual([]);
    state = destroyed.state;

    const report = await verifyPlan(plan, provider, credentials, state);
    expect(report.ok).toBe(false);
    expect(report.notApplied.sort()).toEqual([...CORE_IDS].sort());
  }, 120_000);

  it("Keycloak: the realm no longer exists after destroy", async () => {
    const client = keycloakClient(credentials.keycloak!);
    const res = await client.get(`/admin/realms/dxlab`);
    expect(res.status, "GET /admin/realms/dxlab after destroy --prune").toBe(404);
  });

  it("Nextcloud: the group folder no longer exists after destroy", async () => {
    const nc = credentials.nextcloud!;
    const res = await request(
      `${nc.url}/ocs/v2.php/apps/groupfolders/folders?format=json`,
      { method: "GET", headers: { Authorization: basicAuth(nc.user, nc.password), "OCS-APIRequest": "true", Accept: "application/json" }, expect: [200] },
      [nc.password],
    );
    const body = await json<{ ocs: { data: unknown } }>(res);
    const list = (Array.isArray(body.ocs.data) ? body.ocs.data : Object.values(body.ocs.data as Record<string, { mount_point: string }>)) as Array<{
      mount_point: string;
    }>;
    const shortCode = exampleIntent().organization.short_code.toUpperCase();
    expect(list.some((f) => f.mount_point === `[${shortCode}] DX-OS`), "groupfolders list after destroy --prune").toBe(false);
  });
});

/** Telegram and Mattermost need a real bot/account this suite cannot provision, so both blocks
 * below skip gracefully — not just under `DXFORGE_CONTRACT`, but also when their own credentials
 * are absent — rather than failing the run. */
describe.skipIf(!RUN || !hasEnv("TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"))(
  "provider-oss contract: Telegram comms (optional — needs a real bot token and a forum-enabled chat)",
  () => {
    let plan: PlanV1;
    let credentials: Credentials;
    let provider: Provider;
    let state: StateV1;
    const IDS = ["h.channel", "h.topic.announce", "h.topic.alerts", "h.topic.approvals"];

    beforeAll(async () => {
      const intent = exampleIntent();
      const full = await compiledPlan({ ...intent, channels: { ...intent.channels, chat: "telegram" } });
      plan = { ...full, resources: full.resources.filter((r) => r.type === "comms.channel" || r.type === "comms.topic") };
      credentials = { telegram: { botToken: requiredEnv("TELEGRAM_BOT_TOKEN"), chatId: requiredEnv("TELEGRAM_CHAT_ID") } };
      provider = ossProvider(credentials);
      state = emptyState("oss");
    });

    it("apply creates the channel confirmation and every topic, verify is green, a second apply skips, destroy removes them", async () => {
      const applied = await applyPlan(plan, provider, credentials, state);
      expect(applied.applied.sort()).toEqual([...IDS].sort());
      state = applied.state;

      const report = await verifyPlan(plan, provider, credentials, state);
      expect(report.ok, JSON.stringify(report.items.filter((i) => !i.ok), null, 2)).toBe(true);

      const again = await applyPlan(plan, provider, credentials, state);
      expect(again.applied).toEqual([]);
      expect(again.skipped.sort()).toEqual([...IDS].sort());
      state = again.state;

      const destroyed = await destroyPlan(plan, provider, credentials, state, { prune: true });
      // h.channel's destroy is a no-op (the Bot API cannot delete a supergroup); the topics are removed.
      expect(destroyed.destroyed.sort()).toEqual([...IDS].sort());
    }, 180_000);
  },
);

describe.skipIf(!RUN || !hasEnv("MATTERMOST_URL", "MATTERMOST_TOKEN", "MATTERMOST_TEAM_ID"))(
  "provider-oss contract: Mattermost comms (optional — needs a real server, token and team)",
  () => {
    let plan: PlanV1;
    let credentials: Credentials;
    let provider: Provider;
    let state: StateV1;
    const IDS = ["h.channel", "h.topic.announce", "h.topic.alerts", "h.topic.approvals"];

    beforeAll(async () => {
      const intent = exampleIntent();
      const full = await compiledPlan({ ...intent, channels: { ...intent.channels, chat: "mattermost" } });
      plan = { ...full, resources: full.resources.filter((r) => r.type === "comms.channel" || r.type === "comms.topic") };
      credentials = {
        mattermost: { url: requiredEnv("MATTERMOST_URL"), token: requiredEnv("MATTERMOST_TOKEN"), teamId: requiredEnv("MATTERMOST_TEAM_ID") },
      };
      provider = ossProvider(credentials);
      state = emptyState("oss");
    });

    it("apply creates the channel and one channel per topic, verify is green, a second apply skips, destroy removes them", async () => {
      const applied = await applyPlan(plan, provider, credentials, state);
      expect(applied.applied.sort()).toEqual([...IDS].sort());
      state = applied.state;

      const report = await verifyPlan(plan, provider, credentials, state);
      expect(report.ok, JSON.stringify(report.items.filter((i) => !i.ok), null, 2)).toBe(true);

      const again = await applyPlan(plan, provider, credentials, state);
      expect(again.applied).toEqual([]);
      expect(again.skipped.sort()).toEqual([...IDS].sort());
      state = again.state;

      const destroyed = await destroyPlan(plan, provider, credentials, state, { prune: true });
      expect(destroyed.destroyed.sort()).toEqual([...IDS].sort());
    }, 180_000);
  },
);
