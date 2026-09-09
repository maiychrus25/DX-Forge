# DX-Forge Plan 02 — Measurement wizard (M0): survey, radar, prescriptions, P.A.R.A kit

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Next.js wizard at `apps/web` where an administrator creates the organisation, opens an assessment round, hands out three anonymous survey links, closes the round to get a `ResultV1` with radar and prescriptions, and downloads a P.A.R.A discipline kit. `GET /api/pulse/latest` exposes the result for the interview stage.

**Architecture:** Next.js 16 App Router (server components + route handlers), Tailwind 4, Recharts for the radar, `better-sqlite3` on `.dxforge/wizard.db` with a plain SQL schema, `@dx-forge/hpdi-engine` for scoring. Admin auth is a password from `FORGE_ADMIN_PASSWORD` and an HMAC-signed cookie; survey pages need only the link token. No AI in this plan (rule-based prescriptions only; plan 03 adds the LLM layer behind the same `prescriptions` table).

**Tech Stack:** next ^16, react ^19, tailwindcss ^4 (+ @tailwindcss/postcss), recharts ^3, better-sqlite3 ^12, jszip ^3, zod ^3, @playwright/test ^1.55 (E2E), vitest (unit).

**Spec:** `docs/superpowers/specs/2026-09-09-m0-measurement-design.md` (§2 scope, §3 architecture, §4 data model, §6.2 fallbacks, §7 kit, §8 pages, §9 open-source compliance, §10 tests, §13 interfaces). SRS: FR-W-01..06, FR-M0-*. BA: SC-M0-* screens in `docs/ba/07-screens.md`.

**Plan series:** 01 engine + CLI (done) → **02 this** → 03 AI layer + interview + handbook → 04 provider oss layer H → 05 provider oss P/D/I → 06 wizard plan/apply/verify → 07 provider gws → 08 manifest + packaging.

## Global Constraints

