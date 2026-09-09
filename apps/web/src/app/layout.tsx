// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { vi } from "@/lib/i18n.vi";

export const metadata: Metadata = { title: vi.app.name, description: vi.app.tagline };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-border">
          <nav className="mx-auto max-w-5xl flex items-center gap-4 px-4 h-14">
            <Link href="/pulse" className="flex items-center gap-2 font-semibold">
              <img src="/logo.svg" alt="" width="24" height="24" />
              {vi.app.name}
            </Link>
            <Link href="/pulse" className="text-sm text-muted">{vi.app.nav.pulse}</Link>
            <Link href="/about" className="text-sm text-muted">{vi.app.nav.about}</Link>
            <form action="/api/auth/logout" method="post" className="ml-auto">
              <button className="text-sm text-muted" type="submit">{vi.app.nav.logout}</button>
            </form>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-border text-xs text-muted">
          <div className="mx-auto max-w-5xl px-4 py-4">{vi.about.method} {vi.about.license}</div>
        </footer>
      </body>
    </html>
  );
}
