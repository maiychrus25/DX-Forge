// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import { useState } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar as RRadar, RadarChart, ResponsiveContainer, Legend } from "recharts";
import type { RadarPoint } from "@/lib/radar";
import { vi } from "@/lib/i18n.vi";

const TIER_COLORS = { executive: "#0f172a", manager: "#64748b", staff: "#ea580c" } as const;

export function Radar({ series, compare }: { series: RadarPoint[]; compare?: { name: string; series: RadarPoint[] }[] }) {
  const [tiers, setTiers] = useState<Record<keyof typeof TIER_COLORS, boolean>>({ executive: false, manager: false, staff: false });
  const data = series.map((p, i) => ({ ...p, ...Object.fromEntries((compare ?? []).map((c) => [c.name, c.series[i]?.merged])) }));
  return (
    <div>
      <div className="h-72 sm:h-96">
        <ResponsiveContainer>
          <RadarChart data={data} outerRadius="75%">
            <PolarGrid />
            <PolarAngleAxis dataKey="label" />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <RRadar name={vi.round.merged} dataKey="merged" stroke="#ea580c" fill="#ea580c" fillOpacity={0.25} />
            {(Object.keys(TIER_COLORS) as (keyof typeof TIER_COLORS)[]).filter((t) => tiers[t] && series.some((p) => p[t] !== undefined)).map((t) => (
              <RRadar key={t} name={vi.round.tier[t]} dataKey={t} stroke={TIER_COLORS[t]} fill="none" strokeDasharray="4 3" />
            ))}
            {(compare ?? []).map((c, i) => <RRadar key={c.name} name={c.name} dataKey={c.name} stroke={["#94a3b8", "#cbd5e1", "#e2e8f0"][i % 3]} fill="none" />)}
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {(Object.keys(TIER_COLORS) as (keyof typeof TIER_COLORS)[]).map((t) => (
          <label key={t} className="chip border border-border cursor-pointer">
            <input type="checkbox" className="mr-1" checked={tiers[t]} disabled={!series.some((p) => p[t] !== undefined)} onChange={() => setTiers({ ...tiers, [t]: !tiers[t] })} />
            {vi.round.tier[t]}
          </label>
        ))}
      </div>
      <table className="sr-only"><caption>{vi.round.radar}</caption><tbody>{series.map((p) => <tr key={p.axis}><th>{p.label}</th><td>{p.merged}</td></tr>)}</tbody></table>
    </div>
  );
}
