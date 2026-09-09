// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from "next/server";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { buildTree, buildZip, flatten } from "@/lib/kit/para";
import { buildFiveRo, buildPokaYoke, getOrBuildPrescriptions } from "@/lib/prescribe";
import * as repo from "@/lib/repo";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const db = getDb();
  const a = repo.getAssessment(db, id);
  const org = repo.getOrganization(db);
  if (!a || !org) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = z.object({ projects: z.array(z.string().max(80)).max(50).default([]) }).safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const tree = buildTree({ shortCode: org.shortCode, departments: org.departments, projects: body.data.projects, coreProcess: a.coreProcess });
  const p = repo.getResult(db, id) ? getOrBuildPrescriptions(db, id) : null;
  const zip = await buildZip(tree, { fiveRo: p?.fiveRo ?? buildFiveRo(a.coreProcess), pokaYoke: p?.pokaYoke ?? buildPokaYoke(a.coreProcess) });
  const dir = join(getEnv().dataDir, "artifacts", id);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "para-kit.zip");
  writeFileSync(path, zip);
  repo.saveArtifact(db, { assessmentId: id, kind: "para-kit", path, sizeBytes: zip.length });
  return NextResponse.json({ path, sizeBytes: zip.length, tree: flatten(tree) }, { status: 201 });
}

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const art = repo.getArtifact(getDb(), id, "para-kit");
  if (!art) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new Response(readFileSync(art.path), { headers: { "content-type": "application/zip", "content-disposition": 'attachment; filename="para-kit.zip"' } });
}
