// SPDX-License-Identifier: AGPL-3.0-or-later
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ResultV1 } from "@dx-forge/hpdi-engine";
import { CloseRoundButton } from "@/components/CloseRoundButton";
import { CopyField } from "@/components/CopyField";
import { PillarTable } from "@/components/PillarTable";
import { Radar } from "@/components/Radar";
import { ShapeBadge } from "@/components/ShapeBadge";
import { surveyUrl } from "@/lib/assess";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { vi } from "@/lib/i18n.vi";
import { radarSeries } from "@/lib/radar";
import * as repo from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function RoundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const a = repo.getAssessment(db, id);
  if (!a) notFound();
  const links = repo.listLinks(db, id);
  const counts = repo.countResponses(db, id);
  const result = repo.getResult(db, id)?.payload as ResultV1 | undefined;
  const base = getEnv().baseUrl;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{vi.round.title} {a.round}</h1>
        <span className={`chip ${a.status === "open" ? "bg-verify/15 text-verify" : "bg-border"}`}>{vi.pulse.status[a.status]}</span>
        {a.coreProcess && <span className="text-sm text-muted">{vi.pulse.coreProcess}: {a.coreProcess}</span>}
      </div>
      {a.status === "open" && (
        <section className="card p-4 flex flex-col gap-3">
          <h2 className="font-medium">{vi.round.links}</h2>
          {links.map((l) => <CopyField key={l.tier} label={`${vi.round.tier[l.tier]} (${counts[l.tier]})`} value={surveyUrl(base, l.token)} />)}
          <p className="text-xs text-muted">{vi.round.expires}: {new Date(links[0].expiresAt).toLocaleDateString("vi-VN")}</p>
          <CloseRoundButton id={id} />
        </section>
      )}
      {result && (
        <>
          <section className="card p-4 flex flex-col gap-4">
            <ShapeBadge result={result} />
            <Radar series={radarSeries(result)} />
            <p className="text-sm text-muted">{vi.round.responses}: {vi.round.tier.executive} {result.responseCounts.executive} · {vi.round.tier.manager} {result.responseCounts.manager} · {vi.round.tier.staff} {result.responseCounts.staff}</p>
          </section>
          <section className="card p-4"><h2 className="font-medium mb-2">{vi.round.pillars}</h2><PillarTable result={result} /></section>
          <div className="flex flex-wrap gap-3">
            <Link href={`/pulse/a/${id}/prescription`} className="btn btn-primary">{vi.round.prescription}</Link>
            <Link href={`/pulse/a/${id}/kit`} className="btn btn-secondary">{vi.round.kit}</Link>
          </div>
        </>
      )}
    </div>
  );
}
