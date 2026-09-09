// SPDX-License-Identifier: AGPL-3.0-or-later
import { mergeQuestions } from "./scoring.js";
import type { Axis, Questionnaire, Response, ResultV1 } from "./types.js";

/**
 * Survey score per axis in 0..1, per M0 spec §5.3: P and D come from their pillars; I comes from the
 * AI/automation questions tagged `axis: "I"` (not the whole technology pillar), falling back to the
 * technology pillar when the questionnaire carries no such tag.
 */
export function scoreAxes(q: Questionnaire, responses: Response[], pillars: ResultV1["pillars"]): Record<Axis, number> {
  const axisIQuestions = q.questions.filter((x) => x.axis === "I" && x.type !== "supp");
  return {
    P: (pillars.operations.merged + pillars.customer.merged) / 2,
    D: pillars.data.merged,
    I: axisIQuestions.length > 0 ? mergeQuestions(axisIQuestions, responses).merged : pillars.technology.merged,
  };
}

export function mapHpdi(axes: Record<Axis, number>, supp: Record<Axis, number>): ResultV1["hpdi"] {
  const P = Math.round(axes.P * supp.P * 30);
  const D = Math.round(axes.D * supp.D * 30);
  const I = Math.round(axes.I * supp.I * 30);
  return { H: 100 - (P + D + I), P, D, I };
}

/** dtiScore = 100 − H (see plan Global Constraints for why not the pillar mean). */
export function dtiScore(hpdi: ResultV1["hpdi"]): number {
  return 100 - hpdi.H;
}

export function dtiLevel(score: number): ResultV1["dtiLevel"] {
  if (score <= 10) return 1;
  if (score <= 30) return 2;
  if (score <= 70) return 3;
  if (score < 90) return 4;
  return 5;
}
