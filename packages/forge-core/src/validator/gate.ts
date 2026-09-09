// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IntentV1, Layer } from "../schema/intent.js";
import type { PlanV1 } from "../schema/plan.js";

export type Gate = { layers: Set<Layer>; why: Partial<Record<Layer, string>> };

/** Master spec §3 "Cổng trưởng thành". Cannot be disabled. */
export function allowedLayers(maturity: IntentV1["maturity"]): Gate {
  if (!maturity) {
    const why = "unmeasured: chưa có kết quả đo, chỉ dựng lớp H (hạ tầng). Chạy `dxforge measure` trước.";
    return { layers: new Set(["H"]), why: { P: why, D: why, I: why } };
  }
  const { shape, hpdi } = maturity;
  const layers = new Set<Layer>(["H"]);
  const why: Partial<Record<Layer, string>> = {};
  switch (shape) {
    case "spear":
      why.P = why.D = why.I = `spear (H=${hpdi.H}): tổ chức chưa có quy trình số; dựng hạ tầng và chuẩn hoá trước.`;
      break;
    case "kite":
    case "transitional":
      layers.add("P");
      if (hpdi.P >= 20) layers.add("D");
      else why.D = `${shape}: P=${hpdi.P} < 20, dữ liệu chưa đủ sạch để dựng lớp D.`;
      why.I = `${shape}: lớp I mở khi hình dạng đạt diamond (H ≤ 25 và P, D, I ≥ 20), đúng trật tự P → D → I.`;
      break;
    case "illusion":
      layers.add("P");
      layers.add("D");
      why.I = `GIGO: ${shape} (P=${hpdi.P} < 20 nhưng D/I đã cao). Cấm lớp I cho tới khi quy trình được chuẩn hoá.`;
      break;
    case "diamond":
      layers.add("P");
      layers.add("D");
      layers.add("I");
      break;
  }
  return { layers, why };
}

export function applyGate(plan: PlanV1, intent: IntentV1): PlanV1 {
  const gate = allowedLayers(intent.maturity);
  return {
    ...plan,
    resources: plan.resources.map((r) =>
      gate.layers.has(r.layer) ? { ...r, gate: { allowed: true } } : { ...r, gate: { allowed: false, why: gate.why[r.layer] } },
    ),
  };
}
