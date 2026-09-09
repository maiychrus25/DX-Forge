// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getOrBuildPrescriptions } from "@/lib/prescribe";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(getOrBuildPrescriptions(getDb(), id));
  } catch {
    return NextResponse.json({ error: "assessment not closed" }, { status: 409 });
  }
}