- Everything in plan 01's Global Constraints still applies (AGPL, SPDX first line on every `.ts`/`.tsx`, English code and comments, Vietnamese UI strings, commit identity, **no commit trailers**, no credentials on disk).
- **Ruling (spec deviation):** persistence is `better-sqlite3` with `apps/web/src/lib/schema.sql`, not Prisma. Tables, columns and unique constraints are exactly the spec §4 set: `organizations`, `assessments`, `survey_links`, `responses`, `results`, `prescriptions`, `artifacts`, `llm_calls`; `UNIQUE(assessment_id, tier)` on survey links, `UNIQUE(round)` on assessments. Task 2 patches the one spec line.
- Database file `.dxforge/wizard.db` (env `FORGE_DATA_DIR`, default `.dxforge` under the working directory); artifacts under `.dxforge/artifacts/<assessmentId>/`. Both are git-ignored already.
- Survey responses are anonymous: no IP, no user agent, no cookie is stored. A link token is 32 hex chars from `crypto.randomBytes(16)`; links expire (`expires_at`, default 14 days); a closed or expired link rejects new responses with **410 Gone** (Task 4's route handlers and its client both branch on 410). 409 is a different endpoint: closing a round that cannot be closed (`already_closed`, or `insufficient` responses).
- Closing a round calls `compute(questionnaire, responses)` from `@dx-forge/hpdi-engine`; `InsufficientResponses` becomes HTTP 409 with the Vietnamese message `Chưa đủ phản hồi: cần ít nhất một lãnh đạo và một nhân viên.` and the round stays open.
- Admin auth: `FORGE_ADMIN_PASSWORD` (required) and `FORGE_SESSION_SECRET` (required, ≥ 16 chars). Cookie `forge_session` = `<issuedAt>.<hmacSha256(issuedAt, secret)>`, `HttpOnly; SameSite=Lax; Path=/`, valid 12 hours. Middleware protects `/pulse/**` and `/api/pulse/**` except `/pulse/s/**` and `/api/pulse/survey/**`.
- Radar and every chart use the fixed axis colours H `#64748B`, P `#16A34A`, D `#F59E0B`, I `#7C3AED`; ink `#0F172A`, paper `#F8FAFC`, forge accent `#EA580C` (see `docs/brand/README.md`). `DESIGN.md` is written in Task 1 before any UI.
- Mobile-first: survey page one question per screen, progress bar, draft in `localStorage`, no horizontal overflow at 375 px; light and dark consistent (`prefers-color-scheme`).
- All Vietnamese UI strings live in `apps/web/src/lib/i18n.vi.ts` (one object), never inline in JSX, so plan 06 can add a second language.
- Tests: vitest for `src/lib/**` using an in-memory database (`openDb(":memory:")`); Playwright smoke in `apps/web/e2e/` against `next dev` on port 3100 with a temp data dir; CI runs both.
- `apps/web` is added to root `typecheck` (`tsc -b … apps/web`) and root scripts `web:dev`, `web:build`, `web:start`, `e2e`.

---

## File structure

```
DESIGN.md                                  visual identity (tokens + rationale), read before UI work
apps/web/
├── package.json  tsconfig.json  next.config.ts  postcss.config.mjs  playwright.config.ts  .env.example
├── src/app/globals.css                    Tailwind import + tokens from DESIGN.md
├── src/app/layout.tsx                     shell: header with mark, nav, footer with attribution
├── src/app/page.tsx                       redirect → /pulse
├── src/app/login/page.tsx                 admin password form
├── src/app/about/page.tsx                 attribution, licence, versions
├── src/app/pulse/page.tsx                 organisation dashboard: rounds list, radar history, "Mở đợt đo"
├── src/app/pulse/new/page.tsx             organisation form (first run) + open round
├── src/app/pulse/a/[id]/page.tsx          round dashboard: links, counts, radar, pillar table, close
├── src/app/pulse/a/[id]/prescription/page.tsx   roadmap, discrepancy questions, 5 RÕ, Poka-yoke
├── src/app/pulse/a/[id]/kit/page.tsx      departments/projects form, tree preview, download
├── src/app/pulse/s/[token]/page.tsx       survey (client component host)
├── src/app/api/auth/login/route.ts        POST password → cookie;  api/auth/logout/route.ts
├── src/app/api/pulse/organization/route.ts        GET, PUT
├── src/app/api/pulse/assessments/route.ts         GET list, POST open round
├── src/app/api/pulse/assessments/[id]/route.ts    GET detail (links, counts, result)
├── src/app/api/pulse/assessments/[id]/close/route.ts   POST
├── src/app/api/pulse/assessments/[id]/prescription/route.ts  GET (rule-based, cached in prescriptions)
├── src/app/api/pulse/assessments/[id]/kit/route.ts     POST build zip, GET download
├── src/app/api/pulse/survey/[token]/route.ts      GET questions for the tier, POST answers
├── src/app/api/pulse/latest/route.ts              GET latest closed ResultV1 + maturity block
├── src/middleware.ts                      session gate
├── src/lib/i18n.vi.ts                     all UI strings
├── src/lib/env.ts                         env parsing (zod)
├── src/lib/db.ts  src/lib/schema.sql      openDb(path) → migrated Database
├── src/lib/repo.ts                        typed queries (organisation, assessments, links, responses, results, prescriptions, artifacts, llm_calls)
├── src/lib/auth.ts                        sign/verify session, constant-time password check
├── src/lib/assess.ts                      openRound(), closeRound() (compute + persist + notify), toMaturity()
├── src/lib/prescribe.ts                   rule-based roadmap / discrepancy questions / 5 RÕ / Poka-yoke
├── src/lib/kit/para.ts                    P.A.R.A tree model + zip builder
├── src/lib/notify.ts                      console + optional Telegram sendMessage
├── src/components/{Radar,PillarTable,ShapeBadge,SurveyForm,KitTree,CopyField}.tsx
├── test/{db,repo,auth,assess,prescribe,para}.test.ts
└── e2e/pulse.spec.ts
```

---

### Task 1: DESIGN.md, `apps/web` scaffold, root scripts

**Files:**
- Create: `DESIGN.md`, `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/postcss.config.mjs`, `apps/web/.env.example`, `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/lib/i18n.vi.ts`, `apps/web/src/lib/env.ts`, `apps/web/src/app/api/health/route.ts`
- Modify: `package.json` (root scripts, typecheck), `vitest.config.ts` (exclude `apps/web/e2e`), `.gitignore` (`.next/`, `playwright-report/`, `test-results/`)
- Test: `apps/web/test/env.test.ts`

**Interfaces:**
- Produces: `vi` string object (`import { vi } from "@/lib/i18n.vi"`), `getEnv(): Env` (`adminPassword`, `sessionSecret`, `dataDir`, `telegramBotToken?`, `telegramChatId?`, `baseUrl`), path alias `@/*` → `src/*`.

- [ ] **Step 1: DESIGN.md (visual identity, before any UI)**

`DESIGN.md`:
```markdown
---
name: DX-Forge wizard
version: 1
tokens:
  color:
    ink: "#0F172A"
    paper: "#F8FAFC"
    surface: "#FFFFFF"
    surface-dark: "#111827"
    paper-dark: "#0B1220"
    muted: "#64748B"
    border: "#E2E8F0"
    border-dark: "#1F2937"
    forge: "#EA580C"
    verify: "#16A34A"
    danger: "#DC2626"
    axis-h: "#64748B"
    axis-p: "#16A34A"
    axis-d: "#F59E0B"
    axis-i: "#7C3AED"
  font:
    sans: "Inter, 'Segoe UI', Helvetica, Arial, sans-serif"
    mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
    size: { xs: 12px, sm: 14px, base: 16px, lg: 18px, xl: 22px, 2xl: 28px }
  space: { 1: 4px, 2: 8px, 3: 12px, 4: 16px, 6: 24px, 8: 32px, 12: 48px }
  radius: { sm: 6px, md: 10px, lg: 16px, pill: 999px }
  elevation:
    card: "0 1px 2px rgba(15,23,42,.06), 0 1px 3px rgba(15,23,42,.1)"
    raised: "0 10px 30px rgba(15,23,42,.12)"
  motion: { fast: 120ms, base: 200ms, ease: "cubic-bezier(.2,.8,.2,1)" }
  breakpoints: { sm: 640px, md: 768px, lg: 1024px }
---

# Rationale

**Ink on paper.** The wizard is a measuring instrument, not a marketing site. Text is near-black on
off-white; colour is reserved for meaning: the four HPDI axes, the forge accent for the primary
action, green for verified, red for errors. Dark mode swaps paper/ink and keeps the axis colours.

**One primary action per screen.** Every page has exactly one `forge`-coloured button (open round,
close round, download kit, submit answer). Secondary actions are outlined.

**Survey is a phone screen.** One question, a 0–4 scale as five tappable cards (min 48 px tall),
a progress bar, previous/next. Drafts survive a refresh. Under eight minutes for twenty questions.

**Radar is the hero.** Four fixed axes (H grey, P green, D orange, I purple) in that order,
clockwise from top. Tier layers are toggleable, the merged polygon is filled. The shape badge and
level sit beside it, never over it.

**Tables breathe.** 12 px vertical padding, zebra rows off, right-aligned numbers, a coloured dot
before the pillar name. Discrepancy above 0.3 is marked with a warning chip, not a red row.

**States are designed.** Every list has an empty state with the next action; every fetch has a
skeleton; every error is a sentence in Vietnamese with what to do next.

**Accessibility.** Focus ring 2 px forge on all interactive elements; contrast ≥ 4.5:1 for text;
scale cards are radio buttons under the hood; the radar has a table twin for screen readers.
```

- [ ] **Step 2: Package, config, env**

`apps/web/package.json`:
```json
{
  "name": "@dx-forge/web",
  "version": "0.1.0",
  "license": "AGPL-3.0-or-later",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@dx-forge/forge-core": "0.1.0",
    "@dx-forge/hpdi-engine": "0.1.0",
    "better-sqlite3": "^12.2.0",
    "jszip": "^3.10.1",
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "recharts": "^3.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.55.0",
    "@tailwindcss/postcss": "^4.1.0",
    "@types/better-sqlite3": "^7.6.13",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.1.0"
  }
}
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "composite": false,
    "declaration": false,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", ".next/types/**/*.ts"],
  "references": [{ "path": "../../packages/forge-core" }, { "path": "../../packages/hpdi-engine" }]
}
```
(`noEmit`/`composite:false` because Next owns the build; the root `typecheck` runs `tsc -p apps/web --noEmit`, see Step 5. No `rootDir`/`outDir`: they are meaningless under `noEmit`, and a `rootDir` of `src` makes `tsc` reject the generated `.next/types/validator.ts` that the `include` list requires — TS6059 on every `next build` from Next 16.3.)

`apps/web/next.config.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3"],
  transpilePackages: ["@dx-forge/hpdi-engine", "@dx-forge/forge-core"],
  output: "standalone",
};

export default config;
```

`apps/web/postcss.config.mjs`:
```js
// SPDX-License-Identifier: AGPL-3.0-or-later
export default { plugins: { "@tailwindcss/postcss": {} } };
```

`apps/web/.env.example`:
```
# SPDX-License-Identifier: AGPL-3.0-or-later
# Admin password for the wizard (required)
FORGE_ADMIN_PASSWORD=change-me
# Secret for signing the session cookie, at least 16 characters (required)
FORGE_SESSION_SECRET=change-me-to-a-long-random-string
# Where wizard.db and artifacts live (default: .dxforge)
FORGE_DATA_DIR=.dxforge
# Public base URL used in survey links (default: http://localhost:3000)
FORGE_BASE_URL=http://localhost:3000
# Optional Telegram notifier for survey links and round closing
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

`apps/web/src/lib/env.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";

const EnvSchema = z.object({
  FORGE_ADMIN_PASSWORD: z.string().min(1),
  FORGE_SESSION_SECRET: z.string().min(16),
  FORGE_DATA_DIR: z.string().default(".dxforge"),
  FORGE_BASE_URL: z.string().url().default("http://localhost:3000"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
});

export type Env = {
  adminPassword: string;
  sessionSecret: string;
  dataDir: string;
  baseUrl: string;
  telegramBotToken?: string;
  telegramChatId?: string;
};

export function parseEnv(source: Record<string, string | undefined>): Env {
  const e = EnvSchema.parse(source);
  return {
    adminPassword: e.FORGE_ADMIN_PASSWORD,
    sessionSecret: e.FORGE_SESSION_SECRET,
    dataDir: e.FORGE_DATA_DIR,
    baseUrl: e.FORGE_BASE_URL,
    telegramBotToken: e.TELEGRAM_BOT_TOKEN || undefined,
    telegramChatId: e.TELEGRAM_CHAT_ID || undefined,
  };
}

let cached: Env | undefined;
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
```

`apps/web/src/lib/i18n.vi.ts` (every UI string; later tasks add keys here, never inline):
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
/** All user-facing strings of the wizard. Keys are English, values are Vietnamese. */
export const vi = {
  app: { name: "DX-Forge", tagline: "Bộ biên dịch Hệ điều hành Doanh nghiệp số", nav: { pulse: "Đo lường", about: "Về DX-Forge", logout: "Đăng xuất" } },
  login: { title: "Đăng nhập quản trị", password: "Mật khẩu quản trị", submit: "Đăng nhập", wrong: "Mật khẩu không đúng." },
  common: { save: "Lưu", cancel: "Huỷ", back: "Quay lại", next: "Tiếp", previous: "Trước", copy: "Sao chép", copied: "Đã sao chép", loading: "Đang tải…", error: "Có lỗi xảy ra. Thử lại.", download: "Tải về" },
  org: { title: "Hồ sơ tổ chức", name: "Tên tổ chức", shortCode: "Mã ngắn (2–12 ký tự thường)", sector: "Ngành", sizeBand: "Quy mô", departments: "Phòng ban (mỗi dòng: mã, tên)", saved: "Đã lưu hồ sơ tổ chức." },
  pulse: {
    title: "Đo lường DTI/HPDI", empty: "Chưa có đợt đo nào. Mở đợt đo đầu tiên để nhận ba link khảo sát.", open: "Mở đợt đo", round: "Đợt", status: { open: "Đang mở", closed: "Đã chốt" },
    history: "Radar theo vòng", coreProcess: "Quy trình lõi muốn chuẩn hoá (tuỳ chọn)",
  },
  round: {
    title: "Đợt đo", links: "Link khảo sát (ẩn danh, mỗi tầng một link)", tier: { executive: "Lãnh đạo", manager: "Quản lý", staff: "Nhân viên" },
    responses: "Phản hồi", close: "Chốt đợt đo", closeConfirm: "Chốt đợt đo sẽ khoá link khảo sát và tính kết quả. Tiếp tục?",
    notEnough: "Chưa đủ phản hồi: cần ít nhất một lãnh đạo và một nhân viên.", closed: "Đã chốt đợt đo.",
    radar: "Radar HPDI", pillars: "Sáu trụ cột", pillar: "Trụ cột", merged: "Hợp nhất", discrepancy: "Độ vênh", warn: "Vênh lớn",
    shape: { spear: "Mũi giáo", kite: "Cánh diều lệch", illusion: "Ảo giác công nghệ", diamond: "Kim cương", transitional: "Chuyển tiếp" },
    level: "Mức DTI", prescription: "Kê đơn", kit: "Bộ kỷ luật P.A.R.A", expires: "Hết hạn",
  },
  pillars: { strategy: "Chiến lược", culture: "Văn hoá", customer: "Khách hàng", operations: "Vận hành", technology: "Công nghệ", data: "Dữ liệu" },
  axes: { H: "Hạ tầng", P: "Quy trình", D: "Dữ liệu", I: "Trí tuệ" },
  survey: {
    title: "Khảo sát chuyển đổi số", intro: "Ẩn danh, khoảng 6–8 phút. Chọn mức đúng nhất với thực tế, không phải mong muốn.", start: "Bắt đầu", progress: "Câu {n}/{total}",
    scale: ["Không có", "Rất ít", "Một phần", "Phần lớn", "Hoàn toàn"], freeText: "Điều gì cản trở anh/chị nhất khi làm việc số? (tuỳ chọn)", submit: "Gửi khảo sát",
    thanks: "Cảm ơn anh/chị. Phản hồi đã được ghi nhận ẩn danh.", expired: "Link khảo sát đã hết hạn hoặc đợt đo đã chốt.", draft: "Đã khôi phục bản nháp.",
  },
  prescription: {
    title: "Kê đơn", roadmap: "Lộ trình P → D → I", focus: "Trục ưu tiên", discrepancy: "Câu hỏi đối chất khi vênh tầng", fiveRo: "Ma trận 5 RÕ", pokaYoke: "Poka-yoke", source: "Nguồn: luật của sách (chưa bật AI)",
  },
  kit: { title: "Bộ kỷ luật P.A.R.A", projects: "Dự án đang chạy (mỗi dòng một tên)", preview: "Xem trước cây thư mục", build: "Tạo bộ kỷ luật", download: "Tải para-kit.zip", built: "Đã tạo bộ kỷ luật." },
  about: { title: "Về DX-Forge", method: "Phương pháp luận lấy từ sách \"Xây dựng Hệ điều hành Doanh nghiệp số\" của Tạ Tuấn Anh, giấy phép CC BY 4.0.", license: "Mã nguồn theo giấy phép AGPL-3.0-or-later.", source: "Mã nguồn" },
} as const;
export type Vi = typeof vi;
```

- [ ] **Step 3: Global CSS, layout, home, health**

`apps/web/src/app/globals.css`:
```css
/* SPDX-License-Identifier: AGPL-3.0-or-later */
@import "tailwindcss";

@theme {
  --color-ink: #0f172a;
  --color-paper: #f8fafc;
  --color-surface: #ffffff;
  --color-muted: #64748b;
  --color-border: #e2e8f0;
  --color-forge: #ea580c;
  --color-verify: #16a34a;
  --color-danger: #dc2626;
  --color-axis-h: #64748b;
  --color-axis-p: #16a34a;
  --color-axis-d: #f59e0b;
  --color-axis-i: #7c3aed;
  --font-sans: Inter, "Segoe UI", Helvetica, Arial, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --radius-md: 10px;
  --radius-lg: 16px;
}

:root { color-scheme: light dark; }
html { background: var(--color-paper); color: var(--color-ink); }
@media (prefers-color-scheme: dark) {
  html { background: #0b1220; color: #f8fafc; }
  .card { background: #111827; border-color: #1f2937; }
}
body { font-family: var(--font-sans); -webkit-font-smoothing: antialiased; overflow-x: hidden; }
.card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: 0 1px 2px rgba(15,23,42,.06), 0 1px 3px rgba(15,23,42,.1); }
.btn { display: inline-flex; align-items: center; gap: .5rem; min-height: 44px; padding: 0 1.1rem; border-radius: var(--radius-md); font-weight: 600; transition: transform 120ms cubic-bezier(.2,.8,.2,1), opacity 120ms; }
.btn:active { transform: translateY(1px); }
.btn:focus-visible, a:focus-visible, input:focus-visible { outline: 2px solid var(--color-forge); outline-offset: 2px; }
.btn-primary { background: var(--color-forge); color: #fff; }
.btn-secondary { border: 1px solid var(--color-border); }
.input { width: 100%; min-height: 44px; padding: .5rem .75rem; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: transparent; }
.chip { display: inline-block; padding: .15rem .55rem; border-radius: 999px; font-size: 12px; font-weight: 600; }
```

`apps/web/src/app/layout.tsx`:
```tsx
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
```
Copy `docs/brand/logo.svg` to `apps/web/public/logo.svg` and `docs/brand/favicon-32.png` to `apps/web/public/favicon.ico` (rename is fine; Next serves it).

`apps/web/src/app/page.tsx`:
```tsx
// SPDX-License-Identifier: AGPL-3.0-or-later
import { redirect } from "next/navigation";
export default function Home() { redirect("/pulse"); }
```

`apps/web/src/app/api/health/route.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
export function GET() {
  return Response.json({ ok: true, app: "dx-forge-web" });
}
```

- [ ] **Step 4: Failing test for env parsing, then run**

`apps/web/test/env.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/lib/env.js";

describe("parseEnv", () => {
  it("applies defaults and drops empty optional values", () => {
    const e = parseEnv({ FORGE_ADMIN_PASSWORD: "x", FORGE_SESSION_SECRET: "0123456789abcdef", TELEGRAM_BOT_TOKEN: "" });
    expect(e.dataDir).toBe(".dxforge");
    expect(e.baseUrl).toBe("http://localhost:3000");
    expect(e.telegramBotToken).toBeUndefined();
  });
  it("rejects a short session secret", () => {
    expect(() => parseEnv({ FORGE_ADMIN_PASSWORD: "x", FORGE_SESSION_SECRET: "short" })).toThrow();
  });
});
```

- [ ] **Step 5: Root wiring and install**

Root `package.json` scripts:
```json
"typecheck": "tsc -b packages/hpdi-engine packages/forge-core apps/cli && tsc -p apps/web --noEmit",
"web:dev": "npm run dev -w @dx-forge/web",
"web:build": "npm run build -w @dx-forge/web",
"web:start": "npm run start -w @dx-forge/web",
"e2e": "npm run e2e -w @dx-forge/web"
```
`vitest.config.ts` `test.exclude`: add `"apps/web/e2e/**"` and `"**/node_modules/**"`.
`.gitignore`: add `.next/`, `playwright-report/`, `test-results/`, `apps/web/next-env.d.ts`.

Run:
```bash
npm install
npx vitest run apps/web/test/env.test.ts        # 2 passed
npm run typecheck                                # clean (next-env.d.ts is generated by the first `next build`/`dev`; run `npx next typegen` inside apps/web if tsc complains)
cd apps/web && FORGE_ADMIN_PASSWORD=x FORGE_SESSION_SECRET=0123456789abcdef npx next build   # builds
```
Expected: build succeeds, `/api/health` route listed.

- [ ] **Step 6: Commit**

```bash
git add DESIGN.md apps/web package.json package-lock.json vitest.config.ts .gitignore
git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(web): scaffold Next.js wizard with design tokens, i18n strings and env parsing"
```

---

### Task 2: SQLite schema, `openDb`, repository

**Files:**
- Create: `apps/web/src/lib/schema.sql`, `apps/web/src/lib/db.ts`, `apps/web/src/lib/repo.ts`
- Modify: `docs/superpowers/specs/2026-09-09-m0-measurement-design.md` (the two lines naming Prisma in §3 and §4 heading → "SQLite (better-sqlite3), schema.sql")
- Test: `apps/web/test/repo.test.ts`

**Interfaces:**
- Produces: `openDb(path: string): Database` (runs `schema.sql`, `PRAGMA journal_mode=WAL; foreign_keys=ON`), `getDb(): Database` (singleton on `<dataDir>/wizard.db`, creates the directory), and `Repo` functions:
  `getOrganization(db)`, `saveOrganization(db, org)`, `listAssessments(db)`, `getAssessment(db, id)`, `createAssessment(db, { questionnaireVersion, coreProcess?, expiresAt })` → `{ assessment, links }`, `getLinkByToken(db, token)`, `addResponse(db, linkId, answers, freeText?)`, `countResponses(db, assessmentId): Record<Tier, number>`, `listResponses(db, assessmentId): { tier, answers }[]`, `closeAssessment(db, id, result, engineVersion)`, `getResult(db, assessmentId)`, `latestResult(db)`, `savePrescription(db, row)`, `getPrescription(db, assessmentId, kind)`, `saveArtifact(db, row)`, `getArtifact(db, assessmentId, kind)`, `logLlmCall(db, row)`, `llmStats(db)`.
- Types: `Organization = { id: "org"; name; shortCode; sector; sizeBand; departments: { code; name }[] }`, `Assessment = { id; round; questionnaireVersion; status: "open"|"closed"; coreProcess: string|null; createdAt; closedAt: string|null }`, `SurveyLink = { id; assessmentId; tier; token; expiresAt }`.

- [ ] **Step 1: Failing tests**

`apps/web/test/repo.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, beforeEach } from "vitest";
import { openDb } from "../src/lib/db.js";
import * as repo from "../src/lib/repo.js";
import type Database from "better-sqlite3";

let db: Database.Database;
const ORG = { id: "org" as const, name: "Công ty ABC", shortCode: "abc", sector: "retail", sizeBand: "10-50", departments: [{ code: "cskh", name: "Chăm sóc khách hàng" }] };

beforeEach(() => { db = openDb(":memory:"); });

describe("organisation", () => {
  it("is absent until saved, then round-trips departments as JSON", () => {
    expect(repo.getOrganization(db)).toBeNull();
    repo.saveOrganization(db, ORG);
    expect(repo.getOrganization(db)).toEqual(ORG);
    repo.saveOrganization(db, { ...ORG, name: "ABC 2" });
    expect(repo.getOrganization(db)?.name).toBe("ABC 2");
  });
});

describe("assessments and links", () => {
  it("creates rounds with increasing numbers and exactly three links", () => {
    const a = repo.createAssessment(db, { questionnaireVersion: "1.0", expiresAt: "2030-01-01T00:00:00.000Z" });
    const b = repo.createAssessment(db, { questionnaireVersion: "1.0", coreProcess: "cskh", expiresAt: "2030-01-01T00:00:00.000Z" });
    expect(a.assessment.round).toBe(1);
    expect(b.assessment.round).toBe(2);
    expect(a.links.map((l) => l.tier).sort()).toEqual(["executive", "manager", "staff"]);
    expect(new Set(a.links.map((l) => l.token)).size).toBe(3);
    expect(a.links[0].token).toMatch(/^[0-9a-f]{32}$/);
    expect(repo.listAssessments(db).map((x) => x.round)).toEqual([2, 1]);
  });
  it("finds a link by token and rejects a second link for the same tier", () => {
    const { links } = repo.createAssessment(db, { questionnaireVersion: "1.0", expiresAt: "2030-01-01T00:00:00.000Z" });
    expect(repo.getLinkByToken(db, links[0].token)?.tier).toBe(links[0].tier);
    expect(repo.getLinkByToken(db, "nope")).toBeNull();
    expect(() => db.prepare("INSERT INTO survey_links (id, assessment_id, tier, token, expires_at) VALUES ('x', ?, ?, 'ffffffffffffffffffffffffffffffff', '2030-01-01')").run(links[0].assessmentId, links[0].tier)).toThrow(/UNIQUE/);
  });
});

describe("responses, results", () => {
  it("stores anonymous answers and counts per tier", () => {
    const { assessment, links } = repo.createAssessment(db, { questionnaireVersion: "1.0", expiresAt: "2030-01-01T00:00:00.000Z" });
    const staff = links.find((l) => l.tier === "staff")!;
    repo.addResponse(db, staff.id, { "OPS-02": 3 }, "Quá nhiều Zalo");
    repo.addResponse(db, staff.id, { "OPS-02": 1 });
    expect(repo.countResponses(db, assessment.id)).toEqual({ executive: 0, manager: 0, staff: 2 });
    expect(repo.listResponses(db, assessment.id)).toEqual([{ tier: "staff", answers: { "OPS-02": 3 } }, { tier: "staff", answers: { "OPS-02": 1 } }]);
    expect(db.prepare("PRAGMA table_info(responses)").all().map((c: any) => c.name)).not.toContain("ip");
  });
  it("closes a round with its result and exposes the latest closed one", () => {
    const { assessment } = repo.createAssessment(db, { questionnaireVersion: "1.0", expiresAt: "2030-01-01T00:00:00.000Z" });
    expect(repo.latestResult(db)).toBeNull();
    repo.closeAssessment(db, assessment.id, { hpdi: { H: 90, P: 10, D: 0, I: 0 } }, "1.0");
    expect(repo.getAssessment(db, assessment.id)?.status).toBe("closed");
    expect(repo.getResult(db, assessment.id)?.payload).toEqual({ hpdi: { H: 90, P: 10, D: 0, I: 0 } });
    expect(repo.latestResult(db)?.assessmentId).toBe(assessment.id);
  });
});

describe("prescriptions, artifacts, llm calls", () => {
  it("saves and reads back by kind, and aggregates llm stats", () => {
    const { assessment } = repo.createAssessment(db, { questionnaireVersion: "1.0", expiresAt: "2030-01-01T00:00:00.000Z" });
    repo.savePrescription(db, { assessmentId: assessment.id, kind: "roadmap", provider: "none", model: null, payload: { focusAxis: "P" }, fallback: true, tokensIn: 0, tokensOut: 0, latencyMs: 1 });
    expect(repo.getPrescription(db, assessment.id, "roadmap")?.payload).toEqual({ focusAxis: "P" });
    repo.saveArtifact(db, { assessmentId: assessment.id, kind: "para-kit", path: "/tmp/x.zip", sizeBytes: 10 });
    expect(repo.getArtifact(db, assessment.id, "para-kit")?.sizeBytes).toBe(10);
    repo.logLlmCall(db, { provider: "none", model: "-", purpose: "roadmap", ok: true, fallback: true, tokensIn: 0, tokensOut: 0, latencyMs: 2 });
    repo.logLlmCall(db, { provider: "gemini", model: "g", purpose: "roadmap", ok: true, fallback: false, tokensIn: 10, tokensOut: 5, latencyMs: 300 });
    expect(repo.llmStats(db)).toEqual([
      { provider: "gemini", calls: 1, okFirstTry: 1, fallbacks: 0, tokensIn: 10, tokensOut: 5, avgLatencyMs: 300 },
      { provider: "none", calls: 1, okFirstTry: 1, fallbacks: 1, tokensIn: 0, tokensOut: 0, avgLatencyMs: 2 },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/web/test/repo.test.ts` — FAIL, modules not found.

- [ ] **Step 3: Schema**

`apps/web/src/lib/schema.sql`:
```sql
-- SPDX-License-Identifier: AGPL-3.0-or-later
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_code TEXT NOT NULL,
  sector TEXT NOT NULL,
  size_band TEXT NOT NULL,
  departments TEXT NOT NULL,            -- JSON [{code,name}]
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY,
  round INTEGER NOT NULL UNIQUE,
  questionnaire_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open','closed')),
  core_process TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  closed_at TEXT
);
CREATE TABLE IF NOT EXISTS survey_links (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('executive','manager','staff')),
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  UNIQUE (assessment_id, tier)
);
CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY,
  survey_link_id TEXT NOT NULL REFERENCES survey_links(id) ON DELETE CASCADE,
  answers TEXT NOT NULL,                -- JSON {questionId: number}
  free_text TEXT,
  submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS results (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL UNIQUE REFERENCES assessments(id) ON DELETE CASCADE,
  payload TEXT NOT NULL,                -- JSON ResultV1
  engine_version TEXT NOT NULL,
  computed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS prescriptions (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('roadmap','discrepancy','fiveRo','pokaYoke','askReport')),
  provider TEXT NOT NULL,
  model TEXT,
  payload TEXT NOT NULL,
  fallback INTEGER NOT NULL DEFAULT 0,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  path TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS llm_calls (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  purpose TEXT NOT NULL,
  ok INTEGER NOT NULL,
  fallback INTEGER NOT NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_responses_link ON responses(survey_link_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_assessment ON prescriptions(assessment_id, kind, created_at);
```

- [ ] **Step 4: db.ts and repo.ts**

`apps/web/src/lib/db.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getEnv } from "./env.js";

const SCHEMA = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "schema.sql"), "utf8");

/** Opens (and migrates) a database. Use ":memory:" in tests. */
export function openDb(path: string): Database.Database {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

let singleton: Database.Database | undefined;
export function getDb(): Database.Database {
  singleton ??= openDb(join(getEnv().dataDir, "wizard.db"));
  return singleton;
}
```
(`ponytail:` `schema.sql` is read relative to the module; Next's standalone output copies it because `serverExternalPackages` keeps `better-sqlite3` and this file outside the bundle — verify in Task 9's Docker build.)

`apps/web/src/lib/repo.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomBytes, randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export type Tier = "executive" | "manager" | "staff";
export const TIERS: Tier[] = ["executive", "manager", "staff"];
export type Organization = { id: "org"; name: string; shortCode: string; sector: string; sizeBand: string; departments: { code: string; name: string }[] };
export type Assessment = { id: string; round: number; questionnaireVersion: string; status: "open" | "closed"; coreProcess: string | null; createdAt: string; closedAt: string | null };
export type SurveyLink = { id: string; assessmentId: string; tier: Tier; token: string; expiresAt: string };
export type PrescriptionKind = "roadmap" | "discrepancy" | "fiveRo" | "pokaYoke" | "askReport";
export type PrescriptionRow = { assessmentId: string; kind: PrescriptionKind; provider: string; model: string | null; payload: unknown; fallback: boolean; tokensIn: number; tokensOut: number; latencyMs: number };
export type ArtifactRow = { assessmentId: string; kind: string; path: string; sizeBytes: number };
export type LlmCallRow = { provider: string; model: string; purpose: string; ok: boolean; fallback: boolean; tokensIn: number; tokensOut: number; latencyMs: number };

type Row = Record<string, unknown>;
const assessment = (r: Row): Assessment => ({ id: r.id as string, round: r.round as number, questionnaireVersion: r.questionnaire_version as string, status: r.status as Assessment["status"], coreProcess: (r.core_process as string) ?? null, createdAt: r.created_at as string, closedAt: (r.closed_at as string) ?? null });
const link = (r: Row): SurveyLink => ({ id: r.id as string, assessmentId: r.assessment_id as string, tier: r.tier as Tier, token: r.token as string, expiresAt: r.expires_at as string });

export function getOrganization(db: Database.Database): Organization | null {
  const r = db.prepare("SELECT * FROM organizations WHERE id = 'org'").get() as Row | undefined;
  return r ? { id: "org", name: r.name as string, shortCode: r.short_code as string, sector: r.sector as string, sizeBand: r.size_band as string, departments: JSON.parse(r.departments as string) } : null;
}

export function saveOrganization(db: Database.Database, org: Organization): void {
  db.prepare(`INSERT INTO organizations (id, name, short_code, sector, size_band, departments) VALUES ('org', @name, @shortCode, @sector, @sizeBand, @departments)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, short_code = excluded.short_code, sector = excluded.sector, size_band = excluded.size_band, departments = excluded.departments`)
    .run({ ...org, departments: JSON.stringify(org.departments) });
}

export function listAssessments(db: Database.Database): Assessment[] {
  return (db.prepare("SELECT * FROM assessments ORDER BY round DESC").all() as Row[]).map(assessment);
}

export function getAssessment(db: Database.Database, id: string): Assessment | null {
  const r = db.prepare("SELECT * FROM assessments WHERE id = ?").get(id) as Row | undefined;
  return r ? assessment(r) : null;
}

export function createAssessment(db: Database.Database, input: { questionnaireVersion: string; coreProcess?: string; expiresAt: string }): { assessment: Assessment; links: SurveyLink[] } {
  return db.transaction(() => {
    const round = ((db.prepare("SELECT MAX(round) AS m FROM assessments").get() as { m: number | null }).m ?? 0) + 1;
    const id = randomUUID();
    db.prepare("INSERT INTO assessments (id, round, questionnaire_version, status, core_process) VALUES (?, ?, ?, 'open', ?)").run(id, round, input.questionnaireVersion, input.coreProcess ?? null);
    const ins = db.prepare("INSERT INTO survey_links (id, assessment_id, tier, token, expires_at) VALUES (?, ?, ?, ?, ?)");
    for (const tier of TIERS) ins.run(randomUUID(), id, tier, randomBytes(16).toString("hex"), input.expiresAt);
    return { assessment: getAssessment(db, id)!, links: listLinks(db, id) };
  })();
}

export function listLinks(db: Database.Database, assessmentId: string): SurveyLink[] {
  return (db.prepare("SELECT * FROM survey_links WHERE assessment_id = ? ORDER BY tier").all(assessmentId) as Row[]).map(link);
}

export function getLinkByToken(db: Database.Database, token: string): SurveyLink | null {
  const r = db.prepare("SELECT * FROM survey_links WHERE token = ?").get(token) as Row | undefined;
  return r ? link(r) : null;
}

export function addResponse(db: Database.Database, surveyLinkId: string, answers: Record<string, number>, freeText?: string): string {
  const id = randomUUID();
  db.prepare("INSERT INTO responses (id, survey_link_id, answers, free_text) VALUES (?, ?, ?, ?)").run(id, surveyLinkId, JSON.stringify(answers), freeText ?? null);
  return id;
}

export function countResponses(db: Database.Database, assessmentId: string): Record<Tier, number> {
  const counts: Record<Tier, number> = { executive: 0, manager: 0, staff: 0 };
  const rows = db.prepare("SELECT l.tier AS tier, COUNT(r.id) AS n FROM survey_links l LEFT JOIN responses r ON r.survey_link_id = l.id WHERE l.assessment_id = ? GROUP BY l.tier").all(assessmentId) as { tier: Tier; n: number }[];
  for (const r of rows) counts[r.tier] = r.n;
  return counts;
}

/** Scoring input only: free text is deliberately NOT returned here (see the Interfaces contract and
 * `closeRound`). It stays in the `responses` row; a later reader that genuinely needs it adds its own
 * accessor, so the most PII-sensitive field is never carried around by default.
 * Tiebreak on `rowid`, not `id`: `submitted_at` has millisecond precision, so two responses from
 * one tier routinely share a timestamp, and `id` is a random UUID — ordering by it returns
 * insertion order only by chance (measured: wrong in 157 of 300 runs). `rowid` is monotonic on
 * insert. */
export function listResponses(db: Database.Database, assessmentId: string): { tier: Tier; answers: Record<string, number> }[] {
  const rows = db.prepare("SELECT l.tier AS tier, r.answers AS answers FROM responses r JOIN survey_links l ON l.id = r.survey_link_id WHERE l.assessment_id = ? ORDER BY r.submitted_at, r.rowid").all(assessmentId) as { tier: Tier; answers: string }[];
  return rows.map((r) => ({ tier: r.tier, answers: JSON.parse(r.answers) }));
}

export function closeAssessment(db: Database.Database, id: string, payload: unknown, engineVersion: string): void {
  db.transaction(() => {
    db.prepare("UPDATE assessments SET status = 'closed', closed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(id);
    db.prepare("INSERT INTO results (id, assessment_id, payload, engine_version) VALUES (?, ?, ?, ?)").run(randomUUID(), id, JSON.stringify(payload), engineVersion);
  })();
}

export function getResult(db: Database.Database, assessmentId: string): { assessmentId: string; payload: unknown; engineVersion: string; computedAt: string } | null {
  const r = db.prepare("SELECT * FROM results WHERE assessment_id = ?").get(assessmentId) as Row | undefined;
  return r ? { assessmentId, payload: JSON.parse(r.payload as string), engineVersion: r.engine_version as string, computedAt: r.computed_at as string } : null;
}

export function latestResult(db: Database.Database): { assessmentId: string; round: number; payload: unknown; computedAt: string } | null {
  const r = db.prepare("SELECT r.assessment_id, a.round, r.payload, r.computed_at FROM results r JOIN assessments a ON a.id = r.assessment_id ORDER BY a.round DESC LIMIT 1").get() as Row | undefined;
  return r ? { assessmentId: r.assessment_id as string, round: r.round as number, payload: JSON.parse(r.payload as string), computedAt: r.computed_at as string } : null;
}

export function savePrescription(db: Database.Database, p: PrescriptionRow): void {
  db.prepare("INSERT INTO prescriptions (id, assessment_id, kind, provider, model, payload, fallback, tokens_in, tokens_out, latency_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), p.assessmentId, p.kind, p.provider, p.model, JSON.stringify(p.payload), p.fallback ? 1 : 0, p.tokensIn, p.tokensOut, p.latencyMs);
}

export function getPrescription(db: Database.Database, assessmentId: string, kind: PrescriptionKind): (PrescriptionRow & { createdAt: string }) | null {
  const r = db.prepare("SELECT * FROM prescriptions WHERE assessment_id = ? AND kind = ? ORDER BY created_at DESC LIMIT 1").get(assessmentId, kind) as Row | undefined;
  return r ? { assessmentId, kind, provider: r.provider as string, model: (r.model as string) ?? null, payload: JSON.parse(r.payload as string), fallback: !!r.fallback, tokensIn: r.tokens_in as number, tokensOut: r.tokens_out as number, latencyMs: r.latency_ms as number, createdAt: r.created_at as string } : null;
}

export function saveArtifact(db: Database.Database, a: ArtifactRow): void {
  db.prepare("INSERT INTO artifacts (id, assessment_id, kind, path, size_bytes) VALUES (?, ?, ?, ?, ?)").run(randomUUID(), a.assessmentId, a.kind, a.path, a.sizeBytes);
}

export function getArtifact(db: Database.Database, assessmentId: string, kind: string): (ArtifactRow & { createdAt: string }) | null {
  const r = db.prepare("SELECT * FROM artifacts WHERE assessment_id = ? AND kind = ? ORDER BY created_at DESC, rowid DESC LIMIT 1").get(assessmentId, kind) as Row | undefined;
  return r ? { assessmentId, kind, path: r.path as string, sizeBytes: r.size_bytes as number, createdAt: r.created_at as string } : null;
}

export function logLlmCall(db: Database.Database, c: LlmCallRow): void {
  db.prepare("INSERT INTO llm_calls (id, provider, model, purpose, ok, fallback, tokens_in, tokens_out, latency_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), c.provider, c.model, c.purpose, c.ok ? 1 : 0, c.fallback ? 1 : 0, c.tokensIn, c.tokensOut, c.latencyMs);
}

export function llmStats(db: Database.Database): { provider: string; calls: number; okFirstTry: number; fallbacks: number; tokensIn: number; tokensOut: number; avgLatencyMs: number }[] {
  return db.prepare("SELECT provider, COUNT(*) AS calls, SUM(ok) AS okFirstTry, SUM(fallback) AS fallbacks, SUM(tokens_in) AS tokensIn, SUM(tokens_out) AS tokensOut, ROUND(AVG(latency_ms)) AS avgLatencyMs FROM llm_calls GROUP BY provider ORDER BY provider").all() as ReturnType<typeof llmStats>;
}
```

- [ ] **Step 5: Spec patch, run, commit**

In the M0 spec: §3 bullet `- Prisma trên SQLite ...` → `- SQLite qua better-sqlite3 với schema.sql (thay Prisma, quyết định plan 02) tại .dxforge/wizard.db ...` and §4 heading `## 4. Mô hình dữ liệu (Prisma)` → `## 4. Mô hình dữ liệu (SQLite)`.

Run: `npx vitest run apps/web/test/repo.test.ts` (7 passed), `npm test`, `npm run typecheck`.

```bash
git add apps/web/src/lib docs/superpowers/specs/2026-09-09-m0-measurement-design.md apps/web/test/repo.test.ts
git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(web): sqlite schema, openDb and typed repository"
```

---

### Task 3: Admin auth (password, signed cookie, middleware, login page)

**Files:**
- Create: `apps/web/src/lib/auth.ts`, `apps/web/src/middleware.ts`, `apps/web/src/app/login/page.tsx`, `apps/web/src/app/api/auth/login/route.ts`, `apps/web/src/app/api/auth/logout/route.ts`
- Test: `apps/web/test/auth.test.ts`

**Interfaces:**
- Produces: `signSession(secret, issuedAt = Date.now()): string`, `verifySession(secret, cookie, now = Date.now()): boolean` (12 h), `checkPassword(expected, given): boolean` (constant-time), `SESSION_COOKIE = "forge_session"`, `isPublicPath(pathname): boolean`.

- [ ] **Step 1: Failing tests**

`apps/web/test/auth.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { checkPassword, isPublicPath, signSession, verifySession } from "../src/lib/auth.js";

const S = "0123456789abcdef0123456789abcdef";

describe("session cookie", () => {
  it("verifies a fresh cookie and rejects a tampered or expired one", () => {
    const c = signSession(S, 1_000_000);
    expect(verifySession(S, c, 1_000_000 + 60_000)).toBe(true);
    expect(verifySession(S, c + "x", 1_000_000)).toBe(false);
    expect(verifySession("other-secret-0123456789", c, 1_000_000)).toBe(false);
    expect(verifySession(S, c, 1_000_000 + 13 * 3600 * 1000)).toBe(false);
    expect(verifySession(S, "", 1_000_000)).toBe(false);
  });
});

describe("checkPassword", () => {
  it("compares without leaking length differences into exceptions", () => {
    expect(checkPassword("secret", "secret")).toBe(true);
    expect(checkPassword("secret", "secre")).toBe(false);
    expect(checkPassword("secret", "")).toBe(false);
  });
});

describe("isPublicPath", () => {
  it.each([["/pulse/s/abc", true], ["/api/pulse/survey/abc", true], ["/login", true], ["/api/auth/login", true], ["/api/health", true], ["/about", true], ["/pulse", false], ["/pulse/a/1", false], ["/api/pulse/latest", false]])("%s → %s", (p, pub) => {
    expect(isPublicPath(p)).toBe(pub);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

`npx vitest run apps/web/test/auth.test.ts` — FAIL, module not found.

- [ ] **Step 3: auth.ts**

`apps/web/src/lib/auth.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "forge_session";
const TTL_MS = 12 * 3600 * 1000;

function hmac(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

export function signSession(secret: string, issuedAt: number = Date.now()): string {
  return `${issuedAt}.${hmac(secret, String(issuedAt))}`;
}

export function verifySession(secret: string, cookie: string | undefined, now: number = Date.now()): boolean {
  if (!cookie) return false;
  const [ts, sig] = cookie.split(".");
  if (!ts || !sig || !/^\d+$/.test(ts)) return false;
  const expected = hmac(secret, ts);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const issued = Number(ts);
  return now >= issued && now - issued < TTL_MS;
}

/** Compares SHA-256 digests, not the raw strings: digests are always 32 bytes, so a wrong password
 * costs the same time whatever its length. Returning early on a length mismatch would leak the
 * length of the admin password through response timing. */
export function checkPassword(expected: string, given: string): boolean {
  const a = createHash("sha256").update(expected, "utf8").digest();
  const b = createHash("sha256").update(given, "utf8").digest();
  return timingSafeEqual(a, b);
}

const PUBLIC_PREFIXES = ["/pulse/s/", "/api/pulse/survey/", "/login", "/api/auth/", "/api/health", "/about", "/_next/", "/logo.svg", "/favicon.ico"];
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p));
}
```

- [ ] **Step 4: Middleware and routes**

`apps/web/src/middleware.ts` (Edge runtime cannot use `node:crypto`; verification uses Web Crypto here, same scheme):
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath, SESSION_COOKIE } from "@/lib/auth";

async function verifyEdge(secret: string, cookie: string | undefined): Promise<boolean> {
  if (!cookie) return false;
  const [ts, sig] = cookie.split(".");
  if (!ts || !sig || !/^\d+$/.test(ts)) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ts)));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  if (hex !== sig) return false;
  const age = Date.now() - Number(ts);
  return age >= 0 && age < 12 * 3600 * 1000;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();
  const ok = await verifyEdge(process.env.FORGE_SESSION_SECRET ?? "", req.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/pulse/:path*", "/api/pulse/:path*"] };
```
(The Node `verifySession` and this Edge verifier must agree; `auth.test.ts` covers the Node side, the E2E in Task 10 covers the gate end to end.)

