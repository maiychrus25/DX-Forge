// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { compile } from "../src/compile.js";
import { loadPacks } from "../src/packs/loader.js";
import { loadIntentFile } from "../src/schema/intent.js";
import { emptyState } from "../src/schema/state.js";
import { applyPlan, ApplyError } from "../src/apply.js";
import { verifyPlan, renderVerifyReport } from "../src/verify.js";
import { destroyPlan } from "../src/destroy.js";
import type { Adapter, Provider } from "../src/provider.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const intent = loadIntentFile(`${ROOT}examples/intent.example.yaml`);
const packs = loadPacks(`${ROOT}packs`);
const NOW = () => new Date("2026-09-10T00:00:00Z");

function fakeProvider(opts: { failCheck?: string; throwOnVerify?: string; failDestroyOn?: string } = {}) {
  const calls: string[] = [];
  const mk = (type: string): Adapter => ({
    type,
    async apply(_c, r) { calls.push(`apply ${r.id}`); return { externalId: `ext-${r.id}` }; },
    async verify(_c, r) {
      calls.push(`verify ${r.id}`);
      if (opts.throwOnVerify === r.id) throw new Error("Nextcloud API trả về lỗi 503");
      if (opts.failCheck === r.id) {
        return [
          { name: "exists", ok: true, evidence: "OCS group folder present" },
          { name: "acl", ok: false, evidence: "thiếu quyền cho phòng ban kd" },
        ];
      }
      return [{ name: "exists", ok: true, evidence: "found on target" }];
    },
    async destroy(_c, r) {
      calls.push(`destroy ${r.id}`);
      if (opts.failDestroyOn === r.id) throw new Error("target unreachable");
    },
  });
  const types = ["identity.realm", "identity.role", "identity.group", "storage.tree", "storage.acl", "portal.site", "comms.channel", "comms.topic", "process.entity", "process.form", "process.state_machine", "process.rule", "process.workflow", "process.app", "data.dashboard", "data.snapshot", "data.lod_context"];
  const provider: Provider = { name: "oss", adapters: Object.fromEntries(types.map((t) => [t, mk(t)])) };
  return { provider, calls };
}

async function plan() { return (await compile(intent, packs, NOW())).plan; }

async function appliedState() {
  const p = await plan();
  const r = await applyPlan(p, fakeProvider().provider, {}, emptyState("oss"), { now: NOW });
  return { p, state: r.state };
}

describe("verifyPlan", () => {
  it("is ok=false when one check of one resource fails, with correct totals, per-layer counts and markdown", async () => {
    const { p, state } = await appliedState();
    const { provider } = fakeProvider({ failCheck: "h.acl.resources" });
    const report = await verifyPlan(p, provider, {}, state, { now: NOW });

    expect(report.ok).toBe(false);
    expect(report.total).toBe(30);
    expect(report.passed).toBe(29);
    expect(report.byLayer.H).toEqual({ total: 16, passed: 15 });
    expect(report.notApplied).toEqual([]);

    const item = report.items.find((i) => i.id === "h.acl.resources")!;
    expect(item.ok).toBe(false);
    expect(item.checks).toEqual([
      { name: "exists", ok: true, evidence: "OCS group folder present" },
      { name: "acl", ok: false, evidence: "thiếu quyền cho phòng ban kd" },
    ]);

    const md = renderVerifyReport(report);
    expect(md).toContain("❌ h.acl.resources");
    expect(md).toContain("29/30");
  });

  it("is ok=false with an error message when an adapter throws during verify", async () => {
    const { p, state } = await appliedState();
    const { provider } = fakeProvider({ throwOnVerify: "h.tree" });
    const report = await verifyPlan(p, provider, {}, state, { now: NOW });

    const item = report.items.find((i) => i.id === "h.tree")!;
    expect(item.ok).toBe(false);
    expect(item.checks).toEqual([]);
    expect(item.error).toContain("Nextcloud API trả về lỗi 503");
    expect(report.ok).toBe(false);
  });

  it("reports a plan resource missing from state as notApplied instead of silently skipping it", async () => {
    const { p, state } = await appliedState();
    delete state.entries["h.tree"];
    const { provider } = fakeProvider();
    const report = await verifyPlan(p, provider, {}, state, { now: NOW });

    expect(report.notApplied).toEqual(["h.tree"]);
    expect(report.items.some((i) => i.id === "h.tree")).toBe(false);
    expect(report.ok).toBe(false);
    expect(report.total).toBe(29);
  });

  it("excludes gated resources: no state entry, not verified, never counted as notApplied", async () => {
    const { p, state } = await appliedState();
    const { provider } = fakeProvider();
    const report = await verifyPlan(p, provider, {}, state, { now: NOW });

    expect(report.notApplied).not.toContain("i.rag.resources");
    expect(report.items.some((i) => i.id === "i.rag.resources")).toBe(false);
    expect(report.ok).toBe(true);
    expect(report.total).toBe(30);
    expect(report.passed).toBe(30);
  });

  it("never puts a credential value into the report JSON or the rendered markdown", async () => {
    const creds = { keycloak: { url: "https://kc.example.org", admin: "admin", password: "s3cr3t-pw-do-not-leak" } };
    const p = await plan();
    const applied = await applyPlan(p, fakeProvider().provider, creds, emptyState("oss"), { now: NOW });
    const report = await verifyPlan(p, fakeProvider().provider, creds, applied.state, { now: NOW });

    const json = JSON.stringify(report);
    const md = renderVerifyReport(report);
    expect(json).not.toContain("s3cr3t-pw-do-not-leak");
    expect(md).not.toContain("s3cr3t-pw-do-not-leak");
    expect(json).not.toContain("Authorization");
  });
});

