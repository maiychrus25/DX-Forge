// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, beforeEach } from "vitest";
import { loadQuestionnaireV1, type Tier } from "@dx-forge/hpdi-engine";
import type Database from "better-sqlite3";
import { openDb } from "../src/lib/db.js";
import * as repo from "../src/lib/repo.js";
import { closeRound, openRound, surveyUrl } from "../src/lib/assess.js";

const Q = loadQuestionnaireV1();
/** Supp questions feed different axes (OPS-06 -> P, DAT-06 -> D, TEC-06 -> I), so a single scalar
 * cannot express the book example. Take one coefficient per axis. */
function answersFor(tier: Tier, scale: number, supp: Record<"P" | "D" | "I", number>) {
  return Object.fromEntries(Q.questions.filter((q) => q.tiers.includes(tier)).map((q) => [q.id, q.type === "supp" ? supp[q.supp!.axis] : scale]));
}
let db: Database.Database;
beforeEach(() => { db = openDb(":memory:"); });

describe("openRound", () => {
  it("creates a round whose links expire in the given number of days", () => {
    const { assessment, links } = openRound(db, { coreProcess: "cskh", days: 7 }, new Date("2026-09-10T00:00:00Z"));
    expect(assessment.status).toBe("open");
    expect(links[0].expiresAt).toBe("2026-09-17T00:00:00.000Z");
    expect(surveyUrl("http://localhost:3000", links[0].token)).toBe(`http://localhost:3000/pulse/s/${links[0].token}`);
  });
});

describe("closeRound", () => {
  it("refuses without an executive and a staff response and keeps the round open", () => {
    const { assessment, links } = openRound(db, {});
    repo.addResponse(db, links.find((l) => l.tier === "executive")!.id, answersFor("executive", 4, { P: 1, D: 1, I: 1 }));
    const r = closeRound(db, assessment.id);
    expect(r).toMatchObject({ ok: false, reason: "insufficient", counts: { executive: 1, staff: 0 } });
    expect(repo.getAssessment(db, assessment.id)?.status).toBe("open");
  });
  it("computes and stores ResultV1, then refuses a second close", () => {
    const { assessment, links } = openRound(db, {});
    repo.addResponse(db, links.find((l) => l.tier === "executive")!.id, answersFor("executive", 4, { P: 0.33, D: 0, I: 0 }));
    repo.addResponse(db, links.find((l) => l.tier === "staff")!.id, answersFor("staff", 4, { P: 0.33, D: 0, I: 0 }));
    const r = closeRound(db, assessment.id);
    expect(r.ok && r.result.hpdi).toEqual({ H: 90, P: 10, D: 0, I: 0 });
    expect(repo.getResult(db, assessment.id)?.engineVersion).toBe("1.0");
    expect(closeRound(db, assessment.id)).toEqual({ ok: false, reason: "already_closed" });
    expect(closeRound(db, "nope")).toEqual({ ok: false, reason: "not_found" });
  });
});
