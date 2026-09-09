// SPDX-License-Identifier: AGPL-3.0-or-later
import { LAYER_ORDER, type PlanV1 } from "@dx-forge/forge-core";

const LAYER_NAME = { H: "Hạ tầng", P: "Quy trình", D: "Dữ liệu", I: "Trí tuệ" } as const;

export function renderTree(plan: PlanV1): string {
  const lines: string[] = [];
  for (const layer of LAYER_ORDER) {
    const rs = plan.resources.filter((r) => r.layer === layer);
    if (rs.length === 0) continue;
    lines.push(`[${layer}] ${LAYER_NAME[layer]} (${rs.length})`);
    for (const r of rs) {
      lines.push(r.gate.allowed ? `  ✓ ${r.id}  ${r.type}` : `  ⛔ ${r.id}  ${r.type}  — ${r.gate.why ?? ""}`);
    }
  }
  return lines.join("\n");
}
