// SPDX-License-Identifier: AGPL-3.0-or-later
import { PILLARS, TIERS, TIER_WEIGHTS, type Axis, type Pillar, type Question, type Questionnaire, type Response, type ResultV1, type Tier } from "./types.js";

export class InsufficientResponses extends Error {
  constructor(counts: Record<Tier, number>) {
    super(`Need at least one executive and one staff response, got ${JSON.stringify(counts)}`);
    this.name = "InsufficientResponses";
  }
}

export function countResponses(responses: Response[]): Record<Tier, number> {
  const counts: Record<Tier, number> = { executive: 0, manager: 0, staff: 0 };
  for (const r of responses) counts[r.tier] += 1;
  return counts;
}

export function assertSufficient(counts: Record<Tier, number>): void {
  if (counts.executive < 1 || counts.staff < 1) throw new InsufficientResponses(counts);
}

/** Mean normalised answer (0..1) of one question inside one tier, or undefined when nobody in that tier answered it. */
function tierMean(question: Question, responses: Response[], tier: Tier): number | undefined {
  const values = responses
    .filter((r) => r.tier === tier && typeof r.answers[question.id] === "number")
    .map((r) => Math.min(Math.max(r.answers[question.id]!, 0), question.max) / question.max);
  if (values.length === 0) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function weightedMerge(byTier: Partial<Record<Tier, number>>): number {
  let num = 0;
  let den = 0;
  for (const t of TIERS) {
    const v = byTier[t];
    if (v === undefined) continue;
    num += v * TIER_WEIGHTS[t];
    den += TIER_WEIGHTS[t];
  }
  return den === 0 ? 0 : num / den;
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * Pillar score per tier = mean of that tier's normalised answers.
 * Merged = tier-weighted average (M0 spec §5.2); when staff data exists, executive/manager means used for
 * merging exclude `weightEvidence` questions so hands-on evidence is only counted through staff.
 */
export function scorePillars(q: Questionnaire, responses: Response[]): ResultV1["pillars"] {
  const out = {} as ResultV1["pillars"];
  const staffHasData = responses.some((r) => r.tier === "staff");
  const defined = (v: number | undefined): v is number => v !== undefined;
  for (const pillar of PILLARS) {
    const questions = q.questions.filter((x) => x.pillar === pillar && x.type !== "supp");
    const byTier: Partial<Record<Tier, number>> = {};
    const forMerge: Partial<Record<Tier, number>> = {};
    for (const tier of TIERS) {
      const all = questions.map((x) => tierMean(x, responses, tier)).filter(defined);
      if (all.length === 0) continue;
      byTier[tier] = mean(all);
      const nonEvidence =
        tier !== "staff" && staffHasData
          ? questions.filter((x) => !x.weightEvidence).map((x) => tierMean(x, responses, tier)).filter(defined)
          : all;
      forMerge[tier] = nonEvidence.length > 0 ? mean(nonEvidence) : byTier[tier]!;
    }
    const present = Object.values(byTier);
    out[pillar] = {
      byTier,
      merged: weightedMerge(forMerge),
      discrepancy: present.length > 1 ? Math.max(...present) - Math.min(...present) : 0,
    };
  }
  return out;
}

/** Lowest coefficient across tiers with data; falls back to the lowest option of the axis' supp question. */
export function scoreSupp(q: Questionnaire, responses: Response[]): Record<Axis, number> {
  const out: Record<Axis, number> = { P: 1, D: 1, I: 1 };
  for (const axis of ["P", "D", "I"] as const) {
    const question = q.questions.find((x) => x.type === "supp" && x.supp?.axis === axis);
    if (!question) continue;
    const lowest = Math.min(...question.options!.map((o) => o.value));
    const tierValues = TIERS.map((t) => {
      const vals = responses.filter((r) => r.tier === t && typeof r.answers[question.id] === "number").map((r) => r.answers[question.id]!);
      return vals.length === 0 ? undefined : mean(vals);
    }).filter((v): v is number => v !== undefined);
    out[axis] = tierValues.length === 0 ? lowest : Math.min(...tierValues);
  }
  return out;
}

export type { Pillar };
