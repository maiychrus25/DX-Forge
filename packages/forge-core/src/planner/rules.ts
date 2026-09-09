// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IntentV1 } from "../schema/intent.js";
import type { Resource } from "../schema/plan.js";
import { EntitySpec } from "../schema/specs.js";

/** P.A.R.A tree from the book (M0 spec §7). Department and project branches are added per organisation. */
export const PARA_BRANCHES = [
  "00. Portal",
  "1. [P] PROJECTS",
  "2. [A] AREAS",
  "3. [R] RESOURCES/10. GOVERNANCE/11. Policies_Regulations",
  "3. [R] RESOURCES/10. GOVERNANCE/12. SOP_Processes",
  "3. [R] RESOURCES/10. GOVERNANCE/13. Technical_Manuals",
  "3. [R] RESOURCES/10. GOVERNANCE/14. Templates_Forms",
  "3. [R] RESOURCES/20. EXPERIENCE/21. Case_Studies",
  "3. [R] RESOURCES/20. EXPERIENCE/22. Lessons_Learned",
  "3. [R] RESOURCES/20. EXPERIENCE/23. Customer_Feedback",
  "3. [R] RESOURCES/20. EXPERIENCE/24. Meeting_Notes",
  "3. [R] RESOURCES/30. EDUCATION/31. Onboarding",
  "3. [R] RESOURCES/30. EDUCATION/32. Training_Materials",
  "3. [R] RESOURCES/30. EDUCATION/33. Industry_Knowledge",
  "3. [R] RESOURCES/30. EDUCATION/34. Reading_List",
  "3. [R] RESOURCES/40. ASSETS/41. Structured_Data",
  "3. [R] RESOURCES/40. ASSETS/42. Unstructured_Data",
  "3. [R] RESOURCES/40. ASSETS/43. Brand_Media",
  "3. [R] RESOURCES/40. ASSETS/44. Versioned_Assets",
  "4. [A] ARCHIVES",
];

const ROLES = ["dx-admin", "manager", "staff"] as const;

export function layerH(intent: IntentV1): Resource[] {
  const org = intent.organization;
  const root = `[${org.short_code.toUpperCase()}] DX-OS`;
  const out: Resource[] = [
    {
      id: "h.realm", layer: "H", type: "identity.realm", depends_on: [], gate: { allowed: true },
      spec: { realm: "dxlab", clients: ["dx-forge-wizard", "nextcloud", "n8n"] },
      reason: "Một danh tính, đăng nhập một lần cho mọi công cụ của DX-Lab.",
    },
    ...ROLES.map<Resource>((name) => ({
      id: `h.role.${name}`, layer: "H", type: "identity.role", depends_on: ["h.realm"], gate: { allowed: true },
      spec: { name }, reason: `Vai trò ${name} dùng trong ACL, quy trình và chính sách tác tử.`,
    })),
    ...org.departments.map<Resource>((d) => ({
      id: `h.group.${d.code}`, layer: "H", type: "identity.group", depends_on: ["h.realm"], gate: { allowed: true },
      spec: { path: `/departments/${d.code}`, attributes: { code: d.code, name: d.name } },
      reason: `Nhóm phòng ban ${d.name} để cấp quyền theo AREAS và lọc dữ liệu.`,
    })),
    {
      id: "h.tree", layer: "H", type: "storage.tree", depends_on: ["h.realm"], gate: { allowed: true },
      spec: { root, branches: [...PARA_BRANCHES, ...org.departments.map((d) => `2. [A] AREAS/${d.name}`)], readme: true },
      reason: "Cây P.A.R.A chuẩn của sách: mọi tài liệu có đúng một chỗ.",
    },
    {
      id: "h.acl.resources", layer: "H", type: "storage.acl", depends_on: ["h.tree"], gate: { allowed: true },
      spec: { path: "3. [R] RESOURCES", group: "all-staff", mode: "read" },
      reason: "Kho tài nguyên chỉ đọc với toàn bộ nhân sự; chỉ quản trị mới sửa.",
    },
    ...org.departments.map<Resource>((d) => ({
      id: `h.acl.areas.${d.code}`, layer: "H", type: "storage.acl", depends_on: ["h.tree", `h.group.${d.code}`], gate: { allowed: true },
      spec: { path: `2. [A] AREAS/${d.name}`, group: `departments/${d.code}`, mode: "write" },
      reason: `Phòng ${d.name} tự quản khu vực của mình.`,
    })),
    {
      id: "h.acl.archives", layer: "H", type: "storage.acl", depends_on: ["h.tree", "h.role.dx-admin"], gate: { allowed: true },
      spec: { path: "4. [A] ARCHIVES", group: "dx-admin", mode: "admin" },
      reason: "Lưu trữ chỉ quản trị viên chạm vào; nhân sự không xoá lịch sử.",
    },
    {
      id: "h.portal", layer: "H", type: "portal.site", depends_on: ["h.tree"], gate: { allowed: true },
      spec: { files: ["00. Portal/news.md", "00. Portal/handbook/index.md"] },
      reason: "Cổng thông tin nội bộ: tin tức và sổ tay nghiệp vụ số do Forge sinh.",
    },
    {
      id: "h.channel", layer: "H", type: "comms.channel", depends_on: [], gate: { allowed: true },
      spec: { kind: intent.channels.chat, name: `${org.short_code}-dxlab` },
      reason: "Một kênh chung thay cho tin nhắn riêng lẻ.",
    },
    ...(["announce", "alerts", "approvals"] as const).map<Resource>((purpose) => ({
      id: `h.topic.${purpose}`, layer: "H", type: "comms.topic", depends_on: ["h.channel"], gate: { allowed: true },
      spec: { channel: "h.channel", name: intent.channels.notify_targets[purpose], purpose },
      reason: { announce: "Thông báo chung.", alerts: "Cảnh báo từ quy trình.", approvals: "Nơi người duyệt bấm duyệt cho tác tử và SLA." }[purpose],
    })),
  ];
  return out;
}

