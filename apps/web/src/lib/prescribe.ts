// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";
import type { Axis, ResultV1, Tier } from "@dx-forge/hpdi-engine";
import type Database from "better-sqlite3";
import * as repo from "@/lib/repo";
import { vi } from "@/lib/i18n.vi";

export const RoadmapSchema = z.object({
  focusAxis: z.enum(["P", "D", "I"]),
  diagnosis: z.string().min(1),
  phases: z.array(z.object({ name: z.string(), axis: z.enum(["P", "D", "I"]), actions: z.array(z.string()).min(1), kpis: z.array(z.string()).min(1) })).min(1),
  warnings: z.array(z.string()),
});
export const DiscrepancySchema = z.object({ questions: z.array(z.object({ pillar: z.string(), forTier: z.enum(["executive", "manager", "staff"]), question: z.string(), why: z.string() })) });
export const FiveRoSchema = z.object({
  process: z.string(),
  steps: z.array(z.object({ step: z.string(), role_R: z.string(), role_A: z.string(), role_C: z.string(), role_I: z.string(), standard: z.string(), tool: z.string() })).min(1),
});
export const PokaYokeSchema = z.object({ pokaYoke: z.array(z.object({ point: z.string(), rule: z.string(), layer: z.union([z.literal(1), z.literal(2), z.literal(3)]) })).min(1) });
export type Roadmap = z.infer<typeof RoadmapSchema>;
export type DiscrepancyQuestions = z.infer<typeof DiscrepancySchema>;
export type FiveRo = z.infer<typeof FiveRoSchema>;
export type PokaYoke = z.infer<typeof PokaYokeSchema>;

const PHASES: Record<Axis, { name: string; actions: string[]; kpis: string[] }> = {
  P: { name: "Chuẩn hoá quy trình lõi", actions: ["Chọn một quy trình lõi và viết ma trận 5 RÕ.", "Đưa quy trình lên phần mềm có biểu mẫu chặn dữ liệu sai ngay khi nhập.", "Đặt đúng một người chịu trách nhiệm cho mỗi bước.", "Đo thời gian mỗi bước trong bốn tuần."], kpis: ["100% yêu cầu có mã theo dõi", "Thời gian xử lý trung bình giảm 30%", "0 bước không có người chịu trách nhiệm"] },
  D: { name: "Một nguồn dữ liệu, một bảng điều khiển", actions: ["Gom dữ liệu quy trình về một nguồn duy nhất.", "Dựng bảng điều khiển đếm theo trạng thái và quá hạn.", "Lập lịch chụp dữ liệu hằng tháng vào kho tài nguyên có cấu trúc.", "Che dữ liệu cá nhân khi hiển thị."], kpis: ["Báo cáo tuần tự động 100%", "Lãnh đạo xem dashboard ít nhất 3 lần/tuần", "0 số liệu phải tổng hợp tay"] },
  I: { name: "Trợ lý có kiểm soát", actions: ["Nạp kho tài nguyên vào RAG để trợ lý trả lời theo tài liệu thật.", "Viết chính sách tác tử: whitelist hành động, kênh duyệt, hạn duyệt ≤ 24 giờ.", "Chỉ tự động hoá bước có dữ liệu sạch, giữ người duyệt cho hành động ghi."], kpis: ["Tỷ lệ câu trả lời có dẫn nguồn ≥ 90%", "100% hành động ghi có người duyệt", "Thời gian chờ duyệt ≤ 24 giờ"] },
};

export function buildRoadmap(r: ResultV1): Roadmap {
  const order: Axis[] = ["P", "D", "I"];
  const focusAxis = r.ruleBasedPrescription.focusAxis;
  const phases = order.slice(order.indexOf(focusAxis)).concat(order.slice(0, order.indexOf(focusAxis))).map((axis) => ({ axis, ...PHASES[axis] }));
  const warnings: string[] = [];
  if (r.shape === "illusion") warnings.push("GIGO: công nghệ và dữ liệu đi trước quy trình. Tạm dừng lớp I cho tới khi quy trình lõi được chuẩn hoá.");
  for (const [k, p] of Object.entries(r.pillars)) if (p.discrepancy > 0.3) warnings.push(`Độ vênh lớn ở trụ cột ${vi.pillars[k as keyof typeof vi.pillars]} (${p.discrepancy.toFixed(2)}): xác minh với tầng thấp hơn trước khi lập kế hoạch.`);
  const diagnosis = `Hình dạng ${vi.round.shape[r.shape]}, mức DTI ${r.dtiLevel}/5. H=${r.hpdi.H}, P=${r.hpdi.P}, D=${r.hpdi.D}, I=${r.hpdi.I}. Trục ưu tiên: ${vi.axes[focusAxis]}.`;
  return RoadmapSchema.parse({ focusAxis, diagnosis, phases, warnings });
}

const PILLAR_QUESTION: Record<string, string> = {
  strategy: "Anh/chị được nghe mục tiêu chuyển đổi số ở đâu và khi nào? Nếu chưa, điều gì khiến anh/chị nghĩ chưa có?",
  culture: "Lần gần nhất anh/chị thử một cách làm mới, điều gì xảy ra?",
  customer: "Một yêu cầu của khách hàng hôm qua đi qua những ai, ghi ở đâu?",
  operations: "Hãy mô tả một bước mà anh/chị làm theo trí nhớ hoặc tin nhắn thay vì phần mềm.",
  technology: "Công cụ nào anh/chị phải đăng nhập nhiều lần hoặc phải xuất file tay?",
  data: "Số liệu anh/chị nhập hôm qua xuất hiện ở báo cáo nào? Ai xem?",
};

