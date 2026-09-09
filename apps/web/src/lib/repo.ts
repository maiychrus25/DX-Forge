// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomBytes, randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export type Tier = "executive" | "manager" | "staff";
export const TIERS: Tier[] = ["executive", "manager", "staff"];
export type Organization = { id: "org"; name: string; shortCode: string; sector: string; sizeBand: string; departments: { code: string; name: string }[] };
export type Assessment = { id: string; round: number; questionnaireVersion: string; status: "open" | "closed"; coreProcess: string | null; createdAt: string; closedAt: string | null };
export type SurveyLink = { id: string; assessmentId: string; tier: Tier; token: string; expiresAt: string };
export type PrescriptionKind = "roadmap" | "discrepancy" | "fiveRo" | "pokaYoke" | "askReport";
export type PrescriptionRow = { assessmentId: string; kind: PrescriptionKind; provider: string; model: string | null; payload: unknown; fallback: boolean; tokensIn: number; tokensOut: number; latencyMs: number };
export type ArtifactRow = { assessmentId: string; kind: string; path: string; sizeBytes: number };
export type LlmCallRow = { provider: string; model: string; purpose: string; ok: boolean; fallback: boolean; tokensIn: number; tokensOut: number; latencyMs: number };

type Row = Record<string, unknown>;
const assessment = (r: Row): Assessment => ({ id: r.id as string, round: r.round as number, questionnaireVersion: r.questionnaire_version as string, status: r.status as Assessment["status"], coreProcess: (r.core_process as string) ?? null, createdAt: r.created_at as string, closedAt: (r.closed_at as string) ?? null });
const link = (r: Row): SurveyLink => ({ id: r.id as string, assessmentId: r.assessment_id as string, tier: r.tier as Tier, token: r.token as string, expiresAt: r.expires_at as string });

export function getOrganization(db: Database.Database): Organization | null {
  const r = db.prepare("SELECT * FROM organizations WHERE id = 'org'").get() as Row | undefined;
  return r ? { id: "org", name: r.name as string, shortCode: r.short_code as string, sector: r.sector as string, sizeBand: r.size_band as string, departments: JSON.parse(r.departments as string) } : null;
}

export function saveOrganization(db: Database.Database, org: Organization): void {
  db.prepare(`INSERT INTO organizations (id, name, short_code, sector, size_band, departments) VALUES ('org', @name, @shortCode, @sector, @sizeBand, @departments)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, short_code = excluded.short_code, sector = excluded.sector, size_band = excluded.size_band, departments = excluded.departments`)
    .run({ ...org, departments: JSON.stringify(org.departments) });
}

export function listAssessments(db: Database.Database): Assessment[] {
  return (db.prepare("SELECT * FROM assessments ORDER BY round DESC").all() as Row[]).map(assessment);
}

export function getAssessment(db: Database.Database, id: string): Assessment | null {
  const r = db.prepare("SELECT * FROM assessments WHERE id = ?").get(id) as Row | undefined;
  return r ? assessment(r) : null;
}

export function createAssessment(db: Database.Database, input: { questionnaireVersion: string; coreProcess?: string; expiresAt: string }): { assessment: Assessment; links: SurveyLink[] } {
  return db.transaction(() => {
    const round = ((db.prepare("SELECT MAX(round) AS m FROM assessments").get() as { m: number | null }).m ?? 0) + 1;
    const id = randomUUID();
    db.prepare("INSERT INTO assessments (id, round, questionnaire_version, status, core_process) VALUES (?, ?, ?, 'open', ?)").run(id, round, input.questionnaireVersion, input.coreProcess ?? null);
    const ins = db.prepare("INSERT INTO survey_links (id, assessment_id, tier, token, expires_at) VALUES (?, ?, ?, ?, ?)");
    for (const tier of TIERS) ins.run(randomUUID(), id, tier, randomBytes(16).toString("hex"), input.expiresAt);
    return { assessment: getAssessment(db, id)!, links: listLinks(db, id) };
  })();
}

export function listLinks(db: Database.Database, assessmentId: string): SurveyLink[] {
  return (db.prepare("SELECT * FROM survey_links WHERE assessment_id = ? ORDER BY tier").all(assessmentId) as Row[]).map(link);
}

export function getLinkByToken(db: Database.Database, token: string): SurveyLink | null {
  const r = db.prepare("SELECT * FROM survey_links WHERE token = ?").get(token) as Row | undefined;
  return r ? link(r) : null;
}

export function addResponse(db: Database.Database, surveyLinkId: string, answers: Record<string, number>, freeText?: string): string {
  const id = randomUUID();
  db.prepare("INSERT INTO responses (id, survey_link_id, answers, free_text) VALUES (?, ?, ?, ?)").run(id, surveyLinkId, JSON.stringify(answers), freeText ?? null);
  return id;
}

export function countResponses(db: Database.Database, assessmentId: string): Record<Tier, number> {
  const counts: Record<Tier, number> = { executive: 0, manager: 0, staff: 0 };
  const rows = db.prepare("SELECT l.tier AS tier, COUNT(r.id) AS n FROM survey_links l LEFT JOIN responses r ON r.survey_link_id = l.id WHERE l.assessment_id = ? GROUP BY l.tier").all(assessmentId) as { tier: Tier; n: number }[];
  for (const r of rows) counts[r.tier] = r.n;
  return counts;
}

