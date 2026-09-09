// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PlanV1, Resource } from "../schema/plan.js";
import { AclSpec, AgentPolicySpec, DashboardSpec, EntitySpec, FormSpec, SPEC_SCHEMAS, StateMachineSpec } from "../schema/specs.js";

export type ValidationError = { rule: string; resourceId?: string; message: string };
type Rule = (plan: PlanV1) => ValidationError[];

const byType = (plan: PlanV1, type: string) => plan.resources.filter((r) => r.type === type);

export const specSchema: Rule = (plan) =>
  plan.resources.flatMap((r) => {
    const schema = SPEC_SCHEMAS[r.type];
    if (!schema) return [];
    const res = schema.safeParse(r.spec);
    return res.success ? [] : [{ rule: "spec_schema", resourceId: r.id, message: res.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }];
  });

export const oneA: Rule = (plan) =>
  byType(plan, "process.state_machine").flatMap((r) => {
    const parsed = StateMachineSpec.safeParse(r.spec);
    if (!parsed.success) return [];
    return parsed.data.transitions
      .filter((t) => t.A.length !== 1)
      .map((t) => ({ rule: "one_a", resourceId: r.id, message: `Chuyển ${t.from} → ${t.to} phải có đúng một vai trò A, hiện có ${t.A.length}.` }));
  });

export const maxRequired: Rule = (plan) =>
  byType(plan, "process.form").flatMap((r) => {
    const parsed = FormSpec.safeParse(r.spec);
    if (!parsed.success) return [];
    const n = parsed.data.fields.filter((f) => f.required).length;
    return n > 5 ? [{ rule: "max_required", resourceId: r.id, message: `Form có ${n} trường bắt buộc (> 5). Đặt giá trị mặc định (default) cho các trường ít quan trọng.` }] : [];
  });

export const resourcesReadOnly: Rule = (plan) =>
  byType(plan, "storage.acl").flatMap((r) => {
    const parsed = AclSpec.safeParse(r.spec);
    if (!parsed.success) return [];
    const { path, group, mode } = parsed.data;
    return path.startsWith("3. [R] RESOURCES") && group === "all-staff" && mode !== "read"
      ? [{ rule: "resources_read_only", resourceId: r.id, message: "RESOURCES phải chỉ đọc (read) với all-staff." }]
      : [];
  });

export const piiMasking: Rule = (plan) => {
  const piiFields = new Map<string, string[]>();
  for (const e of byType(plan, "process.entity")) {
    const parsed = EntitySpec.safeParse(e.spec);
    if (parsed.success) piiFields.set(e.id, parsed.data.fields.filter((f) => f.pii).map((f) => f.name));
  }
  return byType(plan, "data.dashboard").flatMap((d) => {
    const parsed = DashboardSpec.safeParse(d.spec);
    if (!parsed.success) return [];
    const missing = (piiFields.get(parsed.data.entity) ?? []).filter((f) => !parsed.data.masking.includes(f));
    return missing.length > 0 ? [{ rule: "pii_masking", resourceId: d.id, message: `Dashboard chưa che trường PII: ${missing.join(", ")}.` }] : [];
  });
};

export const hitl: Rule = (plan) => {
  const topics = new Set(byType(plan, "comms.topic").map((t) => t.id));
  return byType(plan, "intel.agent_policy").flatMap((r) => {
    const parsed = AgentPolicySpec.safeParse(r.spec);
    if (!parsed.success) return [];
    const errs: ValidationError[] = [];
    if (!parsed.data.approval_channel) errs.push({ rule: "hitl", resourceId: r.id, message: "Chính sách tác tử phải có kênh duyệt (approval_channel)." });
    else if (!topics.has(parsed.data.approval_channel)) errs.push({ rule: "hitl", resourceId: r.id, message: `Kênh duyệt ${parsed.data.approval_channel} không phải comms.topic trong plan.` });
    if (parsed.data.expire_hours > 24) errs.push({ rule: "hitl", resourceId: r.id, message: `Hạn duyệt ${parsed.data.expire_hours}h vượt 24h.` });
    return errs;
  });
};

export const dependencies: Rule = (plan) => {
  const ids = new Map(plan.resources.map((r) => [r.id, r] as [string, Resource]));
  const errs: ValidationError[] = [];
  for (const r of plan.resources) {
    for (const d of r.depends_on) if (!ids.has(d)) errs.push({ rule: "dependencies", resourceId: r.id, message: `depends_on trỏ tới id không tồn tại: ${d}.` });
  }
  const state = new Map<string, 0 | 1 | 2>();
  const visit = (id: string, path: string[]): void => {
    const s = state.get(id) ?? 0;
    if (s === 2) return;
    if (s === 1) {
      errs.push({ rule: "dependencies", resourceId: id, message: `Vòng phụ thuộc: ${[...path, id].join(" → ")}.` });
      return;
    }
    state.set(id, 1);
    for (const d of ids.get(id)?.depends_on ?? []) if (ids.has(d)) visit(d, [...path, id]);
    state.set(id, 2);
  };
  for (const r of plan.resources) visit(r.id, []);
  return errs;
};

export const RULES: Rule[] = [specSchema, oneA, maxRequired, resourcesReadOnly, piiMasking, hitl, dependencies];
