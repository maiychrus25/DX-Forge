// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Axis, ResultV1 } from "./types.js";

/** Survey score per axis in 0..1, from the pillars named in M0 spec §5.3. */
export function axisScores(pillars: ResultV1["pillars"]): Record<Axis, number> {
  return {
    P: (pillars.operations.merged + pillars.customer.merged) / 2,
    D: pillars.data.merged,
    I: pillars.technology.merged,
  };
}

export function mapHpdi(pillars: ResultV1["pillars"], supp: Record<Axis, number>): ResultV1["hpdi"] {
  const s = axisScores(pillars);
  const P = Math.round(s.P * supp.P * 30);
  const D = Math.round(s.D * supp.D * 30);
  const I = Math.round(s.I * supp.I * 30);
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
