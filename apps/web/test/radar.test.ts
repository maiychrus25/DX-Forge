// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { compute, loadQuestionnaireV1, type Tier } from "@dx-forge/hpdi-engine";
import { radarSeries } from "../src/lib/radar.js";

const Q = loadQuestionnaireV1();
const respond = (tier: Tier, scale: number, supp: number) => ({ tier, answers: Object.fromEntries(Q.questions.filter((q) => q.tiers.includes(tier)).map((q) => [q.id, q.type === "supp" ? supp : scale])) });

describe("radarSeries", () => {
  it("returns four axes in H,P,D,I order with merged = hpdi and per-tier estimates that sum to 100", () => {
    const r = compute(Q, [respond("executive", 4, 1), respond("staff", 2, 1)]);
    const s = radarSeries(r);
    expect(s.map((x) => x.axis)).toEqual(["H", "P", "D", "I"]);
    expect(s.map((x) => x.merged)).toEqual([r.hpdi.H, r.hpdi.P, r.hpdi.D, r.hpdi.I]);
    const exec = s.reduce((a, x) => a + (x.executive ?? 0), 0);
    const staff = s.reduce((a, x) => a + (x.staff ?? 0), 0);
    expect(Math.round(exec)).toBe(100);
    expect(Math.round(staff)).toBe(100);
    expect(s[1].executive!).toBeGreaterThan(s[1].staff!);
    expect(s.every((x) => x.manager === undefined)).toBe(true);
  });
});