describe("destroyPlan", () => {
  it("destroys every applied resource, layer H last, and empties state", async () => {
    const { p, state } = await appliedState();
    const { provider, calls } = fakeProvider();
    const result = await destroyPlan(p, provider, {}, state, { now: NOW });

    expect(result.destroyed.length).toBe(30);
    expect(Object.keys(result.state.entries).length).toBe(0);
    expect(calls[calls.length - 1]).toBe("destroy h.realm");
    const lastNonH = result.destroyed.findIndex((id) => id === "h.realm");
    const anyPLater = result.destroyed.slice(lastNonH + 1).some((id) => state.entries[id].layer !== "H");
    expect(anyPLater).toBe(false);
  });

  it("without prune, leaves stray state entries that are no longer in the plan untouched", async () => {
    const { p, state } = await appliedState();
    state.entries["stray.old"] = { externalId: "e", checksum: "1".repeat(64), appliedAt: "2026-09-10T00:00:00.000Z", layer: "P", spec: { __type: "process.entity" } };
    const { provider } = fakeProvider();
    const result = await destroyPlan(p, provider, {}, state, { now: NOW });

    expect(result.destroyed).not.toContain("stray.old");
    expect(result.state.entries["stray.old"]).toBeDefined();
  });

  it("with prune, also destroys stray state entries", async () => {
    const { p, state } = await appliedState();
    state.entries["stray.old"] = { externalId: "e", checksum: "1".repeat(64), appliedAt: "2026-09-10T00:00:00.000Z", layer: "P", spec: { __type: "process.entity" } };
    const { provider, calls } = fakeProvider();
    const result = await destroyPlan(p, provider, {}, state, { now: NOW, prune: true });

    expect(result.destroyed).toContain("stray.old");
    expect(result.state.entries["stray.old"]).toBeUndefined();
    expect(calls).toContain("destroy stray.old");
  });

  it("throws ApplyError with the partial state when a destroy fails midway, keeping earlier removals", async () => {
    const { p, state } = await appliedState();
    const { provider } = fakeProvider({ failDestroyOn: "h.realm" });

    let error: unknown;
    try {
      await destroyPlan(p, provider, {}, state, { now: NOW });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ApplyError);
    const partial = (error as ApplyError).state;
    // h.realm is destroyed last (layer H, first applied within H); everything else is already gone.
    expect(Object.keys(partial.entries)).toEqual(["h.realm"]);
    expect((error as ApplyError).resourceId).toBe("h.realm");
  });
});
