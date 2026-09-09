// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { loadQuestionnaireV1, QuestionnaireSchema } from "../src/questionnaire/schema.js";
import { PILLARS, TIERS } from "../src/types.js";

describe("questionnaire v1", () => {
  const q = loadQuestionnaireV1();

  it("validates against the schema and has 30-36 questions", () => {
    expect(QuestionnaireSchema.safeParse(q).success).toBe(true);
    expect(q.questions.length).toBeGreaterThanOrEqual(30);
    expect(q.questions.length).toBeLessThanOrEqual(36);
  });

  it("has unique ids and covers all six pillars", () => {
    const ids = q.questions.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PILLARS) expect(q.questions.some((x) => x.pillar === p)).toBe(true);
  });

  it("asks each tier between 15 and 20 questions", () => {
    for (const t of TIERS) {
      const n = q.questions.filter((x) => x.tiers.includes(t)).length;
      expect(n, t).toBeGreaterThanOrEqual(15);
      expect(n, t).toBeLessThanOrEqual(20);
    }
  });

  it("has exactly one supp question per axis with the book's coefficients", () => {
    const supp = (axis: "P" | "D" | "I") => q.questions.filter((x) => x.supp?.axis === axis);
    expect(supp("P").map((x) => x.options!.map((o) => o.value))).toEqual([[0.33, 0.66, 1]]);
    expect(supp("D").map((x) => x.options!.map((o) => o.value))).toEqual([[0, 0.5, 1]]);
    expect(supp("I").map((x) => x.options!.map((o) => o.value))).toEqual([[0, 0.33, 0.66, 1]]);
  });

  it("rejects a question whose max is below its option values", () => {
    const bad = { ...q, questions: [{ ...q.questions[0], type: "choice", max: 1, options: [{ value: 3, label: "x" }] }] };
    expect(QuestionnaireSchema.safeParse(bad).success).toBe(false);
  });
});
