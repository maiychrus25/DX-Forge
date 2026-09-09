// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { entryFor, readState, StateTargetMismatch, writeState } from "../src/state.js";
import type { Resource } from "../src/schema/plan.js";

const r: Resource = { id: "h.realm", layer: "H", type: "identity.realm", spec: { realm: "dxlab" }, reason: "x", depends_on: [], gate: { allowed: true } };

describe("state file", () => {
  it("returns an empty state for a missing file and round-trips entries with layer and spec", () => {
    const dir = mkdtempSync(join(tmpdir(), "dxf-"));
    const path = join(dir, "state.json");
    const s = readState(path, "oss");
    expect(s).toEqual({ version: 1, target: "oss", entries: {} });
    s.entries["h.realm"] = entryFor(r, "dxlab", new Date("2026-09-10T00:00:00Z"));
    writeState(path, s);
    expect(readState(path, "oss").entries["h.realm"]).toMatchObject({ externalId: "dxlab", layer: "H", spec: { realm: "dxlab" }, appliedAt: "2026-09-10T00:00:00.000Z" });
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(readFileSync(path, "utf8")).not.toContain("password");
  });
  it("refuses a state written for another target and tolerates old entries without layer/spec", () => {
    const dir = mkdtempSync(join(tmpdir(), "dxf-"));
    const path = join(dir, "state.json");
    writeState(path, { version: 1, target: "gws", entries: {} });
    expect(() => readState(path, "oss")).toThrow(StateTargetMismatch);
    writeState(path, { version: 1, target: "oss", entries: { old: { externalId: "e", checksum: "0".repeat(64), appliedAt: "2026-01-01T00:00:00.000Z" } as never } });
    expect(readState(path, "oss").entries.old).toMatchObject({ layer: "H", spec: {} });
  });
});
