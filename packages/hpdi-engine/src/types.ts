// SPDX-License-Identifier: AGPL-3.0-or-later
export const PILLARS = ["strategy", "culture", "customer", "operations", "technology", "data"] as const;
export type Pillar = (typeof PILLARS)[number];

export const TIERS = ["executive", "manager", "staff"] as const;
export type Tier = (typeof TIERS)[number];

/** Merge weights from M0 spec §5.2; renormalised over tiers that have data. */
export const TIER_WEIGHTS: Record<Tier, number> = { executive: 0.25, manager: 0.25, staff: 0.5 };

export type Axis = "P" | "D" | "I";

export type Question = {
  id: string;
  pillar: Pillar;
  tiers: Tier[];
  type: "scale" | "choice" | "supp";
  text: string;
  options?: { value: number; label: string }[];
  max: number;
  supp?: { axis: Axis };
  weightEvidence?: boolean;
  /** Scale question that feeds an HPDI axis directly (used for I: AI/automation questions). */
  axis?: Axis;
};

export type Questionnaire = { version: string; questions: Question[] };

/** One anonymous submission: answers keyed by question id, value in [0, max] (or the supp coefficient). */
export type Response = { tier: Tier; answers: Record<string, number> };

export type Shape = "spear" | "kite" | "illusion" | "diamond" | "transitional";

export type ResultV1 = {
  engineVersion: "1.0";
  pillars: Record<Pillar, { byTier: Partial<Record<Tier, number>>; merged: number; discrepancy: number }>;
  supp: Record<Axis, number>;
  hpdi: { H: number; P: number; D: number; I: number };
  dtiScore: number;
  dtiLevel: 1 | 2 | 3 | 4 | 5;
  shape: Shape;
  responseCounts: Record<Tier, number>;
  ruleBasedPrescription: { focusAxis: Axis; steps: string[] };
};
