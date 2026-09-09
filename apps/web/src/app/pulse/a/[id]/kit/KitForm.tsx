// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import { useState } from "react";
import { KitTree } from "@/components/KitTree";
import { vi } from "@/lib/i18n.vi";

export function KitForm({ id, initialPreview, hasArtifact }: { id: string; initialPreview: string[]; hasArtifact: boolean }) {
  const [projects, setProjects] = useState("");
  const [preview, setPreview] = useState(initialPreview);
  const [ready, setReady] = useState(hasArtifact);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function build() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      await post();
    } finally {
      setBusy(false);
    }
  }

  async function post() {
    const r = await fetch(`/api/pulse/assessments/${id}/kit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projects: projects.split("\n").map((s) => s.trim()).filter(Boolean) }) });
    if (!r.ok) return setMsg(vi.common.error);
    const data = await r.json();
    setPreview(data.tree); setReady(true); setMsg(vi.kit.built);
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card p-4 flex flex-col gap-3">
        <label className="text-sm">{vi.kit.projects}<textarea className="input mt-1 min-h-32" value={projects} onChange={(e) => setProjects(e.target.value)} /></label>
        <button className="btn btn-primary" onClick={build} disabled={busy}>{busy ? vi.common.loading : vi.kit.build}</button>
        {ready && <a className="btn btn-secondary" href={`/api/pulse/assessments/${id}/kit`}>{vi.kit.download}</a>}
        {msg && <p className="text-sm text-verify" role="status">{msg}</p>}
      </div>
      <div className="card p-4"><h2 className="font-medium mb-2">{vi.kit.preview}</h2><KitTree paths={preview} /></div>
    </div>
  );
}
