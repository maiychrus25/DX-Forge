// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { applyPlan } from "../src/apply.js";
import { emptyState } from "../src/schema/state.js";
import type { PlanV1 } from "../src/schema/plan.js";

const plan: PlanV1 = { version: 1, generated_at: "2026-09-10T00:00:00.000Z", intent_hash: "a".repeat(64), target: "oss", resources: [
  { id: "h.realm", layer: "H", type: "identity.realm", spec: {}, reason: "x", depends_on: [], gate: { allowed: true } },
  { id: "cskh.entity", layer: "P", type: "process.entity", spec: {}, reason: "x", depends_on: [], gate: { allowed: true } },
], notes: [] };
const onlyH = { name: "oss", adapters: { "identity.realm": { apply: async () => ({ externalId: "r" }), verify: async () => [], destroy: async () => {} } } } as never;

describe("applyPlan dry-run describes a plan the provider cannot fully serve", () => {
  it("returns the table instead of throwing NoAdapter", async () => {
    const r = await applyPlan(plan, onlyH, {} as never, emptyState("oss"), { dryRun: true });
    expect(r.changes.length).toBe(2);
    expect(r.missingAdapters).toEqual(["process.entity"]);
  });
});
