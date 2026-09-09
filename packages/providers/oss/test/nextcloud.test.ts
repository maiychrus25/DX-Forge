// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplyContext, Credentials, Resource, StateEntry, StateV1 } from "@dx-forge/forge-core";
import { AdapterError, MissingCredentials } from "@dx-forge/forge-core";
import { portalSite, storageAcl, storageTree } from "../src/nextcloud.js";

const NC_URL = "https://nc.example.org";
const PASSWORD = "nc-s3cr3t";
const STAFF_PASSWORD = "staff-s3cr3t";
const ROOT = "CSKH-DXOS";

type RouteResult = { status: number; body?: unknown; rawBody?: string; headers?: Record<string, string> };
type RecordedCall = { method: string; path: string; body: unknown; headers: Record<string, string> };

/** A tiny router in front of a stubbed `fetch`, in the style of test/keycloak.test.ts: each test
 * registers one handler per `METHOD path` (path includes the query string) and every call made
 * against it is recorded so assertions can check method, path, body and headers. A handler may be
 * a function returning one `RouteResult`, or an array of functions consumed in order (so the same
 * route can answer differently across repeated calls, e.g. "not found" then "found"). */
function stubFetch(routes: Record<string, (() => RouteResult) | Array<() => RouteResult>>): RecordedCall[] {
  const calls: RecordedCall[] = [];
  const cursors: Record<string, number> = {};
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
      const fn = Array.isArray(handler) ? handler[Math.min(cursors[key] ?? 0, handler.length - 1)] : handler;
      if (Array.isArray(handler)) cursors[key] = (cursors[key] ?? 0) + 1;
      const result = fn();
      const bodyText = result.rawBody ?? (result.body !== undefined ? JSON.stringify(result.body) : null);
      return new Response(bodyText, { status: result.status, headers: result.headers });
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

function creds(opts: { staff?: boolean } = {}): Credentials {
  return {
    nextcloud: {
      url: NC_URL,
      user: "admin",
      password: PASSWORD,
      ...(opts.staff ? { staffUser: "staff.cskh", staffPassword: STAFF_PASSWORD } : {}),
    },
  };
}

function stateWithTreeAndGroup(): StateV1 {
  return {
    version: 1,
    target: "oss",
    entries: {
      "h.tree": {
        externalId: "42",
        checksum: "0".repeat(64),
        appliedAt: "2026-09-10T00:00:00.000Z",
        layer: "H",
        spec: { root: ROOT, branches: ["RESOURCES", "AREAS/CSKH"], readme: true, __type: "storage.tree" },
      },
      "h.group.cskh": {
        externalId: "kc-group-1",
        checksum: "0".repeat(64),
        appliedAt: "2026-09-10T00:00:00.000Z",
        layer: "H",
        spec: { code: "cskh", name: "CSKH", __type: "identity.group" },
      },
    },
  };
}

function ctxFor(credentials: Credentials, state: StateV1 = { version: 1, target: "oss", entries: {} }): ApplyContext {
  return { target: "oss", credentials, state, log: () => {}, now: () => new Date("2026-09-10T00:00:00Z") };
}

function resource(overrides: Partial<Resource> & Pick<Resource, "id" | "type" | "spec">): Resource {
  return { layer: "H", reason: "x", depends_on: [], gate: { allowed: true }, ...overrides };
}

const emptyEntry = {} as StateEntry;

beforeEach(() => {
  vi.unstubAllGlobals();
});

const GROUPS_BASE = "/ocs/v2.php/cloud/groups?format=json";
const FOLDERS_BASE = "/ocs/v2.php/apps/groupfolders/folders?format=json";
const DAV_BASE = "/remote.php/dav/files/admin";

function groupSearchRoutes(found: Record<string, boolean>) {
  const out: Record<string, () => RouteResult> = {};
  for (const [gid, exists] of Object.entries(found)) {
    out[`GET /ocs/v2.php/cloud/groups?search=${gid}&format=json`] = () => ({ status: 200, body: { ocs: { data: { groups: exists ? [gid] : [] } } } });
  }
  return out;
}

describe("storage.tree", () => {
  it("creates missing Nextcloud groups (all-staff, dx-admin, dept-<code> from identity.group state), maps departments/<code> to dept-<code>, creates the group folder, and MKCOLs every branch with a README", async () => {
    const calls = stubFetch({
      ...groupSearchRoutes({ "all-staff": false, "dx-admin": true, "dept-cskh": false }),
      [`POST ${GROUPS_BASE}`]: () => ({ status: 200, body: { ocs: { data: [] } } }),
      [`GET ${FOLDERS_BASE}`]: () => ({ status: 200, body: { ocs: { data: [] } } }),
      [`POST ${FOLDERS_BASE}`]: () => ({ status: 200, body: { ocs: { data: { id: 42 } } } }),
      "POST /ocs/v2.php/apps/groupfolders/folders/42/groups?format=json": () => ({ status: 200, body: { ocs: { data: [] } } }),
      "POST /ocs/v2.php/apps/groupfolders/folders/42/groups/all-staff?format=json": () => ({ status: 200, body: { ocs: { data: [] } } }),
      [`MKCOL ${DAV_BASE}/${ROOT}/RESOURCES`]: () => ({ status: 201 }),
      [`MKCOL ${DAV_BASE}/${ROOT}/AREAS`]: () => ({ status: 201 }),
      [`MKCOL ${DAV_BASE}/${ROOT}/AREAS/CSKH`]: () => ({ status: 201 }),
      [`PUT ${DAV_BASE}/${ROOT}/RESOURCES/README.md`]: () => ({ status: 201 }),
      [`PUT ${DAV_BASE}/${ROOT}/AREAS/CSKH/README.md`]: () => ({ status: 201 }),
    });
    const ctx = ctxFor(creds(), stateWithTreeAndGroup());
    const r = resource({ id: "h.tree", type: "storage.tree", spec: { root: ROOT, branches: ["RESOURCES", "AREAS/CSKH"], readme: true } });

    const { externalId } = await storageTree.apply(ctx, r);

    expect(externalId).toBe("42");

    // group creation only when search returns none
    const groupCreates = calls.filter((c) => c.method === "POST" && c.path === GROUPS_BASE);
    expect(groupCreates.map((c) => c.body)).toEqual([{ groupid: "all-staff" }, { groupid: "dept-cskh" }]);

    // README PUT count equals number of leaf branches (2)
    const readmePuts = calls.filter((c) => c.method === "PUT" && c.path.endsWith("README.md"));
    expect(readmePuts).toHaveLength(2);

    // MKCOL issued for every ancestor directory, parents first, each exactly once
    const mkcols = calls.filter((c) => c.method === "MKCOL").map((c) => c.path);
    expect(mkcols).toEqual([`${DAV_BASE}/${ROOT}/RESOURCES`, `${DAV_BASE}/${ROOT}/AREAS`, `${DAV_BASE}/${ROOT}/AREAS/CSKH`]);
  });

  it("folder lookup by mount point reuses the existing folder id and issues no create", async () => {
    stubFetch({
      ...groupSearchRoutes({ "all-staff": true, "dx-admin": true, "dept-cskh": true }),
      [`GET ${FOLDERS_BASE}`]: () => ({ status: 200, body: { ocs: { data: [{ id: 42, mount_point: ROOT }] } } }),
      "POST /ocs/v2.php/apps/groupfolders/folders/42/groups?format=json": () => ({ status: 200, body: { ocs: { data: [] } } }),
      "POST /ocs/v2.php/apps/groupfolders/folders/42/groups/all-staff?format=json": () => ({ status: 200, body: { ocs: { data: [] } } }),
      [`MKCOL ${DAV_BASE}/${ROOT}/RESOURCES`]: () => ({ status: 405 }),
      [`MKCOL ${DAV_BASE}/${ROOT}/AREAS`]: () => ({ status: 405 }),
      [`MKCOL ${DAV_BASE}/${ROOT}/AREAS/CSKH`]: () => ({ status: 405 }),
      [`PUT ${DAV_BASE}/${ROOT}/RESOURCES/README.md`]: () => ({ status: 201 }),
      [`PUT ${DAV_BASE}/${ROOT}/AREAS/CSKH/README.md`]: () => ({ status: 201 }),
    });
    const ctx = ctxFor(creds(), stateWithTreeAndGroup());
    const r = resource({ id: "h.tree", type: "storage.tree", spec: { root: ROOT, branches: ["RESOURCES", "AREAS/CSKH"], readme: true } });

    const { externalId } = await storageTree.apply(ctx, r);
    expect(externalId).toBe("42");
  });

  it("re-running apply is a clean no-op: MKCOL 405 on an existing branch does not fail the run", async () => {
    const routes = {
      ...groupSearchRoutes({ "all-staff": true, "dx-admin": true, "dept-cskh": true }),
      [`GET ${FOLDERS_BASE}`]: () => ({ status: 200, body: { ocs: { data: [{ id: 42, mount_point: ROOT }] } } }),
      "POST /ocs/v2.php/apps/groupfolders/folders/42/groups?format=json": () => ({ status: 200, body: { ocs: { data: [] } } }),
      "POST /ocs/v2.php/apps/groupfolders/folders/42/groups/all-staff?format=json": () => ({ status: 200, body: { ocs: { data: [] } } }),
      [`MKCOL ${DAV_BASE}/${ROOT}/RESOURCES`]: () => ({ status: 405 }),
      [`MKCOL ${DAV_BASE}/${ROOT}/AREAS`]: () => ({ status: 405 }),
      [`MKCOL ${DAV_BASE}/${ROOT}/AREAS/CSKH`]: () => ({ status: 405 }),
      [`PUT ${DAV_BASE}/${ROOT}/RESOURCES/README.md`]: () => ({ status: 201 }),
      [`PUT ${DAV_BASE}/${ROOT}/AREAS/CSKH/README.md`]: () => ({ status: 201 }),
    };
    const ctx = ctxFor(creds(), stateWithTreeAndGroup());
    const r = resource({ id: "h.tree", type: "storage.tree", spec: { root: ROOT, branches: ["RESOURCES", "AREAS/CSKH"], readme: true } });

    stubFetch(routes);
    const first = await storageTree.apply(ctx, r);
    stubFetch(routes);
    const second = await storageTree.apply(ctx, r);

    expect(first.externalId).toBe("42");
    expect(second.externalId).toBe("42");
  });

  it("wraps a non-405 4xx MKCOL failure in AdapterError", async () => {
    stubFetch({
      ...groupSearchRoutes({ "all-staff": true, "dx-admin": true, "dept-cskh": true }),
      [`GET ${FOLDERS_BASE}`]: () => ({ status: 200, body: { ocs: { data: [{ id: 42, mount_point: ROOT }] } } }),
      "POST /ocs/v2.php/apps/groupfolders/folders/42/groups?format=json": () => ({ status: 200, body: { ocs: { data: [] } } }),
      "POST /ocs/v2.php/apps/groupfolders/folders/42/groups/all-staff?format=json": () => ({ status: 200, body: { ocs: { data: [] } } }),
      [`MKCOL ${DAV_BASE}/${ROOT}/RESOURCES`]: () => ({ status: 409, body: { error: "conflict" } }),
    });
    const ctx = ctxFor(creds(), stateWithTreeAndGroup());
    const r = resource({ id: "h.tree", type: "storage.tree", spec: { root: ROOT, branches: ["RESOURCES"], readme: true } });

    await expect(storageTree.apply(ctx, r)).rejects.toThrow(AdapterError);
  });

  it("verify PROPFINDs every branch and destroy deletes the group folder", async () => {
    const multistatus = (path: string) =>
      `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>${DAV_BASE}/${ROOT}/${path}/</d:href></d:response></d:multistatus>`;
    const calls = stubFetch({
      [`PROPFIND ${DAV_BASE}/${ROOT}/RESOURCES`]: () => ({ status: 207, rawBody: multistatus("RESOURCES") }),
      [`PROPFIND ${DAV_BASE}/${ROOT}/AREAS/CSKH`]: () => ({ status: 207, rawBody: multistatus("AREAS/CSKH") }),
      "DELETE /ocs/v2.php/apps/groupfolders/folders/42?format=json": () => ({ status: 200, body: { ocs: { data: [] } } }),
    });
    const ctx = ctxFor(creds(), stateWithTreeAndGroup());
    const r = resource({ id: "h.tree", type: "storage.tree", spec: { root: ROOT, branches: ["RESOURCES", "AREAS/CSKH"], readme: true } });
    const entry: StateEntry = { externalId: "42", checksum: "0".repeat(64), appliedAt: "2026-09-10T00:00:00.000Z", layer: "H", spec: {} };

    const checks = await storageTree.verify(ctx, r, entry);
    expect(checks).toHaveLength(2);
    expect(checks.every((c) => c.ok)).toBe(true);

    await storageTree.destroy(ctx, r, entry);
    expect(calls.some((c) => c.method === "DELETE" && c.path === "/ocs/v2.php/apps/groupfolders/folders/42?format=json")).toBe(true);
  });

  it("fails with MissingCredentials when ctx.credentials.nextcloud is absent", async () => {
    const ctx = ctxFor({}, stateWithTreeAndGroup());
    const r = resource({ id: "h.tree", type: "storage.tree", spec: { root: ROOT, branches: ["RESOURCES"], readme: true } });
    await expect(storageTree.apply(ctx, r)).rejects.toThrow(MissingCredentials);
    await expect(storageTree.verify(ctx, r, emptyEntry)).rejects.toThrow(MissingCredentials);
    await expect(storageTree.destroy(ctx, r, emptyEntry)).rejects.toThrow(MissingCredentials);
  });

  it("never includes the Nextcloud password when a group search request fails", async () => {
    stubFetch({
      "GET /ocs/v2.php/cloud/groups?search=all-staff&format=json": () => ({
        status: 500,
        body: { error: `denied for password ${PASSWORD}` },
      }),
    });
    const ctx = ctxFor(creds(), stateWithTreeAndGroup());
    const r = resource({ id: "h.tree", type: "storage.tree", spec: { root: ROOT, branches: ["RESOURCES"], readme: true } });

    try {
      await storageTree.apply(ctx, r);
      expect.fail("expected apply to throw");
    } catch (e) {
      expect((e as Error).message).not.toContain(PASSWORD);
    }
  });
});

describe("storage.acl", () => {
  it("PROPPATCHes an ACL rule mapping departments/cskh to dept-cskh with permissions 31 for write", async () => {
    const calls = stubFetch({
      [`PROPPATCH ${DAV_BASE}/${ROOT}/AREAS/CSKH`]: () => ({ status: 207 }),
    });
    const ctx = ctxFor(creds(), stateWithTreeAndGroup());
    const r = resource({ id: "h.acl.areas.cskh", type: "storage.acl", spec: { path: "AREAS/CSKH", group: "departments/cskh", mode: "write" } });

    const { externalId } = await storageAcl.apply(ctx, r);

    expect(externalId).toBe("42:AREAS/CSKH:dept-cskh");
    const proppatch = calls.find((c) => c.method === "PROPPATCH");
    expect(proppatch?.body).toContain("<nc:acl-mapping-id>dept-cskh</nc:acl-mapping-id>");
    expect(proppatch?.body).toContain("<nc:acl-permissions>31</nc:acl-permissions>");
  });

  it("PROPPATCHes mask 1 permissions for all-staff read on RESOURCES", async () => {
    const calls = stubFetch({
      [`PROPPATCH ${DAV_BASE}/${ROOT}/RESOURCES`]: () => ({ status: 207 }),
    });
    const ctx = ctxFor(creds(), stateWithTreeAndGroup());
    const r = resource({ id: "h.acl.resources", type: "storage.acl", spec: { path: "RESOURCES", group: "all-staff", mode: "read" } });

    await storageAcl.apply(ctx, r);

    const proppatch = calls.find((c) => c.method === "PROPPATCH");
    expect(proppatch?.body).toContain("<nc:acl-mapping-id>all-staff</nc:acl-mapping-id>");
    expect(proppatch?.body).toContain("<nc:acl-permissions>1</nc:acl-permissions>");
  });

  it("RESOURCES is read-only for all-staff: a staff PUT probe into it must return 403 and the check must pass", async () => {
    stubFetch({
      [`PUT /remote.php/dav/files/staff.cskh/${ROOT}/RESOURCES/dxforge-probe.txt`]: () => ({ status: 403 }),
    });
    const ctx = ctxFor(creds({ staff: true }), stateWithTreeAndGroup());
    const r = resource({ id: "h.acl.resources", type: "storage.acl", spec: { path: "RESOURCES", group: "all-staff", mode: "read" } });
    const entry: StateEntry = { externalId: "42:RESOURCES:all-staff", checksum: "0".repeat(64), appliedAt: "2026-09-10T00:00:00.000Z", layer: "H", spec: {} };

    const checks = await storageAcl.verify(ctx, r, entry);

    expect(checks).toHaveLength(1);
    expect(checks[0].ok).toBe(true);
    expect(checks[0].evidence).toContain("403");
  });

  it("a department can write in its own AREAS/<name>: a staff PUT probe there must return 201, and the probe file is deleted", async () => {
    const calls = stubFetch({
      [`PUT /remote.php/dav/files/staff.cskh/${ROOT}/AREAS/CSKH/dxforge-probe.txt`]: () => ({ status: 201 }),
      [`DELETE /remote.php/dav/files/staff.cskh/${ROOT}/AREAS/CSKH/dxforge-probe.txt`]: () => ({ status: 204 }),
    });
    const ctx = ctxFor(creds({ staff: true }), stateWithTreeAndGroup());
    const r = resource({ id: "h.acl.areas.cskh", type: "storage.acl", spec: { path: "AREAS/CSKH", group: "departments/cskh", mode: "write" } });
    const entry: StateEntry = { externalId: "42:AREAS/CSKH:dept-cskh", checksum: "0".repeat(64), appliedAt: "2026-09-10T00:00:00.000Z", layer: "H", spec: {} };

    const checks = await storageAcl.verify(ctx, r, entry);

    expect(checks).toHaveLength(1);
    expect(checks[0].ok).toBe(true);
    expect(checks[0].evidence).toContain("201");
    expect(calls.some((c) => c.method === "DELETE" && c.path.endsWith("dxforge-probe.txt"))).toBe(true);
  });

  it("without staff credentials, verify reads the ACL rule back via PROPFIND acl-list", async () => {
    const aclBody = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:nc="http://nextcloud.org/ns"><d:response><d:propstat><d:prop><nc:acl-list><nc:acl><nc:acl-mapping-type>group</nc:acl-mapping-type><nc:acl-mapping-id>dept-cskh</nc:acl-mapping-id><nc:acl-mask>31</nc:acl-mask><nc:acl-permissions>31</nc:acl-permissions></nc:acl></nc:acl-list></d:prop></d:propstat></d:response></d:multistatus>`;
    stubFetch({
      [`PROPFIND ${DAV_BASE}/${ROOT}/AREAS/CSKH`]: () => ({ status: 207, rawBody: aclBody }),
    });
    const ctx = ctxFor(creds(), stateWithTreeAndGroup());
    const r = resource({ id: "h.acl.areas.cskh", type: "storage.acl", spec: { path: "AREAS/CSKH", group: "departments/cskh", mode: "write" } });
    const entry: StateEntry = { externalId: "42:AREAS/CSKH:dept-cskh", checksum: "0".repeat(64), appliedAt: "2026-09-10T00:00:00.000Z", layer: "H", spec: {} };

    const checks = await storageAcl.verify(ctx, r, entry);
    expect(checks).toHaveLength(1);
    expect(checks[0].ok).toBe(true);
  });

  it("destroy removes the ACL rule with an empty acl-list", async () => {
    const calls = stubFetch({
      [`PROPPATCH ${DAV_BASE}/${ROOT}/AREAS/CSKH`]: () => ({ status: 207 }),
    });
    const ctx = ctxFor(creds(), stateWithTreeAndGroup());
    const r = resource({ id: "h.acl.areas.cskh", type: "storage.acl", spec: { path: "AREAS/CSKH", group: "departments/cskh", mode: "write" } });
    const entry: StateEntry = { externalId: "42:AREAS/CSKH:dept-cskh", checksum: "0".repeat(64), appliedAt: "2026-09-10T00:00:00.000Z", layer: "H", spec: {} };

    await storageAcl.destroy(ctx, r, entry);
    const proppatch = calls.find((c) => c.method === "PROPPATCH");
    expect(proppatch?.body).toContain("<nc:acl-list></nc:acl-list>");
  });

  it("fails with MissingCredentials when ctx.credentials.nextcloud is absent", async () => {
    const ctx = ctxFor({}, stateWithTreeAndGroup());
    const r = resource({ id: "h.acl.resources", type: "storage.acl", spec: { path: "RESOURCES", group: "all-staff", mode: "read" } });
    await expect(storageAcl.apply(ctx, r)).rejects.toThrow(MissingCredentials);
  });

  it("never includes the Nextcloud password when the PROPPATCH request fails", async () => {
    stubFetch({
      [`PROPPATCH ${DAV_BASE}/${ROOT}/AREAS/CSKH`]: () => ({ status: 500, body: `password=${PASSWORD}` }),
    });
    const ctx = ctxFor(creds(), stateWithTreeAndGroup());
    const r = resource({ id: "h.acl.areas.cskh", type: "storage.acl", spec: { path: "AREAS/CSKH", group: "departments/cskh", mode: "write" } });

    try {
      await storageAcl.apply(ctx, r);
      expect.fail("expected apply to throw");
    } catch (e) {
      expect((e as Error).message).not.toContain(PASSWORD);
    }
  });

  it("never includes the staff password when the staff probe request fails unexpectedly", async () => {
    stubFetch({
      [`PUT /remote.php/dav/files/staff.cskh/${ROOT}/RESOURCES/dxforge-probe.txt`]: () => ({
        status: 500,
        body: `staff password was ${STAFF_PASSWORD}`,
      }),
    });
    const ctx = ctxFor(creds({ staff: true }), stateWithTreeAndGroup());
    const r = resource({ id: "h.acl.resources", type: "storage.acl", spec: { path: "RESOURCES", group: "all-staff", mode: "read" } });
    const entry: StateEntry = { externalId: "42:RESOURCES:all-staff", checksum: "0".repeat(64), appliedAt: "2026-09-10T00:00:00.000Z", layer: "H", spec: {} };

    try {
      await storageAcl.verify(ctx, r, entry);
      expect.fail("expected verify to throw");
    } catch (e) {
      expect((e as Error).message).not.toContain(STAFF_PASSWORD);
    }
  });
});

describe("portal.site", () => {
  const FILES = ["00. Portal/news.md", "00. Portal/handbook/index.md"];

  it("PUTs each portal file with a Vietnamese template body, creating parent directories first", async () => {
    const calls = stubFetch({
      [`MKCOL ${DAV_BASE}/${ROOT}/00.%20Portal`]: () => ({ status: 201 }),
      [`MKCOL ${DAV_BASE}/${ROOT}/00.%20Portal/handbook`]: () => ({ status: 201 }),
      [`PUT ${DAV_BASE}/${ROOT}/00.%20Portal/news.md`]: () => ({ status: 201 }),
      [`PUT ${DAV_BASE}/${ROOT}/00.%20Portal/handbook/index.md`]: () => ({ status: 201 }),
    });
    const ctx = ctxFor(creds(), stateWithTreeAndGroup());
    const r = resource({ id: "h.portal", type: "portal.site", spec: { files: FILES } });

    const { externalId } = await portalSite.apply(ctx, r);

    expect(externalId).toBe("portal");
    const handbookPut = calls.find((c) => c.method === "PUT" && c.path.endsWith("handbook/index.md"));
    expect(handbookPut?.body).toContain("Sổ tay sẽ được cập nhật bởi dxforge handbook");
  });

  it("verify PROPFINDs each file, destroy deletes each file", async () => {
    const multistatus = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>x</d:href></d:response></d:multistatus>`;
    const calls = stubFetch({
      [`PROPFIND ${DAV_BASE}/${ROOT}/00.%20Portal/news.md`]: () => ({ status: 207, rawBody: multistatus }),
      [`PROPFIND ${DAV_BASE}/${ROOT}/00.%20Portal/handbook/index.md`]: () => ({ status: 207, rawBody: multistatus }),
      [`DELETE ${DAV_BASE}/${ROOT}/00.%20Portal/news.md`]: () => ({ status: 204 }),
      [`DELETE ${DAV_BASE}/${ROOT}/00.%20Portal/handbook/index.md`]: () => ({ status: 204 }),
    });
    const ctx = ctxFor(creds(), stateWithTreeAndGroup());
    const r = resource({ id: "h.portal", type: "portal.site", spec: { files: FILES } });
    const entry: StateEntry = { externalId: "portal", checksum: "0".repeat(64), appliedAt: "2026-09-10T00:00:00.000Z", layer: "H", spec: {} };

    const checks = await portalSite.verify(ctx, r, entry);
    expect(checks).toHaveLength(2);
    expect(checks.every((c) => c.ok)).toBe(true);

    await portalSite.destroy(ctx, r, entry);
    expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(2);
  });

  it("fails with MissingCredentials when ctx.credentials.nextcloud is absent", async () => {
    const ctx = ctxFor({}, stateWithTreeAndGroup());
    const r = resource({ id: "h.portal", type: "portal.site", spec: { files: FILES } });
    await expect(portalSite.apply(ctx, r)).rejects.toThrow(MissingCredentials);
  });
});
