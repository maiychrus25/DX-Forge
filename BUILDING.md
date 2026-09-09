# Building and running

Requirements: Node 22+, npm 10+. No database, no Docker for this stage.

```bash
git clone <repo> dx-forge && cd dx-forge
npm ci
npm test              # vitest: engine, core, CLI
npm run typecheck
npm run dxforge -- plan -f examples/intent.example.yaml -o plan.yaml
```

Configuration is by environment variables only; none are needed for `plan`. Credentials for `apply` (later release) are read from the variable named in `target.credentials_ref` and never written to disk.
