// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, beforeEach } from "vitest";
import { openDb } from "../src/lib/db.js";
import * as repo from "../src/lib/repo.js";
import type Database from "better-sqlite3";

let db: Database.Database;
const ORG = { id: "org" as const, name: "Công ty ABC", shortCode: "abc", sector: "retail", sizeBand: "10-50", departments: [{ code: "cskh", name: "Chăm sóc khách hàng" }] };

beforeEach(() => { db = openDb(":memory:"); });

describe("organisation", () => {
  it("is absent until saved, then round-trips departments as JSON", () => {
    expect(repo.getOrganization(db)).toBeNull();
    repo.saveOrganization(db, ORG);
    expect(repo.getOrganization(db)).toEqual(ORG);
    repo.saveOrganization(db, { ...ORG, name: "ABC 2" });
    expect(repo.getOrganization(db)?.name).toBe("ABC 2");
  });
});

describe("assessments and links", () => {
  it("creates rounds with increasing numbers and exactly three links", () => {
    const a = repo.createAssessment(db, { questionnaireVersion: "1.0", expiresAt: "2030-01-01T00:00:00.000Z" });
    const b = repo.createAssessment(db, { questionnaireVersion: "1.0", coreProcess: "cskh", expiresAt: "2030-01-01T00:00:00.000Z" });
    expect(a.assessment.round).toBe(1);
    expect(b.assessment.round).toBe(2);
    expect(a.links.map((l) => l.tier).sort()).toEqual(["executive", "manager", "staff"]);
    expect(new Set(a.links.map((l) => l.token)).size).toBe(3);
    expect(a.links[0].token).toMatch(/^[0-9a-f]{32}$/);
    expect(repo.listAssessments(db).map((x) => x.round)).toEqual([2, 1]);
  });
  it("finds a link by token and rejects a second link for the same tier", () => {
    const { links } = repo.createAssessment(db, { questionnaireVersion: "1.0", expiresAt: "2030-01-01T00:00:00.000Z" });
    expect(repo.getLinkByToken(db, links[0].token)?.tier).toBe(links[0].tier);
    expect(repo.getLinkByToken(db, "nope")).toBeNull();
    expect(() => db.prepare("INSERT INTO survey_links (id, assessment_id, tier, token, expires_at) VALUES ('x', ?, ?, 'ffffffffffffffffffffffffffffffff', '2030-01-01')").run(links[0].assessmentId, links[0].tier)).toThrow(/UNIQUE/);
  });
});

describe("responses, results", () => {
  it("stores anonymous answers and counts per tier", () => {
    const { assessment, links } = repo.createAssessment(db, { questionnaireVersion: "1.0", expiresAt: "2030-01-01T00:00:00.000Z" });
    const staff = links.find((l) => l.tier === "staff")!;
    repo.addResponse(db, staff.id, { "OPS-02": 3 }, "Quá nhiều Zalo");
    repo.addResponse(db, staff.id, { "OPS-02": 1 });
    expect(repo.countResponses(db, assessment.id)).toEqual({ executive: 0, manager: 0, staff: 2 });
    expect(repo.listResponses(db, assessment.id)).toEqual([{ tier: "staff", answers: { "OPS-02": 3 } }, { tier: "staff", answers: { "OPS-02": 1 } }]);
    expect(db.prepare("PRAGMA table_info(responses)").all().map((c: any) => c.name)).not.toContain("ip");
  });
  it("closes a round with its result and exposes the latest closed one", () => {
    const { assessment } = repo.createAssessment(db, { questionnaireVersion: "1.0", expiresAt: "2030-01-01T00:00:00.000Z" });
    expect(repo.latestResult(db)).toBeNull();
    repo.closeAssessment(db, assessment.id, { hpdi: { H: 90, P: 10, D: 0, I: 0 } }, "1.0");
    expect(repo.getAssessment(db, assessment.id)?.status).toBe("closed");
    expect(repo.getResult(db, assessment.id)?.payload).toEqual({ hpdi: { H: 90, P: 10, D: 0, I: 0 } });
    expect(repo.latestResult(db)?.assessmentId).toBe(assessment.id);
  });
});

describe("prescriptions, artifacts, llm calls", () => {
  it("saves and reads back by kind, and aggregates llm stats", () => {
    const { assessment } = repo.createAssessment(db, { questionnaireVersion: "1.0", expiresAt: "2030-01-01T00:00:00.000Z" });
    repo.savePrescription(db, { assessmentId: assessment.id, kind: "roadmap", provider: "none", model: null, payload: { focusAxis: "P" }, fallback: true, tokensIn: 0, tokensOut: 0, latencyMs: 1 });
    expect(repo.getPrescription(db, assessment.id, "roadmap")?.payload).toEqual({ focusAxis: "P" });
    repo.saveArtifact(db, { assessmentId: assessment.id, kind: "para-kit", path: "/tmp/x.zip", sizeBytes: 10 });
    expect(repo.getArtifact(db, assessment.id, "para-kit")?.sizeBytes).toBe(10);
    repo.logLlmCall(db, { provider: "none", model: "-", purpose: "roadmap", ok: true, fallback: true, tokensIn: 0, tokensOut: 0, latencyMs: 2 });
    repo.logLlmCall(db, { provider: "gemini", model: "g", purpose: "roadmap", ok: true, fallback: false, tokensIn: 10, tokensOut: 5, latencyMs: 300 });
    expect(repo.llmStats(db)).toEqual([
      { provider: "gemini", calls: 1, okFirstTry: 1, fallbacks: 0, tokensIn: 10, tokensOut: 5, avgLatencyMs: 300 },
      { provider: "none", calls: 1, okFirstTry: 1, fallbacks: 1, tokensIn: 0, tokensOut: 0, avgLatencyMs: 2 },
    ]);
  });
});
