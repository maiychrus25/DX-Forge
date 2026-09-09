// SPDX-License-Identifier: AGPL-3.0-or-later
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Command } from "commander";
import { stringify } from "yaml";
import { ZodError } from "zod";
import { compile, loadIntentFile, loadPacks, type ValidationError } from "@dx-forge/forge-core";
import { renderTree } from "../tree.js";

export function registerPlan(program: Command): void {
  program
    .command("plan")
    .description("Sinh plan.yaml từ intent.yaml và các gói ngành")
    .requiredOption("-f, --file <intent>", "đường dẫn intent.yaml")
    .option("-o, --out <plan>", "đường dẫn plan.yaml", "plan.yaml")
    .option("--packs-dir <dir>", "thư mục gói ngành", resolve(process.cwd(), "packs"))
    .option("--no-ai", "bỏ qua bước AI đề xuất (chưa có trong bản này)")
    .action((opts: { file: string; out: string; packsDir: string }) => {
      process.exitCode = runPlan(opts);
    });
}

export function runPlan(opts: { file: string; out: string; packsDir: string }): number {
  let intent;
  try {
    intent = loadIntentFile(opts.file);
  } catch (e) {
    console.error(`Intent không hợp lệ: ${e instanceof ZodError ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : (e as Error).message}`);
    return 2;
  }
  let result;
  try {
    result = compile(intent, loadPacks(opts.packsDir));
  } catch (e) {
    console.error((e as Error).message);
    return 2;
  }
  console.log(renderTree(result.plan));
  if (result.errors.length > 0) {
    console.error(`\n${result.errors.length} lỗi validator:`);
    for (const err of result.errors) console.error(formatError(err));
    console.error("Không ghi plan. Sửa intent hoặc gói rồi chạy lại.");
    return 1;
  }
  writeFileSync(opts.out, stringify(result.plan));
  console.log(`\nĐã ghi ${opts.out} (${result.plan.resources.length} tài nguyên).`);
  return 0;
}

function formatError(e: ValidationError): string {
  return `  [${e.rule}] ${e.resourceId ?? "-"}: ${e.message}`;
}
