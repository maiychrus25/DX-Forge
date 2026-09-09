// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { PlanV1 } from "@dx-forge/forge-core";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
function run(args: string[]): { code: number; out: string } {
  try {
    return { code: 0, out: execFileSync("npx", ["tsx", "apps/cli/src/index.ts", ...args], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, out: `${err.stdout}${err.stderr}` };
  }
}

describe("dxforge CLI", () => {
  const tmp = mkdtempSync(join(tmpdir(), "dxforge-"));

  it("plan writes a valid plan.yaml and prints the tree with gated I resources", () => {
    const out = join(tmp, "plan.yaml");
    const r = run(["plan", "-f", "examples/intent.example.yaml", "-o", out]);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain("[H]");
    expect(r.out).toContain("⛔ i.policy.cskh");
    expect(PlanV1.safeParse(parse(readFileSync(out, "utf8"))).success).toBe(true);
  });

  it("plan exits 1 and writes nothing when validation fails", () => {
    const intent = readFileSync(join(ROOT, "examples/intent.example.yaml"), "utf8");
    const packsDir = join(tmp, "packs");
    execFileSync("cp", ["-r", join(ROOT, "packs"), packsDir]);
    const bad = readFileSync(join(packsDir, "dx-ticket/pack.yaml"), "utf8").replace('A: ["{{process.actors.A}}"] }\n        - { from: assigned', 'A: [] }\n        - { from: assigned');
    writeFileSync(join(packsDir, "dx-ticket/pack.yaml"), bad);
    const intentFile = join(tmp, "intent.yaml");
    writeFileSync(intentFile, intent);
    const out = join(tmp, "bad-plan.yaml");
    const r = run(["plan", "-f", intentFile, "-o", out, "--packs-dir", packsDir]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("one_a");
    expect(existsSync(out)).toBe(false);
  });

  it("plan exits 2 on an invalid intent file", () => {
    const f = join(tmp, "broken.yaml");
    writeFileSync(f, "version: 2\n");
    const r = run(["plan", "-f", f]);
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/version/);
  });

  it("plan exits 2 when the intent's process pack does not exist", () => {
    const intent = readFileSync(join(ROOT, "examples/intent.example.yaml"), "utf8").replace("pack: dx-ticket", "pack: nope");
    const f = join(tmp, "missing-pack.yaml");
    writeFileSync(f, intent);
    const r = run(["plan", "-f", f]);
    expect(r.code).toBe(2);
    expect(r.out).toContain("Pack not found: nope");
  });

  it("packs list shows core and dx-ticket", () => {
    const r = run(["packs", "list"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("dx-ticket");
    expect(r.out).toContain("core");
  });

  it("explain prints the reason, layer and gate of a resource", () => {
    const out = join(tmp, "plan2.yaml");
    run(["plan", "-f", "examples/intent.example.yaml", "-o", out]);
    const r = run(["explain", "i.policy.cskh", "-p", out]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("intel.agent_policy");
    expect(r.out).toContain("Lý do");
    expect(r.out).toMatch(/gate.*false/i);
  });
});
