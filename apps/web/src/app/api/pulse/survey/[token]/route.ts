// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as repo from "@/lib/repo";
import { linkState, questionsForTier, validateAnswers } from "@/lib/survey";
import { vi } from "@/lib/i18n.vi";

type Ctx = { params: Promise<{ token: string }> };

function load(token: string) {
  const db = getDb();
  const link = repo.getLinkByToken(db, token);
  if (!link) return null;
  const assessment = repo.getAssessment(db, link.assessmentId)!;
  return { db, link, assessment, state: linkState(link, assessment) };
}

export async function GET(_req: Request, { params }: Ctx) {
  const { token } = await params;
  const s = load(token);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (s.state !== "open") return NextResponse.json({ error: vi.survey.expired, state: s.state }, { status: 410 });
  return NextResponse.json({ tier: s.link.tier, questions: questionsForTier(s.link.tier), expiresAt: s.link.expiresAt, round: s.assessment.round });
}

export async function POST(req: Request, { params }: Ctx) {
  const { token } = await params;
  const s = load(token);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (s.state !== "open") return NextResponse.json({ error: vi.survey.expired, state: s.state }, { status: 410 });
  const body = (await req.json().catch(() => null)) as { answers?: unknown; freeText?: unknown } | null;
  const v = validateAnswers(s.link.tier, body?.answers);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const freeText = typeof body?.freeText === "string" ? body.freeText.slice(0, 2000) : undefined;
  repo.addResponse(s.db, s.link.id, v.answers, freeText);
  return NextResponse.json({ ok: true }, { status: 201 });
}
