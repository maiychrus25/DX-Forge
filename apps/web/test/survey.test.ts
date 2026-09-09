// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { linkState, questionsForTier, validateAnswers } from "../src/lib/survey.js";

describe("questionsForTier", () => {
  it("returns only the tier's questions without scoring metadata", () => {
    const qs = questionsForTier("executive");
    expect(qs.length).toBe(18);
    expect(qs.every((q) => !("pillar" in q) && !("supp" in q) && !("weightEvidence" in q) && !("axis" in q))).toBe(true);
    expect(qs.find((q) => q.id === "OPS-06")?.options?.length).toBe(3);
  });
});

describe("validateAnswers", () => {
  const full = Object.fromEntries(questionsForTier("staff").map((q) => [q.id, q.type === "scale" ? 4 : q.options![0].value]));
  it("accepts a complete, in-range submission", () => {
    expect(validateAnswers("staff", full)).toEqual({ ok: true, answers: full });
  });
  it("rejects a missing question, an out-of-range scale and an unknown option value", () => {
    const { "OPS-02": _drop, ...missing } = full;
    expect(validateAnswers("staff", missing).ok).toBe(false);
    expect(validateAnswers("staff", { ...full, "OPS-02": 7 }).ok).toBe(false);
    expect(validateAnswers("staff", { ...full, "OPS-06": 0.4 }).ok).toBe(false);
  });
  it("drops answers to questions the tier was not asked", () => {
    const r = validateAnswers("staff", { ...full, "STR-01": 4 });
    expect(r.ok && "STR-01" in r.answers).toBe(false);
  });
});

describe("linkState", () => {
  const link = { expiresAt: "2030-01-01T00:00:00.000Z" };
  it("open before expiry while the round is open; expired after; closed when the round is closed", () => {
    expect(linkState(link, { status: "open" }, new Date("2029-01-01"))).toBe("open");
    expect(linkState(link, { status: "open" }, new Date("2031-01-01"))).toBe("expired");
    expect(linkState(link, { status: "closed" }, new Date("2029-01-01"))).toBe("closed");
  });
});
