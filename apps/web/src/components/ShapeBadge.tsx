// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ResultV1 } from "@dx-forge/hpdi-engine";
import { vi } from "@/lib/i18n.vi";

const ICON = { spear: "🗡️", kite: "🪁", illusion: "🪞", diamond: "💎", transitional: "🔄" } as const;

export function ShapeBadge({ result }: { result: ResultV1 }) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <span className="chip bg-ink text-paper text-sm px-3 py-1">{ICON[result.shape]} {vi.round.shape[result.shape]}</span>
      <span className="chip border border-border text-sm px-3 py-1">{vi.round.level} {result.dtiLevel}/5</span>
      {(["H", "P", "D", "I"] as const).map((a) => <span key={a} className="chip text-paper" style={{ background: `var(--color-axis-${a.toLowerCase()})` }}>{a} {result.hpdi[a]}</span>)}
    </div>
  );
}
