// SPDX-License-Identifier: AGPL-3.0-or-later
import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3"],
  transpilePackages: ["@dx-forge/hpdi-engine", "@dx-forge/forge-core"],
  output: "standalone",
};

export default config;
