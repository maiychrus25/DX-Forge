// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { loadIntentFile } from "../src/schema/intent.js";
import { loadPacks, renderPack } from "../src/packs/loader.js";
import { TemplateError, render } from "../src/packs/template.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const PACKS = `${ROOT}packs`;
const intent = loadIntentFile(`${ROOT}examples/intent.example.yaml`);

describe("render", () => {
  it("substitutes dotted paths and tolerates spaces", () => {
    expect(render("t_{{ org.short_code }}/{{process.id}}", { org: { short_code: "abc" }, process: { id: "cskh" } })).toBe("t_abc/cskh");
  });
  it("throws TemplateError naming the missing path", () => {
    expect(() => render("{{process.nope}}", { process: {} })).toThrow(TemplateError);
    expect(() => render("{{process.nope}}", { process: {} })).toThrow(/process\.nope/);
  });
  it("escapes a substituted value for a YAML double-quoted scalar", () => {
    expect(render('"{{process.name}}"', { process: { name: 'Xử lý "khẩn"' } })).toBe('"Xử lý \\"khẩn\\""');
  });
});

describe("loadPacks", () => {
  const packs = loadPacks(PACKS);
  it("finds core (org scope) and dx-ticket (process scope)", () => {
    expect(packs.get("core")?.pack.scope).toBe("org");
    expect(packs.get("dx-ticket")?.pack.scope).toBe("process");
  });
  it("rejects a directory whose pack id differs from its folder name", () => {
    expect(() => loadPacks(`${ROOT}packages/forge-core/test/fixtures/bad-packs`)).toThrow(/id/);
  });
});

describe("renderPack dx-ticket", () => {
  const packs = loadPacks(PACKS);
  const resources = renderPack(packs.get("dx-ticket")!, { org: intent.organization, process: intent.core_processes[0] });
  it("yields six P resources prefixed with the process id", () => {
    expect(resources.map((r) => r.id).sort()).toEqual(["cskh.app", "cskh.entity", "cskh.form", "cskh.rule", "cskh.states", "cskh.workflow"]);
    expect(resources.every((r) => r.layer === "P")).toBe(true);
    expect(resources.every((r) => r.source?.pack === "dx-ticket" && r.source?.process === "cskh")).toBe(true);
  });
  it("substitutes actors into the state machine and keeps ≤ 5 required form fields", () => {
    const sm = resources.find((r) => r.id === "cskh.states")!.spec as { transitions: { A: string[] }[] };
    expect(sm.transitions[0].A).toEqual(["manager"]);
    const form = resources.find((r) => r.id === "cskh.form")!.spec as { fields: { required?: boolean }[] };
    expect(form.fields.filter((f) => f.required).length).toBeLessThanOrEqual(5);
  });
  it("core pack renders once per organisation", () => {
    const core = renderPack(packs.get("core")!, { org: intent.organization });
    expect(core.map((r) => r.id)).toEqual(["core.offboarding.entity", "core.offboarding.workflow"]);
  });

  it("escapes a quote in a substituted process name so the rendered YAML stays valid", () => {
    const process = { ...intent.core_processes[0], name: 'Xử lý "khẩn"' };
    const resources = renderPack(packs.get("dx-ticket")!, { org: intent.organization, process });
    const entity = resources.find((r) => r.id === `${process.id}.entity`)!;
    expect(entity.reason).toContain('Xử lý "khẩn"');
  });
});
