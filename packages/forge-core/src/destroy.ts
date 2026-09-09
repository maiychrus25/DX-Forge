// SPDX-License-Identifier: AGPL-3.0-or-later
import { ApplyError } from "./apply.js";
import type { Credentials } from "./credentials.js";
import { destroyOrder } from "./order.js";
import type { ApplyContext, Provider } from "./provider.js";
import type { PlanV1, Resource } from "./schema/plan.js";
import type { StateV1 } from "./schema/state.js";

export type DestroyProgressEvent = { id: string; status: "start" | "done" | "failed" };
export type DestroyOptions = { prune?: boolean; onProgress?: (e: DestroyProgressEvent) => void; now?: () => Date };
export type DestroyResult = { state: StateV1; destroyed: string[] };


/** `entryFor` (state.ts) stores `__type` inside `spec` so a stale entry — one no longer in the plan —
 * can still find its adapter here. */
function typeOf(entry: StateV1["entries"][string]): string | undefined {
  return typeof entry.spec.__type === "string" ? (entry.spec.__type as string) : undefined;
}

/**
 * Destroys resources recorded in `state`, in reverse apply order. Without `opts.prune`, only entries
 * whose id is still in `plan` are destroyed (a plain teardown of what this plan manages); with
 * `opts.prune`, every entry in `state` is destroyed, plan or not — `dxforge destroy --prune` leaves
 * nothing behind. Gated resources have no state entry, so they are never candidates here.
 *
 * Every successfully destroyed resource is removed from `state` immediately, so if a later resource
 * fails, `ApplyError.state` still reflects everything already gone: the caller can persist it and the
 * operator does not lose track of what remains.
 */
export async function destroyPlan(plan: PlanV1, provider: Provider, credentials: Credentials, state: StateV1, opts: DestroyOptions = {}): Promise<DestroyResult> {
  const next: StateV1 = structuredClone(state);
  const now = opts.now ?? (() => new Date());
  const progress = opts.onProgress ?? (() => {});
  const ctx: ApplyContext = { target: provider.name, credentials, state: next, log: () => {}, now };
  const byId = new Map(plan.resources.map((r) => [r.id, r] as [string, Resource]));
  const planIds = new Set(plan.resources.map((r) => r.id));

  const candidates = Object.keys(next.entries).filter((id) => opts.prune || planIds.has(id));
  const order = destroyOrder(next, candidates);
  const destroyed: string[] = [];

  for (const id of order) {
    const entry = next.entries[id];
    const resource: Resource =
      byId.get(id) ?? { id, layer: entry.layer, type: "unknown.unknown", spec: entry.spec, reason: "stale", depends_on: [], gate: { allowed: true } };
    const adapter = provider.adapters[resource.type !== "unknown.unknown" ? resource.type : (typeOf(entry) ?? "")];
    progress({ id, status: "start" });
    try {
      if (adapter) await adapter.destroy(ctx, resource, entry);
      delete next.entries[id];
      destroyed.push(id);
      progress({ id, status: "done" });
    } catch (e) {
      progress({ id, status: "failed" });
      throw new ApplyError(id, next, e);
    }
  }

  return { state: next, destroyed };
}
