// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";
import { TargetKind } from "./intent.js";

export const Check = z.object({ name: z.string(), ok: z.boolean(), evidence: z.string() });
export type Check = z.infer<typeof Check>;

export const StateEntry = z.object({
  externalId: z.string(),
  checksum: z.string().regex(/^[0-9a-f]{64}$/),
  appliedAt: z.string().datetime(),
  verify: z.object({ ok: z.boolean(), checks: z.array(Check) }).optional(),
});
export type StateEntry = z.infer<typeof StateEntry>;

export const StateV1 = z.object({
  version: z.literal(1),
  target: TargetKind,
  entries: z.record(z.string(), StateEntry),
});
export type StateV1 = z.infer<typeof StateV1>;

export function emptyState(target: TargetKind): StateV1 {
  return { version: 1, target, entries: {} };
}
