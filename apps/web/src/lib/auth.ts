// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "forge_session";
const TTL_MS = 12 * 3600 * 1000;

function hmac(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

export function signSession(secret: string, issuedAt: number = Date.now()): string {
  return `${issuedAt}.${hmac(secret, String(issuedAt))}`;
}

export function verifySession(secret: string, cookie: string | undefined, now: number = Date.now()): boolean {
  if (!cookie) return false;
  const [ts, sig] = cookie.split(".");
  if (!ts || !sig || !/^\d+$/.test(ts)) return false;
  const expected = hmac(secret, ts);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const issued = Number(ts);
  return now >= issued && now - issued < TTL_MS;
}

/** Compares SHA-256 digests, not the raw strings: digests are always 32 bytes, so a wrong password
 * costs the same time whatever its length. Returning early on a length mismatch would leak the
 * length of the admin password through response timing. */
export function checkPassword(expected: string, given: string): boolean {
  const a = createHash("sha256").update(expected, "utf8").digest();
  const b = createHash("sha256").update(given, "utf8").digest();
  return timingSafeEqual(a, b);
}

const PUBLIC_PREFIXES = ["/pulse/s/", "/api/pulse/survey/", "/login", "/api/auth/", "/api/health", "/about", "/_next/", "/logo.svg", "/favicon.ico"];
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p));
}