const entityKey = (e: Resource) => e.source?.process ?? e.id.replace(/\.entity$/, "");

export function layerD(_intent: IntentV1, entities: Resource[]): Resource[] {
  return entities.flatMap<Resource>((e) => {
    const key = entityKey(e);
    const parsed = EntitySpec.safeParse(e.spec);
    if (!parsed.success) return [];
    const fields = parsed.data.fields;
    const masking = fields.filter((f) => f.pii).map((f) => f.name);
    return [
      {
        id: `d.dashboard.${key}`, layer: "D", type: "data.dashboard", depends_on: [e.id], gate: { allowed: true },
        spec: { entity: e.id, cards: [{ name: "Theo trạng thái", kind: "count_by_state" }, { name: "Quá hạn SLA", kind: "sla_breach" }], masking },
        reason: `Bảng điều khiển tối thiểu cho ${key}: đếm theo trạng thái, quá hạn; che ${masking.length} trường PII.`,
      },
      {
        id: `d.snapshot.${key}`, layer: "D", type: "data.snapshot", depends_on: [e.id, "h.tree"], gate: { allowed: true },
        spec: { entity: e.id, schedule: "0 2 1 * *", destination: "3. [R] RESOURCES/40. ASSETS/41. Structured_Data", formats: ["csv", "jsonld"] },
        reason: "Chụp dữ liệu hằng tháng vào kho tài nguyên có cấu trúc để so sánh theo thời gian.",
      },
      {
        id: `d.lod.${key}`, layer: "D", type: "data.lod_context", depends_on: [e.id], gate: { allowed: true },
        spec: { entity: e.id, context: { "@vocab": "https://schema.org/", id: "@id", ...Object.fromEntries(fields.map((f) => [f.name, `https://schema.org/${f.name}`])) } },
        reason: "Ngữ cảnh JSON-LD để dữ liệu mở liên kết được (trục LOD).",
      },
    ];
  });
}

export function layerI(intent: IntentV1): Resource[] {
  return [
    {
      id: "i.rag.resources", layer: "I", type: "intel.rag_source", depends_on: ["h.tree"], gate: { allowed: true },
      spec: { paths: ["3. [R] RESOURCES"], collection: `${intent.organization.short_code}_resources` },
      reason: "Trợ lý chỉ trả lời theo tài liệu thật trong kho tài nguyên.",
    },
    ...intent.core_processes.map<Resource>((p) => ({
      id: `i.policy.${p.id}`, layer: "I", type: "intel.agent_policy", depends_on: ["h.topic.approvals"], gate: { allowed: true },
      spec: { actions: [`${p.id}.read`, `${p.id}.comment`, `${p.id}.assign`], approval_channel: "h.topic.approvals", expire_hours: 24, approver_role: p.actors.A },
      reason: `Tác tử cho ${p.name} chỉ được làm việc trong whitelist; hành động ghi cần ${p.actors.A} duyệt trong 24 giờ.`,
    })),
    {
      id: "i.assistant", layer: "I", type: "intel.assistant", depends_on: ["i.rag.resources"], gate: { allowed: true },
      spec: {
        rag_source: "i.rag.resources",
        system_prompt: `Vai trò: trợ lý nội bộ của ${intent.organization.name}. Bối cảnh: chỉ dùng tài liệu trong kho tài nguyên. Hành động: trả lời ngắn, dẫn nguồn. Định dạng: tiếng Việt, gạch đầu dòng. Ranh giới: không bịa, không thực thi hành động ghi khi chưa có duyệt.`,
      },
      reason: "Prompt hệ thống theo khung 5 RÕ; mọi câu trả lời dẫn nguồn.",
    },
  ];
}
