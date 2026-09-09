// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { compile } from "../src/compile.js";
import { loadPacks } from "../src/packs/loader.js";
import { loadIntentFile } from "../src/schema/intent.js";
import { emptyState } from "../src/schema/state.js";
import { applyPlan, ApplyError, NoAdapter, renderDryRun } from "../src/apply.js";
import type { Adapter, Provider } from "../src/provider.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const intent = loadIntentFile(`${ROOT}examples/intent.example.yaml`);
const packs = loadPacks(`${ROOT}packs`);
const NOW = () => new Date("2026-09-10T00:00:00Z");

function fakeProvider(failOn?: string) {
  const calls: string[] = [];
  const mk = (type: string): Adapter => ({
    type,
    async apply(_c, r) { calls.push(`apply ${r.id}`); if (r.id === failOn) throw new Error("boom"); return { externalId: `ext-${r.id}` }; },
    async verify() { return [{ name: "ok", ok: true, evidence: "" }]; },
    async destroy(_c, r) { calls.push(`destroy ${r.id}`); },
  });
  const types = ["identity.realm", "identity.role", "identity.group", "storage.tree", "storage.acl", "portal.site", "comms.channel", "comms.topic", "process.entity", "process.form", "process.state_machine", "process.rule", "process.workflow", "process.app", "data.dashboard", "data.snapshot", "data.lod_context"];
  const provider: Provider = { name: "oss", adapters: Object.fromEntries(types.map((t) => [t, mk(t)])) };
  return { provider, calls };
}

async function plan() { return (await compile(intent, packs, NOW())).plan; }

describe("applyPlan", () => {
  it("dry-run lists creates and gated resources and calls no adapter", async () => {
    const { provider, calls } = fakeProvider();
    const r = await applyPlan(await plan(), provider, {}, emptyState("oss"), { dryRun: true, now: NOW });
    expect(calls).toEqual([]);
    expect(r.changes.filter((c) => c.action === "create").length).toBe(30);
    expect(r.gated).toEqual(["i.rag.resources", "i.policy.cskh", "i.assistant"]);
    expect(renderDryRun(r.changes)).toMatch(/create\s+h\.realm/);
  });
  it("creates everything in topological order, then a second run skips everything", async () => {
    const { provider, calls } = fakeProvider();
    const p = await plan();
    const r1 = await applyPlan(p, provider, {}, emptyState("oss"), { now: NOW });
    expect(calls[0]).toBe("apply h.realm");
    expect(calls.indexOf("apply h.acl.areas.cskh")).toBeGreaterThan(calls.indexOf("apply h.group.cskh"));
    expect(Object.keys(r1.state.entries).length).toBe(30);
    expect(r1.state.entries["h.realm"]).toMatchObject({ externalId: "ext-h.realm", layer: "H" });
    calls.length = 0;
    const r2 = await applyPlan(p, provider, {}, r1.state, { now: NOW });
    expect(calls).toEqual([]);
    expect(r2.skipped.length).toBe(30);
  });
  it("stops at the first failure, keeps the state so far, and resumes from there", async () => {
    const { provider, calls } = fakeProvider("h.tree");
    const p = await plan();
    let saved;
    try { await applyPlan(p, provider, {}, emptyState("oss"), { now: NOW }); } catch (e) { expect(e).toBeInstanceOf(ApplyError); saved = (e as ApplyError).state; expect((e as ApplyError).resourceId).toBe("h.tree"); }
    expect(saved!.entries["h.realm"]).toBeDefined();
    expect(saved!.entries["h.tree"]).toBeUndefined();
    const ok = fakeProvider();
    const r = await applyPlan(p, ok.provider, {}, saved!, { now: NOW });
    expect(ok.calls[0]).toBe("apply h.tree");
    expect(r.skipped).toContain("h.realm");
  });
  it("prunes stale entries in reverse layer order and only with --prune", async () => {
    const { provider, calls } = fakeProvider();
    const p = await plan();
    const state = (await applyPlan(p, provider, {}, emptyState("oss"), { now: NOW })).state;
    state.entries["zz.old"] = { externalId: "e", checksum: "1".repeat(64), appliedAt: "2026-09-10T00:00:00.000Z", layer: "P", spec: {} };
    state.entries["aa.old"] = { externalId: "e", checksum: "1".repeat(64), appliedAt: "2026-09-10T00:00:00.000Z", layer: "H", spec: {} };
    calls.length = 0;
    await applyPlan(p, provider, {}, state, { now: NOW });
    expect(calls).toEqual([]);
    const r = await applyPlan(p, provider, {}, state, { now: NOW, prune: true });
    expect(r.destroyed).toEqual(["zz.old", "aa.old"]);        // P before H
    expect(r.state.entries["zz.old"]).toBeUndefined();
  });
  it("refuses a plan with a resource type the provider cannot handle, before touching the target", async () => {
    const { provider, calls } = fakeProvider();
    delete provider.adapters["storage.acl"];
    await expect(applyPlan(await plan(), provider, {}, emptyState("oss"), { now: NOW })).rejects.toBeInstanceOf(NoAdapter);
    expect(calls).toEqual([]);
  });
});
