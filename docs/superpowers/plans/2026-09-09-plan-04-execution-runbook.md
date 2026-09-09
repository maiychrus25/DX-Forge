# Plan 04 — Execution runbook (subagent dispatch)

Companion to `2026-09-09-plan-04-provider-oss-h.md`. The plan is **what** to build; this file is
**how the work is handed out and accepted**.

**The rules, the worker-prompt template and the trailer/commit discipline are the ones in
`2026-09-09-plan-02-execution-runbook.md` §2 and §4.** They are not repeated here. What follows is
only what differs for plan 04.

Plan 02 shipped 15 defects that only surfaced when the code was run (see that runbook's deviation
register). Plan 04 is a larger surface — HTTP against four external systems — so assume the same and
gate accordingly.

---

## 1. Pre-flight (verified 2026-09-09)

| Fact | Value | Consequence |
|---|---|---|
| Baseline | 140 tests green in 20 files, `typecheck` clean, `next build` 21 routes | Any red after a change belongs to that change. |
| Branch | `develop`, 24 commits ahead of `main`, nothing pushed | Never commit to `main`. Never push. |
| Workspaces | root `package.json` already globs `packages/providers/*` | Task 4's package is picked up with no root change beyond `typecheck`. |
| `fetch` | native on Node 24 | No HTTP dependency is needed or permitted. |
| Docker / Compose | 29.7.2 / v5.4.0, daemon reachable | Task 8's compose target can really run. |
| Disk | 392 GB free | Keycloak + Nextcloud + Postgres images fit. |
| **RAM** | 15.9 GB total, **~3.8 GB available** (a browser holds ~12 GB) | **Tasks 1–7 do not need Docker at all.** Task 8's `core` target wants ≤ 6 GB per the NFR, so memory must be freed before the contract run, or it will thrash. Raise this before starting Task 8 rather than during it. |
| Packages resolve from | `dist/`, built by the root `prepare` | A change in `packages/forge-core/src` is **not** visible to `apps/web` or a built consumer until `tsc -b` runs. `npm test` and `npm run typecheck` both trigger it; a bare `npx vitest` on one file may not. |

---

## 2. Order

```
T1 interfaces + credentials + state
 └─► T2 applyPlan ──► T3 verifyPlan + destroyPlan
      └─► T4 provider-oss skeleton + Keycloak
           ├─► T5 Nextcloud
           └─► T6 Telegram + Mattermost + provider assembly
                └─► T7 CLI apply/verify/destroy
                     └─► T8 compose target + contract tests + CI
                          └─► T9 docs
```

Strictly sequential, one worker at a time, gate between each. T5 and T6 both modify
`packages/providers/oss/src/index.ts`; T2, T3 and T4 all modify
`packages/forge-core/src/index.ts`. Concurrency would collide on those files, exactly as it would
have in plan 02.

Contracts a worker must not break:

| Producer | Consumer | Contract |
|---|---|---|
| T1 | T2–T7 | `Adapter`/`Provider`, `loadCredentials`, `readState`/`writeState`, `StateEntry` with `layer` + `spec` |
| T2 | T7 | `applyPlan`, `ApplyError`, `renderDryRun` |
| T3 | T7 | `verifyPlan`, `VerifyReport`, `renderVerifyReport`, `destroyPlan` |
| T4 | T5, T6 | `http.ts` helpers, `ossProvider()` registry shape |
| T6 | T7, T8 | the assembled provider covering every layer-H resource type |

---

## 3. Gate (orchestrator runs this after every task)

Everything in the plan-02 runbook §5, plus:

- `npm test` and `npm run typecheck` — the whole repository, not one package. `forge-core` is in the
  `tsc -b` graph, so a mistake there breaks the CLI **and** the wizard.
- `cd apps/web && rm -rf .next && FORGE_ADMIN_PASSWORD=x FORGE_SESSION_SECRET=0123456789abcdef npx next build`
  from T1 on: `forge-core` changes reach the wizard through `dist/`, so a broken export surfaces here
  and nowhere else.