`apps/web/src/app/api/auth/login/route.ts`:
```ts
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
```

`apps/web/src/app/api/auth/logout/route.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
```

`apps/web/src/app/login/page.tsx`:
```tsx
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
```

- [ ] **Step 5: Run, typecheck, commit**

`npx vitest run apps/web/test/auth.test.ts` (11 passed); `npm run typecheck`.

```bash
git add apps/web && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(web): admin password login with signed session cookie and route gate"
```

---

### Task 4: Survey API and mobile-first survey page

**Files:**
- Create: `apps/web/src/lib/survey.ts`, `apps/web/src/app/api/pulse/survey/[token]/route.ts`, `apps/web/src/app/pulse/s/[token]/page.tsx`, `apps/web/src/components/SurveyForm.tsx`
- Test: `apps/web/test/survey.test.ts`

**Interfaces:**
- Produces: `questionsForTier(tier): PublicQuestion[]` (`{ id, text, type, options?, max }` — no pillar, no weights, no supp axis leak), `validateAnswers(tier, answers): { ok: true; answers } | { ok: false; error }` (every asked question answered, values in range and, for choice/supp, one of the option values), `linkState(link, assessment, now): "open" | "expired" | "closed"`.
- API: `GET /api/pulse/survey/:token` → `{ tier, questions, expiresAt }` or 404/410; `POST` body `{ answers: Record<string, number>, freeText?: string }` → 201 `{ ok: true }`, 400 on invalid, 410 when expired or closed.

