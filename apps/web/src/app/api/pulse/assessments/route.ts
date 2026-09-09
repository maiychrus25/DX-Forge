// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from "next/server";
import { z } from "zod";
import { openRound, surveyUrl } from "@/lib/assess";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { vi } from "@/lib/i18n.vi";
import { notify } from "@/lib/notify";
import * as repo from "@/lib/repo";

export async function GET() {
  const db = getDb();
  const rows = repo.listAssessments(db).map((a) => ({ ...a, counts: repo.countResponses(db, a.id), result: repo.getResult(db, a.id)?.payload ?? null }));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = z.object({ coreProcess: z.string().max(80).optional(), days: z.number().int().min(1).max(90).optional() }).safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const { assessment, links } = openRound(getDb(), body.data);
  const base = getEnv().baseUrl;
  const out = links.map((l) => ({ tier: l.tier, url: surveyUrl(base, l.token), expiresAt: l.expiresAt }));
  await notify(`${vi.pulse.round} ${assessment.round} ${vi.pulse.status.open}. ${out.map((l) => `${vi.round.tier[l.tier]}: ${l.url}`).join(" | ")}`);
  return NextResponse.json({ assessment, links: out }, { status: 201 });
}
