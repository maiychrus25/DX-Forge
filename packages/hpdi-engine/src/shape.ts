// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Axis, ResultV1, Shape } from "./types.js";

export function classifyShape({ H, P, D, I }: ResultV1["hpdi"]): Shape {
  if (H >= 75) return "spear";
  if (H < 75 && P >= 20 && D < 10 && I < 10) return "kite";
  if (H >= 60 && (I >= 10 || D >= 10) && P < 20) return "illusion";
  if (H <= 25 && P >= 20 && D >= 20 && I >= 20) return "diamond";
  return "transitional";
}

/** User-facing Vietnamese text: the three prescriptions of book chapter 2.5.3, applied in P → D → I order. */
const STEPS: Record<Axis, string[]> = {
  P: [
    "Chọn một quy trình lõi, viết 5 RÕ (ai làm, ai duyệt, tiêu chuẩn, công cụ, thời hạn).",
    "Đưa quy trình lên phần mềm có biểu mẫu chặn dữ liệu sai ngay khi nhập (Poka-yoke lớp 1).",
    "Đo thời gian mỗi bước; chỉ khi P chạy ổn 4 tuần mới sang dữ liệu.",
  ],
  D: [
    "Gom dữ liệu quy trình về một nguồn; dựng bảng điều khiển đếm theo trạng thái.",
    "Lập lịch chụp dữ liệu hằng tháng vào kho tài nguyên có cấu trúc (41. Structured_Data).",
    "Che dữ liệu cá nhân khi hiển thị; công bố chỉ số cho toàn tổ chức.",
  ],
  I: [
    "Nạp kho tài nguyên vào RAG để trợ lý trả lời theo tài liệu thật.",
    "Viết chính sách tác tử: whitelist hành động, kênh duyệt, hạn duyệt ≤ 24 giờ.",
    "Chỉ tự động hoá bước có dữ liệu sạch; giữ người duyệt (HITL) cho hành động ghi.",
  ],
};

export function prescribe(hpdi: ResultV1["hpdi"], shape: Shape): ResultV1["ruleBasedPrescription"] {
  const order: Axis[] = ["P", "D", "I"];
  const focusAxis = order.find((a) => hpdi[a] < 20) ?? "I";
  const steps = [...STEPS[focusAxis]];
  if (shape === "illusion") steps.unshift("Cảnh báo GIGO: công nghệ/dữ liệu đi trước quy trình. Tạm dừng lớp I, quay về chuẩn hoá P.");
  if (shape === "diamond") steps.unshift("Duy trì: đo lại mỗi quý, mở rộng sang quy trình lõi tiếp theo.");
  return { focusAxis, steps };
}
