// SPDX-License-Identifier: AGPL-3.0-or-later
import { Command } from "commander";
import { registerApply } from "./commands/apply.js";
import { registerDestroy } from "./commands/destroy.js";
import { registerExplain } from "./commands/explain.js";
import { registerPacks } from "./commands/packs.js";
import { registerPlan } from "./commands/plan.js";
import { registerVerify } from "./commands/verify.js";

const program = new Command("dxforge").description("DX-Forge: compile an organisation into a running DX-OS").version("0.1.0");
registerPlan(program);
registerPacks(program);
registerExplain(program);
registerApply(program);
registerVerify(program);
registerDestroy(program);
program.parseAsync(process.argv).catch((e: Error) => {
  console.error(e.message);
  process.exit(2);
});
