// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { canonicalJson, checksum } from "../src/hash.js";

describe("canonicalJson / checksum", () => {
  it("is independent of key order and nested key order", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 1, e: 2 }] } })).toBe(canonicalJson({ a: { c: [3, { e: 2, f: 1 }], d: 2 }, b: 1 }));
  });
  it("produces a 64-char hex sha256 that changes with the value", () => {
    const h = checksum({ a: 1 });
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(checksum({ a: 2 })).not.toBe(h);
  });
  it("drops undefined properties like JSON.stringify does", () => {
    expect(checksum({ a: 1, b: undefined })).toBe(checksum({ a: 1 }));
  });
});
