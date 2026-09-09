// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplyContext, Credentials, Resource, StateEntry, StateV1 } from "@dx-forge/forge-core";
import { MissingCredentials } from "@dx-forge/forge-core";
import { identityGroup, identityRealm, identityRole } from "../src/keycloak.js";
import { request } from "../src/http.js";

const KEYCLOAK_URL = "https://kc.example.org";
const PASSWORD = "s3cr3t-pw";

type RouteResult = { status: number; body?: unknown; headers?: Record<string, string> };
type RecordedCall = { method: string; path: string; body: unknown; headers: Record<string, string> };

/** A tiny router in front of a stubbed `fetch`: each test registers one handler per
 * `METHOD path` (path includes the query string) and every call made against it is recorded so
 * assertions can check method, path, body and the `Authorization` header. */
function stubFetch(routes: Record<string, () => RouteResult>): RecordedCall[] {
  const calls: RecordedCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init: RequestInit = {}) => {
      const url = new URL(String(input));
      const method = (init.method ?? "GET").toUpperCase();
      const path = url.pathname + url.search;
      const headers = { ...(init.headers as Record<string, string> | undefined) };
      const body = typeof init.body === "string" ? tryParse(init.body) : undefined;
      calls.push({ method, path, body, headers });
      const key = `${method} ${path}`;
      const handler = routes[key];
      if (!handler) throw new Error(`no route stubbed for ${key}`);
      const result = handler();
      return new Response(result.body !== undefined ? JSON.stringify(result.body) : null, { status: result.status, headers: result.headers });
    }),
  );
  return calls;
}

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

const TOKEN_ROUTE = "POST /realms/master/protocol/openid-connect/token";
function tokenHandler(accessToken = "tok-1"): () => RouteResult {
  return () => ({ status: 200, body: { access_token: accessToken, expires_in: 300 } });
}

function creds(): Credentials {
  return { keycloak: { url: KEYCLOAK_URL, admin: "admin", password: PASSWORD, realmAdminClient: "admin-cli" } };
}

function stateWithRealm(realm = "dxlab"): StateV1 {
  return {
    version: 1,
    target: "oss",
    entries: {
      "h.realm": { externalId: realm, checksum: "0".repeat(64), appliedAt: "2026-09-10T00:00:00.000Z", layer: "H", spec: { realm, __type: "identity.realm" } },
    },
  };
}

function ctxFor(credentials: Credentials, state: StateV1 = { version: 1, target: "oss", entries: {} }): ApplyContext {
  return { target: "oss", credentials, state, log: () => {}, now: () => new Date("2026-09-10T00:00:00Z") };
}

function resource(overrides: Partial<Resource> & Pick<Resource, "id" | "type" | "spec">): Resource {
  return { layer: "H", reason: "x", depends_on: [], gate: { allowed: true }, ...overrides };
}

const TOKEN_PATH = "/realms/master/protocol/openid-connect/token";
const isTokenCall = (c: RecordedCall) => c.method === "POST" && c.path === TOKEN_PATH;
const nonTokenPosts = (calls: RecordedCall[]) => calls.filter((c) => c.method === "POST" && !isTokenCall(c));

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("keycloakClient token caching", () => {
  it("fetches the token once and reuses it for several calls made through the same client", async () => {
    const calls = stubFetch({
      [TOKEN_ROUTE]: tokenHandler(),
      "GET /admin/realms/dxlab": () => ({ status: 200, body: { realm: "dxlab" } }),
      "GET /admin/realms/dxlab/clients?clientId=dx-web": () => ({ status: 200, body: [] }),
      "POST /admin/realms/dxlab/clients": () => ({ status: 201 }),
    });
    const ctx = ctxFor(creds());
    // identityRealm.apply makes 3 authenticated calls (GET realm, GET clients, POST client)
    // through one keycloakClient instance; they must share a single cached token.
    const r = resource({ id: "h.realm", type: "identity.realm", spec: { realm: "dxlab", clients: ["dx-web"] } });
    await identityRealm.apply(ctx, r);

    const tokenCalls = calls.filter(isTokenCall);
    expect(tokenCalls).toHaveLength(1);
    const protectedCalls = calls.filter((c) => !isTokenCall(c));
    expect(protectedCalls.length).toBeGreaterThan(1);
    for (const c of protectedCalls) expect(c.headers.Authorization).toBe("Bearer tok-1");
  });
});

