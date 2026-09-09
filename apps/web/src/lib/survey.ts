// SPDX-License-Identifier: AGPL-3.0-or-later
import { loadQuestionnaireV1, type Question, type Tier } from "@dx-forge/hpdi-engine";

export type PublicQuestion = { id: string; text: string; type: Question["type"]; max: number; options?: { value: number; label: string }[] };

const Q = loadQuestionnaireV1();

export function questionsForTier(tier: Tier): PublicQuestion[] {
  return Q.questions.filter((q) => q.tiers.includes(tier)).map((q) => ({ id: q.id, text: q.text, type: q.type, max: q.max, ...(q.options ? { options: q.options } : {}) }));
}

export function validateAnswers(tier: Tier, raw: unknown): { ok: true; answers: Record<string, number> } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "answers must be an object" };
  const given = raw as Record<string, unknown>;
  const answers: Record<string, number> = {};
  for (const q of questionsForTier(tier)) {
    const v = given[q.id];
    if (typeof v !== "number" || Number.isNaN(v)) return { ok: false, error: `missing answer for ${q.id}` };
    if (q.options) {
      if (!q.options.some((o) => o.value === v)) return { ok: false, error: `invalid option for ${q.id}` };
    } else if (v < 0 || v > q.max || !Number.isInteger(v)) return { ok: false, error: `out of range for ${q.id}` };
    answers[q.id] = v;
  }
  return { ok: true, answers };
}

export function linkState(link: { expiresAt: string }, assessment: { status: "open" | "closed" }, now: Date = new Date()): "open" | "expired" | "closed" {
  if (assessment.status === "closed") return "closed";
  return now.getTime() > new Date(link.expiresAt).getTime() ? "expired" : "open";
}
