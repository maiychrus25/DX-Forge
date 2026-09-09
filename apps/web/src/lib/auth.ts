// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/session";

/** Re-exported so existing importers of `auth.ts` keep working; the Edge middleware imports them
 * from `@/lib/session` directly to stay clear of `node:crypto`. */
export { SESSION_COOKIE, isPublicPath } from "@/lib/session";


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
  return now >= issued && now - issued < SESSION_TTL_MS;
}

/** Compares SHA-256 digests, not the raw strings: digests are always 32 bytes, so a wrong password
 * costs the same time whatever its length. Returning early on a length mismatch would leak the
 * length of the admin password through response timing. */
export function checkPassword(expected: string, given: string): boolean {
  const a = createHash("sha256").update(expected, "utf8").digest();
  const b = createHash("sha256").update(given, "utf8").digest();
  return timingSafeEqual(a, b);
}

