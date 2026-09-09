// SPDX-License-Identifier: AGPL-3.0-or-later
import { ApplyError } from "./apply.js";
import type { Credentials } from "./credentials.js";
import { LAYER_ORDER } from "./order.js";
import type { ApplyContext, Provider } from "./provider.js";
import type { PlanV1, Resource } from "./schema/plan.js";
import type { StateV1 } from "./schema/state.js";

export type DestroyProgressEvent = { id: string; status: "start" | "done" | "failed" };
export type DestroyOptions = { prune?: boolean; onProgress?: (e: DestroyProgressEvent) => void; now?: () => Date };
export type DestroyResult = { state: StateV1; destroyed: string[] };

/**
 * Reverse-of-apply order for a set of state entry ids: layers come out in the reverse of
 * `LAYER_ORDER` (I, D, P, then H last, so the realm and everything else H depends on is the last
 * thing torn down), and within one layer, ids come out in the reverse of `ids`' own order (which the
 * caller passes in `state.entries` insertion order, i.e. apply order) so the most recently applied
 * resource of a layer is destroyed first. This is the same comparator `applyPlan`'s `--prune` step
 * uses; it is kept here rather than imported from `apply.ts` because Task 3's file list does not
 * include `apply.ts` — see the task report for the discrepancy this leaves with the plan text.
 */
export function destroyOrder(state: StateV1, ids: string[]): string[] {
  const position = new Map(ids.map((id, i) => [id, i]));
  return [...ids].sort(
    (a, b) => LAYER_ORDER.indexOf(state.entries[b].layer) - LAYER_ORDER.indexOf(state.entries[a].layer) || position.get(b)! - position.get(a)!,
  );
}

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
