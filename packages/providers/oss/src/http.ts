// SPDX-License-Identifier: AGPL-3.0-or-later

const TIMEOUT_MS = 30_000;
const BODY_SNIPPET_LENGTH = 200;
const REDACTED = "[REDACTED]";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    bodySnippet: string,
  ) {
    super(`HTTP ${status} ${url}: ${bodySnippet}`);
    this.name = "HttpError";
  }
}

/**
 * Replaces every occurrence of every non-empty secret with a fixed placeholder. Called on every
 * response body attached to an `HttpError` so that passwords, admin tokens and bearer tokens
 * never leave the process in an error message, a log line or a report — targets like Keycloak
 * routinely echo request data (including `Authorization` headers and `access_token` fields) back
 * in error bodies.
 */
export function redact(s: string, secrets: string[]): string {
  let out = s;
  for (const secret of secrets) {
    if (!secret) continue;
    out = out.split(secret).join(REDACTED);
  }
  return out;
}

/**
 * Performs one HTTP call with a 30 s timeout. Throws `HttpError` (with a redacted, 200-character
 * body snippet) when the response status is not in `init.expect` (default `[200]`).
 */
export async function request(url: string, init: RequestInit & { expect?: number[] }, secrets: string[] = []): Promise<Response> {
  const { expect = [200], ...rest } = init;
  const res = await fetch(url, { ...rest, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!expect.includes(res.status)) {
    const body = await res.text().catch(() => "");
    const snippet = redact(body, secrets).slice(0, BODY_SNIPPET_LENGTH);
    throw new HttpError(res.status, url, snippet);
  }
  return res;
}

export const json = <T>(res: Response) => res.json() as Promise<T>;
export const text = (res: Response) => res.text();
export const basicAuth = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
export const bearer = (token: string) => `Bearer ${token}`;
