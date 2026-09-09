// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Command } from "commander";
import { parse } from "yaml";
import { loadCredentials, PlanV1, readState, renderVerifyReport, verifyPlan, type TargetKind } from "@dx-forge/forge-core";
import { providerFor } from "../providers.js";

export type VerifyOpts = {
  target?: string;
  state: string;
  credentialsRef: string;
  out: string;
};

export function registerVerify(program: Command): void {
  program
    .command("verify <plan>")
    .description("Kiểm tra các tài nguyên đã áp dụng trên đích thật, ghi báo cáo")
    .option("--target <target>", "đích kiểm tra (mặc định lấy từ plan)")
    .option("--state <path>", "đường dẫn state.json", ".dxforge/state.json")
    .option("--credentials-ref <name>", "tên biến môi trường chứa thông tin đăng nhập JSON", "DXFORGE_OSS_CREDENTIALS")
    .option("--out <dir>", "thư mục ghi báo cáo verify", ".dxforge")
    .action(async (planPath: string, opts: VerifyOpts) => {
      process.exitCode = await runVerify(planPath, opts);
    });
}

export async function runVerify(planPath: string, opts: VerifyOpts): Promise<number> {
  let plan: PlanV1;
  try {
    plan = PlanV1.parse(parse(readFileSync(planPath, "utf8")));
  } catch (e) {
    console.error(`Plan không hợp lệ: ${(e as Error).message}`);
    return 2;
  }

  const target = (opts.target ?? plan.target) as TargetKind;
  const statePath = resolve(process.cwd(), opts.state);
  const outDir = resolve(process.cwd(), opts.out);

  try {
    const provider = providerFor(target, {});
    const credentials = loadCredentials(opts.credentialsRef);
    const state = readState(statePath, target);
    const report = await verifyPlan(plan, provider, credentials, state);

    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "verify-report.json"), JSON.stringify(report, null, 2));
    const md = renderVerifyReport(report);
    writeFileSync(join(outDir, "verify-report.md"), md);
    console.log(md);

    return report.ok ? 0 : 1;
  } catch (e) {
    console.error((e as Error).message);
    return 2;
  }
}
