// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ResultV1 } from "@dx-forge/hpdi-engine";
import { vi } from "@/lib/i18n.vi";

const pct = (v?: number) => (v === undefined ? "–" : `${Math.round(v * 100)}%`);

export function PillarTable({ result }: { result: ResultV1 }) {
  const rows = Object.entries(result.pillars) as [keyof typeof vi.pillars, ResultV1["pillars"][keyof ResultV1["pillars"]]][];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-muted text-left"><tr><th className="py-2">{vi.round.pillar}</th><th className="text-right">{vi.round.tier.executive}</th><th className="text-right">{vi.round.tier.manager}</th><th className="text-right">{vi.round.tier.staff}</th><th className="text-right">{vi.round.merged}</th><th className="text-right">{vi.round.discrepancy}</th></tr></thead>
        <tbody>
          {rows.map(([k, p]) => (
            <tr key={k} className="border-t border-border">
              <td className="py-3">{vi.pillars[k]}</td>
              <td className="text-right font-mono">{pct(p.byTier.executive)}</td>
              <td className="text-right font-mono">{pct(p.byTier.manager)}</td>
              <td className="text-right font-mono">{pct(p.byTier.staff)}</td>
              <td className="text-right font-mono font-semibold">{pct(p.merged)}</td>
              <td className="text-right font-mono">{p.discrepancy.toFixed(2)} {p.discrepancy > 0.3 && <span className="chip bg-axis-d/20 text-axis-d ml-1">{vi.round.warn}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
