// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import { useEffect, useMemo, useState } from "react";
import { vi } from "@/lib/i18n.vi";
import type { PublicQuestion } from "@/lib/survey";

type Phase = "loading" | "intro" | "questions" | "free" | "done" | "expired" | "error";

export function SurveyForm({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [tier, setTier] = useState("");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [freeText, setFreeText] = useState("");
  const [restored, setRestored] = useState(false);
  const draftKey = `dxforge.survey.${token}`;

  useEffect(() => {
    fetch(`/api/pulse/survey/${token}`).then(async (r) => {
      if (r.status === 410) return setPhase("expired");
      if (!r.ok) return setPhase("error");
      const data = await r.json();
      setQuestions(data.questions); setTier(data.tier);
      try {
        const draft = localStorage.getItem(draftKey);
        if (draft) { const d = JSON.parse(draft); setAnswers(d.answers ?? {}); setIndex(d.index ?? 0); setFreeText(d.freeText ?? ""); setRestored(true); }
      } catch { /* storage unavailable: start fresh */ }
      setPhase("intro");
    }).catch(() => setPhase("error"));
  }, [token, draftKey]);

  useEffect(() => {
    if (phase !== "questions" && phase !== "free") return;
    try { localStorage.setItem(draftKey, JSON.stringify({ answers, index, freeText })); } catch { /* ignore */ }
  }, [answers, index, freeText, phase, draftKey]);

  const q = questions[index];
  const total = questions.length;
  const progress = useMemo(() => (total ? Math.round(((index) / total) * 100) : 0), [index, total]);

  async function submit() {
    const r = await fetch(`/api/pulse/survey/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers, freeText }) });
    if (r.status === 201) { try { localStorage.removeItem(draftKey); } catch { /* ignore */ } setPhase("done"); }
    else if (r.status === 410) setPhase("expired");
    else setPhase("error");
  }

  if (phase === "loading") return <p className="text-muted">{vi.common.loading}</p>;
  if (phase === "expired") return <p className="card p-6">{vi.survey.expired}</p>;
  if (phase === "error") return <p className="card p-6 text-danger">{vi.common.error}</p>;
  if (phase === "done") return <p className="card p-6">{vi.survey.thanks}</p>;

  if (phase === "intro") return (
    <div className="card p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-semibold mb-2">{vi.survey.title}</h1>
      <p className="text-sm text-muted mb-1">{vi.round.tier[tier as keyof typeof vi.round.tier]}</p>
      <p className="mb-4">{vi.survey.intro}</p>
      {restored && <p className="text-sm text-verify mb-2">{vi.survey.draft}</p>}
      <button className="btn btn-primary w-full" onClick={() => setPhase("questions")}>{vi.survey.start}</button>
    </div>
  );

  if (phase === "free") return (
    <div className="card p-6 max-w-lg mx-auto flex flex-col gap-3">
      <label className="text-sm" htmlFor="free">{vi.survey.freeText}</label>
      <textarea id="free" className="input min-h-32" maxLength={2000} value={freeText} onChange={(e) => setFreeText(e.target.value)} />
      <div className="flex gap-2">
        <button className="btn btn-secondary" onClick={() => setPhase("questions")}>{vi.common.previous}</button>
        <button className="btn btn-primary flex-1" onClick={submit}>{vi.survey.submit}</button>
      </div>
    </div>
  );

  const choices = q.options ?? vi.survey.scale.map((label, value) => ({ value, label }));
  const chosen = answers[q.id];
  return (
    <div className="card p-6 max-w-lg mx-auto">
      <div className="h-1.5 bg-border rounded-full mb-4"><div className="h-1.5 bg-forge rounded-full transition-all" style={{ width: `${progress}%` }} /></div>
      <p className="text-xs text-muted mb-1">{vi.survey.progress.replace("{n}", String(index + 1)).replace("{total}", String(total))}</p>
      <h2 className="text-lg font-medium mb-4">{q.text}</h2>
      <fieldset className="flex flex-col gap-2" aria-label={q.text}>
        {choices.map((c) => (
          <label key={c.value} className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer min-h-12 ${chosen === c.value ? "border-forge" : "border-border"}`}>
            <input type="radio" name={q.id} value={c.value} checked={chosen === c.value} onChange={() => setAnswers({ ...answers, [q.id]: c.value })} />
            <span>{c.label}</span>
          </label>
        ))}
      </fieldset>
      <div className="flex gap-2 mt-4">
        <button className="btn btn-secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>{vi.common.previous}</button>
        <button className="btn btn-primary flex-1" disabled={chosen === undefined} onClick={() => (index + 1 < total ? setIndex(index + 1) : setPhase("free"))}>{vi.common.next}</button>
      </div>
    </div>
  );
}
