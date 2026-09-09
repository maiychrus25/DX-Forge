// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Layer } from "./schema/intent.js";
import type { Resource } from "./schema/plan.js";
import type { StateV1 } from "./schema/state.js";

export const LAYER_ORDER: Layer[] = ["H", "P", "D", "I"];

export class CyclicDependency extends Error {
  constructor(id: string) {
    super(`Cyclic dependency at ${id}`);
    this.name = "CyclicDependency";
  }
}

/**
 * Stable topological order for apply. Resources are grouped by layer (H → P → D → I) and by input
 * order, but a dependency is always emitted before its dependent, even when the dependency lives in a
 * later layer than the dependent. Generated plans never do that; a hand-edited plan may.
 */
export function topoSort(resources: Resource[]): Resource[] {
  const byId = new Map(resources.map((r) => [r.id, r]));
  const ranked = [...resources].sort((a, b) => LAYER_ORDER.indexOf(a.layer) - LAYER_ORDER.indexOf(b.layer));
  const out: Resource[] = [];
  const state = new Map<string, 1 | 2>();
  const visit = (r: Resource) => {
    const s = state.get(r.id);
    if (s === 2) return;
    if (s === 1) throw new CyclicDependency(r.id);
    state.set(r.id, 1);
    for (const d of r.depends_on) {
      const dep = byId.get(d);
      if (dep) visit(dep);
    }
    state.set(r.id, 2);
    out.push(r);
  };
  for (const r of ranked) visit(r);
  return out;
}

/**
 * Reverse of apply order: later layers first, and within a layer the most recently applied first, so
 * infrastructure is torn down after everything that sits on top of it. Shared by `applyPlan`'s
 * `--prune` pass and by `destroyPlan`, which must agree — two copies would be free to drift.
 */
export function destroyOrder(state: StateV1, ids: string[]): string[] {
  const position = new Map(ids.map((id, i) => [id, i]));
  return [...ids].sort(
    (a, b) => LAYER_ORDER.indexOf(state.entries[b]!.layer) - LAYER_ORDER.indexOf(state.entries[a]!.layer) || position.get(b)! - position.get(a)!,
  );
}
