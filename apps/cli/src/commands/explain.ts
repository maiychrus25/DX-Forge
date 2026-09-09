// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from "node:fs";
import type { Command } from "commander";
import { parse } from "yaml";
import { PlanV1 } from "@dx-forge/forge-core";

export function registerExplain(program: Command): void {
  program
    .command("explain <id>")
    .description("Giải thích một tài nguyên trong plan: lý do, phụ thuộc, cổng")
    .option("-p, --plan <plan>", "đường dẫn plan.yaml", "plan.yaml")
    .action((id: string, opts: { plan: string }) => {
      const plan = PlanV1.parse(parse(readFileSync(opts.plan, "utf8")));
      const r = plan.resources.find((x) => x.id === id);
      if (!r) {
        console.error(`Không có tài nguyên ${id} trong ${opts.plan}`);
        process.exitCode = 2;
        return;
      }
      console.log(`${r.id}  [${r.layer}] ${r.type}`);
      console.log(`Lý do: ${r.reason}`);
      console.log(`Phụ thuộc: ${r.depends_on.length ? r.depends_on.join(", ") : "(không)"}`);
      console.log(`Gate: allowed=${r.gate.allowed}${r.gate.why ? ` — ${r.gate.why}` : ""}`);
      if (r.source) console.log(`Nguồn: gói ${r.source.pack}${r.source.process ? `, quy trình ${r.source.process}` : ""}`);
    });
}
