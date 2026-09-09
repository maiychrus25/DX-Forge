// SPDX-License-Identifier: AGPL-3.0-or-later
import { resolve } from "node:path";
import type { Command } from "commander";
import { loadPacks } from "@dx-forge/forge-core";

export function registerPacks(program: Command): void {
  const packs = program.command("packs").description("Quản lý gói ngành");
  packs
    .command("list")
    .option("--packs-dir <dir>", "thư mục gói ngành", resolve(process.cwd(), "packs"))
    .action((opts: { packsDir: string }) => {
      for (const { pack } of loadPacks(opts.packsDir).values()) {
        console.log(`${pack.id.padEnd(14)} ${pack.version.padEnd(6)} ${pack.scope.padEnd(8)} ${pack.resources.length} tài nguyên  ${pack.name}`);
      }
    });
}
