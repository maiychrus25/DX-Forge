// SPDX-License-Identifier: AGPL-3.0-or-later
import { ENGINE_VERSION } from "@dx-forge/hpdi-engine";
import { vi } from "@/lib/i18n.vi";

export default function AboutPage() {
  return (
    <div className="card p-6 max-w-2xl mx-auto flex flex-col gap-3">
      <h1 className="text-2xl font-semibold">{vi.about.title}</h1>
      <p>{vi.app.tagline}.</p>
      <p>{vi.about.method}</p>
      <p>{vi.about.license}</p>
      <p className="text-sm text-muted">hpdi-engine {ENGINE_VERSION} · web {process.env.npm_package_version ?? "0.1.0"}</p>
      <a className="underline" href="https://github.com/maiychrus25/DX-Forge">{vi.about.source}</a>
    </div>
  );
}
