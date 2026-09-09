// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { vi } from "@/lib/i18n.vi";

export function CloseRoundButton({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function close() {
    if (!confirm(vi.round.closeConfirm)) return;
    setBusy(true); setError(null);
    const r = await fetch(`/api/pulse/assessments/${id}/close`, { method: "POST" });
    setBusy(false);
    if (r.ok) router.refresh();
    else setError((await r.json().catch(() => ({}))).error ?? vi.common.error);
  }
  return (
    <div className="flex flex-col gap-2">
      <button className="btn btn-primary" disabled={busy} onClick={close}>{vi.round.close}</button>
      {error && <p className="text-danger text-sm" role="alert">{error}</p>}
    </div>
  );
}
