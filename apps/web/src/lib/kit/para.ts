// SPDX-License-Identifier: AGPL-3.0-or-later
import JSZip from "jszip";
import type { FiveRo, PokaYoke } from "@/lib/prescribe";

export type KitNode = { name: string; children?: KitNode[]; content?: string };
export type KitInput = { shortCode: string; departments: { code: string; name: string }[]; projects: string[]; coreProcess: string | null };

const RESOURCES: [string, string[]][] = [
  ["10. GOVERNANCE", ["11. Policies_Regulations", "12. SOP_Processes", "13. Technical_Manuals", "14. Templates_Forms"]],
  ["20. EXPERIENCE", ["21. Case_Studies", "22. Lessons_Learned", "23. Customer_Feedback", "24. Meeting_Notes"]],
  ["30. EDUCATION", ["31. Onboarding", "32. Training_Materials", "33. Industry_Knowledge", "34. Reading_List"]],
  ["40. ASSETS", ["41. Structured_Data", "42. Unstructured_Data", "43. Brand_Media", "44. Versioned_Assets"]],
];

const safe = (s: string) => s.replace(/[<>:"|?*\\/]/g, "-").trim();
export const slugAscii = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");

const readme = (title: string, purpose: string, rules: string[]) => `# ${title}\n\n${purpose}\n\n## Quy tắc\n\n${rules.map((r) => `- ${r}`).join("\n")}\n`;
const dir = (name: string, purpose: string, rules: string[], children: KitNode[] = []): KitNode => ({ name, children: [{ name: "README.md", content: readme(name, purpose, rules) }, ...children] });

export function buildTree(input: KitInput): KitNode {
  const root = `[${input.shortCode.toUpperCase()}] DX-OS`;
  const projects = dir("1. [P] PROJECTS", "Việc có ngày kết thúc và kết quả cụ thể.", ["Mỗi dự án một thư mục; xong thì chuyển sang ARCHIVES.", "Tên thư mục: YYYY-MM_Ten_du_an."],
    input.projects.filter(Boolean).map((p) => dir(safe(p), `Dự án ${p}.`, ["Kế hoạch, biên bản, sản phẩm bàn giao để ở đây."])));
  const areas = dir("2. [A] AREAS", "Trách nhiệm dài hạn theo phòng ban.", ["Phòng nào tự quản thư mục phòng đó.", "Không lưu tài liệu tham khảo chung ở đây; đưa sang RESOURCES."],
    input.departments.map((d) => dir(safe(d.name), `Khu vực làm việc của phòng ${d.name} (${d.code}).`, ["Hồ sơ đang hoạt động của phòng.", "Quy trình chuẩn của phòng tham chiếu sang RESOURCES/10. GOVERNANCE/12. SOP_Processes."])));
  const resources = dir("3. [R] RESOURCES", "Kho tri thức dùng chung, chỉ đọc với toàn bộ nhân sự.", ["Chỉ quản trị viên được sửa.", "Mọi tài liệu có phiên bản và ngày."],
    RESOURCES.map(([g, subs]) => dir(g, `Nhóm ${g}.`, ["Đặt tài liệu đúng nhánh con."], subs.map((s) => ({ name: s, children: [{ name: "README.md", content: readme(s, `Nhánh ${s}.`, ["Tên tệp: YYYY-MM-DD_Ten_tai_lieu_vX.md"]) }] })))));
  const archives = dir("4. [A] ARCHIVES", "Những gì đã xong hoặc không còn dùng.", ["Chỉ quản trị viên chuyển vào đây.", "Không xoá; lưu trữ là lịch sử của tổ chức."]);
  const naming = { name: "NAMING_CONVENTION.md", content: `# Quy ước đặt tên\n\n## Kịch bản 1: tài liệu theo thời gian\n\n\`YYYY-MM-DD_Loai_Tieu_de_vX.ext\` — ví dụ \`2026-09-10_BienBan_Hop_giao_ban_v1.md\`.\n\n## Kịch bản 2: tài liệu theo đối tượng\n\n\`DoiTuong_MaDoiTuong_Loai_vX.ext\` — ví dụ \`KhachHang_KH0421_HopDong_v2.pdf\`.\n\n## Chung\n\n- Không dấu, không khoảng trắng trong tên tệp; dùng gạch dưới.\n- Phiên bản tăng dần; không ghi đè bản cũ trong RESOURCES.\n- Thư mục trong P.A.R.A giữ nguyên tiền tố số.\n` };
  const fiveRoName = `5RO_${slugAscii(input.coreProcess ?? "Quy_trinh_loi")}.md`;
  return { name: root, children: [projects, areas, resources, archives, naming, { name: "POKA_YOKE.md", content: "" }, { name: fiveRoName, content: "" }] };
}

export function flatten(tree: KitNode, prefix = ""): string[] {
  const path = prefix ? `${prefix}/${tree.name}` : tree.name;
  return [path, ...(tree.children ?? []).flatMap((c) => flatten(c, path))];
}

function fiveRoMarkdown(f: FiveRo): string {
  return `# Ma trận 5 RÕ: ${f.process}\n\n| Bước | R (làm) | A (chịu trách nhiệm) | C (tham vấn) | I (được báo) | Tiêu chuẩn | Công cụ |\n|---|---|---|---|---|---|---|\n${f.steps.map((s) => `| ${s.step} | ${s.role_R} | ${s.role_A} | ${s.role_C || "–"} | ${s.role_I} | ${s.standard} | ${s.tool} |`).join("\n")}\n`;
}
function pokaYokeMarkdown(p: PokaYoke): string {
  return `# Poka-yoke\n\n${[1, 2, 3].map((l) => `## Lớp ${l}\n\n${p.pokaYoke.filter((x) => x.layer === l).map((x) => `- **${x.point}**: ${x.rule}`).join("\n")}\n`).join("\n")}`;
}

export async function buildZip(tree: KitNode, files: { fiveRo: FiveRo; pokaYoke: PokaYoke }): Promise<Buffer> {
  const zip = new JSZip();
  const walk = (n: KitNode, prefix: string) => {
    const path = prefix ? `${prefix}/${n.name}` : n.name;
    if (n.children) { zip.folder(path); n.children.forEach((c) => walk(c, path)); return; }
    let content = n.content ?? "";
    if (n.name === "POKA_YOKE.md") content = pokaYokeMarkdown(files.pokaYoke);
    if (n.name.startsWith("5RO_")) content = fiveRoMarkdown(files.fiveRo);
    zip.file(path, content);
  };
  walk(tree, "");
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
