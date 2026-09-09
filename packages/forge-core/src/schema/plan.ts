// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";
import { Layer, TargetKind } from "./intent.js";

export const ResourceId = z.string().regex(/^[a-z0-9][a-z0-9.-]*$/);

export const Resource = z.object({
  id: ResourceId,
  layer: Layer,
  type: z.string().regex(/^[a-z_]+\.[a-z_]+$/),
  spec: z.record(z.string(), z.unknown()),
  reason: z.string().min(1),
  depends_on: z.array(ResourceId).default([]),
  gate: z.object({ allowed: z.boolean(), why: z.string().optional() }).default({ allowed: true }),
  source: z.object({ pack: z.string().optional(), process: z.string().optional() }).optional(),
});
export type Resource = z.infer<typeof Resource>;

export const PlanV1 = z.object({
  version: z.literal(1),
  generated_at: z.string().datetime(),
  intent_hash: z.string().regex(/^[0-9a-f]{64}$/),
  target: TargetKind,
  resources: z.array(Resource),
  notes: z.array(z.string()).default([]),
});
export type PlanV1 = z.infer<typeof PlanV1>;
