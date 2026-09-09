// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from "next/server";
import { resultToMaturity } from "@dx-forge/forge-core";
import type { ResultV1 } from "@dx-forge/hpdi-engine";
import { getDb } from "@/lib/db";
import * as repo from "@/lib/repo";

export async function GET() {
  const latest = repo.latestResult(getDb());
  if (!latest) return NextResponse.json({ error: "no closed assessment" }, { status: 404 });
  const result = latest.payload as ResultV1;
  return NextResponse.json({ assessmentId: latest.assessmentId, round: latest.round, computedAt: latest.computedAt, result, maturity: resultToMaturity(result, latest.assessmentId) });
}
