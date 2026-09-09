// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Adapter, ApplyContext, Check, Credentials } from "@dx-forge/forge-core";
import { MissingCredentials } from "@dx-forge/forge-core";
import { bearer, json, request } from "./http.js";

const TOKEN_REFRESH_MARGIN_MS = 30_000;

type KeycloakCredentials = NonNullable<Credentials["keycloak"]>;

/**
 * Thin client over the Keycloak admin REST API. `token()` fetches an admin access token via the
 * resource-owner password grant against the `master` realm and caches it until 30 s before it
 * expires; every other call reuses that cached token. Every request (including the token
 * request) carries the admin password (and, once known, the bearer token) as `secrets` so that
 * an unexpected-status body never leaks them into an error message.
 */
export function keycloakClient(creds: KeycloakCredentials) {
  let cached: { accessToken: string; expiresAt: number } | undefined;

  async function token(): Promise<string> {
    if (cached && Date.now() < cached.expiresAt - TOKEN_REFRESH_MARGIN_MS) return cached.accessToken;
    const body = new URLSearchParams({
      grant_type: "password",
      client_id: creds.realmAdminClient,
      username: creds.admin,
      password: creds.password,
    });
    const res = await request(
      `${creds.url}/realms/master/protocol/openid-connect/token`,
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString(), expect: [200] },
      [creds.password],
    );
    const data = await json<{ access_token: string; expires_in: number }>(res);
    cached = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return cached.accessToken;
  }

  async function call(path: string, init: RequestInit & { expect?: number[] }): Promise<Response> {
    const accessToken = await token();
    return request(
      `${creds.url}${path}`,
      { ...init, headers: { ...(init.headers ?? {}), Authorization: bearer(accessToken) } },
      [creds.password, accessToken],
    );
  }

  return {
    token,
    get: (path: string) => call(path, { method: "GET", expect: [200, 404] }),
    post: (path: string, body: unknown) =>
      call(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), expect: [201, 204] }),
    put: (path: string, body: unknown) =>
      call(path, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), expect: [204] }),
    del: (path: string) => call(path, { method: "DELETE", expect: [204] }),
  };
}

type KeycloakClient = ReturnType<typeof keycloakClient>;

function requireKeycloak(ctx: ApplyContext): KeycloakCredentials {
  if (!ctx.credentials.keycloak) throw new MissingCredentials("keycloak");
  return ctx.credentials.keycloak;
}

/** The realm a role/group resource applies to is the realm recorded by the `h.realm` resource
 * already in state, not a field on the role/group resource itself; `dxlab` is the fallback for
 * standalone tests and for a state file where `h.realm` has not been applied yet. */
function realmOf(ctx: ApplyContext): string {
  const realm = ctx.state.entries["h.realm"]?.spec.realm;
  return typeof realm === "string" ? realm : "dxlab";
}

function idFromLocation(res: Response): string {
  const location = res.headers.get("location");
  if (!location) throw new Error(`Keycloak did not return a Location header for ${res.url}.`);
  const segments = location.split("/").filter((s) => s.length > 0);
  return segments[segments.length - 1];
}

export const identityRealm: Adapter = {
  type: "identity.realm",

  async apply(ctx, resource) {
    const creds = requireKeycloak(ctx);
    const client = keycloakClient(creds);
    const realm = resource.spec.realm as string;
    const displayName = (resource.spec.displayName as string | undefined) ?? realm;

    const found = await client.get(`/admin/realms/${realm}`);
    if (found.status === 404) {
      await client.post("/admin/realms", { realm, enabled: true, displayName });
    }

    const clients = (resource.spec.clients as string[] | undefined) ?? [];
    for (const clientId of clients) {
      await ensureClient(client, realm, clientId);
    }

    return { externalId: realm };
  },

  async verify(ctx, resource) {
    const creds = requireKeycloak(ctx);
    const client = keycloakClient(creds);
    const realm = resource.spec.realm as string;
    const checks: Check[] = [];

    const res = await client.get(`/admin/realms/${realm}`);
    checks.push({ name: "realm exists", ok: res.status === 200, evidence: `GET /admin/realms/${realm} -> ${res.status}` });

    const clients = (resource.spec.clients as string[] | undefined) ?? [];
    for (const clientId of clients) {
      const found = await client.get(`/admin/realms/${realm}/clients?clientId=${encodeURIComponent(clientId)}`);
      const list = await json<unknown[]>(found);
      checks.push({ name: `client ${clientId} exists`, ok: list.length > 0, evidence: `GET clients?clientId=${clientId} -> ${list.length} match(es)` });
    }

    return checks;
  },

  async destroy(ctx, resource) {
    const creds = requireKeycloak(ctx);
    const client = keycloakClient(creds);
    const realm = resource.spec.realm as string;
    await client.del(`/admin/realms/${realm}`);
  },
};

