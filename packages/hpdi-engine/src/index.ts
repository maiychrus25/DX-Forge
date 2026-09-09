// SPDX-License-Identifier: AGPL-3.0-or-later
import { dtiLevel, dtiScore, mapHpdi } from "./mapping.js";
import { assertSufficient, countResponses, scorePillars, scoreSupp } from "./scoring.js";
import { classifyShape, prescribe } from "./shape.js";
import type { Questionnaire, Response, ResultV1 } from "./types.js";

export const ENGINE_VERSION = "1.0" as const;
export * from "./types.js";
export { QuestionSchema, QuestionnaireSchema, loadQuestionnaireV1 } from "./questionnaire/schema.js";
export { InsufficientResponses, assertSufficient, countResponses, scorePillars, scoreSupp } from "./scoring.js";
export { axisScores, dtiLevel, dtiScore, mapHpdi } from "./mapping.js";
export { classifyShape, prescribe } from "./shape.js";

export function compute(q: Questionnaire, responses: Response[]): ResultV1 {
  const responseCounts = countResponses(responses);
  assertSufficient(responseCounts);
  const pillars = scorePillars(q, responses);
  const supp = scoreSupp(q, responses);
  const hpdi = mapHpdi(pillars, supp);
  const score = dtiScore(hpdi);
  const shape = classifyShape(hpdi);
  return {
    engineVersion: ENGINE_VERSION,
    pillars,
    supp,
    hpdi,
    dtiScore: score,
    dtiLevel: dtiLevel(score),
    shape,
    responseCounts,
    ruleBasedPrescription: prescribe(hpdi, shape),
  };
}
