// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/test/**/*.test.ts", "apps/**/test/**/*.test.ts"],
    exclude: ["apps/web/e2e/**", "**/node_modules/**"],
    coverage: { provider: "v8", include: ["packages/*/src/**"] },
  },
});
