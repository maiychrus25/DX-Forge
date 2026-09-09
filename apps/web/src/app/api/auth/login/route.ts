// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from "next/server";
import { checkPassword, SESSION_COOKIE, signSession } from "@/lib/auth";
import { getEnv } from "@/lib/env";

export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/pulse");
  const env = getEnv();
  if (!checkPassword(env.adminPassword, password)) {
    return NextResponse.redirect(new URL(`/login?error=1&next=${encodeURIComponent(next)}`, req.url), { status: 303 });
  }
  const res = NextResponse.redirect(new URL(next.startsWith("/") ? next : "/pulse", req.url), { status: 303 });
  res.cookies.set(SESSION_COOKIE, signSession(env.sessionSecret), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 12 * 3600 });
  return res;
}