- **No network from unit tests.** Grep the diff for a real hostname; every adapter test stubs `fetch`.
  `grep -rn "https\?://" packages/providers/oss/test` must show only obvious fixtures
  (`https://kc.example.org` and the like), never a host that resolves.
- **No credential ever reaches disk.** After any task that touches credentials or state:
  `grep -rniE 'password|token|secret' .dxforge/ 2>/dev/null` must find nothing, and the same grep
  over the committed diff must find only variable *names* and schema keys, never a value.
- From T7 on: `npm run dxforge -- apply --help`, `verify --help`, `destroy --help` all exit 0.
- From T7 on: `npm run dxforge -- apply <plan> --dry-run` against a plan with **no** credentials in
  the environment must print the change table and exit 0 without attempting a connection. Dry-run
  calling an adapter is the single most likely defect in this plan.
- T8 only: bring the compose target up, run the contract suite, then bring it down and confirm no
  container or volume is left behind.

---

## 4. Task-specific notes for the dispatch prompts

| # | Note |
|:-:|---|
| 1 | `StateV1.version` stays `1`. Older state files without `layer`/`spec` must still load, defaulting to `layer: "H"`, `spec: {}` — write the test for that, it is the compatibility promise. |
| 2 | Dry-run must never call an adapter and never write state. Resume means: write what succeeded, throw `ApplyError`, and continue on the next run. Prune destroys in **reverse** apply order, using the `layer` now stored in state. |
| 3 | `verify` exits 0 only when every check passes. The report is written in both JSON and markdown. |
| 4 | `redact()` in `http.ts` is a security control, not a nicety: error messages carry status plus a 200-character body snippet with tokens removed. Test it with a body that contains a token. |
| 5 | Nextcloud group ids are `dept-<code>` while plan resources say `departments/<code>` — the adapter maps between them. The ACL check that matters is the one the spec names: a staff account gets 403 writing into `3. [R] RESOURCES` and 201 writing into its own `2. [A] AREAS/<dept>`. |
| 6 | Telegram needs the bot to be an admin of a forum-enabled supergroup; Mattermost channel names are slugified from `spec.name`. Both are stubbed in unit tests. |
| 7 | `--target` defaults to `plan.target`; state defaults to `.dxforge/state.json`. Exit codes: 0 success, 2 validation, 3 target error. |
| 8 | Contract tests run only under `DXFORGE_CONTRACT=1` and live outside the default vitest run. Check available memory before starting the stack. |
| 9 | Update the README roadmap row for 04, BUILDING.md, CHANGELOG, and only the spec lines the task names. |

---

## 5. Deviation register