describe("identity.realm", () => {
  it("creates the realm and missing clients when absent", async () => {
    const calls = stubFetch({
      [TOKEN_ROUTE]: tokenHandler(),
      "GET /admin/realms/dxlab": () => ({ status: 404 }),
      "POST /admin/realms": () => ({ status: 201 }),
      "GET /admin/realms/dxlab/clients?clientId=dx-web": () => ({ status: 200, body: [] }),
      "POST /admin/realms/dxlab/clients": () => ({ status: 201 }),
    });
    const ctx = ctxFor(creds());
    const r = resource({ id: "h.realm", type: "identity.realm", spec: { realm: "dxlab", displayName: "DX Lab", clients: ["dx-web"] } });

    const { externalId } = await identityRealm.apply(ctx, r);

    expect(externalId).toBe("dxlab");
    const createRealm = calls.find((c) => c.method === "POST" && c.path === "/admin/realms");
    expect(createRealm?.body).toEqual({ realm: "dxlab", enabled: true, displayName: "DX Lab" });
    const createClient = calls.find((c) => c.method === "POST" && c.path === "/admin/realms/dxlab/clients");
    expect(createClient?.body).toEqual({ clientId: "dx-web", publicClient: false, standardFlowEnabled: true, redirectUris: ["*"] });
  });

  it("is idempotent: a second apply issues no POST when the realm and clients already exist", async () => {
    const calls = stubFetch({
      [TOKEN_ROUTE]: tokenHandler(),
      "GET /admin/realms/dxlab": () => ({ status: 200, body: { realm: "dxlab" } }),
      "GET /admin/realms/dxlab/clients?clientId=dx-web": () => ({ status: 200, body: [{ id: "c1", clientId: "dx-web" }] }),
    });
    const ctx = ctxFor(creds());
    const r = resource({ id: "h.realm", type: "identity.realm", spec: { realm: "dxlab", displayName: "DX Lab", clients: ["dx-web"] } });

    const first = await identityRealm.apply(ctx, r);
    const second = await identityRealm.apply(ctx, r);

    expect(first.externalId).toBe("dxlab");
    expect(second.externalId).toBe("dxlab");
    expect(nonTokenPosts(calls)).toHaveLength(0);
  });

  it("verify reports the realm and each client, destroy deletes the realm", async () => {
    const calls = stubFetch({
      [TOKEN_ROUTE]: tokenHandler(),
      "GET /admin/realms/dxlab": () => ({ status: 200, body: { realm: "dxlab" } }),
      "GET /admin/realms/dxlab/clients?clientId=dx-web": () => ({ status: 200, body: [{ id: "c1" }] }),
      "DELETE /admin/realms/dxlab": () => ({ status: 204 }),
    });
    const ctx = ctxFor(creds());
    const r = resource({ id: "h.realm", type: "identity.realm", spec: { realm: "dxlab", clients: ["dx-web"] } });

    const checks = await identityRealm.verify(ctx, r, {} as StateEntry);
    expect(checks).toEqual([
      { name: "realm exists", ok: true, evidence: "GET /admin/realms/dxlab -> 200" },
      { name: "client dx-web exists", ok: true, evidence: "GET clients?clientId=dx-web -> 1 match(es)" },
    ]);

    await identityRealm.destroy(ctx, r, {} as StateEntry);
    expect(calls.some((c) => c.method === "DELETE" && c.path === "/admin/realms/dxlab")).toBe(true);
  });

  it("fails with MissingCredentials when ctx.credentials.keycloak is absent", async () => {
    const ctx = ctxFor({});
    const r = resource({ id: "h.realm", type: "identity.realm", spec: { realm: "dxlab" } });
    await expect(identityRealm.apply(ctx, r)).rejects.toThrow(MissingCredentials);
    await expect(identityRealm.verify(ctx, r, {} as StateEntry)).rejects.toThrow(MissingCredentials);
    await expect(identityRealm.destroy(ctx, r, {} as StateEntry)).rejects.toThrow(MissingCredentials);
  });
});

