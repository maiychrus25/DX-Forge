// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { loadIntentFile } from "../src/schema/intent.js";
import { loadPacks } from "../src/packs/loader.js";
import { DuplicateResourceId, buildPlan } from "../src/planner/index.js";
import { PlanV1 } from "../src/schema/plan.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const intent = loadIntentFile(`${ROOT}examples/intent.example.yaml`);
const packs = loadPacks(`${ROOT}packs`);
const NOW = new Date("2026-09-10T00:00:00.000Z");

describe("buildPlan", () => {
  const plan = buildPlan(intent, packs, NOW);
  const ids = plan.resources.map((r) => r.id);

  it("is a valid PlanV1 with a stable intent hash and the intent's target", () => {
    expect(PlanV1.safeParse(plan).success).toBe(true);
    expect(plan.target).toBe("oss");
    expect(plan.intent_hash).toBe(buildPlan(intent, packs, NOW).intent_hash);
  });

  it("generates the H layer from organisation and channels", () => {
    for (const id of ["h.realm", "h.role.dx-admin", "h.role.manager", "h.role.staff", "h.group.cskh", "h.group.kd", "h.tree", "h.acl.resources", "h.acl.areas.cskh", "h.acl.areas.kd", "h.acl.archives", "h.portal", "h.channel", "h.topic.announce", "h.topic.alerts", "h.topic.approvals"]) {
      expect(ids, id).toContain(id);
    }
    const acl = plan.resources.find((r) => r.id === "h.acl.resources")!;
    expect(acl.spec).toMatchObject({ path: "3. [R] RESOURCES", group: "all-staff", mode: "read" });
  });

  it("expands the process pack and the org-scoped core pack", () => {
    expect(ids).toEqual(expect.arrayContaining(["cskh.entity", "cskh.form", "cskh.states", "core.offboardings.entity", "core.offboarding.workflow"]));
  });

  it("derives one dashboard, snapshot and LOD context per entity, masking PII fields", () => {
    expect(ids).toEqual(expect.arrayContaining(["d.dashboard.cskh", "d.snapshot.cskh", "d.lod.cskh", "d.dashboard.core.offboardings"]));
    const dash = plan.resources.find((r) => r.id === "d.dashboard.cskh")!;
    expect(dash.spec).toMatchObject({ entity: "cskh.entity", masking: ["customer_name", "customer_phone"] });
    expect(dash.depends_on).toContain("cskh.entity");
  });

  it("derives the I layer with an HITL policy per core process", () => {
    const policy = plan.resources.find((r) => r.id === "i.policy.cskh")!;
    expect(policy.spec).toMatchObject({ approval_channel: "h.topic.approvals", expire_hours: 24 });
    expect(ids).toEqual(expect.arrayContaining(["i.rag.resources", "i.assistant"]));
  });

  it("every resource has a non-empty reason and all gates default to allowed", () => {
    expect(plan.resources.every((r) => r.reason.length > 0 && r.gate.allowed)).toBe(true);
  });

  it("throws on a duplicate id", () => {
    const twice = { ...intent, core_processes: [intent.core_processes[0], intent.core_processes[0]] };
    expect(() => buildPlan(twice, packs, NOW)).toThrow(DuplicateResourceId);
  });

  it("matches the snapshot", () => {
    expect(plan).toMatchSnapshot();
  });
});
