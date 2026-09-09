// SPDX-License-Identifier: AGPL-3.0-or-later
import { request, text } from "./http.js";

const HREF_RE = /<d:href>([^<]+)<\/d:href>/g;

/**
 * Minimal WebDAV client used by the Nextcloud adapter (`nextcloud.ts`). Every function takes the
 * full request URL, the headers to send (caller supplies `Authorization`) and the list of secrets
 * to redact from any error body, mirroring `http.ts`'s `request()` contract.
 */

/** Creates a collection. A Nextcloud server answers `405 Method Not Allowed` for a branch that
 * already exists (WebDAV RFC 2518 §8.3.1); that is treated as success, not a failure, so that
 * re-running `apply` on an already-built tree is a clean no-op. */
export async function mkcol(url: string, headers: Record<string, string>, secrets: string[] = []): Promise<void> {
  await request(url, { method: "MKCOL", headers, expect: [201, 405] }, secrets);
}

export async function put(url: string, body: string, headers: Record<string, string>, secrets: string[] = []): Promise<void> {
  await request(url, { method: "PUT", headers, body, expect: [201, 204] }, secrets);
}

export async function del(url: string, headers: Record<string, string>, secrets: string[] = []): Promise<void> {
  await request(url, { method: "DELETE", headers, expect: [204] }, secrets);
}

/** Depth-0/1 PROPFIND returning every `<d:href>` in the multistatus response, extracted with a
 * minimal regex rather than a full XML parser (the response bodies this adapter needs to read are
 * small and shaped consistently by Nextcloud). */
export async function propfind(url: string, depth: number, headers: Record<string, string>, secrets: string[] = []): Promise<string[]> {
  const res = await request(url, { method: "PROPFIND", headers: { ...headers, Depth: String(depth) }, expect: [207] }, secrets);
  const raw = await text(res);
  return [...raw.matchAll(HREF_RE)].map((m) => decodeURIComponent(m[1]));
}

export async function proppatch(url: string, xmlBody: string, headers: Record<string, string>, secrets: string[] = []): Promise<void> {
  await request(
    url,
    { method: "PROPPATCH", headers: { ...headers, "Content-Type": "application/xml; charset=utf-8" }, body: xmlBody, expect: [207] },
    secrets,
  );
}
