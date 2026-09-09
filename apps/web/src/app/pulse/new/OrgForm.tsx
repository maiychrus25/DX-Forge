// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { vi } from "@/lib/i18n.vi";
import type { Organization } from "@/lib/repo";

export function OrgForm({ initial }: { initial: Organization | null }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: initial?.name ?? "", shortCode: initial?.shortCode ?? "", sector: initial?.sector ?? "", sizeBand: initial?.sizeBand ?? "10-50", departments: (initial?.departments ?? []).map((d) => `${d.code}, ${d.name}`).join("\n"), coreProcess: "" });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const departments = form.departments.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [code, ...rest] = l.split(","); return { code: code.trim(), name: rest.join(",").trim() }; });
    const put = await fetch("/api/pulse/organization", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: form.name, shortCode: form.shortCode, sector: form.sector, sizeBand: form.sizeBand, departments }) });
    if (!put.ok) return setError((await put.json()).error ?? vi.common.error);
    const post = await fetch("/api/pulse/assessments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ coreProcess: form.coreProcess || undefined }) });
    if (!post.ok) return setError(vi.common.error);
    const { assessment } = await post.json();
    router.push(`/pulse/a/${assessment.id}`);
  }

  return (
    <form onSubmit={submit} className="card p-6 max-w-xl mx-auto flex flex-col gap-3">
      <h1 className="text-xl font-semibold">{vi.org.title}</h1>
      <label className="text-sm">{vi.org.name}<input className="input mt-1" required value={form.name} onChange={set("name")} /></label>
      <label className="text-sm">{vi.org.shortCode}<input className="input mt-1" required pattern="[a-z0-9]{2,12}" value={form.shortCode} onChange={set("shortCode")} /></label>
      <label className="text-sm">{vi.org.sector}<input className="input mt-1" required value={form.sector} onChange={set("sector")} /></label>
      <label className="text-sm">{vi.org.sizeBand}<select className="input mt-1" value={form.sizeBand} onChange={set("sizeBand")}>{["1-9", "10-50", "51-200", "201-500", "500+"].map((s) => <option key={s}>{s}</option>)}</select></label>
      <label className="text-sm">{vi.org.departments}<textarea className="input mt-1 min-h-24 font-mono text-xs" required value={form.departments} onChange={set("departments")} placeholder={"cskh, Chăm sóc khách hàng\nkd, Kinh doanh"} /></label>
      <label className="text-sm">{vi.pulse.coreProcess}<input className="input mt-1" value={form.coreProcess} onChange={set("coreProcess")} placeholder="Xử lý yêu cầu khách hàng" /></label>
      {error && <p className="text-danger text-sm" role="alert">{error}</p>}
      <button className="btn btn-primary" type="submit">{vi.pulse.open}</button>
    </form>
  );
}
