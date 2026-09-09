// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { loadIntentFile } from "../src/schema/intent.js";
import { loadPacks } from "../src/packs/loader.js";
import { compile } from "../src/compile.js";
import { emptyState, type StateV1 } from "../src/schema/state.js";
import { diffPlan, resourceChecksum } from "../src/differ.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const intent = loadIntentFile(`${ROOT}examples/intent.example.yaml`);
const packs = loadPacks(`${ROOT}packs`);
const { plan } = compile(intent, packs, new Date("2026-09-10T00:00:00Z"));

function stateFor(ids: string[]): StateV1 {
  const s = emptyState("oss");
  for (const id of ids) {
    const r = plan.resources.find((x) => x.id === id)!;
    s.entries[id] = { externalId: `ext-${id}`, checksum: resourceChecksum(r), appliedAt: "2026-09-10T00:00:00.000Z" };
  }
  return s;
}

describe("diffPlan", () => {
  it("empty state → every allowed resource is created, gated ones are reported as gated, in apply order", () => {
    const changes = diffPlan(plan, emptyState("oss"));
    expect(changes[0]).toMatchObject({ id: "h.realm", action: "create", layer: "H" });
    expect(changes.filter((c) => c.action === "gated").map((c) => c.id)).toEqual(["i.rag.resources", "i.policy.cskh", "i.assistant"]);
    const layers = changes.filter((c) => c.action === "create").map((c) => c.layer);
    expect(layers.indexOf("P")).toBeGreaterThan(layers.lastIndexOf("H"));
    expect(layers.indexOf("D")).toBeGreaterThan(layers.lastIndexOf("P"));
  });
  it("same checksum → skip; changed spec → update with before/after", () => {
    const state = stateFor(["h.realm", "h.role.staff"]);
    state.entries["h.role.staff"].checksum = "0".repeat(64);
    const byId = Object.fromEntries(diffPlan(plan, state).map((c) => [c.id, c]));
    expect(byId["h.realm"].action).toBe("skip");
    expect(byId["h.role.staff"]).toMatchObject({ action: "update", after: { name: "staff" } });
    expect(byId["h.role.staff"].before).toBeUndefined(); // state holds only a checksum, not the old spec
  });
  it("entries in state but not in plan are destroyed only with prune, after everything else, in reverse order", () => {
    const state = stateFor(["h.realm"]);
    state.entries["zz.old"] = { externalId: "e", checksum: "1".repeat(64), appliedAt: "2026-09-10T00:00:00.000Z" };
    state.entries["aa.old"] = { externalId: "e", checksum: "1".repeat(64), appliedAt: "2026-09-10T00:00:00.000Z" };
    expect(diffPlan(plan, state).some((c) => c.action === "destroy")).toBe(false);
    const pruned = diffPlan(plan, state, { prune: true });
    expect(pruned.slice(-2).map((c) => [c.id, c.action])).toEqual([["aa.old", "destroy"], ["zz.old", "destroy"]]);
  });
  it("resourceChecksum ignores reason and gate but not spec or type", () => {
    const r = plan.resources[0];
    expect(resourceChecksum({ ...r, reason: "other", gate: { allowed: false } })).toBe(resourceChecksum(r));
    expect(resourceChecksum({ ...r, spec: { ...r.spec, extra: 1 } })).not.toBe(resourceChecksum(r));
  });
});
