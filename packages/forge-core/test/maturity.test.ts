// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { resultToMaturity } from "../src/maturity.js";
import { Maturity } from "../src/schema/intent.js";

describe("resultToMaturity", () => {
  it("copies hpdi, shape and level and keeps only discrepancies above 0.3", () => {
    const m = resultToMaturity({ hpdi: { H: 55, P: 25, D: 12, I: 8 }, shape: "transitional", dtiLevel: 3, pillars: { operations: { discrepancy: 0.35 }, data: { discrepancy: 0.1 } } }, "a1");
    expect(m).toEqual({ assessment_id: "a1", hpdi: { H: 55, P: 25, D: 12, I: 8 }, shape: "transitional", dti_level: 3, discrepancies: { operations: 0.35 } });
    expect(Maturity.safeParse(m).success).toBe(true);
  });
});
