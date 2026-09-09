# Contributing

- Branch from `develop`; `main` only receives tagged releases.
- Code, comments, tests and commit messages in English. Strings shown to end users are Vietnamese.
- Every source file starts with `// SPDX-License-Identifier: AGPL-3.0-or-later`.
- Tests first (vitest). A validator rule without a failing and a passing case is not done.
- Never commit credentials, `.dxforge/`, or generated `plan.yaml`.
- Commit messages: Conventional Commits (`feat(scope): ...`), one logical change per commit.
