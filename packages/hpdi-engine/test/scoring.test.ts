// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { loadQuestionnaireV1 } from "../src/questionnaire/schema.js";
import { InsufficientResponses, assertSufficient, countResponses, scorePillars, scoreSupp } from "../src/scoring.js";
import type { Response, Tier } from "../src/types.js";

const q = loadQuestionnaireV1();

/** Build a response answering every question the tier is asked with `scaleValue` (0-4) and supp questions with `suppValue`. */
function respond(tier: Tier, scaleValue: number, suppValue = 1): Response {
  const answers: Record<string, number> = {};
  for (const x of q.questions) {
    if (!x.tiers.includes(tier)) continue;
    answers[x.id] = x.type === "supp" ? suppValue : scaleValue;
  }
  return { tier, answers };
}

describe("countResponses / assertSufficient", () => {
  it("throws InsufficientResponses when there are no responses", () => {
    expect(() => assertSufficient(countResponses([]))).toThrow(InsufficientResponses);
  });
  it("throws when the staff tier is missing", () => {
    expect(() => assertSufficient(countResponses([respond("executive", 4), respond("manager", 4)]))).toThrow(InsufficientResponses);
  });
  it("accepts executive + staff", () => {
    expect(() => assertSufficient(countResponses([respond("executive", 4), respond("staff", 4)]))).not.toThrow();
  });
  it("throws when the executive tier is missing", () => {
    expect(() => assertSufficient(countResponses([respond("manager", 4), respond("staff", 4)]))).toThrow(InsufficientResponses);
  });
});

describe("scorePillars", () => {
  it("gives 1.0 merged and 0 discrepancy when every tier answers the maximum", () => {
    const p = scorePillars(q, [respond("executive", 4), respond("manager", 4), respond("staff", 4)]);
    expect(p.operations.merged).toBeCloseTo(1, 5);
    expect(p.operations.discrepancy).toBeCloseTo(0, 5);
    expect(p.operations.byTier.staff).toBeCloseTo(1, 5);
  });

  it("flags discrepancy above 0.3 and leans to staff when executives over-rate", () => {
    const p = scorePillars(q, [respond("executive", 4), respond("staff", 0)]);
    expect(p.operations.discrepancy).toBeGreaterThan(0.3);
    // weights 0.25 exec / 0.5 staff renormalised -> exec 1/3, staff 2/3 -> merged 0.333.
    expect(p.operations.merged).toBeLessThan(0.34);
  });

  it("averages several responses inside one tier", () => {
    const p = scorePillars(q, [respond("executive", 2), respond("staff", 0), respond("staff", 4)]);
    expect(p.data.byTier.staff).toBeCloseTo(0.5, 5);
  });

  it("omits tiers without data from byTier and renormalises weights", () => {
    const p = scorePillars(q, [respond("executive", 4), respond("staff", 4)]);
    expect(p.strategy.byTier.manager).toBeUndefined();
    expect(p.strategy.merged).toBeCloseTo(1, 5);
  });

  it("scopes the evidence exclusion per pillar: staff without answers in a pillar does not strip manager evidence questions", () => {
    const responses: Response[] = [
      { tier: "executive", answers: { "OPS-01": 0, "OPS-05": 0 } },
      { tier: "manager", answers: { "OPS-02": 4, "OPS-03": 0, "OPS-04": 4 } },
      { tier: "staff", answers: { "DAT-01": 0 } },
    ];
    const p = scorePillars(q, responses);
    // executive 0 (weight 0.25), manager mean 2/3 over all three questions (weight 0.25), staff absent in operations
    expect(p.operations.merged).toBeCloseTo(1 / 3, 5);
    expect(p.operations.byTier.staff).toBeUndefined();
  });
});

describe("scoreSupp", () => {
  it("takes the minimum coefficient across tiers", () => {
    const s = scoreSupp(q, [respond("executive", 4, 1), respond("staff", 4, 0.33)]);
    expect(s.P).toBeCloseTo(0.33, 5);
  });
  it("falls back to the lowest option when nobody answered the supp question", () => {
    const noSupp: Response = { tier: "staff", answers: { "OPS-01": 4 } };
    const s = scoreSupp(q, [noSupp]);
    expect(s).toEqual({ P: 0.33, D: 0, I: 0 });
  });
});
