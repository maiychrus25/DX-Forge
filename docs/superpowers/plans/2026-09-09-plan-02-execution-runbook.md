# Plan 02 — Execution runbook (subagent dispatch)

Companion to `2026-09-09-plan-02-measure-wizard.md`. That file is **what** to build; this file is
**how the work is handed out and accepted**. The plan stays the single source of truth for code: if
this runbook and the plan disagree about a file's contents, the plan wins and the disagreement is
reported.

Orchestrator: the session that dispatches tasks and runs the acceptance gate.
Workers: one subagent per task, model Sonnet, executing exactly one task then stopping.

---

## 1. Pre-flight (verified 2026-09-09, do not re-verify)

The orchestrator ran these before dispatch. Workers should trust them and must report immediately if
reality differs.

| Fact | Value | Consequence |
|---|---|---|
| Node / npm | v24.18.0 / 11.16.0 | Plan's `>=22` satisfied. CI pins Node 22; do not add a Node 24 dependency. |
| Baseline suite | 104 tests green, `typecheck` clean | Any red test after your change is **yours**. |
| Branch | `develop`, 1 commit ahead of `origin/develop` | Never commit to `main`. Never push. |
| `next` on registry | 16.3.4 | Plan's `^16.0.0` resolves. |
| `react` / `react-dom` | 19.2.8 | Plan's `^19.0.0` resolves. |
| `tailwindcss` | 4.3.3 | Plan's `^4.1.0` resolves. |
| `recharts` | 3.10.1 | Plan's `^3.0.0` resolves. |
| `@playwright/test` | 1.63.0 | Plan's `^1.55.0` resolves. |
| `better-sqlite3` | `^12.2.0` → 12.11.1, engines include Node 24 | Verified: binding loads and executes SQL on this machine **despite** npm's `allow-scripts` warning, because 12.x ships a prebuilt binary. Do not "fix" this warning, do not add `--allow-scripts`, do not switch to v13. |
| `zod` installed | 3.25.76 (v3 line) | `apps/web` must use `^3.24.0` as the plan says. **Do not install zod 4** — registry latest is 4.5.4 and would split the workspace. |
| Native build tools | python3, make, g++ present | Fallback compile possible if a prebuild is ever missing. |

---

## 2. Non-negotiable rules (from `AGENTS.md`, condensed)

Every worker prompt embeds this list. A worker that breaks one has failed the task even if tests pass.

1. **Scope.** Implement exactly your task: its `Files:` list, its tests, its one commit. Do not
   touch files outside that list. No refactoring, renaming or reformatting of neighbouring code.
2. **No unplanned dependencies.** Only packages named in your task. Need another? Stop and report.
3. **Test-first.** Write the failing test exactly as the plan gives it → run it → confirm it fails
   for the expected reason (paste the output) → minimal implementation → run again → green.
4. **Never weaken a test or a schema to get green.** If you believe a test is wrong, report it.
5. **Language.** Code, identifiers, comments, tests, commit messages: English. Strings shown to end
   users: Vietnamese, and only inside `apps/web/src/lib/i18n.vi.ts` — never inline in JSX.
6. **SPDX.** First line of every `.ts`/`.tsx`/`.js`/`.mjs`/`.sql`/`.sh` you create:
   `// SPDX-License-Identifier: AGPL-3.0-or-later` (`--` for `.sql`, `#` for `.sh`/`.yaml`,
   `/* */` for `.css`). CI fails without it.
7. **ESM with `.js` suffixes** in relative TypeScript imports; `@/*` alias inside `apps/web`.
8. **Secrets.** Never write a credential, token or password into code, tests, fixtures, YAML, logs
   or commit messages. Never commit `.dxforge/`, `node_modules/`, `.next/`, generated `plan.yaml`.
9. **Green before commit.** `npm test` and `npm run typecheck` must both pass on the **whole**
   repository, not just your files.
10. **Commit.** Exactly one, on `develop`, with the message the plan gives, using:
    ```bash
    git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "<message>"
    ```
    **No trailers.** No `Co-Authored-By`, no `Signed-off-by`, no tool or AI attribution. Subject and
    optional body only. `git add` only your task's files. **Never `git push`.**
11. **Report honestly.** Say what you ran and what it printed. Never "should work" or "probably
    passes". If something is impossible, finish everything else and report the exact command and
    error.

---

## 3. Dependency graph and order

```
T1 scaffold
 ├─► T2 db + repo ──► T4 survey ──► T5 rounds/latest ──► T6 dashboards ──► T7 prescriptions ──► T8 kit
 ├─► T3 auth                                                                                      │
 └─► T9 about + docker ◄──────────────────────────────────────────────────────────────────────────┘
                                                                                                  │
                                                                              T10 e2e + CI ◄───────┘
```

