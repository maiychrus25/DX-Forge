// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { IntentV1, loadIntentFile } from "../src/schema/intent.js";
import { PlanV1, Resource } from "../src/schema/plan.js";
import { StateV1, emptyState } from "../src/schema/state.js";
import { SPEC_SCHEMAS } from "../src/schema/specs.js";

export const EXAMPLE = fileURLToPath(new URL("../../../examples/intent.example.yaml", import.meta.url));

describe("IntentV1", () => {
  it("parses the example intent and applies defaults", () => {
    const intent = loadIntentFile(EXAMPLE);
    expect(intent.organization.short_code).toBe("abc");
    expect(intent.core_processes[0].pack).toBe("dx-ticket");
    expect(intent.constraints.pii_masking).toBe(true);
    expect(intent.maturity?.shape).toBe("transitional");
  });
  it("rejects an upper-case short_code and a credentials_ref that is not an env var name", () => {
    const base = loadIntentFile(EXAMPLE);
    expect(IntentV1.safeParse({ ...base, organization: { ...base.organization, short_code: "ABC" } }).success).toBe(false);
    expect(IntentV1.safeParse({ ...base, target: { ...base.target, credentials_ref: "hunter2" } }).success).toBe(false);
  });
  it("allows maturity to be absent (unmeasured)", () => {
    const { maturity: _m, ...rest } = loadIntentFile(EXAMPLE);
    expect(IntentV1.safeParse(rest).success).toBe(true);
  });
});

describe("PlanV1 / Resource", () => {
  const res = { id: "h.realm", layer: "H", type: "identity.realm", spec: { realm: "dxlab" }, reason: "SSO" };
  it("defaults depends_on and gate", () => {
    const r = Resource.parse(res);
    expect(r.depends_on).toEqual([]);
    expect(r.gate).toEqual({ allowed: true });
  });
  it("requires a 64-char intent_hash and ISO generated_at", () => {
    const ok = PlanV1.safeParse({ version: 1, generated_at: new Date().toISOString(), intent_hash: "a".repeat(64), target: "oss", resources: [res] });
    expect(ok.success).toBe(true);
    expect(PlanV1.safeParse({ ...ok.data, intent_hash: "abc" }).success).toBe(false);
  });
  it("rejects a type without a dot and an id with spaces", () => {
    expect(Resource.safeParse({ ...res, type: "realm" }).success).toBe(false);
    expect(Resource.safeParse({ ...res, id: "h realm" }).success).toBe(false);
  });
});

describe("StateV1", () => {
  it("emptyState is valid", () => {
    expect(StateV1.safeParse(emptyState("oss")).success).toBe(true);
  });
});

describe("SPEC_SCHEMAS", () => {
  it("covers the validator-relevant types", () => {
    for (const t of ["process.entity", "process.form", "process.state_machine", "storage.acl", "data.dashboard", "intel.agent_policy"]) {
      expect(SPEC_SCHEMAS[t], t).toBeDefined();
    }
  });
  it("process.form rejects a field without a name", () => {
    expect(SPEC_SCHEMAS["process.form"].safeParse({ entity: "x", fields: [{ label: "Tiêu đề" }] }).success).toBe(false);
  });
});
