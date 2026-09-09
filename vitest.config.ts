// SPDX-License-Identifier: AGPL-3.0-or-later
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // `apps/web` addresses its own modules through the `@/*` alias that Next resolves and that
  // `apps/web/tsconfig.json` declares. Vitest reads neither, so it needs the same mapping to load
  // those modules in unit tests.
  resolve: { alias: { "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)) } },
  test: {
    include: ["packages/**/test/**/*.test.ts", "apps/**/test/**/*.test.ts"],
    exclude: ["apps/web/e2e/**", "**/node_modules/**"],
    coverage: { provider: "v8", include: ["packages/*/src/**"] },
  },
});
