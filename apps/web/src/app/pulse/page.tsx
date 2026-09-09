// SPDX-License-Identifier: AGPL-3.0-or-later
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ResultV1 } from "@dx-forge/hpdi-engine";
import { Radar } from "@/components/Radar";
import { getDb } from "@/lib/db";
import { vi } from "@/lib/i18n.vi";
import { radarSeries } from "@/lib/radar";
import * as repo from "@/lib/repo";

export const dynamic = "force-dynamic";

export default function PulsePage() {
  const db = getDb();
  const org = repo.getOrganization(db);
  if (!org) redirect("/pulse/new");
  const rounds = repo.listAssessments(db).map((a) => ({ ...a, counts: repo.countResponses(db, a.id), result: repo.getResult(db, a.id)?.payload as ResultV1 | undefined }));
  const closed = rounds.filter((r) => r.result);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">{vi.pulse.title}</h1><p className="text-muted text-sm">{org.name} · {org.shortCode}</p></div>
        <Link href="/pulse/new" className="btn btn-primary">{vi.pulse.open}</Link>
      </div>
      {closed.length > 0 && (
        <section className="card p-4"><h2 className="font-medium mb-2">{vi.pulse.history}</h2>
          <Radar series={radarSeries(closed[0].result!)} compare={closed.slice(1, 4).map((r) => ({ name: `${vi.pulse.round} ${r.round}`, series: radarSeries(r.result!) }))} />
        </section>
      )}
      <section className="card divide-y divide-border">
        {rounds.length === 0 && <p className="p-6 text-muted">{vi.pulse.empty}</p>}
        {rounds.map((r) => (
          <Link key={r.id} href={`/pulse/a/${r.id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-paper">
            <span className="font-medium">{vi.pulse.round} {r.round}</span>
            <span className={`chip ${r.status === "open" ? "bg-verify/15 text-verify" : "bg-border"}`}>{vi.pulse.status[r.status]}</span>
            <span className="text-sm text-muted">{vi.round.responses}: {r.counts.executive}/{r.counts.manager}/{r.counts.staff}</span>
            {r.result && <span className="ml-auto text-sm font-mono">H{r.result.hpdi.H} P{r.result.hpdi.P} D{r.result.hpdi.D} I{r.result.hpdi.I}</span>}
          </Link>
        ))}
      </section>
    </div>
  );
}
