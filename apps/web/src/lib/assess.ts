// SPDX-License-Identifier: AGPL-3.0-or-later
import { compute, InsufficientResponses, loadQuestionnaireV1, type ResultV1 } from "@dx-forge/hpdi-engine";
import type Database from "better-sqlite3";
import * as repo from "./repo.js";

const Q = loadQuestionnaireV1();

export function surveyUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}/pulse/s/${token}`;
}

export function openRound(db: Database.Database, input: { coreProcess?: string; days?: number }, now: Date = new Date()) {
  const expiresAt = new Date(now.getTime() + (input.days ?? 14) * 86_400_000).toISOString();
  return repo.createAssessment(db, { questionnaireVersion: Q.version, coreProcess: input.coreProcess, expiresAt });
}

export type CloseOutcome = { ok: true; result: ResultV1 } | { ok: false; reason: "not_found" | "already_closed" | "insufficient"; counts?: Record<repo.Tier, number> };

export function closeRound(db: Database.Database, id: string): CloseOutcome {
  const a = repo.getAssessment(db, id);
  if (!a) return { ok: false, reason: "not_found" };
  if (a.status === "closed") return { ok: false, reason: "already_closed" };
  const responses = repo.listResponses(db, id).map((r) => ({ tier: r.tier, answers: r.answers }));
  try {
    const result = compute(Q, responses);
    repo.closeAssessment(db, id, result, result.engineVersion);
    return { ok: true, result };
  } catch (e) {
    if (e instanceof InsufficientResponses) return { ok: false, reason: "insufficient", counts: repo.countResponses(db, id) };
    throw e;
  }
}
