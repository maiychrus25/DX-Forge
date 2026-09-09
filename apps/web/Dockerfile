# SPDX-License-Identifier: AGPL-3.0-or-later
# Build stage: needs devDependencies (typescript) because root "prepare" runs
# `tsc -b packages/hpdi-engine packages/forge-core` on `npm ci`, and the two
# workspace packages resolve from their compiled dist/ output, not TS source.
FROM node:22-bookworm-slim AS build
WORKDIR /src
COPY . .
RUN npm ci
# Go through the workspace script, not `npx next build`, so apps/web's "prebuild" runs too and the
# workspace packages are compiled even if the root "prepare" was skipped.
RUN FORGE_ADMIN_PASSWORD=build FORGE_SESSION_SECRET=build-only-secret-0000 npm run build -w @dx-forge/web

# Runtime stage: only the standalone output is copied, so devDependencies and
# the full node_modules tree from the build stage never reach this image.
# Debian (not Alpine) so the prebuilt better-sqlite3 native binding loads.
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
