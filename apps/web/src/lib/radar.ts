// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Axis, ResultV1, Tier } from "@dx-forge/hpdi-engine";
import { vi } from "@/lib/i18n.vi";

export type RadarPoint = { axis: Axis | "H"; label: string; merged: number } & Partial<Record<Tier, number>>;

/** Per-tier axis estimate using the same axis sources and supp coefficients as the engine (display only). */
function tierAxes(r: ResultV1, tier: Tier): Record<"H" | Axis, number> | undefined {
  const p = r.pillars;
  const t = (k: keyof ResultV1["pillars"]) => p[k].byTier[tier];
  if (t("operations") === undefined && t("customer") === undefined && t("data") === undefined && t("technology") === undefined) return undefined;
  const P = Math.round((((t("operations") ?? 0) + (t("customer") ?? 0)) / 2) * r.supp.P * 30);
  const D = Math.round((t("data") ?? 0) * r.supp.D * 30);
  const I = Math.round((t("technology") ?? 0) * r.supp.I * 30);
  return { H: 100 - (P + D + I), P, D, I };
}

export function radarSeries(r: ResultV1): RadarPoint[] {
  const tiers: Tier[] = ["executive", "manager", "staff"];
  const byTier = Object.fromEntries(tiers.map((t) => [t, tierAxes(r, t)])) as Record<Tier, ReturnType<typeof tierAxes>>;
  return (["H", "P", "D", "I"] as const).map((axis) => {
    const point: RadarPoint = { axis, label: vi.axes[axis], merged: r.hpdi[axis] };
    for (const t of tiers) if (byTier[t]) point[t] = byTier[t]![axis];
    return point;
  });
}
