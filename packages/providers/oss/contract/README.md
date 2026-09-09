# Contract suite: provider-oss vs. the compose target `core`

`core.contract.test.ts` runs the `@dx-forge/provider-oss` layer-H adapters against a real Keycloak
and Nextcloud (`deploy/target-core.yml`) instead of the stubbed `fetch` every other test in this
repository uses. It is skipped unless `DXFORGE_CONTRACT=1`, lives outside `packages/**/test/**`,
and `vitest.config.ts` excludes this directory explicitly — `npm test` never touches the network.

Run it with:

```bash
npm run contract
```

## What it proves — and does not

Two call shapes in the adapters are guesses the authoring plan (plan 04) flagged as unconfirmed:

- the Nextcloud groupfolders ACL `PROPPATCH` body (`../src/nextcloud.ts`, `aclXml`), and
- the Keycloak child-group endpoint (`../src/keycloak.ts`, `ensureParentGroup` / `identityGroup`).

The suite has one `it` dedicated to each, reading the shape back with a request independent of the
adapter that wrote it, so a mismatch fails with a message naming the exact call and the exact
missing/wrong fragment — not a bare "500" or "verify failed". The rest of the suite runs the
sequence the spec's acceptance criteria describe: apply layer H → verify all green (including the
staff ACL probes: 403 into `3. [R] RESOURCES`, 201 into the staff's own `2. [A] AREAS/<dept>`) →
apply again and see every resource skip → `destroy --prune` → verify reports everything gone.

This suite was authored without ever running it: no adapter's real behaviour against Keycloak 26 /
Nextcloud 31 + groupfolders has been confirmed. Every assumption it encodes — endpoint paths,
request/response envelopes, status codes, the exact XML — is exactly what a first run is for.
Expect to have to adjust either the adapters or this file once it has actually talked to the
target; that is the point of a contract suite, not a sign something was skipped.

## Bringing the stack up in stages

The three services do not all need to run at once for every check, and on a machine with little
free RAM they should not be started together blindly. Suggested staging:

```bash
cp deploy/target-core.env.example deploy/.env.core
# edit deploy/.env.core: replace every CHANGE_ME_* value

# stage 1 — Postgres only
docker compose --env-file deploy/.env.core -f deploy/target-core.yml up -d --wait postgres

# stage 2 — Nextcloud (depends on Postgres; runs nextcloud-init.sh on first install)
docker compose --env-file deploy/.env.core -f deploy/target-core.yml up -d --wait nextcloud

# stage 3 — Keycloak (independent of the other two; dev mode, no external DB)
docker compose --env-file deploy/.env.core -f deploy/target-core.yml up -d --wait keycloak

# run the suite (values must match deploy/.env.core)
DXFORGE_CONTRACT=1 \
  KC_URL=http://localhost:8080 KC_ADMIN=admin KC_PASSWORD=<same as .env.core> \
  NC_URL=http://localhost:8081 NC_ADMIN=admin NC_PASSWORD=<same as .env.core> \
  NC_STAFF_PASSWORD=<same as .env.core> \
  npm run contract

# tear down
docker compose --env-file deploy/.env.core -f deploy/target-core.yml down -v
```

`--wait` blocks until each service's healthcheck passes before the next stage starts, which is
also the moment to check memory headroom before continuing.

### Estimated memory per stage (rough; not measured on this machine)

| Stage                   | Approx. resident memory |
| ------------------------ | ------------------------ |
| Postgres alone            | ~60–100 MB |
| + Nextcloud (apache+php)  | ~300–500 MB more (~400–600 MB total) |
| + Keycloak (dev mode, JVM)| ~500–700 MB more (~1–1.3 GB total) |

All three together should stay under ~1.5 GB, well below the ~6 GB the plan's Global Constraints
originally estimated — that number assumed Keycloak also ran its own Postgres-backed realm and
did not assume dev mode; routing Keycloak to its embedded database (see the comment at the top of
`target-core.yml`) is the main saving. Still, bring services up one stage at a time and check
`docker stats` before starting the next if free RAM is under ~2 GB.

### Optional: Telegram / Mattermost comms

`h.channel` / `h.topic.*` are excluded from the main contract run (no chat backend runs in
`target-core.yml`, and CI has no bot account). Two extra, independently-gated `describe` blocks
exercise them against a *real* account when its credentials are present in the environment —
otherwise they skip with no failure:

- Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (the chat must already have Topics enabled).
- Mattermost: `MATTERMOST_URL`, `MATTERMOST_TOKEN`, `MATTERMOST_TEAM_ID`.

## Known risks in this compose file (unverified — flag if wrong)

- The Keycloak healthcheck assumes `--health-enabled=true` exposes `/health/ready` on the
  container-internal management port 9000 and that the image's shell supports the `/dev/tcp`
  redirection used to probe it without `curl`/`wget`. If Keycloak never reports healthy, check
  `docker compose logs keycloak` first — this is a healthcheck config issue, not necessarily an
  adapter bug.
- `nextcloud-init.sh` assumes the official `nextcloud:31-apache` image's entrypoint *sources*
  every file under `docker-entrypoint-hooks.d/post-installation/` (rather than executing it), and
  that `occ app:list` / `occ user:list` output contains the app/user id as a plain substring.