- [ ] **Step 1: Failing tests**

`apps/web/test/survey.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { linkState, questionsForTier, validateAnswers } from "../src/lib/survey.js";

describe("questionsForTier", () => {
  it("returns only the tier's questions without scoring metadata", () => {
    const qs = questionsForTier("executive");
    expect(qs.length).toBe(18);
    expect(qs.every((q) => !("pillar" in q) && !("supp" in q) && !("weightEvidence" in q) && !("axis" in q))).toBe(true);
    expect(qs.find((q) => q.id === "OPS-06")?.options?.length).toBe(3);
  });
});

describe("validateAnswers", () => {
  const full = Object.fromEntries(questionsForTier("staff").map((q) => [q.id, q.type === "scale" ? 4 : q.options![0].value]));
  it("accepts a complete, in-range submission", () => {
    expect(validateAnswers("staff", full)).toEqual({ ok: true, answers: full });
  });
  it("rejects a missing question, an out-of-range scale and an unknown option value", () => {
    const { "OPS-02": _drop, ...missing } = full;
    expect(validateAnswers("staff", missing).ok).toBe(false);
    expect(validateAnswers("staff", { ...full, "OPS-02": 7 }).ok).toBe(false);
    expect(validateAnswers("staff", { ...full, "OPS-06": 0.4 }).ok).toBe(false);
  });
  it("drops answers to questions the tier was not asked", () => {
    const r = validateAnswers("staff", { ...full, "STR-01": 4 });
    expect(r.ok && "STR-01" in r.answers).toBe(false);
  });
});

describe("linkState", () => {
  const link = { expiresAt: "2030-01-01T00:00:00.000Z" };
  it("open before expiry while the round is open; expired after; closed when the round is closed", () => {
    expect(linkState(link, { status: "open" }, new Date("2029-01-01"))).toBe("open");
    expect(linkState(link, { status: "open" }, new Date("2031-01-01"))).toBe("expired");
    expect(linkState(link, { status: "closed" }, new Date("2029-01-01"))).toBe("closed");
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run apps/web/test/survey.test.ts`.

- [ ] **Step 3: survey.ts**

`apps/web/src/lib/survey.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { loadQuestionnaireV1, type Question, type Tier } from "@dx-forge/hpdi-engine";

export type PublicQuestion = { id: string; text: string; type: Question["type"]; max: number; options?: { value: number; label: string }[] };

const Q = loadQuestionnaireV1();

export function questionsForTier(tier: Tier): PublicQuestion[] {
  return Q.questions.filter((q) => q.tiers.includes(tier)).map((q) => ({ id: q.id, text: q.text, type: q.type, max: q.max, ...(q.options ? { options: q.options } : {}) }));
}

export function validateAnswers(tier: Tier, raw: unknown): { ok: true; answers: Record<string, number> } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "answers must be an object" };
  const given = raw as Record<string, unknown>;
  const answers: Record<string, number> = {};
  for (const q of questionsForTier(tier)) {
    const v = given[q.id];
    if (typeof v !== "number" || Number.isNaN(v)) return { ok: false, error: `missing answer for ${q.id}` };
    if (q.options) {
      if (!q.options.some((o) => o.value === v)) return { ok: false, error: `invalid option for ${q.id}` };
    } else if (v < 0 || v > q.max || !Number.isInteger(v)) return { ok: false, error: `out of range for ${q.id}` };
    answers[q.id] = v;
  }
  return { ok: true, answers };
}

export function linkState(link: { expiresAt: string }, assessment: { status: "open" | "closed" }, now: Date = new Date()): "open" | "expired" | "closed" {
  if (assessment.status === "closed") return "closed";
  return now.getTime() > new Date(link.expiresAt).getTime() ? "expired" : "open";
}
```

- [ ] **Step 4: Route handler**

`apps/web/src/app/api/pulse/survey/[token]/route.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as repo from "@/lib/repo";
import { linkState, questionsForTier, validateAnswers } from "@/lib/survey";
import { vi } from "@/lib/i18n.vi";

type Ctx = { params: Promise<{ token: string }> };

function load(token: string) {
  const db = getDb();
  const link = repo.getLinkByToken(db, token);
  if (!link) return null;
  const assessment = repo.getAssessment(db, link.assessmentId)!;
  return { db, link, assessment, state: linkState(link, assessment) };
}

export async function GET(_req: Request, { params }: Ctx) {
  const { token } = await params;
  const s = load(token);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (s.state !== "open") return NextResponse.json({ error: vi.survey.expired, state: s.state }, { status: 410 });
  return NextResponse.json({ tier: s.link.tier, questions: questionsForTier(s.link.tier), expiresAt: s.link.expiresAt, round: s.assessment.round });
}

export async function POST(req: Request, { params }: Ctx) {
  const { token } = await params;
  const s = load(token);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (s.state !== "open") return NextResponse.json({ error: vi.survey.expired, state: s.state }, { status: 410 });
  const body = (await req.json().catch(() => null)) as { answers?: unknown; freeText?: unknown } | null;
  const v = validateAnswers(s.link.tier, body?.answers);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const freeText = typeof body?.freeText === "string" ? body.freeText.slice(0, 2000) : undefined;
  repo.addResponse(s.db, s.link.id, v.answers, freeText);
  return NextResponse.json({ ok: true }, { status: 201 });
}
```

- [ ] **Step 5: Survey page and client form**

`apps/web/src/app/pulse/s/[token]/page.tsx`:
```tsx
// SPDX-License-Identifier: AGPL-3.0-or-later
import { SurveyForm } from "@/components/SurveyForm";

export default async function SurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SurveyForm token={token} />;
}
```

`apps/web/src/components/SurveyForm.tsx`:
```tsx
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
```

- [ ] **Step 6: Run, typecheck, commit**

`npx vitest run apps/web/test/survey.test.ts` (5 passed); `npm run typecheck`.

```bash
git add apps/web && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(web): anonymous survey API and one-question-per-screen survey page"
```

---

### Task 5: Open and close rounds, `latest` endpoint, notifier, `toMaturity`

**Files:**
- Create: `apps/web/src/lib/assess.ts`, `apps/web/src/lib/notify.ts`, `apps/web/src/app/api/pulse/organization/route.ts`, `apps/web/src/app/api/pulse/assessments/route.ts`, `apps/web/src/app/api/pulse/assessments/[id]/route.ts`, `apps/web/src/app/api/pulse/assessments/[id]/close/route.ts`, `apps/web/src/app/api/pulse/latest/route.ts`
- Create: `packages/forge-core/src/maturity.ts`; modify `packages/forge-core/src/index.ts` and `packages/forge-core/src/schema/intent.ts` (add `export type Maturity = z.infer<typeof Maturity>;` beside the const, matching the convention the file already uses for `Layer`, `TargetKind` and `ShapeName`; without it `maturity.ts` declaring its own `Maturity` type collides with the star re-export and `tsc -b` fails with TS2308)
- Test: `apps/web/test/assess.test.ts`, `packages/forge-core/test/maturity.test.ts`

**Interfaces:**
- Produces (web): `openRound(db, { coreProcess?, days = 14 })` → `{ assessment, links }`; `closeRound(db, id)` → `{ ok: true; result: ResultV1 } | { ok: false; reason: "not_found" | "already_closed" | "insufficient"; counts? }`; `surveyUrl(baseUrl, token)`; `notify(text): Promise<void>` (console always; Telegram when both env values exist).
- Produces (forge-core): `resultToMaturity(result: { hpdi; shape; dtiLevel; pillars: Record<string, { discrepancy: number }> }, assessmentId): Maturity` — the `intent.maturity` block. Discrepancies above 0.3 only.
- API: `GET/PUT /api/pulse/organization`; `GET /api/pulse/assessments` → list with counts; `POST` `{ coreProcess? }` → 201 `{ assessment, links: [{ tier, url, expiresAt }] }`; `GET /api/pulse/assessments/:id` → `{ assessment, links, counts, result? }`; `POST /api/pulse/assessments/:id/close` → 200 result | 409 `{ error }`; `GET /api/pulse/latest` → `{ assessmentId, round, result, maturity }` | 404.

- [ ] **Step 1: Failing tests**

`packages/forge-core/test/maturity.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { resultToMaturity } from "../src/maturity.js";
import { Maturity } from "../src/schema/intent.js";

describe("resultToMaturity", () => {
  it("copies hpdi, shape and level and keeps only discrepancies above 0.3", () => {
    const m = resultToMaturity({ hpdi: { H: 55, P: 25, D: 12, I: 8 }, shape: "transitional", dtiLevel: 3, pillars: { operations: { discrepancy: 0.35 }, data: { discrepancy: 0.1 } } }, "a1");
    expect(m).toEqual({ assessment_id: "a1", hpdi: { H: 55, P: 25, D: 12, I: 8 }, shape: "transitional", dti_level: 3, discrepancies: { operations: 0.35 } });
    expect(Maturity.safeParse(m).success).toBe(true);
  });
});
```

`apps/web/test/assess.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, beforeEach } from "vitest";
import { loadQuestionnaireV1, type Tier } from "@dx-forge/hpdi-engine";
import type Database from "better-sqlite3";
import { openDb } from "../src/lib/db.js";
import * as repo from "../src/lib/repo.js";
import { closeRound, openRound, surveyUrl } from "../src/lib/assess.js";

const Q = loadQuestionnaireV1();
/** Supp questions feed different axes (OPS-06 -> P, DAT-06 -> D, TEC-06 -> I), so a single scalar
 * cannot express the book example. Take one coefficient per axis. */
function answersFor(tier: Tier, scale: number, supp: Record<"P" | "D" | "I", number>) {
  return Object.fromEntries(Q.questions.filter((q) => q.tiers.includes(tier)).map((q) => [q.id, q.type === "supp" ? supp[q.supp!.axis] : scale]));
}
let db: Database.Database;
beforeEach(() => { db = openDb(":memory:"); });

describe("openRound", () => {
  it("creates a round whose links expire in the given number of days", () => {
    const { assessment, links } = openRound(db, { coreProcess: "cskh", days: 7 }, new Date("2026-09-10T00:00:00Z"));
    expect(assessment.status).toBe("open");
    expect(links[0].expiresAt).toBe("2026-09-17T00:00:00.000Z");
    expect(surveyUrl("http://localhost:3000", links[0].token)).toBe(`http://localhost:3000/pulse/s/${links[0].token}`);
  });
});

describe("closeRound", () => {
  it("refuses without an executive and a staff response and keeps the round open", () => {
    const { assessment, links } = openRound(db, {});
    repo.addResponse(db, links.find((l) => l.tier === "executive")!.id, answersFor("executive", 4, { P: 1, D: 1, I: 1 }));
    const r = closeRound(db, assessment.id);
    expect(r).toMatchObject({ ok: false, reason: "insufficient", counts: { executive: 1, staff: 0 } });
    expect(repo.getAssessment(db, assessment.id)?.status).toBe("open");
  });
  it("computes and stores ResultV1, then refuses a second close", () => {
    const { assessment, links } = openRound(db, {});
    repo.addResponse(db, links.find((l) => l.tier === "executive")!.id, answersFor("executive", 4, { P: 0.33, D: 0, I: 0 }));
    repo.addResponse(db, links.find((l) => l.tier === "staff")!.id, answersFor("staff", 4, { P: 0.33, D: 0, I: 0 }));
    const r = closeRound(db, assessment.id);
    expect(r.ok && r.result.hpdi).toEqual({ H: 90, P: 10, D: 0, I: 0 });
    expect(repo.getResult(db, assessment.id)?.engineVersion).toBe("1.0");
    expect(closeRound(db, assessment.id)).toEqual({ ok: false, reason: "already_closed" });
    expect(closeRound(db, "nope")).toEqual({ ok: false, reason: "not_found" });
  });
});
```

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: forge-core maturity**

`packages/forge-core/src/maturity.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";
import { Maturity as MaturitySchema, type Maturity, type ShapeName } from "./schema/intent.js";


export type ResultLike = {
  hpdi: { H: number; P: number; D: number; I: number };
  shape: ShapeName;
  dtiLevel: number;
  pillars: Record<string, { discrepancy: number }>;
};

/** Builds the `intent.maturity` block from a measurement result (M0 spec §13). */
export function resultToMaturity(result: ResultLike, assessmentId: string): Maturity {
  const discrepancies = Object.fromEntries(Object.entries(result.pillars).filter(([, p]) => p.discrepancy > 0.3).map(([k, p]) => [k, p.discrepancy]));
  return MaturitySchema.parse({ assessment_id: assessmentId, hpdi: result.hpdi, shape: result.shape, dti_level: result.dtiLevel, discrepancies });
}
```
Append `export * from "./maturity.js";` to `src/index.ts`.

- [ ] **Step 4: assess.ts and notify.ts**

`apps/web/src/lib/notify.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { getEnv } from "./env.js";