| # | Task | Plan said | Reality | Decision |
|:-:|---|---|---|---|
| 1 | 2 | Task 2's test calls `compile(intent, packs, { now: NOW() })` | The shipped signature is positional — `compile(intent, packs, now: Date = new Date())` — and `differ.test.ts` has been calling it that way since plan 01. The options object made `buildPlan` call `now.toISOString()` on a plain object: `TypeError: now.toISOString is not a function`. Found by the Task 2 worker. | Call site corrected to positional. Plan patched at the source. |
| 2 | 2 | The plan puts a "Ruling in this task" inside Task 2 that requires editing `state.ts` and `differ.ts` — files Task 2's own `Files:` list excludes | A genuine self-contradiction in the plan, so the worker correctly implemented neither. But the consequence is severe: without `__type` on the state entry, `provider.adapters[typeOf(entry) ?? ""]` is always `undefined`, so `--prune` **deletes the state entry and leaves the real object alive on the target**, reporting success while orphaning it. No test in the plan covers this — the prune test uses `spec: {}` entries and never reaches a real adapter. | Orchestrator applied the ruling after the task, since it spans two files the worker was told not to touch: `entryFor` stores `__type`, `diffPlan` strips it back out so it never appears in an operator's diff. Verified with a probe: `adapter.destroy` is now called with the real `externalId`, and `before` in a diff still reads `{ realm: "dxlab" }` with no bookkeeping key. Task 2's Files list in the plan now says who applies the ruling. |
| 3 | 3 | Task 3 says to extract `destroyOrder` and "reuse from `apply.ts`", but `apply.ts` is not in Task 3's `Files:` list | The second scope self-contradiction in this plan (see deviation 2). The worker correctly refused to touch `apply.ts` and left a second copy of the comparator in `destroy.ts`. The orchestrator first suspected the two copies behaved differently — `apply.ts` called `indexOf` on the very array `sort` was mutating — and **was wrong**: a randomised differential run of 2000 cases up to 65 entries found 0 mismatches for either version. So this was duplication, not a defect. | Still deduplicated, because two comparators that must agree are free to drift and destroy order is a correctness property. `destroyOrder` moved to `order.ts`, which already owns `LAYER_ORDER` and imports neither `apply` nor `destroy`, so both import it with no cycle — the plan's intent without its scope conflict. |
| 4 | 5 | `h.tree` declares `depends_on: ["h.realm"]` only | The Nextcloud `storage.tree` adapter needs the department codes, and the only place it can read them is the applied `identity.group` state entries. That worked purely because the planner happens to emit groups at positions 4–5 and the tree at 6, and `topoSort` preserves input order within a layer. The product explicitly lets a human edit `plan.yaml` before apply, and a reorder would have produced a tree with **no department groups and no error**. Surfaced by the Task 5 worker's deviation note. | `h.tree` now declares `["h.realm", ...departments.map(d => \`h.group.\${d.code}\`)]`, so the guarantee comes from the dependency graph rather than from luck. Planner snapshot regenerated; 33 resources unchanged. |
| — | — | *(process note)* | Editing `packages/forge-core/src` and then running the CLI showed the **old** behaviour: the CLI resolves `@dx-forge/forge-core` through `dist/`, which had not been rebuilt yet. `npm test` did not reveal it because forge-core's own tests import `../src/` directly. | Always run `npm run typecheck` (or `npm run prepare`) before trusting a CLI run after a core edit. Already listed in the runbook pre-flight; recorded here because it actually happened. |
| 5 | 6 | `request()` redacts the response body but passes the raw `url` into `HttpError`, whose message is `HTTP <status> <url>: <body>` | Telegram carries the bot token **in the URL path**, so a failed call put the token straight into `HttpError.message` and into the public `HttpError.url` field. The Task 6 worker spotted it, could not fix it (`http.ts` is outside Task 6's file list) and defended its own adapter by rewrapping the error — correct, but it leaves the next adapter exposed. Orchestrator reproduced the leak with a probe before changing anything. | Fixed at the source: `request()` now redacts the URL as well, so the control works by default instead of depending on every adapter remembering to rewrap. The probe was kept as `packages/providers/oss/test/http.test.ts` so the leak cannot come back. |
| 6 | 7 | `destroy` asks for confirmation with `readline/promises` `question()` | `question()` never settles when stdin reaches EOF before an answer — any non-interactive invocation (a pipe, CI, `< /dev/null`). The process then exited **0 with no output and nothing destroyed**, which reads as success. Found and fixed by the Task 7 worker while testing by hand. | The question races the interface's `close` event; unanswered EOF is treated as a decline, prints `Đã huỷ, không xoá gì.` and exits 1. |
| 7 | 7 | `applyPlan` checks every change for a registered adapter **before** the `dryRun` early return | So a dry run of a full four-layer plan threw `NoAdapter("process.entity")` and printed nothing — the provider only serves layer H until plan 05. That is exactly the situation `--dry-run` exists to reveal. Found by the Task 7 worker, which worked around it in the CLI by calling `diffPlan`/`renderDryRun` directly; correct for its scope, but the core stayed broken and **plan 06's wizard calls `applyPlan` directly**. | Fixed at the source: the adapter check now runs after the dry-run return, and `ApplyResult` gains `missingAdapters`, so a dry run reports what the provider cannot serve instead of aborting. A real apply still throws. The CLI was put back on `applyPlan` so one code path produces the table an operator reviews, and it now prints `Đích oss chưa có adapter cho: …` with the hint to use `--layers H`. Regression test kept as `dryrun.test.ts`. |
| | | | | |
