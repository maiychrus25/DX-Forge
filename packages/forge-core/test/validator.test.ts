// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { loadIntentFile, type IntentV1 } from "../src/schema/intent.js";
import { loadPacks } from "../src/packs/loader.js";
import { buildPlan } from "../src/planner/index.js";
import { allowedLayers, applyGate } from "../src/validator/gate.js";
import { validatePlan } from "../src/validator/index.js";
import { compile } from "../src/compile.js";
import type { PlanV1, Resource } from "../src/schema/plan.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const intent = loadIntentFile(`${ROOT}examples/intent.example.yaml`);
const packs = loadPacks(`${ROOT}packs`);
const base = () => buildPlan(intent, packs, new Date("2026-09-10T00:00:00Z"));

function withMaturity(hpdi: { H: number; P: number; D: number; I: number }, shape: NonNullable<IntentV1["maturity"]>["shape"]): IntentV1 {
  return { ...intent, maturity: { assessment_id: "t", hpdi, shape, dti_level: 3, discrepancies: {} } };
}
function patch(plan: PlanV1, id: string, fn: (r: Resource) => Resource): PlanV1 {
  return { ...plan, resources: plan.resources.map((r) => (r.id === id ? fn(r) : r)) };
}
const rules = (plan: PlanV1, i: IntentV1 = intent) => validatePlan(plan, i).errors.map((e) => e.rule);

describe("maturity gate", () => {
  it("spear → only H", () => {
    expect([...allowedLayers(withMaturity({ H: 90, P: 10, D: 0, I: 0 }, "spear").maturity).layers]).toEqual(["H"]);
  });
  it("kite with P < 20 → H + P", () => {
    expect([...allowedLayers(withMaturity({ H: 75, P: 15, D: 5, I: 5 }, "kite").maturity).layers].sort()).toEqual(["H", "P"]);
  });
  it("transitional with P ≥ 20 → H + P + D", () => {
    expect([...allowedLayers(intent.maturity).layers].sort()).toEqual(["D", "H", "P"]);
  });
  it("illusion → H + P + D, I forbidden with GIGO", () => {
    const g = allowedLayers(withMaturity({ H: 65, P: 10, D: 15, I: 10 }, "illusion").maturity);
    expect(g.layers.has("I")).toBe(false);
    expect(g.why.I).toMatch(/GIGO/);
  });
  it("diamond → all four", () => {
    expect(allowedLayers(withMaturity({ H: 10, P: 30, D: 30, I: 30 }, "diamond").maturity).layers.size).toBe(4);
  });
  it("unmeasured → only H with an 'unmeasured' reason", () => {
    const g = allowedLayers(undefined);
    expect([...g.layers]).toEqual(["H"]);
    expect(g.why.P).toMatch(/unmeasured/);
  });
  it("applyGate keeps gated resources in the plan with allowed=false and why", () => {
    const gated = applyGate(base(), intent);
    const policy = gated.resources.find((r) => r.id === "i.policy.cskh")!;
    expect(policy.gate.allowed).toBe(false);
    expect(policy.gate.why).toBeTruthy();
    expect(gated.resources.find((r) => r.id === "h.realm")!.gate.allowed).toBe(true);
    expect(gated.resources.length).toBe(base().resources.length);
  });
});

describe("rules on the generated plan", () => {
  it("the generated plan for the example intent has no errors", () => {
    expect(validatePlan(base(), intent).errors).toEqual([]);
  });
  it("spec_schema: an entity without fields", () => {
    expect(rules(patch(base(), "cskh.entity", (r) => ({ ...r, spec: { table: "x" } })))).toContain("spec_schema");
  });
  it("one_a: a transition with two A roles fails; with one passes", () => {
    const bad = patch(base(), "cskh.states", (r) => ({ ...r, spec: { ...r.spec, transitions: [{ from: "new", to: "assigned", A: ["manager", "staff"] }] } }));
    expect(rules(bad)).toContain("one_a");
    const none = patch(base(), "cskh.states", (r) => ({ ...r, spec: { ...r.spec, transitions: [{ from: "new", to: "assigned", A: [] }] } }));
    expect(rules(none)).toContain("one_a");
  });
  it("max_required: six required fields fail with a hint about defaults", () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ name: `f${i}`, label: `F${i}`, required: true }));
    const bad = patch(base(), "cskh.form", (r) => ({ ...r, spec: { ...r.spec, fields: six } }));
    const err = validatePlan(bad, intent).errors.find((e) => e.rule === "max_required")!;
    expect(err.resourceId).toBe("cskh.form");
    expect(err.message).toMatch(/mặc định|default/);
  });
  it("resources_read_only: all-staff write on RESOURCES fails; read passes", () => {
    expect(rules(patch(base(), "h.acl.resources", (r) => ({ ...r, spec: { ...r.spec, mode: "write" } })))).toContain("resources_read_only");
    expect(rules(base())).not.toContain("resources_read_only");
  });
  it("pii_masking: a dashboard on a PII entity that does not mask every PII field fails", () => {
    expect(rules(patch(base(), "d.dashboard.cskh", (r) => ({ ...r, spec: { ...r.spec, masking: ["customer_name"] } })))).toContain("pii_masking");
  });
  it("pii_masking: entity without PII needs no masking", () => {
    const noPii = patch(base(), "cskh.entity", (r) => ({ ...r, spec: { ...r.spec, fields: [{ name: "code", type: "text" }] } }));
    const unmasked = patch(noPii, "d.dashboard.cskh", (r) => ({ ...r, spec: { ...r.spec, masking: [] } }));
    expect(rules(unmasked)).not.toContain("pii_masking");
  });
  it("hitl: empty approval_channel or expire_hours > 24 fails", () => {
    expect(rules(patch(base(), "i.policy.cskh", (r) => ({ ...r, spec: { ...r.spec, approval_channel: "" } })))).toContain("hitl");
    expect(rules(patch(base(), "i.policy.cskh", (r) => ({ ...r, spec: { ...r.spec, expire_hours: 48 } })))).toContain("hitl");
  });
  it("hitl: approval_channel must be an existing comms.topic", () => {
    expect(rules(patch(base(), "i.policy.cskh", (r) => ({ ...r, spec: { ...r.spec, approval_channel: "h.topic.nope" } })))).toContain("hitl");
  });
  it("dependencies: unknown id fails", () => {
    expect(rules(patch(base(), "cskh.form", (r) => ({ ...r, depends_on: ["ghost"] })))).toContain("dependencies");
  });
  it("dependencies: a cycle fails", () => {
    const cyc = patch(patch(base(), "cskh.form", (r) => ({ ...r, depends_on: ["cskh.app"] })), "cskh.app", (r) => ({ ...r, depends_on: ["cskh.form"] }));
    expect(rules(cyc)).toContain("dependencies");
  });
  it("errors are collected from all rules at once, not the first only", () => {
    const bad = patch(patch(base(), "h.acl.resources", (r) => ({ ...r, spec: { ...r.spec, mode: "write" } })), "cskh.form", (r) => ({ ...r, depends_on: ["ghost"] }));
    expect(new Set(rules(bad))).toEqual(new Set(["resources_read_only", "dependencies"]));
  });
});

describe("compile", () => {
  it("returns a gated plan and no errors for the example", () => {
    const { plan, errors } = compile(intent, packs, new Date("2026-09-10T00:00:00Z"));
    expect(errors).toEqual([]);
    expect(plan.resources.filter((r) => !r.gate.allowed).map((r) => r.layer)).toEqual(["I", "I", "I"]);
  });
});
