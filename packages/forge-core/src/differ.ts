// SPDX-License-Identifier: AGPL-3.0-or-later
import { checksum } from "./hash.js";
import { topoSort } from "./order.js";
import type { Layer } from "./schema/intent.js";
import type { PlanV1, Resource } from "./schema/plan.js";
import type { StateV1 } from "./schema/state.js";

export type ChangeAction = "create" | "update" | "skip" | "destroy" | "gated";
export type Change = { id: string; action: ChangeAction; layer?: Layer; type?: string; before?: unknown; after?: unknown; why?: string };

/** What apply compares against state: only the things that change the real resource. */
export function resourceChecksum(r: Resource): string {
  return checksum({ type: r.type, spec: r.spec });
}

export function diffPlan(plan: PlanV1, state: StateV1, opts: { prune?: boolean } = {}): Change[] {
  const changes: Change[] = [];
  for (const r of topoSort(plan.resources)) {
    const base = { id: r.id, layer: r.layer, type: r.type };
    if (!r.gate.allowed) {
      changes.push({ ...base, action: "gated", why: r.gate.why });
      continue;
    }
    const entry = state.entries[r.id];
    if (!entry) changes.push({ ...base, action: "create", after: r.spec });
    else if (entry.checksum === resourceChecksum(r)) changes.push({ ...base, action: "skip" });
    else changes.push({ ...base, action: "update", after: r.spec });
  }
  if (opts.prune) {
    const planIds = new Set(plan.resources.map((r) => r.id));
    // ponytail: no layer info survives in state, so stale ids are destroyed in the reverse of
    // their order in state.entries. Store `layer` in StateEntry in plan 04 when real destroys
    // need H last.
    const stale = Object.keys(state.entries).filter((id) => !planIds.has(id)).reverse();
    for (const id of stale) changes.push({ id, action: "destroy" });
  }
  return changes;
}
