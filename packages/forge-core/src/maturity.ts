// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";
import { Maturity as MaturitySchema, type Maturity, type ShapeName } from "./schema/intent.js";


export type ResultLike = {
  hpdi: { H: number; P: number; D: number; I: number };
  shape: ShapeName;
  dtiLevel: number;
  pillars: Record<string, { discrepancy: number }>;
};

/** Builds the `intent.maturity` block from a measurement result (M0 spec §13). */
export function resultToMaturity(result: ResultLike, assessmentId: string): Maturity {
  const discrepancies = Object.fromEntries(Object.entries(result.pillars).filter(([, p]) => p.discrepancy > 0.3).map(([k, p]) => [k, p.discrepancy]));
  return MaturitySchema.parse({ assessment_id: assessmentId, hpdi: result.hpdi, shape: result.shape, dti_level: result.dtiLevel, discrepancies });
}
