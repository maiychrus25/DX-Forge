// SPDX-License-Identifier: AGPL-3.0-or-later
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { vi } from "@/lib/i18n.vi";
import { buildTree, flatten } from "@/lib/kit/para";
import * as repo from "@/lib/repo";
import { KitForm } from "./KitForm";

export const dynamic = "force-dynamic";

export default async function KitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const a = repo.getAssessment(db, id);
  const org = repo.getOrganization(db);
  if (!a || !org) notFound();
  const preview = flatten(buildTree({ shortCode: org.shortCode, departments: org.departments, projects: [], coreProcess: a.coreProcess }));
  const existing = repo.getArtifact(db, id, "para-kit");
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3"><Link href={`/pulse/a/${id}`} className="text-sm text-muted">← {vi.common.back}</Link><h1 className="text-2xl font-semibold">{vi.kit.title}</h1></div>
      <KitForm id={id} initialPreview={preview} hasArtifact={!!existing} />
    </div>
  );
}
