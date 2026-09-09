// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import * as repo from "@/lib/repo";

const Body = z.object({
  name: z.string().min(1), shortCode: z.string().regex(/^[a-z0-9]{2,12}$/), sector: z.string().min(1), sizeBand: z.string().min(1),
  departments: z.array(z.object({ code: z.string().regex(/^[a-z0-9][a-z0-9-]{1,19}$/), name: z.string().min(1) })).min(1),
});

export async function GET() {
  const org = repo.getOrganization(getDb());
  return org ? NextResponse.json(org) : NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function PUT(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, { status: 400 });
  repo.saveOrganization(getDb(), { id: "org", ...parsed.data });
  return NextResponse.json({ ok: true });
}