describe("identity.role", () => {
  it("creates the role under the realm recorded by h.realm when absent", async () => {
    const calls = stubFetch({
      [TOKEN_ROUTE]: tokenHandler(),
      "GET /admin/realms/dxlab/roles/coordinator": () => ({ status: 404 }),
      "POST /admin/realms/dxlab/roles": () => ({ status: 201 }),
    });
    const ctx = ctxFor(creds(), stateWithRealm("dxlab"));
    const r = resource({ id: "h.role.coordinator", type: "identity.role", spec: { name: "coordinator" } });

    const { externalId } = await identityRole.apply(ctx, r);

    expect(externalId).toBe("coordinator");
    const create = calls.find((c) => c.method === "POST" && c.path === "/admin/realms/dxlab/roles");
    expect(create?.body).toEqual({ name: "coordinator" });
  });

  it("falls back to realm dxlab when h.realm is not yet in state", async () => {
    stubFetch({
      [TOKEN_ROUTE]: tokenHandler(),
      "GET /admin/realms/dxlab/roles/coordinator": () => ({ status: 404 }),
      "POST /admin/realms/dxlab/roles": () => ({ status: 201 }),
    });
    const ctx = ctxFor(creds());
    const r = resource({ id: "h.role.coordinator", type: "identity.role", spec: { name: "coordinator" } });
    const { externalId } = await identityRole.apply(ctx, r);
    expect(externalId).toBe("coordinator");
  });

  it("is idempotent: a second apply issues no POST when the role already exists", async () => {
    const calls = stubFetch({
      [TOKEN_ROUTE]: tokenHandler(),
      "GET /admin/realms/dxlab/roles/coordinator": () => ({ status: 200, body: { name: "coordinator" } }),
    });
    const ctx = ctxFor(creds(), stateWithRealm());
    const r = resource({ id: "h.role.coordinator", type: "identity.role", spec: { name: "coordinator" } });

    const first = await identityRole.apply(ctx, r);
    const second = await identityRole.apply(ctx, r);

    expect(first.externalId).toBe("coordinator");
    expect(second.externalId).toBe("coordinator");
    expect(nonTokenPosts(calls)).toHaveLength(0);
  });

  it("verify checks existence, destroy deletes by name", async () => {
    const calls = stubFetch({
      [TOKEN_ROUTE]: tokenHandler(),
      "GET /admin/realms/dxlab/roles/coordinator": () => ({ status: 200, body: { name: "coordinator" } }),
      "DELETE /admin/realms/dxlab/roles/coordinator": () => ({ status: 204 }),
    });
    const ctx = ctxFor(creds(), stateWithRealm());
    const r = resource({ id: "h.role.coordinator", type: "identity.role", spec: { name: "coordinator" } });

    const checks = await identityRole.verify(ctx, r, {} as StateEntry);
    expect(checks).toEqual([{ name: "role exists", ok: true, evidence: "GET roles/coordinator -> 200" }]);

    await identityRole.destroy(ctx, r, {} as StateEntry);
    expect(calls.some((c) => c.method === "DELETE" && c.path === "/admin/realms/dxlab/roles/coordinator")).toBe(true);
  });

  it("fails with MissingCredentials when ctx.credentials.keycloak is absent", async () => {
    const ctx = ctxFor({}, stateWithRealm());
    const r = resource({ id: "h.role.coordinator", type: "identity.role", spec: { name: "coordinator" } });
    await expect(identityRole.apply(ctx, r)).rejects.toThrow(MissingCredentials);
  });
});