**Execution is strictly sequential: T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10.**

T3 and T9 are logically parallelisable, but every task appends keys to the single
`apps/web/src/lib/i18n.vi.ts` and several touch root `package.json`, so concurrent workers would
collide on the same lines. One worker at a time; the orchestrator gates between them.

Cross-task couplings a worker must not break:

| Producer | Consumer | Contract |
|---|---|---|
| T1 | all | `vi` strings object, `getEnv()`, `@/*` alias, design tokens in `globals.css` |
| T2 | T4–T8 | `openDb(path)`, `getDb()`, `Repo` functions, the eight spec §4 tables |
| T3 | T10 | `SESSION_COOKIE`, `signSession`/`verifySession`, `isPublicPath` |
| T4 | T5, T10 | `questionsForTier`, `validateAnswers`, `linkState` |
| T5 | T6, T7, T8 | persisted `results` row, `GET /api/pulse/latest`, `toMaturity` in forge-core |
| T7 | T8 | `FiveRo` and `PokaYoke` shapes are written into the kit zip |

---

## 4. Dispatch cards

Every worker prompt is built from this template:

> Read `AGENTS.md` completely, then read **only** `### Task N` of
> `docs/superpowers/plans/2026-09-09-plan-02-measure-wizard.md` plus that plan's
> "Global Constraints" and "File structure" sections. Implement that task and only that task,
> step by step, test-first. Do not read or implement other tasks.
> [rules digest from §2] [pre-flight facts from §1] [task-specific notes below]
> Finish with the four commands in `AGENTS.md` §7 and report in that order.

| # | Task | Commit message | Task-specific note for the worker |
|:-:|---|---|---|
| 1 | scaffold, DESIGN.md, root scripts | `feat(web): scaffold Next.js wizard with design tokens, i18n strings and env parsing` | `next-env.d.ts` is generated by the first `next build`; run `npx next typegen` in `apps/web` if `tsc` complains. Add it to `.gitignore`, do not commit it. Copy the two brand assets from `docs/brand/`. |
| 2 | SQLite schema, `openDb`, repo | `feat(web): sqlite schema, openDb and typed repository` | This task is allowed to modify **two lines** of `docs/superpowers/specs/2026-09-09-m0-measurement-design.md` (Prisma → better-sqlite3, §3 and the §4 heading). That is the only docs edit any worker may make. Tests use `openDb(":memory:")`. |
| 3 | admin auth | `feat(web): admin password login with signed session cookie and route gate` | Constant-time password compare. Cookie `HttpOnly; SameSite=Lax; Path=/`, 12 h. Survey paths `/pulse/s/**` and `/api/pulse/survey/**` must stay public — a regression here silently breaks T4 and T10. |
| 4 | survey API + page | `feat(web): anonymous survey API and one-question-per-screen survey page` | No IP, no user-agent, no identifying cookie is stored. `questionsForTier` must not leak `pillar`, `weightEvidence` or `supp.axis` to the client. Closed round → 409. |
| 5 | rounds, latest, notifier | `feat(web): open and close rounds, latest result with maturity block, notifier` | Also touches `packages/forge-core` (new `maturity.ts` + index export). `InsufficientResponses` → HTTP 409 with the exact Vietnamese sentence in Global Constraints; the round stays open. |
| 6 | dashboards, radar, pillar table | `feat(web): organisation and round dashboards with HPDI radar and pillar table` | Axis colours are fixed: H `#64748B`, P `#16A34A`, D `#F59E0B`, I `#7C3AED`, in the order H, P, D, I. Radar needs a table twin for screen readers. Run `next build` in this task's gate, not just tests. |
| 7 | rule-based prescriptions | `feat(web): rule-based prescriptions with shared schemas and cached rows` | Export `RoadmapSchema`, `DiscrepancySchema`, `FiveRoSchema`, `PokaYokeSchema` — plan 03's LLM output must satisfy the same schemas. Cache rows with `provider: "none", fallback: true`. No AI in this task. |
| 8 | P.A.R.A kit | `feat(web): P.A.R.A discipline kit builder, preview and download` | Tree is exactly M0 spec §7. `00. Portal` belongs to the planner, **not** the kit — do not add it. Zip is written under `.dxforge/artifacts/<assessmentId>/`. |
| 9 | about page, Docker, docs | `feat(web): about page, Dockerfile and compose for the wizard` | Attribution on the About page must match `LICENSE_NOTICE.md` exactly (Tạ Tuấn Anh / FDS, CC BY 4.0). Update `BUILDING.md` and `CHANGELOG.md`. `deploy/` is the wizard container only — targets arrive in plan 04. |
| 10 | Playwright E2E + CI | `test(web): Playwright end-to-end smoke on desktop and mobile, CI job` | Runs against `next dev` on port 3100 with a temp data dir. Journey: open round → fill three tiers → close → radar → prescription → kit. Desktop 1440 and mobile 375. Add the `e2e` job to `.github/workflows/ci.yml`. |

