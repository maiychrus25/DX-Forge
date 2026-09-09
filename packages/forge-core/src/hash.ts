// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash } from "node:crypto";

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
        .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

export function canonicalJson(v: unknown): string {
  return JSON.stringify(sortKeys(v));
}

export function checksum(v: unknown): string {
  return createHash("sha256").update(canonicalJson(v)).digest("hex");
}
