// SPDX-License-Identifier: AGPL-3.0-or-later
import { vi } from "@/lib/i18n.vi";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  return (
    <div className="mx-auto max-w-sm card p-6 mt-12">
      <h1 className="text-xl font-semibold mb-4">{vi.login.title}</h1>
      <form action="/api/auth/login" method="post" className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next ?? "/pulse"} />
        <label className="text-sm" htmlFor="password">{vi.login.password}</label>
        <input id="password" name="password" type="password" className="input" autoFocus required />
        {error && <p className="text-danger text-sm">{vi.login.wrong}</p>}
        <button className="btn btn-primary" type="submit">{vi.login.submit}</button>
      </form>
    </div>
  );
}
