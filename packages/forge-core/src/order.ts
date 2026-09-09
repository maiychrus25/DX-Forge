// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Layer } from "./schema/intent.js";
import type { Resource } from "./schema/plan.js";

export const LAYER_ORDER: Layer[] = ["H", "P", "D", "I"];

export class CyclicDependency extends Error {
  constructor(id: string) {
    super(`Cyclic dependency at ${id}`);
    this.name = "CyclicDependency";
  }
}

/** Stable topological order: layer rank first, then depends_on, then input order. */
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