---

## 5. Acceptance gate (orchestrator runs this, not the worker)

After each worker returns, before dispatching the next:

```bash
npm test                       # expect the previous count + the task's new tests, 0 failed
npm run typecheck              # clean
git log --oneline -1           # exactly the task's message, no trailer
git show --stat HEAD           # only the task's Files: list
git status --short             # clean tree
grep -rL "SPDX-License-Identifier" --include='*.ts' --include='*.tsx' apps/web/src packages apps/cli
```

Additionally:

- `git show HEAD | grep -iE 'co-authored-by|signed-off-by|generated'` → must print nothing.
- New user-facing Vietnamese text appears **only** in `i18n.vi.ts`.
- From Task 6 on: `cd apps/web && FORGE_ADMIN_PASSWORD=x FORGE_SESSION_SECRET=0123456789abcdef npx next build` succeeds.

A task is rejected and re-dispatched with the specific failure if any check fails. A rejected task
is fixed by the **same** worker where possible, so context is not lost.

---

## 6. Stop-and-report conditions

A worker must stop, leave the tree clean, and report instead of improvising when:

- a package named in the plan cannot be installed, or resolves to a major version other than the
  plan's range;
- a test in the plan cannot pass without changing the test or widening a schema;
- the task needs a file outside its `Files:` list;
- `npm test` was already red before the worker's first change;
- anything requires a credential, a network call to a real target, or a `git push`.

---

## 7. Deviation register

Filled in as work proceeds. Every entry needs the reason and the evidence.

| # | Task | Plan said | Reality | Decision |
|:-:|---|---|---|---|
| 1 | 02 (plan-level) | persistence via Prisma (M0 spec §3–4) | plan 02 Global Constraints rules better-sqlite3 + `schema.sql` | Accepted before dispatch; Task 2 patches the two spec lines. |
| 2 | 1 | `apps/web/tsconfig.json` with `"rootDir": "src"` and `"outDir": "dist"` | Next 16.3.4 emits `.next/types/validator.ts`, which the same file's `include` list requires; `tsc` then fails with TS6059 on every `next build`. Reported by the Task 1 worker, reproduced by the orchestrator. | Both keys dropped — they are inert under `noEmit: true`, and Next's own scaffold omits them. `next build` green, `/api/health` in the route table, root `typecheck` green with `.next/` present. Plan file patched at the source so later tasks inherit the fix. |
| 3 | 2 | `listResponses` body returns `{ tier, answers, freeText? }` | The Interfaces contract (plan L481), the task's own test (L535) and the only consumer, `closeRound` (L1420, which maps the result down to `{tier, answers}`), all say `{ tier, answers }`. Only the body disagreed. Found by the Task 2 worker, which stopped rather than editing the test. | Body corrected to match the other three. `addResponse` still stores `free_text` and the column stays; only the read path narrowed. Free text is the most PII-sensitive column, so not carrying it by default is also the safer default. Plan patched at the source. |
| 4 | 2 | `listResponses` orders by `ORDER BY r.submitted_at, r.id` | `submitted_at` has millisecond precision so same-tier responses routinely tie, and `id` is `randomUUID()` — the tiebreak is a coin flip. Orchestrator probe over 300 trials: wrong order **157/300** with `id`, **0/300** with `rowid`. Not a test flake; the read path was non-deterministic. | Tiebreaker changed to `r.rowid`, which SQLite increments monotonically on insert (`responses` is a normal rowid table — no `WITHOUT ROWID` in `schema.sql`). Plan patched at the source. |
| — | 7, 8 | *(latent, not yet fixed)* `getPrescription` and `getArtifact` use `ORDER BY created_at DESC LIMIT 1` | Same tie exposure as #4. No test covers it and a tie picks between two rows of the same `kind`, so the damage is bounded. Out of Task 2's scope. | Deliberately left alone. Revisit when Task 7 and Task 8 start writing those tables; add a `rowid DESC` tiebreak there if either writes more than one row per kind. |
| | | | | |
