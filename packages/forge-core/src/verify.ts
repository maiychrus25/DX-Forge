// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Credentials } from "./credentials.js";
import { NoAdapter } from "./apply.js";
import { LAYER_ORDER } from "./order.js";
import type { ApplyContext, Provider } from "./provider.js";
import type { Layer, TargetKind } from "./schema/intent.js";
import type { PlanV1 } from "./schema/plan.js";
import type { Check, StateV1 } from "./schema/state.js";

export type VerifyItem = { id: string; layer: Layer; type: string; ok: boolean; checks: Check[]; error?: string };
export type VerifyReport = {
  target: TargetKind;
  verifiedAt: string;
  ok: boolean;
  total: number;
  passed: number;
  byLayer: Record<Layer, { total: number; passed: number }>;
  items: VerifyItem[];
  notApplied: string[];
};
export type VerifyProgressEvent = { id: string; status: "start" | "done" | "failed" };
export type VerifyOptions = { now?: () => Date; onProgress?: (e: VerifyProgressEvent) => void };

/**
 * Verifies every non-gated resource of `plan` against the live target through `provider`. A resource
 * present in the plan but absent from `state` is not silently skipped: it is recorded in `notApplied`
 * and forces `report.ok = false`, because that situation means the system is only half-applied. Gated
 * resources were never applied and carry no state entry, so they are excluded entirely — neither
 * verified nor reported as missing.
 *
 * The report never carries `credentials` or the `ApplyContext`: every field on `VerifyItem` is built
 * from the resource's own id/layer/type plus the `Check[]` an adapter returns (or the message of an
 * error it throws), so nothing this function has never seen — a password, a token, an `Authorization`
 * header — can end up in the report or in the markdown rendered from it.
 */
export async function verifyPlan(plan: PlanV1, provider: Provider, credentials: Credentials, state: StateV1, opts: VerifyOptions = {}): Promise<VerifyReport> {
  const now = opts.now ?? (() => new Date());
  const progress = opts.onProgress ?? (() => {});
  const ctx: ApplyContext = { target: provider.name, credentials, state, log: () => {}, now };

  const items: VerifyItem[] = [];
  const notApplied: string[] = [];

  for (const r of plan.resources) {
    if (!r.gate.allowed) continue;
    const entry = state.entries[r.id];
    if (!entry) { notApplied.push(r.id); continue; }
    progress({ id: r.id, status: "start" });
    try {
      const adapter = provider.adapters[r.type];
      if (!adapter) throw new NoAdapter(r.type);
      const checks = await adapter.verify(ctx, r, entry);
      const ok = checks.every((c) => c.ok);
      items.push({ id: r.id, layer: r.layer, type: r.type, ok, checks });
      progress({ id: r.id, status: "done" });
    } catch (e) {
      items.push({ id: r.id, layer: r.layer, type: r.type, ok: false, checks: [], error: (e as Error).message ?? String(e) });
      progress({ id: r.id, status: "failed" });
    }
  }

  const byLayer = Object.fromEntries(LAYER_ORDER.map((l) => [l, { total: 0, passed: 0 }])) as Record<Layer, { total: number; passed: number }>;
  for (const item of items) {
    byLayer[item.layer].total += 1;
    if (item.ok) byLayer[item.layer].passed += 1;
  }
  const total = items.length;
  const passed = items.filter((i) => i.ok).length;

  return { target: provider.name, verifiedAt: now().toISOString(), ok: passed === total && notApplied.length === 0, total, passed, byLayer, items, notApplied };
}

const STATUS = (ok: boolean) => (ok ? "✅" : "❌");

/** Markdown report a human reads to decide whether the DX-Lab is healthy: grouped by layer, one
 * line per resource with its checks, a failure marked `❌` so it stands out at a glance. */
export function renderVerifyReport(r: VerifyReport): string {
  const lines: string[] = [];
  lines.push(`# Báo cáo verify — ${r.target}`);
  lines.push("");
  lines.push(`Thời điểm: ${r.verifiedAt}`);
  lines.push(`Kết quả chung: ${STATUS(r.ok)} ${r.ok ? "ĐẠT" : "THẤT BẠI"}`);
  lines.push(`Tổng: **${r.passed}/${r.total}** tài nguyên đạt kiểm tra`);
  lines.push("");

  for (const layer of LAYER_ORDER) {
    const layerItems = r.items.filter((i) => i.layer === layer);
    if (layerItems.length === 0) continue;
    const { total, passed } = r.byLayer[layer];
    lines.push(`## Lớp ${layer} — ${passed}/${total} đạt`);
    for (const item of layerItems) {
      lines.push(`- ${STATUS(item.ok)} ${item.id} (${item.type})`);
      for (const check of item.checks) lines.push(`  - ${STATUS(check.ok)} ${check.name}: ${check.evidence}`);
      if (item.error) lines.push(`  - lỗi: ${item.error}`);
    }
    lines.push("");
  }

  if (r.notApplied.length > 0) {
    lines.push("## Chưa áp dụng (không có trong state)");
    for (const id of r.notApplied) lines.push(`- ❌ ${id}`);
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}
