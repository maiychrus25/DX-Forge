// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Adapter, ApplyContext, Check, Credentials, StateV1 } from "@dx-forge/forge-core";
import { AdapterError, MissingCredentials } from "@dx-forge/forge-core";
import { basicAuth, HttpError, json, request, text } from "./http.js";
import { del, mkcol, propfind, proppatch, put } from "./webdav.js";

type NextcloudCredentials = NonNullable<Credentials["nextcloud"]>;

const MASK_READ = 1;
const MASK_FULL = 31;

/** Nextcloud OCS provisioning + groupfolders client. Every call carries the admin password as a
 * secret (see `http.ts#redact`) so an unexpected-status body never leaks it into an error message.
 * `format=json` and `OCS-APIRequest: true` are mandatory: without either, Nextcloud answers with
 * an HTML page instead of the JSON `{ ocs: { data } }` envelope. */
function nextcloudClient(creds: NextcloudCredentials) {
  async function ocs(path: string, init: RequestInit & { expect?: number[] }): Promise<unknown> {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${creds.url}/ocs/v2.php${path}${sep}format=json`;
    const headers = {
      Authorization: basicAuth(creds.user, creds.password),
      "OCS-APIRequest": "true",
      Accept: "application/json",
      ...(init.headers ?? {}),
    };
    const res = await request(url, { ...init, headers }, [creds.password]);
    const body = await json<{ ocs: { data: unknown } }>(res);
    return body.ocs.data;
  }

  return {
    ocsGet: (path: string) => ocs(path, { method: "GET", expect: [200] }),
    ocsPost: (path: string, body: Record<string, string>) =>
      ocs(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), expect: [200] }),
    ocsDelete: (path: string) => ocs(path, { method: "DELETE", expect: [200] }),
  };
}

type NextcloudClient = ReturnType<typeof nextcloudClient>;
type GroupFolder = { id: number | string; mount_point: string };

function requireNextcloud(ctx: ApplyContext): NextcloudCredentials {
  if (!ctx.credentials.nextcloud) throw new MissingCredentials("nextcloud");
  return ctx.credentials.nextcloud;
}

/** Nextcloud group ids follow their own convention (`all-staff`, `dx-admin`, `dept-<code>`) while
 * plan resources name departments `departments/<code>` (matching Keycloak's group path); this is
 * the one place that translates between the two so an ACL is never silently applied to a
 * non-existent Nextcloud group. */
function mapGroupId(group: string): string {
  const m = /^departments\/(.+)$/.exec(group);
  return m ? `dept-${m[1]}` : group;
}

function permissionsFor(mode: "read" | "write" | "admin"): number {
  return mode === "read" ? MASK_READ : MASK_FULL;
}

/** `storage.tree` applies before the department Nextcloud groups it needs to reference are known
 * from its own resource spec; it reads them back from the `identity.group` state entries that
 * `apply` writes earlier in the same run (see plan Task 5 note on group id mapping). */
function departmentCodesFromState(state: StateV1): string[] {
  const codes: string[] = [];
  for (const entry of Object.values(state.entries)) {
    if (entry.spec.__type !== "identity.group") continue;
    const attributes = entry.spec.attributes as { code?: unknown } | undefined;
    const code = typeof entry.spec.code === "string" ? entry.spec.code : attributes?.code;
    if (typeof code === "string") codes.push(code);
  }
  return codes;
}

async function ensureGroup(client: NextcloudClient, gid: string): Promise<void> {
  const data = (await client.ocsGet(`/cloud/groups?search=${encodeURIComponent(gid)}`)) as { groups?: string[] } | undefined;
  if (data?.groups?.includes(gid)) return;
  await client.ocsPost("/cloud/groups", { groupid: gid });
}

async function ensureGroupFolder(client: NextcloudClient, root: string): Promise<string> {
  const data = await client.ocsGet("/apps/groupfolders/folders");
  const list = (Array.isArray(data) ? data : Object.values(data as Record<string, GroupFolder>)) as GroupFolder[];
  const existing = list.find((f) => f.mount_point === root);
  if (existing) return String(existing.id);
  const created = (await client.ocsPost("/apps/groupfolders/folders", { mountpoint: root })) as { id: number | string };
  return String(created.id);
}

async function addGroupToFolder(client: NextcloudClient, folderId: string, gid: string, permissions: number): Promise<void> {
  await client.ocsPost(`/apps/groupfolders/folders/${folderId}/groups`, { group: gid });
  await client.ocsPost(`/apps/groupfolders/folders/${folderId}/groups/${gid}`, { permissions: String(permissions) });
}

type DavContext = { base: string; headers: Record<string, string>; secrets: string[] };

function webdavContext(creds: NextcloudCredentials, user: string = creds.user, password: string = creds.password): DavContext {
  return {
    base: `${creds.url}/remote.php/dav/files/${encodeURIComponent(user)}`,
    headers: { Authorization: basicAuth(user, password) },
    secrets: [password],
  };
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function davUrl(dav: DavContext, root: string, path?: string): string {
  const full = path ? `${root}/${path}` : root;
  return `${dav.base}/${encodePath(full)}`;
}

/** Wraps a WebDAV `MKCOL` failure that is not the tolerated "already exists" 405 into an
 * `AdapterError` carrying the resource id and the (already redacted) HTTP status/body. */
async function ensureCollection(dav: DavContext, root: string, path: string, resourceId: string): Promise<void> {
  try {
    await mkcol(davUrl(dav, root, path), dav.headers, dav.secrets);
  } catch (e) {
    if (e instanceof HttpError) throw new AdapterError(resourceId, `Không thể tạo thư mục Nextcloud "${path}": ${e.message}`, e.status);
    throw e;
  }
}

/** The Vietnamese one-liner dropped into every leaf branch so an operator opening the tree for the
 * first time sees it was generated, not hand-built. */
function readmeBody(branch: string): string {
  const name = branch.split("/").pop() ?? branch;
  return `# ${name}\n\nThư mục này được dxforge khởi tạo tự động theo cấu trúc P.A.R.A; vui lòng không đổi tên hay di chuyển.\n`;
}

function aclXml(gid: string, permissions: number): string {
  return (
    `<?xml version="1.0"?>` +
    `<d:propertyupdate xmlns:d="DAV:" xmlns:nc="http://nextcloud.org/ns"><d:set><d:prop><nc:acl-list>` +
    `<nc:acl><nc:acl-mapping-type>group</nc:acl-mapping-type><nc:acl-mapping-id>${gid}</nc:acl-mapping-id>` +
    `<nc:acl-mask>${MASK_FULL}</nc:acl-mask><nc:acl-permissions>${permissions}</nc:acl-permissions></nc:acl>` +
    `</nc:acl-list></d:prop></d:set></d:propertyupdate>`
  );
}

const EMPTY_ACL_XML =
  `<?xml version="1.0"?>` +
  `<d:propertyupdate xmlns:d="DAV:" xmlns:nc="http://nextcloud.org/ns"><d:set><d:prop><nc:acl-list></nc:acl-list></d:prop></d:set></d:propertyupdate>`;

const ACL_PROPFIND_BODY =
  `<?xml version="1.0"?>` + `<d:propfind xmlns:d="DAV:" xmlns:nc="http://nextcloud.org/ns"><d:prop><nc:acl-list/></d:prop></d:propfind>`;

/** The group folder id and mount point (`spec.root`) that `storage.acl` and `portal.site` need are
 * recorded only on the `storage.tree` state entry (`h.tree`), which their `depends_on` guarantees
 * is applied first. */
function treeRoot(ctx: ApplyContext, resourceId: string): string {
  const entry = ctx.state.entries["h.tree"];
  const root = entry?.spec.root;
  if (typeof root !== "string") throw new Error(`Resource ${resourceId} requires state entry "h.tree" (storage.tree) with spec.root already applied.`);
  return root;
}

function treeFolderId(ctx: ApplyContext, resourceId: string): string {
  const entry = ctx.state.entries["h.tree"];
  if (!entry) throw new Error(`Resource ${resourceId} requires state entry "h.tree" (storage.tree) already applied.`);
  return entry.externalId;
}

export const storageTree: Adapter = {
  type: "storage.tree",

  async apply(ctx, resource) {
    const creds = requireNextcloud(ctx);
    const client = nextcloudClient(creds);
    const root = resource.spec.root as string;
    const branches = resource.spec.branches as string[];

    await ensureGroup(client, "all-staff");
    await ensureGroup(client, "dx-admin");
    for (const code of departmentCodesFromState(ctx.state)) {
      await ensureGroup(client, `dept-${code}`);
    }

    const folderId = await ensureGroupFolder(client, root);
    await addGroupToFolder(client, folderId, "all-staff", MASK_READ);

    const dav = webdavContext(creds);
    const createdDirs = new Set<string>();
    for (const branch of branches) {
      let acc = "";
      for (const segment of branch.split("/")) {
        acc = acc ? `${acc}/${segment}` : segment;
        if (createdDirs.has(acc)) continue;
        createdDirs.add(acc);
        await ensureCollection(dav, root, acc, resource.id);
      }
    }
    for (const branch of branches) {
      await put(davUrl(dav, root, `${branch}/README.md`), readmeBody(branch), dav.headers, dav.secrets);
    }

    return { externalId: folderId };
  },

  async verify(ctx, resource) {
    const creds = requireNextcloud(ctx);
    const root = resource.spec.root as string;
    const branches = resource.spec.branches as string[];
    const dav = webdavContext(creds);
    const checks: Check[] = [];
    for (const branch of branches) {
      const hrefs = await propfind(davUrl(dav, root, branch), 1, dav.headers, dav.secrets);
      checks.push({ name: `branch "${branch}" exists`, ok: hrefs.length > 0, evidence: `PROPFIND ${branch} -> ${hrefs.length} href(s)` });
    }
    return checks;
  },

  async destroy(ctx, _resource, entry) {
    const creds = requireNextcloud(ctx);
    const client = nextcloudClient(creds);
    await client.ocsDelete(`/apps/groupfolders/folders/${entry.externalId}`);
  },
};

export const storageAcl: Adapter = {
  type: "storage.acl",

  async apply(ctx, resource) {
    const creds = requireNextcloud(ctx);
    const path = resource.spec.path as string;
    const group = resource.spec.group as string;
    const mode = resource.spec.mode as "read" | "write" | "admin";
    const gid = mapGroupId(group);
    const folderId = treeFolderId(ctx, resource.id);
    const root = treeRoot(ctx, resource.id);

    if (mode === "admin") {
      const client = nextcloudClient(creds);
      await addGroupToFolder(client, folderId, gid, MASK_FULL);
    }

    const dav = webdavContext(creds);
    await proppatch(davUrl(dav, root, path), aclXml(gid, permissionsFor(mode)), dav.headers, dav.secrets);

    return { externalId: `${folderId}:${path}:${gid}` };
  },

  async verify(ctx, resource) {
    const creds = requireNextcloud(ctx);
    const path = resource.spec.path as string;
    const mode = resource.spec.mode as "read" | "write" | "admin";
    const gid = mapGroupId(resource.spec.group as string);
    const root = treeRoot(ctx, resource.id);

    if (creds.staffUser && creds.staffPassword) {
      const dav = webdavContext(creds, creds.staffUser, creds.staffPassword);
      const probePath = `${path}/dxforge-probe.txt`;
      const url = davUrl(dav, root, probePath);
      const res = await request(url, { method: "PUT", headers: dav.headers, body: "dxforge probe", expect: [201, 403, 409] }, dav.secrets);
      if (res.status === 201) await del(url, dav.headers, dav.secrets);
      const expected = mode === "write" ? 201 : 403;
      return [{ name: `staff probe on ${path}`, ok: res.status === expected, evidence: `PUT ${path}/dxforge-probe.txt -> ${res.status}` }];
    }

    const dav = webdavContext(creds);
    const url = davUrl(dav, root, path);
    const res = await request(
      url,
      { method: "PROPFIND", headers: { ...dav.headers, Depth: "0", "Content-Type": "application/xml; charset=utf-8" }, body: ACL_PROPFIND_BODY, expect: [207] },
      dav.secrets,
    );
    const raw = await text(res);
    const hasMapping = raw.includes(`<nc:acl-mapping-id>${gid}</nc:acl-mapping-id>`);
    const hasPermissions = raw.includes(`<nc:acl-permissions>${permissionsFor(mode)}</nc:acl-permissions>`);
    return [{ name: `ACL rule on ${path}`, ok: hasMapping && hasPermissions, evidence: `PROPFIND acl-list ${path} -> mapping=${hasMapping} permissions=${hasPermissions}` }];
  },

  async destroy(ctx, resource) {
    const creds = requireNextcloud(ctx);
    const path = resource.spec.path as string;
    const root = treeRoot(ctx, resource.id);
    const dav = webdavContext(creds);
    await proppatch(davUrl(dav, root, path), EMPTY_ACL_XML, dav.headers, dav.secrets);
  },
};

export const portalSite: Adapter = {
  type: "portal.site",

  async apply(ctx, resource) {
    const creds = requireNextcloud(ctx);
    const root = treeRoot(ctx, resource.id);
    const dav = webdavContext(creds);
    const files = resource.spec.files as string[];

    const createdDirs = new Set<string>();
    for (const file of files) {
      const segments = file.split("/");
      segments.pop();
      let acc = "";
      for (const segment of segments) {
        acc = acc ? `${acc}/${segment}` : segment;
        if (createdDirs.has(acc)) continue;
        createdDirs.add(acc);
        await ensureCollection(dav, root, acc, resource.id);
      }
    }
    for (const file of files) {
      await put(davUrl(dav, root, file), portalBody(file, ctx.now()), dav.headers, dav.secrets);
    }

    return { externalId: "portal" };
  },

  async verify(ctx, resource) {
    const creds = requireNextcloud(ctx);
    const root = treeRoot(ctx, resource.id);
    const dav = webdavContext(creds);
    const files = resource.spec.files as string[];
    const checks: Check[] = [];
    for (const file of files) {
      const hrefs = await propfind(davUrl(dav, root, file), 0, dav.headers, dav.secrets);
      checks.push({ name: `file ${file} exists`, ok: hrefs.length > 0, evidence: `PROPFIND ${file} -> ${hrefs.length} href(s)` });
    }
    return checks;
  },

  async destroy(ctx, resource) {
    const creds = requireNextcloud(ctx);
    const root = treeRoot(ctx, resource.id);
    const dav = webdavContext(creds);
    const files = resource.spec.files as string[];
    for (const file of files) await del(davUrl(dav, root, file), dav.headers, dav.secrets);
  },
};

function portalBody(file: string, now: Date): string {
  if (file.endsWith("handbook/index.md")) {
    return "Sổ tay sẽ được cập nhật bởi dxforge handbook\n";
  }
  const date = now.toISOString().slice(0, 10);
  return `# Tin tức\n\nChào mừng đến với DX-OS! Cổng thông tin cập nhật ngày ${date}.\n`;
}
