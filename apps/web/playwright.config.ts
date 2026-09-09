// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig, devices } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = process.env.E2E_DATA_DIR ?? mkdtempSync(join(tmpdir(), "dxforge-e2e-"));

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  // Both projects share one `next dev` server and therefore one SQLite file, so they must not run
  // concurrently. The raised expect timeout covers the first hit on a route Turbopack has not
  // compiled yet, which takes far longer than the 5s default.
  fullyParallel: false,
  workers: 1,
  expect: { timeout: 15_000 },
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }, { name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "npx next dev -p 3100",
    url: "http://localhost:3100/api/health",
    reuseExistingServer: false,
    env: { FORGE_ADMIN_PASSWORD: "e2e-pass", FORGE_SESSION_SECRET: "e2e-secret-0123456789", FORGE_DATA_DIR: dataDir, FORGE_BASE_URL: "http://localhost:3100" },
  },
});
