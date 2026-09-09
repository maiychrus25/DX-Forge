// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Credentials } from "./credentials.js";
import { diffPlan, type Change, type ChangeAction } from "./differ.js";
import { LAYER_ORDER } from "./order.js";
import type { ApplyContext, Provider } from "./provider.js";
import type { PlanV1, Resource } from "./schema/plan.js";
import type { StateV1 } from "./schema/state.js";
import { entryFor } from "./state.js";

export type ProgressEvent = { id: string; action: ChangeAction; status: "start" | "done" | "failed" | "skipped"; message?: string };
export type ApplyOptions = { dryRun?: boolean; prune?: boolean; onProgress?: (e: ProgressEvent) => void; now?: () => Date; log?: (line: string) => void };
export type ApplyResult = { state: StateV1; changes: Change[]; applied: string[]; skipped: string[]; destroyed: string[]; gated: string[] };

export class NoAdapter extends Error { constructor(type: string) { super(`Provider không có adapter cho loại tài nguyên ${type}.`); this.name = "NoAdapter"; } }
export class ApplyError extends Error {
  constructor(public readonly resourceId: string, public readonly state: StateV1, public readonly cause: unknown) {
    super(`Cấp phát ${resourceId} thất bại: ${(cause as Error)?.message ?? String(cause)}. State đã ghi; chạy lại apply để tiếp tục.`);
    this.name = "ApplyError";
  }
}

export async function applyPlan(plan: PlanV1, provider: Provider, credentials: Credentials, initial: StateV1, opts: ApplyOptions = {}): Promise<ApplyResult> {
  const state: StateV1 = structuredClone(initial);
  const now = opts.now ?? (() => new Date());
  const progress = opts.onProgress ?? (() => {});
  const ctx: ApplyContext = { target: provider.name, credentials, state, log: opts.log ?? (() => {}), now };
  const byId = new Map(plan.resources.map((r) => [r.id, r] as [string, Resource]));
  const changes = diffPlan(plan, state, { prune: opts.prune });
  for (const c of changes) if ((c.action === "create" || c.action === "update") && !provider.adapters[c.type!]) throw new NoAdapter(c.type!);
  const result: ApplyResult = { state, changes, applied: [], skipped: [], destroyed: [], gated: [] };
  if (opts.dryRun) { result.gated = changes.filter((c) => c.action === "gated").map((c) => c.id); return result; }

  for (const c of changes) {
    if (c.action === "gated") { result.gated.push(c.id); progress({ id: c.id, action: c.action, status: "skipped", message: c.why }); continue; }
    if (c.action === "skip") { result.skipped.push(c.id); progress({ id: c.id, action: c.action, status: "skipped" }); continue; }
    if (c.action === "destroy") continue;
    const r = byId.get(c.id)!;
    progress({ id: c.id, action: c.action, status: "start" });
    try {
      const { externalId } = await provider.adapters[r.type].apply(ctx, r, state.entries[c.id]);
      state.entries[c.id] = entryFor(r, externalId, now());
      result.applied.push(c.id);
      progress({ id: c.id, action: c.action, status: "done" });
    } catch (e) {
      progress({ id: c.id, action: c.action, status: "failed", message: (e as Error).message });
      throw new ApplyError(c.id, state, e);
    }
  }

  if (opts.prune) {
    const stale = changes.filter((c) => c.action === "destroy").map((c) => c.id);
    const order = Object.keys(state.entries).filter((id) => stale.includes(id));
    order.sort((a, b) => LAYER_ORDER.indexOf(state.entries[b].layer) - LAYER_ORDER.indexOf(state.entries[a].layer) || order.indexOf(b) - order.indexOf(a));
    for (const id of order) {
      const entry = state.entries[id];
      const ghost: Resource = { id, layer: entry.layer, type: "unknown.unknown", spec: entry.spec, reason: "stale", depends_on: [], gate: { allowed: true } };
      const adapter = provider.adapters[typeOf(entry) ?? ""];
      progress({ id, action: "destroy", status: "start" });
      try {
        if (adapter) await adapter.destroy(ctx, ghost, entry);
        delete state.entries[id];
        result.destroyed.push(id);
        progress({ id, action: "destroy", status: "done" });
      } catch (e) {
        progress({ id, action: "destroy", status: "failed", message: (e as Error).message });
        throw new ApplyError(id, state, e);
      }
    }
  }
  return result;
}

/** State entries do not store the type; adapters that need it read `entry.spec.__type` written by `entryFor`. */
function typeOf(entry: StateV1["entries"][string]): string | undefined {
  return typeof entry.spec.__type === "string" ? (entry.spec.__type as string) : undefined;
}

export function renderDryRun(changes: Change[]): string {
  const rows = changes.map((c) => {
    const diff = c.action === "update" ? diffKeys(c.before as Record<string, unknown> | undefined, c.after as Record<string, unknown>) : "";
    return `${c.action.padEnd(8)} ${c.id.padEnd(28)} ${(c.layer ?? "").padEnd(2)} ${(c.type ?? "").padEnd(22)} ${c.why ?? diff}`;
  });
  const count = (a: ChangeAction) => changes.filter((c) => c.action === a).length;
  return [...rows, "", `create ${count("create")} · update ${count("update")} · skip ${count("skip")} · destroy ${count("destroy")} · gated ${count("gated")}`].join("\n");
}

function diffKeys(before: Record<string, unknown> | undefined, after: Record<string, unknown>): string {
  const b = before ?? {};
  const keys = new Set([...Object.keys(b), ...Object.keys(after)]);
  const out: string[] = [];
  for (const k of keys) {
    if (!(k in b)) out.push(`+${k}`);
    else if (!(k in after)) out.push(`-${k}`);
    else if (JSON.stringify(b[k]) !== JSON.stringify(after[k])) out.push(`~${k}`);
  }
  return out.join(" ");
}
