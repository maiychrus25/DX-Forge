# Dependencies

No third-party code is vendored or modified. All packages are fetched from npm at build time.

| Package | License | Used for |
|---|---|---|
| zod | MIT | schema validation (intent, plan, state, questionnaire) |
| yaml | ISC | reading/writing YAML files |
| commander | MIT | CLI argument parsing |
| typescript | Apache-2.0 | compiler (dev) |
| vitest | MIT | tests (dev) |
| tsx | MIT | running TypeScript without a build step (dev) |

Targets (Keycloak, Nextcloud, PostgreSQL, n8n, Appsmith, Metabase, Qdrant, Telegram, Mattermost, Google Workspace) are external systems DX-Forge talks to over HTTP; none of their code is included.