/** Sends an operator notification. Always logs; posts to Telegram when configured. Never throws. */
export async function notify(text: string): Promise<void> {
  console.log(`[notify] ${text}`);
  const { telegramBotToken, telegramChatId } = getEnv();
  if (!telegramBotToken || !telegramChatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: telegramChatId, text, disable_web_page_preview: true }),
    });
  } catch (e) {
    console.warn(`[notify] telegram failed: ${(e as Error).message}`);
  }
}
```

`apps/web/src/lib/assess.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { compute, InsufficientResponses, loadQuestionnaireV1, type ResultV1 } from "@dx-forge/hpdi-engine";
import type Database from "better-sqlite3";
import * as repo from "./repo.js";

const Q = loadQuestionnaireV1();

export function surveyUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}/pulse/s/${token}`;
}

export function openRound(db: Database.Database, input: { coreProcess?: string; days?: number }, now: Date = new Date()) {
  const expiresAt = new Date(now.getTime() + (input.days ?? 14) * 86_400_000).toISOString();
  return repo.createAssessment(db, { questionnaireVersion: Q.version, coreProcess: input.coreProcess, expiresAt });
}

export type CloseOutcome = { ok: true; result: ResultV1 } | { ok: false; reason: "not_found" | "already_closed" | "insufficient"; counts?: Record<repo.Tier, number> };

export function closeRound(db: Database.Database, id: string): CloseOutcome {
  const a = repo.getAssessment(db, id);
  if (!a) return { ok: false, reason: "not_found" };
  if (a.status === "closed") return { ok: false, reason: "already_closed" };
  const responses = repo.listResponses(db, id).map((r) => ({ tier: r.tier, answers: r.answers }));
  try {
    const result = compute(Q, responses);
    repo.closeAssessment(db, id, result, result.engineVersion);
    return { ok: true, result };
  } catch (e) {
    if (e instanceof InsufficientResponses) return { ok: false, reason: "insufficient", counts: repo.countResponses(db, id) };
    throw e;
  }
}
```

- [ ] **Step 5: Route handlers**

`apps/web/src/app/api/pulse/organization/route.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import * as repo from "@/lib/repo";

const Body = z.object({
  name: z.string().min(1), shortCode: z.string().regex(/^[a-z0-9]{2,12}$/), sector: z.string().min(1), sizeBand: z.string().min(1),
  departments: z.array(z.object({ code: z.string().regex(/^[a-z0-9][a-z0-9-]{1,19}$/), name: z.string().min(1) })).min(1),
});

export async function GET() {
  const org = repo.getOrganization(getDb());
  return org ? NextResponse.json(org) : NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function PUT(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, { status: 400 });
  repo.saveOrganization(getDb(), { id: "org", ...parsed.data });
  return NextResponse.json({ ok: true });
}
```

`apps/web/src/app/api/pulse/assessments/route.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from "next/server";
import { z } from "zod";
import { openRound, surveyUrl } from "@/lib/assess";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { vi } from "@/lib/i18n.vi";
import { notify } from "@/lib/notify";
import * as repo from "@/lib/repo";

export async function GET() {
  const db = getDb();
  const rows = repo.listAssessments(db).map((a) => ({ ...a, counts: repo.countResponses(db, a.id), result: repo.getResult(db, a.id)?.payload ?? null }));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = z.object({ coreProcess: z.string().max(80).optional(), days: z.number().int().min(1).max(90).optional() }).safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const { assessment, links } = openRound(getDb(), body.data);
  const base = getEnv().baseUrl;
  const out = links.map((l) => ({ tier: l.tier, url: surveyUrl(base, l.token), expiresAt: l.expiresAt }));
  await notify(`${vi.pulse.round} ${assessment.round} ${vi.pulse.status.open}. ${out.map((l) => `${vi.round.tier[l.tier]}: ${l.url}`).join(" | ")}`);
  return NextResponse.json({ assessment, links: out }, { status: 201 });
}
```

`apps/web/src/app/api/pulse/assessments/[id]/route.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from "next/server";
import { surveyUrl } from "@/lib/assess";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import * as repo from "@/lib/repo";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const assessment = repo.getAssessment(db, id);
  if (!assessment) return NextResponse.json({ error: "not found" }, { status: 404 });
  const base = getEnv().baseUrl;
  return NextResponse.json({
    assessment,
    links: repo.listLinks(db, id).map((l) => ({ tier: l.tier, url: surveyUrl(base, l.token), expiresAt: l.expiresAt })),
    counts: repo.countResponses(db, id),
    result: repo.getResult(db, id)?.payload ?? null,
  });
}
```

`apps/web/src/app/api/pulse/assessments/[id]/close/route.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from "next/server";
import { closeRound } from "@/lib/assess";
import { getDb } from "@/lib/db";
import { vi } from "@/lib/i18n.vi";
import { notify } from "@/lib/notify";
import * as repo from "@/lib/repo";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const out = closeRound(db, id);
  if (!out.ok) {
    if (out.reason === "not_found") return NextResponse.json({ error: "not found" }, { status: 404 });
    if (out.reason === "insufficient") return NextResponse.json({ error: vi.round.notEnough, counts: out.counts }, { status: 409 });
    return NextResponse.json({ error: vi.pulse.status.closed }, { status: 409 });
  }
  const a = repo.getAssessment(db, id)!;
  await notify(`${vi.pulse.round} ${a.round} ${vi.round.closed} HPDI H=${out.result.hpdi.H} P=${out.result.hpdi.P} D=${out.result.hpdi.D} I=${out.result.hpdi.I}, ${vi.round.shape[out.result.shape]}, ${vi.round.level} ${out.result.dtiLevel}.`);
  return NextResponse.json(out.result);
}
```

`apps/web/src/app/api/pulse/latest/route.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from "next/server";
import { resultToMaturity } from "@dx-forge/forge-core";
import type { ResultV1 } from "@dx-forge/hpdi-engine";
import { getDb } from "@/lib/db";
import * as repo from "@/lib/repo";

export async function GET() {
  const latest = repo.latestResult(getDb());
  if (!latest) return NextResponse.json({ error: "no closed assessment" }, { status: 404 });
  const result = latest.payload as ResultV1;
  return NextResponse.json({ assessmentId: latest.assessmentId, round: latest.round, computedAt: latest.computedAt, result, maturity: resultToMaturity(result, latest.assessmentId) });
}
```

- [ ] **Step 6: Run, typecheck, commit**

`npx vitest run apps/web/test/assess.test.ts packages/forge-core/test/maturity.test.ts` (4 passed); `npm test`; `npm run typecheck`.

```bash
git add apps/web packages/forge-core && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(web): open and close rounds, latest result with maturity block, notifier"
```

---

### Task 6: Dashboards — organisation page, round page, radar, pillar table

**Files:**
- Create: `apps/web/src/components/Radar.tsx`, `apps/web/src/components/PillarTable.tsx`, `apps/web/src/components/ShapeBadge.tsx`, `apps/web/src/components/CopyField.tsx`, `apps/web/src/components/CloseRoundButton.tsx`, `apps/web/src/app/pulse/page.tsx`, `apps/web/src/app/pulse/new/page.tsx`, `apps/web/src/app/pulse/new/OrgForm.tsx`, `apps/web/src/app/pulse/a/[id]/page.tsx`, `apps/web/src/lib/radar.ts`
- Test: `apps/web/test/radar.test.ts`

**Interfaces:**
- Produces: `radarSeries(result: ResultV1): { axis: "H"|"P"|"D"|"I"; label: string; merged: number; executive?: number; manager?: number; staff?: number }[]` in the order H, P, D, I, values 0–100 (`merged` = `hpdi`; tier values = that tier's axis estimate computed from `pillars[*].byTier` through `scoreAxes`-like weighting: P = mean(operations, customer), D = data, I = technology, H = 100 − sum, each × supp × 30 — see code).
- Pages are server components; `Radar` and forms are client components.

- [ ] **Step 1: Failing test**

`apps/web/test/radar.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { compute, loadQuestionnaireV1, type Tier } from "@dx-forge/hpdi-engine";
import { radarSeries } from "../src/lib/radar.js";

const Q = loadQuestionnaireV1();
const respond = (tier: Tier, scale: number, supp: number) => ({ tier, answers: Object.fromEntries(Q.questions.filter((q) => q.tiers.includes(tier)).map((q) => [q.id, q.type === "supp" ? supp : scale])) });

describe("radarSeries", () => {
  it("returns four axes in H,P,D,I order with merged = hpdi and per-tier estimates that sum to 100", () => {
    const r = compute(Q, [respond("executive", 4, 1), respond("staff", 2, 1)]);
    const s = radarSeries(r);
    expect(s.map((x) => x.axis)).toEqual(["H", "P", "D", "I"]);
    expect(s.map((x) => x.merged)).toEqual([r.hpdi.H, r.hpdi.P, r.hpdi.D, r.hpdi.I]);
    const exec = s.reduce((a, x) => a + (x.executive ?? 0), 0);
    const staff = s.reduce((a, x) => a + (x.staff ?? 0), 0);
    expect(Math.round(exec)).toBe(100);
    expect(Math.round(staff)).toBe(100);
    expect(s[1].executive!).toBeGreaterThan(s[1].staff!);
    expect(s.every((x) => x.manager === undefined)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: radar.ts**

`apps/web/src/lib/radar.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Axis, ResultV1, Tier } from "@dx-forge/hpdi-engine";
import { vi } from "./i18n.vi.js";

export type RadarPoint = { axis: Axis | "H"; label: string; merged: number } & Partial<Record<Tier, number>>;

/** Per-tier axis estimate using the same axis sources and supp coefficients as the engine (display only). */
function tierAxes(r: ResultV1, tier: Tier): Record<"H" | Axis, number> | undefined {
  const p = r.pillars;
  const t = (k: keyof ResultV1["pillars"]) => p[k].byTier[tier];
  if (t("operations") === undefined && t("customer") === undefined && t("data") === undefined && t("technology") === undefined) return undefined;
  const P = Math.round((((t("operations") ?? 0) + (t("customer") ?? 0)) / 2) * r.supp.P * 30);
  const D = Math.round((t("data") ?? 0) * r.supp.D * 30);
  const I = Math.round((t("technology") ?? 0) * r.supp.I * 30);
  return { H: 100 - (P + D + I), P, D, I };
}

export function radarSeries(r: ResultV1): RadarPoint[] {
  const tiers: Tier[] = ["executive", "manager", "staff"];
  const byTier = Object.fromEntries(tiers.map((t) => [t, tierAxes(r, t)])) as Record<Tier, ReturnType<typeof tierAxes>>;
  return (["H", "P", "D", "I"] as const).map((axis) => {
    const point: RadarPoint = { axis, label: vi.axes[axis], merged: r.hpdi[axis] };
    for (const t of tiers) if (byTier[t]) point[t] = byTier[t]![axis];
    return point;
  });
}
```

- [ ] **Step 4: Components**

`apps/web/src/components/Radar.tsx`:
```tsx
// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";
import { useState } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar as RRadar, RadarChart, ResponsiveContainer, Legend } from "recharts";
import type { RadarPoint } from "@/lib/radar";
import { vi } from "@/lib/i18n.vi";

const TIER_COLORS = { executive: "#0f172a", manager: "#64748b", staff: "#ea580c" } as const;

export function Radar({ series, compare }: { series: RadarPoint[]; compare?: { name: string; series: RadarPoint[] }[] }) {
  const [tiers, setTiers] = useState<Record<keyof typeof TIER_COLORS, boolean>>({ executive: false, manager: false, staff: false });
  const data = series.map((p, i) => ({ ...p, ...Object.fromEntries((compare ?? []).map((c) => [c.name, c.series[i]?.merged])) }));
  return (
    <div>
      <div className="h-72 sm:h-96">
        <ResponsiveContainer>
          <RadarChart data={data} outerRadius="75%">
            <PolarGrid />
            <PolarAngleAxis dataKey="label" />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <RRadar name={vi.round.merged} dataKey="merged" stroke="#ea580c" fill="#ea580c" fillOpacity={0.25} />
            {(Object.keys(TIER_COLORS) as (keyof typeof TIER_COLORS)[]).filter((t) => tiers[t] && series.some((p) => p[t] !== undefined)).map((t) => (
              <RRadar key={t} name={vi.round.tier[t]} dataKey={t} stroke={TIER_COLORS[t]} fill="none" strokeDasharray="4 3" />
            ))}
            {(compare ?? []).map((c, i) => <RRadar key={c.name} name={c.name} dataKey={c.name} stroke={["#94a3b8", "#cbd5e1", "#e2e8f0"][i % 3]} fill="none" />)}
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {(Object.keys(TIER_COLORS) as (keyof typeof TIER_COLORS)[]).map((t) => (
          <label key={t} className="chip border border-border cursor-pointer">
            <input type="checkbox" className="mr-1" checked={tiers[t]} disabled={!series.some((p) => p[t] !== undefined)} onChange={() => setTiers({ ...tiers, [t]: !tiers[t] })} />
            {vi.round.tier[t]}
          </label>
        ))}
      </div>
      <table className="sr-only"><caption>{vi.round.radar}</caption><tbody>{series.map((p) => <tr key={p.axis}><th>{p.label}</th><td>{p.merged}</td></tr>)}</tbody></table>
    </div>
  );
}
```

`apps/web/src/components/PillarTable.tsx`:
```tsx
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ResultV1 } from "@dx-forge/hpdi-engine";
import { vi } from "@/lib/i18n.vi";

const pct = (v?: number) => (v === undefined ? "–" : `${Math.round(v * 100)}%`);

