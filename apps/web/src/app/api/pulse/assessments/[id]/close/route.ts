// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from "next/server";
import { closeRound } from "@/lib/assess";
import { getDb } from "@/lib/db";
import { vi } from "@/lib/i18n.vi";
import { notify } from "@/lib/notify";
import * as repo from "@/lib/repo";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const out = closeRound(db, id);
  if (!out.ok) {
    if (out.reason === "not_found") return NextResponse.json({ error: "not found" }, { status: 404 });
    if (out.reason === "insufficient") return NextResponse.json({ error: vi.round.notEnough, counts: out.counts }, { status: 409 });
    return NextResponse.json({ error: vi.pulse.status.closed }, { status: 409 });
  }
  const a = repo.getAssessment(db, id)!;
  await notify(`${vi.pulse.round} ${a.round} ${vi.round.closed} HPDI H=${out.result.hpdi.H} P=${out.result.hpdi.P} D=${out.result.hpdi.D} I=${out.result.hpdi.I}, ${vi.round.shape[out.result.shape]}, ${vi.round.level} ${out.result.dtiLevel}.`);
  return NextResponse.json(out.result);
}
