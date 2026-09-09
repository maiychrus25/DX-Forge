// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import { useState } from "react";
import { vi } from "@/lib/i18n.vi";

export function CopyField({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <span className="w-28 text-sm text-muted">{label}</span>
      <input className="input font-mono text-xs" readOnly value={value} onFocus={(e) => e.currentTarget.select()} />
      <button type="button" className="btn btn-secondary" onClick={async () => { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); }}>{done ? vi.common.copied : vi.common.copy}</button>
    </div>
  );
}