/** Scoring input only: free text is deliberately NOT returned here (see the Interfaces contract and
 * `closeRound`). It stays in the `responses` row; a later reader that genuinely needs it adds its own
 * accessor, so the most PII-sensitive field is never carried around by default.
 * Tiebreak on `rowid`, not `id`: `submitted_at` has millisecond precision, so two responses from
 * one tier routinely share a timestamp, and `id` is a random UUID — ordering by it returns
 * insertion order only by chance (measured: wrong in 157 of 300 runs). `rowid` is monotonic on
 * insert. */
export function listResponses(db: Database.Database, assessmentId: string): { tier: Tier; answers: Record<string, number> }[] {
  const rows = db.prepare("SELECT l.tier AS tier, r.answers AS answers FROM responses r JOIN survey_links l ON l.id = r.survey_link_id WHERE l.assessment_id = ? ORDER BY r.submitted_at, r.rowid").all(assessmentId) as { tier: Tier; answers: string }[];
  return rows.map((r) => ({ tier: r.tier, answers: JSON.parse(r.answers) }));
}

export function closeAssessment(db: Database.Database, id: string, payload: unknown, engineVersion: string): void {
  db.transaction(() => {
    db.prepare("UPDATE assessments SET status = 'closed', closed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(id);
    db.prepare("INSERT INTO results (id, assessment_id, payload, engine_version) VALUES (?, ?, ?, ?)").run(randomUUID(), id, JSON.stringify(payload), engineVersion);
  })();
}

export function getResult(db: Database.Database, assessmentId: string): { assessmentId: string; payload: unknown; engineVersion: string; computedAt: string } | null {
  const r = db.prepare("SELECT * FROM results WHERE assessment_id = ?").get(assessmentId) as Row | undefined;
  return r ? { assessmentId, payload: JSON.parse(r.payload as string), engineVersion: r.engine_version as string, computedAt: r.computed_at as string } : null;
}

export function latestResult(db: Database.Database): { assessmentId: string; round: number; payload: unknown; computedAt: string } | null {
  const r = db.prepare("SELECT r.assessment_id, a.round, r.payload, r.computed_at FROM results r JOIN assessments a ON a.id = r.assessment_id ORDER BY a.round DESC LIMIT 1").get() as Row | undefined;
  return r ? { assessmentId: r.assessment_id as string, round: r.round as number, payload: JSON.parse(r.payload as string), computedAt: r.computed_at as string } : null;
}

export function savePrescription(db: Database.Database, p: PrescriptionRow): void {
  db.prepare("INSERT INTO prescriptions (id, assessment_id, kind, provider, model, payload, fallback, tokens_in, tokens_out, latency_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), p.assessmentId, p.kind, p.provider, p.model, JSON.stringify(p.payload), p.fallback ? 1 : 0, p.tokensIn, p.tokensOut, p.latencyMs);
}

export function getPrescription(db: Database.Database, assessmentId: string, kind: PrescriptionKind): (PrescriptionRow & { createdAt: string }) | null {
  const r = db.prepare("SELECT * FROM prescriptions WHERE assessment_id = ? AND kind = ? ORDER BY created_at DESC LIMIT 1").get(assessmentId, kind) as Row | undefined;
  return r ? { assessmentId, kind, provider: r.provider as string, model: (r.model as string) ?? null, payload: JSON.parse(r.payload as string), fallback: !!r.fallback, tokensIn: r.tokens_in as number, tokensOut: r.tokens_out as number, latencyMs: r.latency_ms as number, createdAt: r.created_at as string } : null;
}

export function saveArtifact(db: Database.Database, a: ArtifactRow): void {
  db.prepare("INSERT INTO artifacts (id, assessment_id, kind, path, size_bytes) VALUES (?, ?, ?, ?, ?)").run(randomUUID(), a.assessmentId, a.kind, a.path, a.sizeBytes);
}

export function getArtifact(db: Database.Database, assessmentId: string, kind: string): (ArtifactRow & { createdAt: string }) | null {
  const r = db.prepare("SELECT * FROM artifacts WHERE assessment_id = ? AND kind = ? ORDER BY created_at DESC, rowid DESC LIMIT 1").get(assessmentId, kind) as Row | undefined;
  return r ? { assessmentId, kind, path: r.path as string, sizeBytes: r.size_bytes as number, createdAt: r.created_at as string } : null;
}

export function logLlmCall(db: Database.Database, c: LlmCallRow): void {
  db.prepare("INSERT INTO llm_calls (id, provider, model, purpose, ok, fallback, tokens_in, tokens_out, latency_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), c.provider, c.model, c.purpose, c.ok ? 1 : 0, c.fallback ? 1 : 0, c.tokensIn, c.tokensOut, c.latencyMs);
}

export function llmStats(db: Database.Database): { provider: string; calls: number; okFirstTry: number; fallbacks: number; tokensIn: number; tokensOut: number; avgLatencyMs: number }[] {
  return db.prepare("SELECT provider, COUNT(*) AS calls, SUM(ok) AS okFirstTry, SUM(fallback) AS fallbacks, SUM(tokens_in) AS tokensIn, SUM(tokens_out) AS tokensOut, ROUND(AVG(latency_ms)) AS avgLatencyMs FROM llm_calls GROUP BY provider ORDER BY provider").all() as ReturnType<typeof llmStats>;
}