export function buildDiscrepancyQuestions(r: ResultV1): DiscrepancyQuestions {
  const questions = Object.entries(r.pillars).filter(([, p]) => p.discrepancy > 0.3).map(([pillar, p]) => {
    const tiers = Object.entries(p.byTier) as [Tier, number][];
    const forTier = tiers.sort((a, b) => a[1] - b[1])[0][0];
    return { pillar, forTier, question: PILLAR_QUESTION[pillar], why: `Tầng ${vi.round.tier[forTier]} chấm thấp hơn ${Math.round(p.discrepancy * 100)} điểm phần trăm so với tầng cao nhất.` };
  });
  return DiscrepancySchema.parse({ questions });
}

export function buildFiveRo(coreProcess: string | null): FiveRo {
  const process = coreProcess ?? "Xử lý yêu cầu khách hàng";
  return FiveRoSchema.parse({
    process,
    steps: [
      { step: "Tiếp nhận yêu cầu", role_R: "Nhân viên trực", role_A: "Trưởng nhóm", role_C: "", role_I: "Quản trị DX", standard: "Có mã yêu cầu trong 5 phút; đủ tên, số điện thoại, mô tả", tool: "Biểu mẫu tiếp nhận" },
      { step: "Phân công xử lý", role_R: "Trưởng nhóm", role_A: "Trưởng nhóm", role_C: "Nhân viên", role_I: "Khách hàng", standard: "Phân công trong 30 phút; mỗi yêu cầu đúng một người xử lý", tool: "Bảng kanban" },
      { step: "Xử lý và cập nhật", role_R: "Nhân viên xử lý", role_A: "Nhân viên xử lý", role_C: "Trưởng nhóm", role_I: "Khách hàng", standard: "Cập nhật trạng thái mỗi lần chuyển bước; không đóng khi chưa có người xử lý", tool: "Màn hình chi tiết yêu cầu" },
      { step: "Đóng và thông báo", role_R: "Nhân viên xử lý", role_A: "Trưởng nhóm", role_C: "", role_I: "Khách hàng, Lãnh đạo", standard: "Đóng trong hạn SLA; khách hàng nhận thông báo", tool: "Workflow thông báo" },
    ],
  });
}

export function buildPokaYoke(_coreProcess: string | null): PokaYoke {
  return PokaYokeSchema.parse({
    pokaYoke: [
      { point: "Nhập số điện thoại", rule: "Chỉ nhận 10 chữ số bắt đầu bằng 0; sai thì không cho gửi", layer: 1 },
      { point: "Trường bắt buộc", rule: "Tối đa 5 trường bắt buộc; các trường khác có giá trị mặc định", layer: 1 },
      { point: "Đóng yêu cầu", rule: "Không cho chuyển sang Đã đóng khi chưa có người xử lý", layer: 2 },
      { point: "Quá hạn SLA", rule: "Sau 24 giờ chưa xử lý thì gửi cảnh báo tới kênh phê duyệt", layer: 2 },
      { point: "Kho tài nguyên", rule: "Toàn bộ nhân viên chỉ đọc; chỉ quản trị mới sửa", layer: 3 },
      { point: "Dữ liệu cá nhân", rule: "Che số điện thoại trên bảng điều khiển", layer: 3 },
    ],
  });
}

export type Prescriptions = { roadmap: Roadmap; discrepancy: DiscrepancyQuestions; fiveRo: FiveRo; pokaYoke: PokaYoke; provider: string; fallback: boolean };

/** Returns cached prescriptions for a closed assessment, building the rule-based set on first call. */
export function getOrBuildPrescriptions(db: Database.Database, assessmentId: string): Prescriptions {
  const a = repo.getAssessment(db, assessmentId);
  const res = repo.getResult(db, assessmentId);
  if (!a || !res) throw new Error("assessment not closed");
  const result = res.payload as ResultV1;
  const cached = repo.getPrescription(db, assessmentId, "roadmap");
  if (cached) {
    return {
      roadmap: RoadmapSchema.parse(cached.payload),
      discrepancy: DiscrepancySchema.parse(repo.getPrescription(db, assessmentId, "discrepancy")!.payload),
      fiveRo: FiveRoSchema.parse(repo.getPrescription(db, assessmentId, "fiveRo")!.payload),
      pokaYoke: PokaYokeSchema.parse(repo.getPrescription(db, assessmentId, "pokaYoke")!.payload),
      provider: cached.provider, fallback: cached.fallback,
    };
  }
  const started = Date.now();
  const built = { roadmap: buildRoadmap(result), discrepancy: buildDiscrepancyQuestions(result), fiveRo: buildFiveRo(a.coreProcess), pokaYoke: buildPokaYoke(a.coreProcess) };
  for (const kind of ["roadmap", "discrepancy", "fiveRo", "pokaYoke"] as const) {
    repo.savePrescription(db, { assessmentId, kind, provider: "none", model: null, payload: built[kind], fallback: true, tokensIn: 0, tokensOut: 0, latencyMs: Date.now() - started });
  }
  return { ...built, provider: "none", fallback: true };
}
