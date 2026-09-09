// SPDX-License-Identifier: AGPL-3.0-or-later
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { vi } from "@/lib/i18n.vi";
import { getOrBuildPrescriptions } from "@/lib/prescribe";
import * as repo from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function PrescriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  if (!repo.getResult(db, id)) notFound();
  const p = getOrBuildPrescriptions(db, id);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3"><Link href={`/pulse/a/${id}`} className="text-sm text-muted">← {vi.common.back}</Link><h1 className="text-2xl font-semibold">{vi.prescription.title}</h1></div>
      <p className="text-xs text-muted">{p.fallback ? vi.prescription.source : `${p.provider}`}</p>
      <section className="card p-4">
        <h2 className="font-medium">{vi.prescription.roadmap}</h2>
        <p className="text-sm text-muted mb-3">{p.roadmap.diagnosis}</p>
        {p.roadmap.warnings.map((w) => <p key={w} className="text-sm text-axis-d mb-2">⚠ {w}</p>)}
        <ol className="flex flex-col gap-3">
          {p.roadmap.phases.map((ph, i) => (
            <li key={ph.axis} className="border-l-4 pl-3" style={{ borderColor: `var(--color-axis-${ph.axis.toLowerCase()})` }}>
              <p className="font-medium">{i + 1}. {ph.name} <span className="chip border border-border">{vi.axes[ph.axis]}</span></p>
              <ul className="list-disc ml-5 text-sm">{ph.actions.map((a) => <li key={a}>{a}</li>)}</ul>
              <p className="text-xs text-muted mt-1">KPI: {ph.kpis.join(" · ")}</p>
            </li>
          ))}
        </ol>
      </section>
      {p.discrepancy.questions.length > 0 && (
        <section className="card p-4"><h2 className="font-medium mb-2">{vi.prescription.discrepancy}</h2>
          <ul className="flex flex-col gap-2 text-sm">{p.discrepancy.questions.map((q) => <li key={q.pillar}><b>{vi.pillars[q.pillar as keyof typeof vi.pillars]}</b> → {vi.round.tier[q.forTier]}: {q.question} <span className="text-muted">({q.why})</span></li>)}</ul>
        </section>
      )}
      <section className="card p-4 overflow-x-auto"><h2 className="font-medium mb-2">{vi.prescription.fiveRo}: {p.fiveRo.process}</h2>
        <table className="w-full text-sm"><thead className="text-left text-muted"><tr><th>Bước</th><th>R</th><th>A</th><th>C</th><th>I</th><th>Tiêu chuẩn</th><th>Công cụ</th></tr></thead>
          <tbody>{p.fiveRo.steps.map((s) => <tr key={s.step} className="border-t border-border"><td className="py-2">{s.step}</td><td>{s.role_R}</td><td>{s.role_A}</td><td>{s.role_C || "–"}</td><td>{s.role_I}</td><td>{s.standard}</td><td>{s.tool}</td></tr>)}</tbody></table>
      </section>
      <section className="card p-4"><h2 className="font-medium mb-2">{vi.prescription.pokaYoke}</h2>
        <ul className="text-sm flex flex-col gap-1">{p.pokaYoke.pokaYoke.map((x) => <li key={x.point}><span className="chip border border-border mr-2">Lớp {x.layer}</span><b>{x.point}</b>: {x.rule}</li>)}</ul>
      </section>
    </div>
  );
}
