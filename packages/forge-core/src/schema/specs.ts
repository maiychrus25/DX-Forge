// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";

const Name = z.string().regex(/^[a-z][a-z0-9_]*$/);

export const EntitySpec = z.object({
  table: Name,
  fields: z.array(z.object({
    name: Name,
    type: z.enum(["text", "int", "numeric", "bool", "date", "timestamp", "enum"]),
    required: z.boolean().optional(),
    pii: z.boolean().optional(),
    options: z.array(z.string()).optional(),
  })).min(1),
});

export const FormSpec = z.object({
  entity: z.string().min(1),
  fields: z.array(z.object({
    name: Name,
    label: z.string().min(1),
    required: z.boolean().optional(),
    pattern: z.string().optional(),
    options: z.array(z.string()).optional(),
  })).min(1),
});

export const StateMachineSpec = z.object({
  entity: z.string().min(1),
  states: z.array(Name).min(2),
  transitions: z.array(z.object({ from: Name, to: Name, A: z.array(z.string()) })).min(1),
});

export const AclSpec = z.object({ path: z.string().min(1), group: z.string().min(1), mode: z.enum(["read", "write", "admin"]) });

export const DashboardSpec = z.object({
  entity: z.string().min(1),
  cards: z.array(z.object({ name: z.string().min(1), kind: z.enum(["count_by_state", "sla_breach", "trend"]) })).min(1),
  masking: z.array(z.string()).default([]),
});

export const AgentPolicySpec = z.object({
  actions: z.array(z.string().min(1)).min(1),
  approval_channel: z.string(),
  expire_hours: z.number().positive(),
});

export const SPEC_SCHEMAS: Record<string, z.ZodTypeAny> = {
  "process.entity": EntitySpec,
  "process.form": FormSpec,
  "process.state_machine": StateMachineSpec,
  "storage.acl": AclSpec,
  "data.dashboard": DashboardSpec,
  "intel.agent_policy": AgentPolicySpec,
};
