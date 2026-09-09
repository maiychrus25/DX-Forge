// SPDX-License-Identifier: AGPL-3.0-or-later
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The contract suite (packages/providers/oss/contract/) talks to a real Keycloak/Nextcloud target
// and must never be collected by the default `npm test` run. It is not under a `test/` directory,
// so the default include globs already miss it, and it is excluded explicitly too so that stays
// true even if its location ever changes. `npm run contract` sets DXFORGE_CONTRACT=1 before
// invoking vitest, which flips the config to include *only* that directory — a single include list
// cannot serve both runs, because a positional file path on the vitest CLI still has to match
// `include`/`exclude` to be collected at all.
const CONTRACT = process.env.DXFORGE_CONTRACT === "1";

export default defineConfig({
  // `apps/web` addresses its own modules through the `@/*` alias that Next resolves and that
  // `apps/web/tsconfig.json` declares. Vitest reads neither, so it needs the same mapping to load
  // those modules in unit tests.
  resolve: { alias: { "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)) } },
  test: {
    include: CONTRACT ? ["packages/providers/oss/contract/**/*.test.ts"] : ["packages/**/test/**/*.test.ts", "apps/**/test/**/*.test.ts"],
    exclude: CONTRACT ? ["**/node_modules/**"] : ["apps/web/e2e/**", "**/node_modules/**", "packages/providers/oss/contract/**"],
    coverage: { provider: "v8", include: ["packages/*/src/**"] },
  },
});