export function PillarTable({ result }: { result: ResultV1 }) {
  const rows = Object.entries(result.pillars) as [keyof typeof vi.pillars, ResultV1["pillars"][keyof ResultV1["pillars"]]][];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-muted text-left"><tr><th className="py-2">{vi.round.pillar}</th><th className="text-right">{vi.round.tier.executive}</th><th className="text-right">{vi.round.tier.manager}</th><th className="text-right">{vi.round.tier.staff}</th><th className="text-right">{vi.round.merged}</th><th className="text-right">{vi.round.discrepancy}</th></tr></thead>
        <tbody>
          {rows.map(([k, p]) => (
            <tr key={k} className="border-t border-border">
              <td className="py-3">{vi.pillars[k]}</td>
              <td className="text-right font-mono">{pct(p.byTier.executive)}</td>
              <td className="text-right font-mono">{pct(p.byTier.manager)}</td>
              <td className="text-right font-mono">{pct(p.byTier.staff)}</td>
              <td className="text-right font-mono font-semibold">{pct(p.merged)}</td>
              <td className="text-right font-mono">{p.discrepancy.toFixed(2)} {p.discrepancy > 0.3 && <span className="chip bg-axis-d/20 text-axis-d ml-1">{vi.round.warn}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`apps/web/src/components/ShapeBadge.tsx`:
```tsx
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ResultV1 } from "@dx-forge/hpdi-engine";
import { vi } from "@/lib/i18n.vi";

const ICON = { spear: "🗡️", kite: "🪁", illusion: "🪞", diamond: "💎", transitional: "🔄" } as const;

export function ShapeBadge({ result }: { result: ResultV1 }) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <span className="chip bg-ink text-paper text-sm px-3 py-1">{ICON[result.shape]} {vi.round.shape[result.shape]}</span>
      <span className="chip border border-border text-sm px-3 py-1">{vi.round.level} {result.dtiLevel}/5</span>
      {(["H", "P", "D", "I"] as const).map((a) => <span key={a} className="chip text-paper" style={{ background: `var(--color-axis-${a.toLowerCase()})` }}>{a} {result.hpdi[a]}</span>)}
    </div>
  );
}
```

`apps/web/src/components/CopyField.tsx`:
```tsx
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
```

`apps/web/src/components/CloseRoundButton.tsx`:
```tsx
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
```

- [ ] **Step 5: Pages**

`apps/web/src/app/pulse/page.tsx`:
```tsx
// SPDX-License-Identifier: AGPL-3.0-or-later
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ResultV1 } from "@dx-forge/hpdi-engine";
import { Radar } from "@/components/Radar";
import { getDb } from "@/lib/db";
import { vi } from "@/lib/i18n.vi";
import { radarSeries } from "@/lib/radar";
import * as repo from "@/lib/repo";

export const dynamic = "force-dynamic";

export default function PulsePage() {
  const db = getDb();
  const org = repo.getOrganization(db);
  if (!org) redirect("/pulse/new");
  const rounds = repo.listAssessments(db).map((a) => ({ ...a, counts: repo.countResponses(db, a.id), result: repo.getResult(db, a.id)?.payload as ResultV1 | undefined }));
  const closed = rounds.filter((r) => r.result);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">{vi.pulse.title}</h1><p className="text-muted text-sm">{org.name} · {org.shortCode}</p></div>
        <Link href="/pulse/new" className="btn btn-primary">{vi.pulse.open}</Link>
      </div>
      {closed.length > 0 && (
        <section className="card p-4"><h2 className="font-medium mb-2">{vi.pulse.history}</h2>
          <Radar series={radarSeries(closed[0].result!)} compare={closed.slice(1, 4).map((r) => ({ name: `${vi.pulse.round} ${r.round}`, series: radarSeries(r.result!) }))} />
        </section>
      )}
      <section className="card divide-y divide-border">
        {rounds.length === 0 && <p className="p-6 text-muted">{vi.pulse.empty}</p>}
        {rounds.map((r) => (
          <Link key={r.id} href={`/pulse/a/${r.id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-paper">
            <span className="font-medium">{vi.pulse.round} {r.round}</span>
            <span className={`chip ${r.status === "open" ? "bg-verify/15 text-verify" : "bg-border"}`}>{vi.pulse.status[r.status]}</span>
            <span className="text-sm text-muted">{vi.round.responses}: {r.counts.executive}/{r.counts.manager}/{r.counts.staff}</span>
            {r.result && <span className="ml-auto text-sm font-mono">H{r.result.hpdi.H} P{r.result.hpdi.P} D{r.result.hpdi.D} I{r.result.hpdi.I}</span>}
          </Link>
        ))}
      </section>
    </div>
  );
}
```

`apps/web/src/app/pulse/new/page.tsx`:
```tsx
// SPDX-License-Identifier: AGPL-3.0-or-later
import { getDb } from "@/lib/db";
import * as repo from "@/lib/repo";
import { OrgForm } from "./OrgForm";

export const dynamic = "force-dynamic";

export default function NewRoundPage() {
  const org = repo.getOrganization(getDb());
  return <OrgForm initial={org} />;
}
```

`apps/web/src/app/pulse/new/OrgForm.tsx`:
```tsx
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
```

`apps/web/src/app/pulse/a/[id]/page.tsx`:
```tsx
// SPDX-License-Identifier: AGPL-3.0-or-later
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ResultV1 } from "@dx-forge/hpdi-engine";
import { CloseRoundButton } from "@/components/CloseRoundButton";
import { CopyField } from "@/components/CopyField";
import { PillarTable } from "@/components/PillarTable";
import { Radar } from "@/components/Radar";
import { ShapeBadge } from "@/components/ShapeBadge";
import { surveyUrl } from "@/lib/assess";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { vi } from "@/lib/i18n.vi";
import { radarSeries } from "@/lib/radar";
import * as repo from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function RoundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const a = repo.getAssessment(db, id);
  if (!a) notFound();
  const links = repo.listLinks(db, id);
  const counts = repo.countResponses(db, id);
  const result = repo.getResult(db, id)?.payload as ResultV1 | undefined;
  const base = getEnv().baseUrl;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{vi.round.title} {a.round}</h1>
        <span className={`chip ${a.status === "open" ? "bg-verify/15 text-verify" : "bg-border"}`}>{vi.pulse.status[a.status]}</span>
        {a.coreProcess && <span className="text-sm text-muted">{vi.pulse.coreProcess}: {a.coreProcess}</span>}
      </div>
      {a.status === "open" && (
        <section className="card p-4 flex flex-col gap-3">
          <h2 className="font-medium">{vi.round.links}</h2>
          {links.map((l) => <CopyField key={l.tier} label={`${vi.round.tier[l.tier]} (${counts[l.tier]})`} value={surveyUrl(base, l.token)} />)}
          <p className="text-xs text-muted">{vi.round.expires}: {new Date(links[0].expiresAt).toLocaleDateString("vi-VN")}</p>
          <CloseRoundButton id={id} />
        </section>
      )}
      {result && (
        <>
          <section className="card p-4 flex flex-col gap-4">
            <ShapeBadge result={result} />
            <Radar series={radarSeries(result)} />
            <p className="text-sm text-muted">{vi.round.responses}: {vi.round.tier.executive} {result.responseCounts.executive} · {vi.round.tier.manager} {result.responseCounts.manager} · {vi.round.tier.staff} {result.responseCounts.staff}</p>
          </section>
          <section className="card p-4"><h2 className="font-medium mb-2">{vi.round.pillars}</h2><PillarTable result={result} /></section>
          <div className="flex flex-wrap gap-3">
            <Link href={`/pulse/a/${id}/prescription`} className="btn btn-primary">{vi.round.prescription}</Link>
            <Link href={`/pulse/a/${id}/kit`} className="btn btn-secondary">{vi.round.kit}</Link>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run, build, commit**

`npx vitest run apps/web/test/radar.test.ts` (1 passed); `npm run typecheck`; `cd apps/web && FORGE_ADMIN_PASSWORD=x FORGE_SESSION_SECRET=0123456789abcdef npx next build` (pages compile).

```bash
git add apps/web && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(web): organisation and round dashboards with HPDI radar and pillar table"
```

---

### Task 7: Rule-based prescriptions page (roadmap, discrepancy questions, 5 RÕ, Poka-yoke)

**Files:**
- Create: `apps/web/src/lib/prescribe.ts`, `apps/web/src/app/api/pulse/assessments/[id]/prescription/route.ts`, `apps/web/src/app/pulse/a/[id]/prescription/page.tsx`
- Test: `apps/web/test/prescribe.test.ts`

**Interfaces:**
- Produces: `buildRoadmap(result): Roadmap`, `buildDiscrepancyQuestions(result): DiscrepancyQuestions`, `buildFiveRo(coreProcess: string | null): FiveRo`, `buildPokaYoke(coreProcess): PokaYoke`; each returns the zod-typed shape from M0 spec §6.2 (the same schemas plan 03's LLM output must satisfy, so they live in this file and are exported: `RoadmapSchema`, `DiscrepancySchema`, `FiveRoSchema`, `PokaYokeSchema`); `getOrBuildPrescriptions(db, assessmentId)` caches each kind in `prescriptions` with `provider: "none", fallback: true`.
- Plan 03 replaces only the *builder* functions behind the same schemas.

- [ ] **Step 1: Failing tests**

`apps/web/test/prescribe.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { compute, loadQuestionnaireV1, type Tier } from "@dx-forge/hpdi-engine";
import { openDb } from "../src/lib/db.js";
import * as repo from "../src/lib/repo.js";
import { buildDiscrepancyQuestions, buildFiveRo, buildPokaYoke, buildRoadmap, DiscrepancySchema, FiveRoSchema, getOrBuildPrescriptions, PokaYokeSchema, RoadmapSchema } from "../src/lib/prescribe.js";

const Q = loadQuestionnaireV1();
const respond = (tier: Tier, scale: number, supp: number) => ({ tier, answers: Object.fromEntries(Q.questions.filter((q) => q.tiers.includes(tier)).map((q) => [q.id, q.type === "supp" ? supp : scale])) });
const spear = compute(Q, [respond("executive", 4, 0.33), respond("staff", 4, 0.33)]);
const skewed = compute(Q, [respond("executive", 4, 1), respond("staff", 0, 1)]);

describe("builders satisfy the shared schemas", () => {
  it("roadmap: three phases in P → D → I order starting at the focus axis", () => {
    const r = buildRoadmap(spear);
    expect(RoadmapSchema.safeParse(r).success).toBe(true);
    expect(r.focusAxis).toBe("P");
    expect(r.phases.map((p) => p.axis)).toEqual(["P", "D", "I"]);
    expect(r.phases[0].actions.length).toBeGreaterThanOrEqual(3);
  });
  it("discrepancy: one question per pillar with discrepancy > 0.3, addressed to the lower-scoring tier", () => {
    const d = buildDiscrepancyQuestions(skewed);
    expect(DiscrepancySchema.safeParse(d).success).toBe(true);
    expect(d.questions.length).toBe(6);
    expect(d.questions.every((q) => q.forTier === "staff")).toBe(true);
    expect(buildDiscrepancyQuestions(spear).questions).toEqual([]);
  });
  it("fiveRo and pokaYoke fall back to the DX-Ticket template and name the process", () => {
    const f = buildFiveRo("Xử lý yêu cầu khách hàng");
    expect(FiveRoSchema.safeParse(f).success).toBe(true);
    expect(f.process).toBe("Xử lý yêu cầu khách hàng");
    expect(f.steps.every((s) => s.role_A.length > 0)).toBe(true);
    const p = buildPokaYoke(null);
    expect(PokaYokeSchema.safeParse(p).success).toBe(true);
    expect(new Set(p.pokaYoke.map((x) => x.layer))).toEqual(new Set([1, 2, 3]));
  });
});

describe("getOrBuildPrescriptions", () => {
  it("builds once, stores four rows with provider none, and returns cached rows afterwards", () => {
    const db = openDb(":memory:");
    const { assessment } = repo.createAssessment(db, { questionnaireVersion: "1.0", coreProcess: "cskh", expiresAt: "2030-01-01T00:00:00.000Z" });
    repo.closeAssessment(db, assessment.id, spear, "1.0");
    const first = getOrBuildPrescriptions(db, assessment.id);
    expect(first.roadmap.focusAxis).toBe("P");
    expect(db.prepare("SELECT COUNT(*) AS n FROM prescriptions").get()).toEqual({ n: 4 });
    getOrBuildPrescriptions(db, assessment.id);
    expect(db.prepare("SELECT COUNT(*) AS n FROM prescriptions").get()).toEqual({ n: 4 });
    expect(repo.getPrescription(db, assessment.id, "roadmap")?.provider).toBe("none");
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: prescribe.ts**

`apps/web/src/lib/prescribe.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";
import type { Axis, ResultV1, Tier } from "@dx-forge/hpdi-engine";
import type Database from "better-sqlite3";
import * as repo from "./repo.js";
import { vi } from "./i18n.vi.js";

export const RoadmapSchema = z.object({
  focusAxis: z.enum(["P", "D", "I"]),
  diagnosis: z.string().min(1),
  phases: z.array(z.object({ name: z.string(), axis: z.enum(["P", "D", "I"]), actions: z.array(z.string()).min(1), kpis: z.array(z.string()).min(1) })).min(1),
  warnings: z.array(z.string()),
});
export const DiscrepancySchema = z.object({ questions: z.array(z.object({ pillar: z.string(), forTier: z.enum(["executive", "manager", "staff"]), question: z.string(), why: z.string() })) });
export const FiveRoSchema = z.object({
  process: z.string(),
  steps: z.array(z.object({ step: z.string(), role_R: z.string(), role_A: z.string(), role_C: z.string(), role_I: z.string(), standard: z.string(), tool: z.string() })).min(1),
});
export const PokaYokeSchema = z.object({ pokaYoke: z.array(z.object({ point: z.string(), rule: z.string(), layer: z.union([z.literal(1), z.literal(2), z.literal(3)]) })).min(1) });
export type Roadmap = z.infer<typeof RoadmapSchema>;
export type DiscrepancyQuestions = z.infer<typeof DiscrepancySchema>;
export type FiveRo = z.infer<typeof FiveRoSchema>;
export type PokaYoke = z.infer<typeof PokaYokeSchema>;

const PHASES: Record<Axis, { name: string; actions: string[]; kpis: string[] }> = {
  P: { name: "Chuẩn hoá quy trình lõi", actions: ["Chọn một quy trình lõi và viết ma trận 5 RÕ.", "Đưa quy trình lên phần mềm có biểu mẫu chặn dữ liệu sai ngay khi nhập.", "Đặt đúng một người chịu trách nhiệm cho mỗi bước.", "Đo thời gian mỗi bước trong bốn tuần."], kpis: ["100% yêu cầu có mã theo dõi", "Thời gian xử lý trung bình giảm 30%", "0 bước không có người chịu trách nhiệm"] },
  D: { name: "Một nguồn dữ liệu, một bảng điều khiển", actions: ["Gom dữ liệu quy trình về một nguồn duy nhất.", "Dựng bảng điều khiển đếm theo trạng thái và quá hạn.", "Lập lịch chụp dữ liệu hằng tháng vào kho tài nguyên có cấu trúc.", "Che dữ liệu cá nhân khi hiển thị."], kpis: ["Báo cáo tuần tự động 100%", "Lãnh đạo xem dashboard ít nhất 3 lần/tuần", "0 số liệu phải tổng hợp tay"] },
  I: { name: "Trợ lý có kiểm soát", actions: ["Nạp kho tài nguyên vào RAG để trợ lý trả lời theo tài liệu thật.", "Viết chính sách tác tử: whitelist hành động, kênh duyệt, hạn duyệt ≤ 24 giờ.", "Chỉ tự động hoá bước có dữ liệu sạch, giữ người duyệt cho hành động ghi."], kpis: ["Tỷ lệ câu trả lời có dẫn nguồn ≥ 90%", "100% hành động ghi có người duyệt", "Thời gian chờ duyệt ≤ 24 giờ"] },
};

export function buildRoadmap(r: ResultV1): Roadmap {
  const order: Axis[] = ["P", "D", "I"];
  const focusAxis = r.ruleBasedPrescription.focusAxis;
  const phases = order.slice(order.indexOf(focusAxis)).concat(order.slice(0, order.indexOf(focusAxis))).map((axis) => ({ axis, ...PHASES[axis] }));
  const warnings: string[] = [];
  if (r.shape === "illusion") warnings.push("GIGO: công nghệ và dữ liệu đi trước quy trình. Tạm dừng lớp I cho tới khi quy trình lõi được chuẩn hoá.");
  for (const [k, p] of Object.entries(r.pillars)) if (p.discrepancy > 0.3) warnings.push(`Độ vênh lớn ở trụ cột ${vi.pillars[k as keyof typeof vi.pillars]} (${p.discrepancy.toFixed(2)}): xác minh với tầng thấp hơn trước khi lập kế hoạch.`);
  const diagnosis = `Hình dạng ${vi.round.shape[r.shape]}, mức DTI ${r.dtiLevel}/5. H=${r.hpdi.H}, P=${r.hpdi.P}, D=${r.hpdi.D}, I=${r.hpdi.I}. Trục ưu tiên: ${vi.axes[focusAxis]}.`;
  return RoadmapSchema.parse({ focusAxis, diagnosis, phases, warnings });
}

const PILLAR_QUESTION: Record<string, string> = {
  strategy: "Anh/chị được nghe mục tiêu chuyển đổi số ở đâu và khi nào? Nếu chưa, điều gì khiến anh/chị nghĩ chưa có?",
  culture: "Lần gần nhất anh/chị thử một cách làm mới, điều gì xảy ra?",
  customer: "Một yêu cầu của khách hàng hôm qua đi qua những ai, ghi ở đâu?",
  operations: "Hãy mô tả một bước mà anh/chị làm theo trí nhớ hoặc tin nhắn thay vì phần mềm.",
  technology: "Công cụ nào anh/chị phải đăng nhập nhiều lần hoặc phải xuất file tay?",
  data: "Số liệu anh/chị nhập hôm qua xuất hiện ở báo cáo nào? Ai xem?",
};

export function buildDiscrepancyQuestions(r: ResultV1): DiscrepancyQuestions {
  const questions = Object.entries(r.pillars).filter(([, p]) => p.discrepancy > 0.3).map(([pillar, p]) => {
    const tiers = Object.entries(p.byTier) as [Tier, number][];
    const forTier = tiers.sort((a, b) => a[1] - b[1])[0][0];
    return { pillar, forTier, question: PILLAR_QUESTION[pillar], why: `Tầng ${vi.round.tier[forTier]} chấm thấp hơn ${Math.round(p.discrepancy * 100)} điểm phần trăm so với tầng cao nhất.` };
  });
  return DiscrepancySchema.parse({ questions });
}

export function buildFiveRo(coreProcess: string | null): FiveRo {
  const process = coreProcess ?? "Xử lý yêu cầu khách hàng";
  return FiveRoSchema.parse({
    process,
    steps: [
      { step: "Tiếp nhận yêu cầu", role_R: "Nhân viên trực", role_A: "Trưởng nhóm", role_C: "", role_I: "Quản trị DX", standard: "Có mã yêu cầu trong 5 phút; đủ tên, số điện thoại, mô tả", tool: "Biểu mẫu tiếp nhận" },
      { step: "Phân công xử lý", role_R: "Trưởng nhóm", role_A: "Trưởng nhóm", role_C: "Nhân viên", role_I: "Khách hàng", standard: "Phân công trong 30 phút; mỗi yêu cầu đúng một người xử lý", tool: "Bảng kanban" },
      { step: "Xử lý và cập nhật", role_R: "Nhân viên xử lý", role_A: "Nhân viên xử lý", role_C: "Trưởng nhóm", role_I: "Khách hàng", standard: "Cập nhật trạng thái mỗi lần chuyển bước; không đóng khi chưa có người xử lý", tool: "Màn hình chi tiết yêu cầu" },
      { step: "Đóng và thông báo", role_R: "Nhân viên xử lý", role_A: "Trưởng nhóm", role_C: "", role_I: "Khách hàng, Lãnh đạo", standard: "Đóng trong hạn SLA; khách hàng nhận thông báo", tool: "Workflow thông báo" },
    ],
  });
}

export function buildPokaYoke(_coreProcess: string | null): PokaYoke {
  return PokaYokeSchema.parse({
    pokaYoke: [
      { point: "Nhập số điện thoại", rule: "Chỉ nhận 10 chữ số bắt đầu bằng 0; sai thì không cho gửi", layer: 1 },
      { point: "Trường bắt buộc", rule: "Tối đa 5 trường bắt buộc; các trường khác có giá trị mặc định", layer: 1 },
      { point: "Đóng yêu cầu", rule: "Không cho chuyển sang Đã đóng khi chưa có người xử lý", layer: 2 },
      { point: "Quá hạn SLA", rule: "Sau 24 giờ chưa xử lý thì gửi cảnh báo tới kênh phê duyệt", layer: 2 },
      { point: "Kho tài nguyên", rule: "Toàn bộ nhân viên chỉ đọc; chỉ quản trị mới sửa", layer: 3 },
      { point: "Dữ liệu cá nhân", rule: "Che số điện thoại trên bảng điều khiển", layer: 3 },
    ],
  });
}

export type Prescriptions = { roadmap: Roadmap; discrepancy: DiscrepancyQuestions; fiveRo: FiveRo; pokaYoke: PokaYoke; provider: string; fallback: boolean };

/** Returns cached prescriptions for a closed assessment, building the rule-based set on first call. */
export function getOrBuildPrescriptions(db: Database.Database, assessmentId: string): Prescriptions {
  const a = repo.getAssessment(db, assessmentId);
  const res = repo.getResult(db, assessmentId);
  if (!a || !res) throw new Error("assessment not closed");
  const result = res.payload as ResultV1;
  const cached = repo.getPrescription(db, assessmentId, "roadmap");
  if (cached) {
    return {
      roadmap: RoadmapSchema.parse(cached.payload),
      discrepancy: DiscrepancySchema.parse(repo.getPrescription(db, assessmentId, "discrepancy")!.payload),
      fiveRo: FiveRoSchema.parse(repo.getPrescription(db, assessmentId, "fiveRo")!.payload),
      pokaYoke: PokaYokeSchema.parse(repo.getPrescription(db, assessmentId, "pokaYoke")!.payload),
      provider: cached.provider, fallback: cached.fallback,
    };
  }
  const started = Date.now();
  const built = { roadmap: buildRoadmap(result), discrepancy: buildDiscrepancyQuestions(result), fiveRo: buildFiveRo(a.coreProcess), pokaYoke: buildPokaYoke(a.coreProcess) };
  for (const kind of ["roadmap", "discrepancy", "fiveRo", "pokaYoke"] as const) {
    repo.savePrescription(db, { assessmentId, kind, provider: "none", model: null, payload: built[kind], fallback: true, tokensIn: 0, tokensOut: 0, latencyMs: Date.now() - started });
  }
  return { ...built, provider: "none", fallback: true };
}
```

- [ ] **Step 4: Route and page**

`apps/web/src/app/api/pulse/assessments/[id]/prescription/route.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getOrBuildPrescriptions } from "@/lib/prescribe";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(getOrBuildPrescriptions(getDb(), id));
  } catch {
    return NextResponse.json({ error: "assessment not closed" }, { status: 409 });
  }
}
```

`apps/web/src/app/pulse/a/[id]/prescription/page.tsx`:
```tsx
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
            <li key={ph.axis} className="border-l-4 pl-3" style={{ borderColor: { P: "#16a34a", D: "#f59e0b", I: "#7c3aed" }[ph.axis] }}>
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
```

- [ ] **Step 5: Run, typecheck, commit**

`npx vitest run apps/web/test/prescribe.test.ts` (4 passed); `npm run typecheck`.

```bash
git add apps/web && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(web): rule-based prescriptions with shared schemas and cached rows"
```

---

### Task 8: P.A.R.A discipline kit (tree model, zip, preview, download)

**Files:**
- Create: `apps/web/src/lib/kit/para.ts`, `apps/web/src/app/api/pulse/assessments/[id]/kit/route.ts`, `apps/web/src/app/pulse/a/[id]/kit/page.tsx`, `apps/web/src/app/pulse/a/[id]/kit/KitForm.tsx`, `apps/web/src/components/KitTree.tsx`
- Test: `apps/web/test/para.test.ts`

**Interfaces:**
- Produces: `buildTree(input: { shortCode; departments: {code; name}[]; projects: string[]; coreProcess: string | null }): KitNode` (`{ name; children?: KitNode[]; content?: string }`), `flatten(tree): string[]` (paths), `buildZip(tree, files: { fiveRo; pokaYoke }): Promise<Buffer>`; the tree is exactly M0 spec §7 (00. Portal is added by the planner, not the kit).
- API: `POST /api/pulse/assessments/:id/kit` body `{ projects: string[] }` → builds zip to `<dataDir>/artifacts/<id>/para-kit.zip`, records artifact, returns `{ path, sizeBytes, tree }`; `GET` streams the zip (`application/zip`, `Content-Disposition: attachment; filename="para-kit.zip"`) or 404.

- [ ] **Step 1: Failing tests**

`apps/web/test/para.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildTree, buildZip, flatten } from "../src/lib/kit/para.js";
import { buildFiveRo, buildPokaYoke } from "../src/lib/prescribe.js";

