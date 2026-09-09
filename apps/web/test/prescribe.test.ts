// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { compute, loadQuestionnaireV1, type Tier } from "@dx-forge/hpdi-engine";
import { openDb } from "../src/lib/db.js";
import * as repo from "../src/lib/repo.js";
import { buildDiscrepancyQuestions, buildFiveRo, buildPokaYoke, buildRoadmap, DiscrepancySchema, FiveRoSchema, getOrBuildPrescriptions, PokaYokeSchema, RoadmapSchema } from "../src/lib/prescribe.js";

const Q = loadQuestionnaireV1();
const respond = (tier: Tier, scale: number, supp: number) => ({ tier, answers: Object.fromEntries(Q.questions.filter((q) => q.tiers.includes(tier)).map((q) => [q.id, q.type === "supp" ? supp : scale])) });
const spear = compute(Q, [respond("executive", 4, 0.33), respond("staff", 4, 0.33)]);
const skewed = compute(Q, [respond("executive", 4, 1), respond("staff", 0, 1)]);

describe("builders satisfy the shared schemas", () => {
  it("roadmap: three phases in P → D → I order starting at the focus axis", () => {
    const r = buildRoadmap(spear);
    expect(RoadmapSchema.safeParse(r).success).toBe(true);
    expect(r.focusAxis).toBe("P");
    expect(r.phases.map((p) => p.axis)).toEqual(["P", "D", "I"]);
    expect(r.phases[0].actions.length).toBeGreaterThanOrEqual(3);
  });
  it("discrepancy: one question per pillar with discrepancy > 0.3, addressed to the lower-scoring tier", () => {
    const d = buildDiscrepancyQuestions(skewed);
    expect(DiscrepancySchema.safeParse(d).success).toBe(true);
    expect(d.questions.length).toBe(6);
    expect(d.questions.every((q) => q.forTier === "staff")).toBe(true);
    expect(buildDiscrepancyQuestions(spear).questions).toEqual([]);
  });
  it("fiveRo and pokaYoke fall back to the DX-Ticket template and name the process", () => {
    const f = buildFiveRo("Xử lý yêu cầu khách hàng");
    expect(FiveRoSchema.safeParse(f).success).toBe(true);
    expect(f.process).toBe("Xử lý yêu cầu khách hàng");
    expect(f.steps.every((s) => s.role_A.length > 0)).toBe(true);
    const p = buildPokaYoke(null);
    expect(PokaYokeSchema.safeParse(p).success).toBe(true);
    expect(new Set(p.pokaYoke.map((x) => x.layer))).toEqual(new Set([1, 2, 3]));
  });
});

describe("getOrBuildPrescriptions", () => {
  it("builds once, stores four rows with provider none, and returns cached rows afterwards", () => {
    const db = openDb(":memory:");
    const { assessment } = repo.createAssessment(db, { questionnaireVersion: "1.0", coreProcess: "cskh", expiresAt: "2030-01-01T00:00:00.000Z" });
    repo.closeAssessment(db, assessment.id, spear, "1.0");
    const first = getOrBuildPrescriptions(db, assessment.id);
    expect(first.roadmap.focusAxis).toBe("P");
    expect(db.prepare("SELECT COUNT(*) AS n FROM prescriptions").get()).toEqual({ n: 4 });
    getOrBuildPrescriptions(db, assessment.id);
    expect(db.prepare("SELECT COUNT(*) AS n FROM prescriptions").get()).toEqual({ n: 4 });
    expect(repo.getPrescription(db, assessment.id, "roadmap")?.provider).toBe("none");
  });
});