describe("identity.group", () => {
  it("ensures the parent group 'departments' before creating the child, in order", async () => {
    const calls = stubFetch({
      [TOKEN_ROUTE]: tokenHandler(),
      "GET /admin/realms/dxlab/groups?search=departments&exact=true": () => ({ status: 200, body: [] }),
      "POST /admin/realms/dxlab/groups": () => ({ status: 201, headers: { location: `${KEYCLOAK_URL}/admin/realms/dxlab/groups/parent-1` } }),
      "GET /admin/realms/dxlab/groups/parent-1/children?search=hr&exact=true": () => ({ status: 200, body: [] }),
      "POST /admin/realms/dxlab/groups/parent-1/children": () => ({ status: 201, headers: { location: `${KEYCLOAK_URL}/admin/realms/dxlab/groups/child-1` } }),
    });
    const ctx = ctxFor(creds(), stateWithRealm());
    const r = resource({ id: "h.group.hr", type: "identity.group", spec: { code: "hr", name: "Nhân sự" } });

    const { externalId } = await identityGroup.apply(ctx, r);

    expect(externalId).toBe("child-1");
    const relevant = calls.filter((c) => c.path.includes("/groups"));
    const parentSearchIdx = relevant.findIndex((c) => c.method === "GET" && c.path.endsWith("groups?search=departments&exact=true"));
    const parentCreateIdx = relevant.findIndex((c) => c.method === "POST" && c.path === "/admin/realms/dxlab/groups");
    const childSearchIdx = relevant.findIndex((c) => c.method === "GET" && c.path.includes("/groups/parent-1/children"));
    const childCreateIdx = relevant.findIndex((c) => c.method === "POST" && c.path === "/admin/realms/dxlab/groups/parent-1/children");
    expect(parentSearchIdx).toBeGreaterThanOrEqual(0);
    expect(parentSearchIdx).toBeLessThan(parentCreateIdx);
    expect(parentCreateIdx).toBeLessThan(childSearchIdx);
    expect(childSearchIdx).toBeLessThan(childCreateIdx);
    const childCreate = calls.find((c) => c.method === "POST" && c.path === "/admin/realms/dxlab/groups/parent-1/children");
    expect(childCreate?.body).toEqual({ name: "hr", attributes: { code: ["hr"], name: ["Nhân sự"] } });
  });

  it("is idempotent: a second apply issues no POST and returns the same id when parent and child already exist", async () => {
    const calls = stubFetch({
      [TOKEN_ROUTE]: tokenHandler(),
      "GET /admin/realms/dxlab/groups?search=departments&exact=true": () => ({ status: 200, body: [{ id: "parent-1", name: "departments" }] }),
      "GET /admin/realms/dxlab/groups/parent-1/children?search=hr&exact=true": () => ({ status: 200, body: [{ id: "child-1", name: "hr" }] }),
    });
    const ctx = ctxFor(creds(), stateWithRealm());
    const r = resource({ id: "h.group.hr", type: "identity.group", spec: { code: "hr", name: "Nhân sự" } });

    const first = await identityGroup.apply(ctx, r);
    const second = await identityGroup.apply(ctx, r);

    expect(first.externalId).toBe("child-1");
    expect(second.externalId).toBe("child-1");
    expect(nonTokenPosts(calls)).toHaveLength(0);
  });

  it("verify checks existence and that attributes.code matches, destroy deletes by id", async () => {
    const calls = stubFetch({
      [TOKEN_ROUTE]: tokenHandler(),
      "GET /admin/realms/dxlab/groups/child-1": () => ({ status: 200, body: { id: "child-1", name: "hr", attributes: { code: ["hr"], name: ["Nhân sự"] } } }),
      "DELETE /admin/realms/dxlab/groups/child-1": () => ({ status: 204 }),
    });
    const ctx = ctxFor(creds(), stateWithRealm());
    const r = resource({ id: "h.group.hr", type: "identity.group", spec: { code: "hr", name: "Nhân sự" } });
    const entry = { externalId: "child-1", checksum: "0".repeat(64), appliedAt: "2026-09-10T00:00:00.000Z", layer: "H" as const, spec: {} };

    const checks = await identityGroup.verify(ctx, r, entry);
    expect(checks).toEqual([
      { name: "group exists", ok: true, evidence: "GET groups/child-1 -> 200" },
      { name: "group code matches", ok: true, evidence: "attributes.code[0] = hr" },
    ]);

    await identityGroup.destroy(ctx, r, entry);
    expect(calls.some((c) => c.method === "DELETE" && c.path === "/admin/realms/dxlab/groups/child-1")).toBe(true);
  });

  it("fails with MissingCredentials when ctx.credentials.keycloak is absent", async () => {
    const ctx = ctxFor({}, stateWithRealm());
    const r = resource({ id: "h.group.hr", type: "identity.group", spec: { code: "hr", name: "Nhân sự" } });
    await expect(identityGroup.apply(ctx, r)).rejects.toThrow(MissingCredentials);
  });
});

describe("HttpError redaction", () => {
  it("never includes the admin password when the token endpoint rejects it", async () => {
    stubFetch({
      [TOKEN_ROUTE]: () => ({ status: 401, body: { error: "invalid_grant", error_description: `bad password: ${PASSWORD}` } }),
    });
    const ctx = ctxFor(creds());
    const r = resource({ id: "h.realm", type: "identity.realm", spec: { realm: "dxlab" } });

    await expect(identityRealm.apply(ctx, r)).rejects.toMatchObject({ status: 401 });
    try {
      await identityRealm.apply(ctx, r);
      expect.fail("expected apply to throw");
    } catch (e) {
      expect((e as Error).message).not.toContain(PASSWORD);
    }
  });

  it("redacts a bearer token and an access_token field echoed back in an unexpected-status body", async () => {
    const secretToken = "eyJhbGciOiJSUzI1NiJ9.abc.def-secret-token";
    const leaking = JSON.stringify({
      error: "server_error",
      authorization: `Bearer ${secretToken}`,
      access_token: secretToken,
      triedPassword: PASSWORD,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(leaking, { status: 500 })),
    );

    try {
      await request(`${KEYCLOAK_URL}/admin/realms/dxlab`, { method: "GET", expect: [200] }, [PASSWORD, secretToken]);
      expect.fail("expected HttpError");
    } catch (e) {
      const message = (e as Error).message;
      expect(message).not.toContain(secretToken);
      expect(message).not.toContain(PASSWORD);
      expect(message).not.toContain(`Bearer ${secretToken}`);
    }
  });
});