const input = { shortCode: "abc", departments: [{ code: "cskh", name: "Chăm sóc khách hàng" }, { code: "kd", name: "Kinh doanh" }], projects: ["Website mới"], coreProcess: "Xử lý yêu cầu khách hàng" };

describe("buildTree", () => {
  it("produces the book's P.A.R.A layout with one folder per project and department", () => {
    const paths = flatten(buildTree(input));
    expect(paths[0]).toBe("[ABC] DX-OS");
    for (const p of ["[ABC] DX-OS/1. [P] PROJECTS/Website mới/README.md", "[ABC] DX-OS/2. [A] AREAS/Chăm sóc khách hàng/README.md", "[ABC] DX-OS/2. [A] AREAS/Kinh doanh/README.md",
      "[ABC] DX-OS/3. [R] RESOURCES/10. GOVERNANCE/11. Policies_Regulations", "[ABC] DX-OS/3. [R] RESOURCES/10. GOVERNANCE/14. Templates_Forms", "[ABC] DX-OS/3. [R] RESOURCES/20. EXPERIENCE/21. Case_Studies",
      "[ABC] DX-OS/3. [R] RESOURCES/30. EDUCATION/34. Reading_List", "[ABC] DX-OS/3. [R] RESOURCES/40. ASSETS/41. Structured_Data", "[ABC] DX-OS/3. [R] RESOURCES/40. ASSETS/44. Versioned_Assets",
      "[ABC] DX-OS/4. [A] ARCHIVES/README.md", "[ABC] DX-OS/NAMING_CONVENTION.md", "[ABC] DX-OS/POKA_YOKE.md", "[ABC] DX-OS/5RO_Xu_ly_yeu_cau_khach_hang.md"]) {
      expect(paths, p).toContain(p);
    }
  });
  it("every branch has a README and no path contains characters illegal in Nextcloud or Drive", () => {
    const paths = flatten(buildTree(input));
    expect(paths.filter((p) => p.endsWith("/README.md")).length).toBeGreaterThanOrEqual(8);
    expect(paths.every((p) => !/[<>:"|?*\\]/.test(p))).toBe(true);
  });
});

describe("buildZip", () => {
  it("contains every file of the tree with non-empty markdown", async () => {
    const tree = buildTree(input);
    const zip = await JSZip.loadAsync(await buildZip(tree, { fiveRo: buildFiveRo(input.coreProcess), pokaYoke: buildPokaYoke(input.coreProcess) }));
    const files = Object.keys(zip.files).filter((f) => !zip.files[f].dir);
    expect(files).toContain("[ABC] DX-OS/NAMING_CONVENTION.md");
    expect((await zip.file("[ABC] DX-OS/5RO_Xu_ly_yeu_cau_khach_hang.md")!.async("string")).length).toBeGreaterThan(100);
    expect((await zip.file("[ABC] DX-OS/2. [A] AREAS/Kinh doanh/README.md")!.async("string"))).toContain("Kinh doanh");
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: para.ts**

`apps/web/src/lib/kit/para.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import JSZip from "jszip";
import type { FiveRo, PokaYoke } from "../prescribe.js";

export type KitNode = { name: string; children?: KitNode[]; content?: string };
export type KitInput = { shortCode: string; departments: { code: string; name: string }[]; projects: string[]; coreProcess: string | null };

const RESOURCES: [string, string[]][] = [
  ["10. GOVERNANCE", ["11. Policies_Regulations", "12. SOP_Processes", "13. Technical_Manuals", "14. Templates_Forms"]],
  ["20. EXPERIENCE", ["21. Case_Studies", "22. Lessons_Learned", "23. Customer_Feedback", "24. Meeting_Notes"]],
  ["30. EDUCATION", ["31. Onboarding", "32. Training_Materials", "33. Industry_Knowledge", "34. Reading_List"]],
  ["40. ASSETS", ["41. Structured_Data", "42. Unstructured_Data", "43. Brand_Media", "44. Versioned_Assets"]],
];

const safe = (s: string) => s.replace(/[<>:"|?*\\/]/g, "-").trim();
export const slugAscii = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");

const readme = (title: string, purpose: string, rules: string[]) => `# ${title}\n\n${purpose}\n\n## Quy tắc\n\n${rules.map((r) => `- ${r}`).join("\n")}\n`;
const dir = (name: string, purpose: string, rules: string[], children: KitNode[] = []): KitNode => ({ name, children: [{ name: "README.md", content: readme(name, purpose, rules) }, ...children] });

export function buildTree(input: KitInput): KitNode {
  const root = `[${input.shortCode.toUpperCase()}] DX-OS`;
  const projects = dir("1. [P] PROJECTS", "Việc có ngày kết thúc và kết quả cụ thể.", ["Mỗi dự án một thư mục; xong thì chuyển sang ARCHIVES.", "Tên thư mục: YYYY-MM_Ten_du_an."],
    input.projects.filter(Boolean).map((p) => dir(safe(p), `Dự án ${p}.`, ["Kế hoạch, biên bản, sản phẩm bàn giao để ở đây."])));
  const areas = dir("2. [A] AREAS", "Trách nhiệm dài hạn theo phòng ban.", ["Phòng nào tự quản thư mục phòng đó.", "Không lưu tài liệu tham khảo chung ở đây; đưa sang RESOURCES."],
    input.departments.map((d) => dir(safe(d.name), `Khu vực làm việc của phòng ${d.name} (${d.code}).`, ["Hồ sơ đang hoạt động của phòng.", "Quy trình chuẩn của phòng tham chiếu sang RESOURCES/10. GOVERNANCE/12. SOP_Processes."])));
  const resources = dir("3. [R] RESOURCES", "Kho tri thức dùng chung, chỉ đọc với toàn bộ nhân sự.", ["Chỉ quản trị viên được sửa.", "Mọi tài liệu có phiên bản và ngày."],
    RESOURCES.map(([g, subs]) => dir(g, `Nhóm ${g}.`, ["Đặt tài liệu đúng nhánh con."], subs.map((s) => ({ name: s, children: [{ name: "README.md", content: readme(s, `Nhánh ${s}.`, ["Tên tệp: YYYY-MM-DD_Ten_tai_lieu_vX.md"]) }] })))));
  const archives = dir("4. [A] ARCHIVES", "Những gì đã xong hoặc không còn dùng.", ["Chỉ quản trị viên chuyển vào đây.", "Không xoá; lưu trữ là lịch sử của tổ chức."]);
  const naming = { name: "NAMING_CONVENTION.md", content: `# Quy ước đặt tên\n\n## Kịch bản 1: tài liệu theo thời gian\n\n\`YYYY-MM-DD_Loai_Tieu_de_vX.ext\` — ví dụ \`2026-09-10_BienBan_Hop_giao_ban_v1.md\`.\n\n## Kịch bản 2: tài liệu theo đối tượng\n\n\`DoiTuong_MaDoiTuong_Loai_vX.ext\` — ví dụ \`KhachHang_KH0421_HopDong_v2.pdf\`.\n\n## Chung\n\n- Không dấu, không khoảng trắng trong tên tệp; dùng gạch dưới.\n- Phiên bản tăng dần; không ghi đè bản cũ trong RESOURCES.\n- Thư mục trong P.A.R.A giữ nguyên tiền tố số.\n` };
  const fiveRoName = `5RO_${slugAscii(input.coreProcess ?? "Quy_trinh_loi")}.md`;
  return { name: root, children: [projects, areas, resources, archives, naming, { name: "POKA_YOKE.md", content: "" }, { name: fiveRoName, content: "" }] };
}

export function flatten(tree: KitNode, prefix = ""): string[] {
  const path = prefix ? `${prefix}/${tree.name}` : tree.name;
  return [path, ...(tree.children ?? []).flatMap((c) => flatten(c, path))];
}

function fiveRoMarkdown(f: FiveRo): string {
  return `# Ma trận 5 RÕ: ${f.process}\n\n| Bước | R (làm) | A (chịu trách nhiệm) | C (tham vấn) | I (được báo) | Tiêu chuẩn | Công cụ |\n|---|---|---|---|---|---|---|\n${f.steps.map((s) => `| ${s.step} | ${s.role_R} | ${s.role_A} | ${s.role_C || "–"} | ${s.role_I} | ${s.standard} | ${s.tool} |`).join("\n")}\n`;
}
function pokaYokeMarkdown(p: PokaYoke): string {
  return `# Poka-yoke\n\n${[1, 2, 3].map((l) => `## Lớp ${l}\n\n${p.pokaYoke.filter((x) => x.layer === l).map((x) => `- **${x.point}**: ${x.rule}`).join("\n")}\n`).join("\n")}`;
}

export async function buildZip(tree: KitNode, files: { fiveRo: FiveRo; pokaYoke: PokaYoke }): Promise<Buffer> {
  const zip = new JSZip();
  const walk = (n: KitNode, prefix: string) => {
    const path = prefix ? `${prefix}/${n.name}` : n.name;
    if (n.children) { zip.folder(path); n.children.forEach((c) => walk(c, path)); return; }
    let content = n.content ?? "";
    if (n.name === "POKA_YOKE.md") content = pokaYokeMarkdown(files.pokaYoke);
    if (n.name.startsWith("5RO_")) content = fiveRoMarkdown(files.fiveRo);
    zip.file(path, content);
  };
  walk(tree, "");
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
```

- [ ] **Step 4: Route, page, components**

`apps/web/src/app/api/pulse/assessments/[id]/kit/route.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from "next/server";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { buildTree, buildZip, flatten } from "@/lib/kit/para";
import { buildFiveRo, buildPokaYoke, getOrBuildPrescriptions } from "@/lib/prescribe";
import * as repo from "@/lib/repo";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const db = getDb();
  const a = repo.getAssessment(db, id);
  const org = repo.getOrganization(db);
  if (!a || !org) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = z.object({ projects: z.array(z.string().max(80)).max(50).default([]) }).safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const tree = buildTree({ shortCode: org.shortCode, departments: org.departments, projects: body.data.projects, coreProcess: a.coreProcess });
  const p = repo.getResult(db, id) ? getOrBuildPrescriptions(db, id) : null;
  const zip = await buildZip(tree, { fiveRo: p?.fiveRo ?? buildFiveRo(a.coreProcess), pokaYoke: p?.pokaYoke ?? buildPokaYoke(a.coreProcess) });
  const dir = join(getEnv().dataDir, "artifacts", id);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "para-kit.zip");
  writeFileSync(path, zip);
  repo.saveArtifact(db, { assessmentId: id, kind: "para-kit", path, sizeBytes: zip.length });
  return NextResponse.json({ path, sizeBytes: zip.length, tree: flatten(tree) }, { status: 201 });
}

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const art = repo.getArtifact(getDb(), id, "para-kit");
  if (!art) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new Response(readFileSync(art.path), { headers: { "content-type": "application/zip", "content-disposition": 'attachment; filename="para-kit.zip"' } });
}
```

`apps/web/src/components/KitTree.tsx`:
```tsx
// SPDX-License-Identifier: AGPL-3.0-or-later
export function KitTree({ paths }: { paths: string[] }) {
  return (
    <pre className="text-xs font-mono overflow-x-auto p-3 rounded-md border border-border">
      {paths.map((p) => { const depth = p.split("/").length - 1; return `${"  ".repeat(depth)}${depth ? "└ " : ""}${p.split("/").pop()}\n`; }).join("")}
    </pre>
  );
}
```

`apps/web/src/app/pulse/a/[id]/kit/page.tsx`:
```tsx
// SPDX-License-Identifier: AGPL-3.0-or-later
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { vi } from "@/lib/i18n.vi";
import { buildTree, flatten } from "@/lib/kit/para";
import * as repo from "@/lib/repo";
import { KitForm } from "./KitForm";

export const dynamic = "force-dynamic";

export default async function KitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const a = repo.getAssessment(db, id);
  const org = repo.getOrganization(db);
  if (!a || !org) notFound();
  const preview = flatten(buildTree({ shortCode: org.shortCode, departments: org.departments, projects: [], coreProcess: a.coreProcess }));
  const existing = repo.getArtifact(db, id, "para-kit");
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3"><Link href={`/pulse/a/${id}`} className="text-sm text-muted">← {vi.common.back}</Link><h1 className="text-2xl font-semibold">{vi.kit.title}</h1></div>
      <KitForm id={id} initialPreview={preview} hasArtifact={!!existing} />
    </div>
  );
}
```

`apps/web/src/app/pulse/a/[id]/kit/KitForm.tsx`:
```tsx
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
  async function build() {
    setMsg(null);
    const r = await fetch(`/api/pulse/assessments/${id}/kit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projects: projects.split("\n").map((s) => s.trim()).filter(Boolean) }) });
    if (!r.ok) return setMsg(vi.common.error);
    const data = await r.json();
    setPreview(data.tree); setReady(true); setMsg(vi.kit.built);
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card p-4 flex flex-col gap-3">
        <label className="text-sm">{vi.kit.projects}<textarea className="input mt-1 min-h-32" value={projects} onChange={(e) => setProjects(e.target.value)} /></label>
        <button className="btn btn-primary" onClick={build}>{vi.kit.build}</button>
        {ready && <a className="btn btn-secondary" href={`/api/pulse/assessments/${id}/kit`}>{vi.kit.download}</a>}
        {msg && <p className="text-sm text-verify" role="status">{msg}</p>}
      </div>
      <div className="card p-4"><h2 className="font-medium mb-2">{vi.kit.preview}</h2><KitTree paths={preview} /></div>
    </div>
  );
}
```

- [ ] **Step 5: Run, typecheck, commit**

`npx vitest run apps/web/test/para.test.ts` (3 passed); `npm run typecheck`.

```bash
git add apps/web && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(web): P.A.R.A discipline kit builder, preview and download"
```

---

### Task 9: About page, Dockerfile and compose, BUILDING/CHANGELOG

**Files:**
- Create: `apps/web/src/app/about/page.tsx`, `apps/web/Dockerfile`, `deploy/docker-compose.wizard.yml`, `deploy/.env.example`
- Modify: `BUILDING.md`, `CHANGELOG.md`, `.dockerignore` (create)

- [ ] **Step 1: About page**

`apps/web/src/app/about/page.tsx`:
```tsx
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
```

- [ ] **Step 2: Docker**

`.dockerignore` (root):
```
node_modules
**/node_modules
**/.next
**/dist
.dxforge
.git
docs
```

`apps/web/Dockerfile`:
```dockerfile
# SPDX-License-Identifier: AGPL-3.0-or-later
FROM node:22-bookworm-slim AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY packages/hpdi-engine/package.json packages/hpdi-engine/
COPY packages/forge-core/package.json packages/forge-core/
COPY apps/cli/package.json apps/cli/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY . .
RUN cd apps/web && FORGE_ADMIN_PASSWORD=build FORGE_SESSION_SECRET=build-only-secret-0000 npx next build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production FORGE_DATA_DIR=/data
COPY --from=build /src/apps/web/.next/standalone ./
COPY --from=build /src/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /src/apps/web/public ./apps/web/public
COPY --from=build /src/apps/web/src/lib/schema.sql ./apps/web/src/lib/schema.sql
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

`deploy/docker-compose.wizard.yml`:
```yaml
# SPDX-License-Identifier: AGPL-3.0-or-later
# The DX-Forge wizard itself. Targets (Keycloak, Nextcloud, ...) are separate stacks added in plan 04.
services:
  wizard:
    build: { context: .., dockerfile: apps/web/Dockerfile }
    image: dx-forge/wizard:${TAG:-dev}
    env_file: .env
    ports: ["${WIZARD_PORT:-3000}:3000"]
    volumes: ["wizard-data:/data"]
    restart: unless-stopped
volumes:
  wizard-data: {}
```

`deploy/.env.example`: same keys as `apps/web/.env.example` plus `WIZARD_PORT=3000`, `TAG=dev`.

- [ ] **Step 3: Docs**

`BUILDING.md`: add a "Wizard" section:
```markdown
## Wizard (measurement UI)

```bash
cp apps/web/.env.example apps/web/.env   # set FORGE_ADMIN_PASSWORD and FORGE_SESSION_SECRET
npm run web:dev                          # http://localhost:3000, data in ./.dxforge
npm run web:build && npm run web:start   # production build
```

Docker: `cp deploy/.env.example deploy/.env`, edit it, then `docker compose -f deploy/docker-compose.wizard.yml up -d --build`. Data (SQLite + artifacts) lives in the `wizard-data` volume.
```
`CHANGELOG.md` Unreleased → add `web: measurement wizard (survey, radar, prescriptions, P.A.R.A kit), /api/pulse/latest` and `forge-core: resultToMaturity`.

- [ ] **Step 4: Verify and commit**

```bash
npm run typecheck && docker build -f apps/web/Dockerfile -t dx-forge/wizard:dev . && docker run --rm -e FORGE_ADMIN_PASSWORD=x -e FORGE_SESSION_SECRET=0123456789abcdef -p 3100:3000 -d --name forge-smoke dx-forge/wizard:dev && sleep 5 && curl -fsS http://localhost:3100/api/health && docker rm -f forge-smoke
```
Expected: `{"ok":true,"app":"dx-forge-web"}`. If Docker is unavailable on the machine, report it and skip the smoke (CI does not build the image in this plan).

```bash
git add apps/web/src/app/about apps/web/Dockerfile deploy .dockerignore BUILDING.md CHANGELOG.md
git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(web): about page, Dockerfile and compose for the wizard"
```

---

### Task 10: Playwright end-to-end smoke and CI job

**Files:**
- Create: `apps/web/playwright.config.ts`, `apps/web/e2e/pulse.spec.ts`
- Modify: `.github/workflows/ci.yml` (job `e2e`)

- [ ] **Step 1: Config**

`apps/web/playwright.config.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig, devices } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = process.env.E2E_DATA_DIR ?? mkdtempSync(join(tmpdir(), "dxforge-e2e-"));

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }, { name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "npx next dev -p 3100",
    url: "http://localhost:3100/api/health",
    reuseExistingServer: false,
    env: { FORGE_ADMIN_PASSWORD: "e2e-pass", FORGE_SESSION_SECRET: "e2e-secret-0123456789", FORGE_DATA_DIR: dataDir, FORGE_BASE_URL: "http://localhost:3100" },
  },
});
```

- [ ] **Step 2: Spec**

`apps/web/e2e/pulse.spec.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import JSZip from "jszip";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Mật khẩu quản trị").fill("e2e-pass");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/pulse/);
}

