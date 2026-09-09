// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { compute, InsufficientResponses, loadQuestionnaireV1, scorePillars } from "../src/index.js";
import { classifyShape, prescribe } from "../src/shape.js";
import { dtiLevel, scoreAxes } from "../src/mapping.js";
import type { Questionnaire, Response, Tier } from "../src/types.js";

const q = loadQuestionnaireV1();

function respond(tier: Tier, scaleValue: number, supp: { P: number; D: number; I: number }): Response {
  const answers: Record<string, number> = {};
  for (const x of q.questions) {
    if (!x.tiers.includes(tier)) continue;
    answers[x.id] = x.type === "supp" ? supp[x.supp!.axis] : scaleValue;
  }
  return { tier, answers };
}

/** Like `respond`, but `overrides` replaces the scale value for the listed question ids. */
function respondWithOverrides(
  tier: Tier,
  overrides: Record<string, number>,
  supp: { P: number; D: number; I: number },
): Response {
  const answers: Record<string, number> = {};
  for (const x of q.questions) {
    if (!x.tiers.includes(tier)) continue;
    answers[x.id] = x.type === "supp" ? supp[x.supp!.axis] : (overrides[x.id] ?? 4);
  }
  return { tier, answers };
}

describe("compute golden cases (M0 spec §5.5)", () => {
  it("book example: max survey, supp P 0.33 / D 0 / I 0 → P=10 D=0 I=0 H=90, spear, level 1", () => {
    const r = compute(q, [respond("executive", 4, { P: 0.33, D: 0, I: 0 }), respond("staff", 4, { P: 0.33, D: 0, I: 0 })]);
    expect(r.hpdi).toEqual({ H: 90, P: 10, D: 0, I: 0 });
    expect(r.shape).toBe("spear");
    expect(r.dtiLevel).toBe(1);
    expect(r.engineVersion).toBe("1.0");
    expect(r.responseCounts).toEqual({ executive: 1, manager: 0, staff: 1 });
  });

  it("diamond: max survey and supp 1 → P=D=I=30, H=10, diamond, level 5", () => {
    const all = { P: 1, D: 1, I: 1 };
    const r = compute(q, [respond("executive", 4, all), respond("manager", 4, all), respond("staff", 4, all)]);
    expect(r.hpdi).toEqual({ H: 10, P: 30, D: 30, I: 30 });
    expect(r.shape).toBe("diamond");
    expect(r.dtiLevel).toBe(5);
    expect(r.ruleBasedPrescription.focusAxis).toBe("I");
  });

  it("throws InsufficientResponses without responses and without staff", () => {
    expect(() => compute(q, [])).toThrow(InsufficientResponses);
    expect(() => compute(q, [respond("executive", 4, { P: 1, D: 1, I: 1 })])).toThrow(InsufficientResponses);
  });

  it("executive high, staff low → discrepancy > 0.3 and merged leaning to staff", () => {
    const r = compute(q, [respond("executive", 4, { P: 1, D: 1, I: 1 }), respond("staff", 0, { P: 1, D: 1, I: 1 })]);
    expect(r.pillars.operations.discrepancy).toBeGreaterThan(0.3);
    expect(r.pillars.operations.merged).toBeLessThan(0.34);
  });

  it("I axis comes only from questions marked axis I", () => {
    const overrides = { "TEC-02": 0, "TEC-04": 0 };
    const r = compute(q, [
      respondWithOverrides("executive", overrides, { P: 1, D: 1, I: 1 }),
      respondWithOverrides("staff", overrides, { P: 1, D: 1, I: 1 }),
    ]);
    expect(r.hpdi.I).toBe(0);
    expect(r.pillars.technology.merged).toBeGreaterThan(0.5);
  });

  it("scoreAxes falls back to the technology pillar when no question is marked", () => {
    const qNoAxis: Questionnaire = { ...q, questions: q.questions.map((x) => ({ ...x, axis: undefined })) };
    const responses = [respond("executive", 4, { P: 1, D: 1, I: 1 }), respond("staff", 4, { P: 1, D: 1, I: 1 })];
    const pillars = scorePillars(qNoAxis, responses);
    expect(scoreAxes(qNoAxis, responses, pillars).I).toBeCloseTo(1, 5);
  });
});

describe("classifyShape", () => {
  it.each([
    [{ H: 80, P: 10, D: 5, I: 5 }, "spear"],
    [{ H: 70, P: 25, D: 3, I: 2 }, "kite"],
    [{ H: 65, P: 10, D: 15, I: 10 }, "illusion"],
    [{ H: 20, P: 30, D: 25, I: 25 }, "diamond"],
    [{ H: 50, P: 25, D: 15, I: 10 }, "transitional"],
  ])("%j → %s", (hpdi, shape) => {
    expect(classifyShape(hpdi)).toBe(shape);
  });
});

describe("dtiLevel boundaries", () => {
  it.each([[0, 1], [10, 1], [10.5, 2], [30, 2], [31, 3], [70, 3], [71, 4], [89, 4], [90, 5], [100, 5]])("score %d → level %d", (s, l) => {
    expect(dtiLevel(s)).toBe(l);
  });
});

describe("prescribe", () => {
  it("follows the P → D → I order: first axis under 20 is the focus", () => {
    expect(prescribe({ H: 60, P: 25, D: 10, I: 5 }, "transitional").focusAxis).toBe("D");
    expect(prescribe({ H: 90, P: 10, D: 0, I: 0 }, "spear").focusAxis).toBe("P");
  });
  it("warns about GIGO for illusion", () => {
    expect(prescribe({ H: 65, P: 10, D: 15, I: 10 }, "illusion").steps.join(" ")).toContain("GIGO");
  });
});
