// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The parts of the session contract that the Edge middleware needs. Kept apart from `auth.ts`
 * because that module imports `node:crypto`, which the Edge Runtime does not provide: importing it
 * from `middleware.ts` pulls the whole module in and fails the build. Nothing here needs crypto.
 */
export const SESSION_COOKIE = "forge_session";
export const SESSION_TTL_MS = 12 * 3600 * 1000;

const PUBLIC_PREFIXES = ["/pulse/s/", "/api/pulse/survey/", "/login", "/api/auth/", "/api/health", "/about", "/_next/", "/logo.svg", "/favicon.ico"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p));
}