async function answerAll(request: APIRequestContext, url: string, scale: number, supp: number) {
  const token = url.split("/").pop()!;
  const q = await (await request.get(`/api/pulse/survey/${token}`)).json();
  const answers = Object.fromEntries(q.questions.map((x: { id: string; type: string; options?: { value: number }[] }) => [x.id, x.type === "supp" ? (x.options!.find((o) => o.value === supp) ? supp : x.options![0].value) : scale]));
  const r = await request.post(`/api/pulse/survey/${token}`, { data: { answers } });
  expect(r.status()).toBe(201);
}

test("gate: /pulse redirects to login; survey link works without login", async ({ page }) => {
  await page.goto("/pulse");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/pulse/s/not-a-token");
  await expect(page.getByText("hết hạn")).toBeVisible();
});

test("full round: organisation → links → answers → close → radar → prescriptions → kit", async ({ page, request }) => {
  await login(page);
  await page.goto("/pulse/new");
  await page.getByLabel("Tên tổ chức").fill("Công ty E2E");
  await page.getByLabel(/Mã ngắn/).fill("e2e");
  await page.getByLabel("Ngành").fill("retail");
  await page.getByLabel(/Phòng ban/).fill("cskh, Chăm sóc khách hàng\nkd, Kinh doanh");
  await page.getByLabel(/Quy trình lõi/).fill("Xử lý yêu cầu khách hàng");
  await page.getByRole("button", { name: "Mở đợt đo" }).click();
  await expect(page).toHaveURL(/\/pulse\/a\//);
  const id = page.url().split("/").pop()!;

  // survey page renders one question per screen on this device
  const links = (await (await page.request.get(`/api/pulse/assessments/${id}`)).json()).links as { tier: string; url: string }[];
  await page.goto(links.find((l) => l.tier === "staff")!.url);
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await expect(page.getByText(/Câu 1\//)).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.evaluate(() => document.documentElement.clientWidth));

  // answer via API for all three tiers, then close
  await answerAll(page.request, links.find((l) => l.tier === "executive")!.url, 4, 1);
  await answerAll(page.request, links.find((l) => l.tier === "manager")!.url, 3, 0.66);
  await answerAll(page.request, links.find((l) => l.tier === "staff")!.url, 2, 0.33);
  await page.goto(`/pulse/a/${id}`);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Chốt đợt đo" }).click();
  await expect(page.getByText("Radar HPDI").or(page.getByText(/Mức DTI/))).toBeVisible();
  await expect(page.getByText(/Mức DTI \d\/5/)).toBeVisible();

  // the closed round refuses new answers
  const late = await page.request.post(`/api/pulse/survey/${links[0].url.split("/").pop()}`, { data: { answers: {} } });
  expect(late.status()).toBe(410);

  // prescriptions
  await page.getByRole("link", { name: "Kê đơn" }).click();
  await expect(page.getByText("Lộ trình P → D → I")).toBeVisible();
  await expect(page.getByText(/Ma trận 5 RÕ: Xử lý yêu cầu khách hàng/)).toBeVisible();

  // kit
  await page.goto(`/pulse/a/${id}/kit`);
  await page.getByLabel(/Dự án đang chạy/).fill("Website mới");
  await page.getByRole("button", { name: "Tạo bộ kỷ luật" }).click();
  await expect(page.getByText("Đã tạo bộ kỷ luật.")).toBeVisible();
  const zip = await JSZip.loadAsync(await (await page.request.get(`/api/pulse/assessments/${id}/kit`)).body());
  expect(Object.keys(zip.files)).toContain("[E2E] DX-OS/1. [P] PROJECTS/Website mới/README.md");
  expect(Object.keys(zip.files)).toContain("[E2E] DX-OS/3. [R] RESOURCES/40. ASSETS/41. Structured_Data/README.md");

  // latest for the interview stage
  const latest = await (await page.request.get("/api/pulse/latest")).json();
  expect(latest.maturity.assessment_id).toBe(id);
  expect(["spear", "kite", "illusion", "diamond", "transitional"]).toContain(latest.maturity.shape);
});
```

- [ ] **Step 3: CI job**

Append to `.github/workflows/ci.yml`:
```yaml
  e2e:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: apps/web/playwright-report }
```

- [ ] **Step 4: Run locally, commit**

```bash
npx playwright install chromium   # once
npm run e2e
```
Expected: 4 passed (2 tests × desktop + mobile). Paste the summary in the report.

```bash
git add apps/web/playwright.config.ts apps/web/e2e .github/workflows/ci.yml
git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "test(web): Playwright end-to-end smoke on desktop and mobile, CI job"
```

---

## Self-review

**Spec coverage (M0 spec):** §2 block 1 survey three tiers with links and discrepancy → Tasks 4–6; block 2 engine, radar, shapes, level → plan 01 + Task 6; block 3 prescriptions (rule-based fallbacks of §6.2; AI adapters are plan 03) → Task 7; block 4 kit zip + preview → Task 8; block 5 history by round (radar overlay of the last rounds) → Task 6 `PulsePage`. §3 architecture (one container, engine as a package, SQLite in `.dxforge`, admin password auth, survey token-only) → Tasks 1–3, 9. §4 data model, all eight tables and both unique constraints → Task 2; closing event + notifier → Task 5. §7 tree → Task 8 (all four RESOURCES groups with 16 leaves, NAMING_CONVENTION, POKA_YOKE, 5RO). §8 pages → Tasks 3, 6, 7, 8, 9 (`/pulse`, `/pulse/a/[id]`, `/prescription`, `/kit`, `/pulse/s/[token]`, `/about`, `/login`). §9 open-source compliance (Docker, env-only config) → Task 9; §10 E2E and mobile → Task 10; §13 `GET /api/pulse/latest` + maturity → Task 5. Not in this plan: askReport (needs an LLM → plan 03), OIDC login via Keycloak (plan 04, once a target exists), the admin LLM stats page (data is collected via `llmStats`; the page comes with plan 03).

**Placeholder scan:** none. The two `ponytail:` notes name their follow-up (schema.sql packaging check in Task 9; `dist` packaging in plan 08).

**Type consistency:** `repo.Tier` and `hpdi-engine.Tier` are the same string union; `closeRound` returns `ResultV1` from the engine and `resultToMaturity` (forge-core) accepts a structural subset of it; `PublicQuestion` (Task 4) is what `SurveyForm` renders; the prescription schemas (Task 7) are the contract plan 03's LLM output must satisfy and the kit (Task 8) consumes `FiveRo`/`PokaYoke` from them; `radarSeries` reads `ResultV1.supp` and `pillars[*].byTier`, both present since plan 01.
