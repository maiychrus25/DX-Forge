// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildTree, buildZip, flatten } from "../src/lib/kit/para.js";
import { buildFiveRo, buildPokaYoke } from "../src/lib/prescribe.js";

const input = { shortCode: "abc", departments: [{ code: "cskh", name: "Chăm sóc khách hàng" }, { code: "kd", name: "Kinh doanh" }], projects: ["Website mới"], coreProcess: "Xử lý yêu cầu khách hàng" };

describe("buildTree", () => {
  it("produces the book's P.A.R.A layout with one folder per project and department", () => {
    const paths = flatten(buildTree(input));
    expect(paths[0]).toBe("[ABC] DX-OS");
    for (const p of ["[ABC] DX-OS/1. [P] PROJECTS/Website mới/README.md", "[ABC] DX-OS/2. [A] AREAS/Chăm sóc khách hàng/README.md", "[ABC] DX-OS/2. [A] AREAS/Kinh doanh/README.md",
      "[ABC] DX-OS/3. [R] RESOURCES/10. GOVERNANCE/11. Policies_Regulations", "[ABC] DX-OS/3. [R] RESOURCES/10. GOVERNANCE/14. Templates_Forms", "[ABC] DX-OS/3. [R] RESOURCES/20. EXPERIENCE/21. Case_Studies",
      "[ABC] DX-OS/3. [R] RESOURCES/30. EDUCATION/34. Reading_List", "[ABC] DX-OS/3. [R] RESOURCES/40. ASSETS/41. Structured_Data", "[ABC] DX-OS/3. [R] RESOURCES/40. ASSETS/44. Versioned_Assets",
      "[ABC] DX-OS/4. [A] ARCHIVES/README.md", "[ABC] DX-OS/NAMING_CONVENTION.md", "[ABC] DX-OS/POKA_YOKE.md", "[ABC] DX-OS/5RO_Xu_ly_yeu_cau_khach_hang.md"]) {
      expect(paths, p).toContain(p);
    }
  });
  it("every branch has a README and no path contains characters illegal in Nextcloud or Drive", () => {
    const paths = flatten(buildTree(input));
    expect(paths.filter((p) => p.endsWith("/README.md")).length).toBeGreaterThanOrEqual(8);
    expect(paths.every((p) => !/[<>:"|?*\\]/.test(p))).toBe(true);
  });
});

describe("buildZip", () => {
  it("contains every file of the tree with non-empty markdown", async () => {
    const tree = buildTree(input);
    const zip = await JSZip.loadAsync(await buildZip(tree, { fiveRo: buildFiveRo(input.coreProcess), pokaYoke: buildPokaYoke(input.coreProcess) }));
    const files = Object.keys(zip.files).filter((f) => !zip.files[f].dir);
    expect(files).toContain("[ABC] DX-OS/NAMING_CONVENTION.md");
    expect((await zip.file("[ABC] DX-OS/5RO_Xu_ly_yeu_cau_khach_hang.md")!.async("string")).length).toBeGreaterThan(100);
    expect((await zip.file("[ABC] DX-OS/2. [A] AREAS/Kinh doanh/README.md")!.async("string"))).toContain("Kinh doanh");
  });
});
