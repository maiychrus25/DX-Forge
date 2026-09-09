# AGENTS.md — rules for every agent working in this repository

Read this file completely before touching any file. It is the source of truth; it overrides
personal habits and defaults. If a plan or task conflicts with this file, follow this file and
report the conflict.

## 1. What this repository is

DX-Forge: a compiler for the digital enterprise operating system (DX-OS). Pipeline
`measure → interview → plan → apply → verify → handbook`. Specs live in
`docs/superpowers/specs/`, requirements in `docs/SRS.md` and `docs/BRD.md`, BA set in `docs/ba/`,
implementation plans in `docs/superpowers/plans/`. Read the plan task you were given and the
spec sections it cites; do not read the whole documentation set unless the task says so.

## 2. Scope discipline

- Implement exactly the task you were assigned: its files, its tests, its commit. Nothing more.
- Do not refactor, rename, reformat or "improve" files outside the task's `Files:` list.
- Do not add dependencies that are not named in the task. If you believe one is needed, stop
  and report instead of adding it.
- Do not create abstractions, config options, or scaffolding "for later".
- If something in the task is impossible or wrong, finish every other step, then report the
  exact problem with evidence (command + output). Do not silently change the design.

## 3. Language and style

- Code, identifiers, comments, tests, commit messages, docs under `docs/superpowers/plans`:
  **English only**.
- Strings shown to end users (questionnaire text, CLI messages to the operator, prescriptions,
  UI labels, `reason` fields in packs and rules): **Vietnamese**.
- First line of every `.ts`, `.tsx`, `.js`, `.mjs`, `.sql`, `.sh` file:
  `// SPDX-License-Identifier: AGPL-3.0-or-later` (`#` for `.sh`/`.yaml` we author,
  `--` for `.sql`). CI fails without it.
- TypeScript strict, ESM (`import x from "./x.js"` with the `.js` suffix even for `.ts` sources).
- Formatting: 2 spaces, LF, final newline (see `.editorconfig`). Match the style of neighbouring
  code.

## 4. Test-first, always

1. Write the failing test exactly as the plan gives it.
2. Run it and confirm it fails for the expected reason (paste the output in your report).
3. Write the minimal implementation.
4. Run the test again and confirm it passes.
5. Run the whole suite: `npm test` and `npm run typecheck` must both be green before you commit.

A task is not done while any test is red or skipped. Never edit a test to make it pass unless
the plan step explicitly says the test is wrong; if you think it is wrong, report it.

## 5. Security and data

- Never write credentials, tokens, API keys or passwords into code, tests, fixtures, YAML,
  state files, plan files, logs or commit messages. `target.credentials_ref` is an environment
  variable **name**, never a value.
- Never commit `.dxforge/`, `node_modules/`, `dist/`, generated `plan.yaml`.
- Validator rules in `packages/forge-core/src/validator` cannot be made optional. Do not add a
  flag, env var or parameter that skips any rule or the maturity gate.
- Do not call external networks from tests. HTTP adapters (later plans) are tested with mocks.

## 6. Git

- Work on branch `develop`. Never commit to `main`. Never push unless the task says to.
- One commit per task, message in English, Conventional Commits (`feat(scope): ...`,
  `chore: ...`, `test: ...`, `docs: ...`).
- Commit with exactly this identity and trailer:

```bash
git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "<type>(<scope>): <summary>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- `git add` only the files in the task's `Files:` list plus files the task creates
  (snapshots, lockfile changes caused by the task). Check `git status` before committing.

## 7. Verification and reporting

Before you report a task as done, run and paste the output of:

```bash
npm test
npm run typecheck
git status --short
git log --oneline -1
```

Your final report must contain, in this order:
1. What you implemented (files created/modified).
2. Test results (the actual pass/fail counts from the commands above).
3. Anything you deviated from in the plan, with the reason.
4. Anything you could not finish, with the exact error.

Do not say "should work", "probably passes" or "nothing else is affected". Say what you ran and
what it printed.

## 8. Things that look helpful but are forbidden

- Adding ESLint/Prettier/Husky or any tooling not in the task.
- Changing `package.json` scripts, `tsconfig.base.json` or `vitest.config.ts` unless the task
  lists them.
- Widening zod schemas to make a test pass.
- Catching and swallowing errors to make a command exit 0.
- Writing Vietnamese comments or identifiers, or English user-facing strings.
- Editing files under `docs/` except the single spec line a task explicitly names.
