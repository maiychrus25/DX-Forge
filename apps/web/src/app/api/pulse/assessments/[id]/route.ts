// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from "next/server";
import { surveyUrl } from "@/lib/assess";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import * as repo from "@/lib/repo";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const assessment = repo.getAssessment(db, id);
  if (!assessment) return NextResponse.json({ error: "not found" }, { status: 404 });
  const base = getEnv().baseUrl;
  return NextResponse.json({
    assessment,
    links: repo.listLinks(db, id).map((l) => ({ tier: l.tier, url: surveyUrl(base, l.token), expiresAt: l.expiresAt })),
    counts: repo.countResponses(db, id),
    result: repo.getResult(db, id)?.payload ?? null,
  });
}