async function ensureClient(client: KeycloakClient, realm: string, clientId: string): Promise<void> {
  const found = await client.get(`/admin/realms/${realm}/clients?clientId=${encodeURIComponent(clientId)}`);
  const list = await json<unknown[]>(found);
  if (list.length === 0) {
    await client.post(`/admin/realms/${realm}/clients`, { clientId, publicClient: false, standardFlowEnabled: true, redirectUris: ["*"] });
  }
}

export const identityRole: Adapter = {
  type: "identity.role",

  async apply(ctx, resource) {
    const creds = requireKeycloak(ctx);
    const client = keycloakClient(creds);
    const realm = realmOf(ctx);
    const name = resource.spec.name as string;

    const found = await client.get(`/admin/realms/${realm}/roles/${encodeURIComponent(name)}`);
    if (found.status === 404) {
      const description = resource.spec.description as string | undefined;
      await client.post(`/admin/realms/${realm}/roles`, description ? { name, description } : { name });
    }

    return { externalId: name };
  },

  async verify(ctx, resource) {
    const creds = requireKeycloak(ctx);
    const client = keycloakClient(creds);
    const realm = realmOf(ctx);
    const name = resource.spec.name as string;

    const res = await client.get(`/admin/realms/${realm}/roles/${encodeURIComponent(name)}`);
    return [{ name: "role exists", ok: res.status === 200, evidence: `GET roles/${name} -> ${res.status}` }];
  },

  async destroy(ctx, resource) {
    const creds = requireKeycloak(ctx);
    const client = keycloakClient(creds);
    const realm = realmOf(ctx);
    const name = resource.spec.name as string;
    await client.del(`/admin/realms/${realm}/roles/${encodeURIComponent(name)}`);
  },
};

type KeycloakGroup = { id: string; name: string; attributes?: Record<string, string[]> };

/** Groups live at `/departments/<code>`, a child of the parent group `departments`. The parent is
 * looked up (and created if absent) before the child so that a first apply never tries to create
 * a child under a non-existent parent. */
async function ensureParentGroup(client: KeycloakClient, realm: string): Promise<string> {
  const found = await client.get(`/admin/realms/${realm}/groups?search=departments&exact=true`);
  const list = await json<KeycloakGroup[]>(found);
  const existing = list.find((g) => g.name === "departments");
  if (existing) return existing.id;
  const created = await client.post(`/admin/realms/${realm}/groups`, { name: "departments" });
  return idFromLocation(created);
}

export const identityGroup: Adapter = {
  type: "identity.group",

  async apply(ctx, resource) {
    const creds = requireKeycloak(ctx);
    const client = keycloakClient(creds);
    const realm = realmOf(ctx);
    const code = resource.spec.code as string;
    const name = resource.spec.name as string;

    const parentId = await ensureParentGroup(client, realm);

    const found = await client.get(`/admin/realms/${realm}/groups/${parentId}/children?search=${encodeURIComponent(code)}&exact=true`);
    const list = await json<KeycloakGroup[]>(found);
    const existing = list.find((g) => g.name === code);
    if (existing) return { externalId: existing.id };

    const created = await client.post(`/admin/realms/${realm}/groups/${parentId}/children`, {
      name: code,
      attributes: { code: [code], name: [name] },
    });
    return { externalId: idFromLocation(created) };
  },

  async verify(ctx, resource, entry) {
    const creds = requireKeycloak(ctx);
    const client = keycloakClient(creds);
    const realm = realmOf(ctx);
    const code = resource.spec.code as string;

    const res = await client.get(`/admin/realms/${realm}/groups/${entry.externalId}`);
    if (res.status !== 200) {
      return [{ name: "group exists", ok: false, evidence: `GET groups/${entry.externalId} -> ${res.status}` }];
    }
    const group = await json<KeycloakGroup>(res);
    const actualCode = group.attributes?.code?.[0];
    return [
      { name: "group exists", ok: true, evidence: `GET groups/${entry.externalId} -> 200` },
      { name: "group code matches", ok: actualCode === code, evidence: `attributes.code[0] = ${actualCode ?? "∅"}` },
    ];
  },

  async destroy(ctx, _resource, entry) {
    const creds = requireKeycloak(ctx);
    const client = keycloakClient(creds);
    const realm = realmOf(ctx);
    await client.del(`/admin/realms/${realm}/groups/${entry.externalId}`);
  },
};
