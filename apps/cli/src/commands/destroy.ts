// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import type { Command } from "commander";
import { parse } from "yaml";
import { ApplyError, destroyPlan, loadCredentials, PlanV1, readState, writeState, type TargetKind } from "@dx-forge/forge-core";
import { providerFor } from "../providers.js";

export type DestroyOpts = {
  target?: string;
  state: string;
  credentialsRef: string;
  prune?: boolean;
  yes?: boolean;
};

export function registerDestroy(program: Command): void {
  program
    .command("destroy <plan>")
    .description("Xoá các tài nguyên đã áp dụng trên đích")
    .option("--target <target>", "đích cần xoá (mặc định lấy từ plan)")
    .option("--state <path>", "đường dẫn state.json", ".dxforge/state.json")
    .option("--credentials-ref <name>", "tên biến môi trường chứa thông tin đăng nhập JSON", "DXFORGE_OSS_CREDENTIALS")
    .option("--prune", "xoá mọi tài nguyên trong state, kể cả tài nguyên không còn trong plan")
    .option("--yes", "không hỏi xác nhận, dùng cho chạy không tương tác")
    .action(async (planPath: string, opts: DestroyOpts) => {
      process.exitCode = await runDestroy(planPath, opts);
    });
}

export async function runDestroy(planPath: string, opts: DestroyOpts): Promise<number> {
  let plan: PlanV1;
  try {
    plan = PlanV1.parse(parse(readFileSync(planPath, "utf8")));
  } catch (e) {
    console.error(`Plan không hợp lệ: ${(e as Error).message}`);
    return 2;
  }

  const target = (opts.target ?? plan.target) as TargetKind;
  const statePath = resolve(process.cwd(), opts.state);

  try {
    const provider = providerFor(target, {});
    const credentials = loadCredentials(opts.credentialsRef);
    const state = readState(statePath, target);

    const planIds = new Set(plan.resources.map((r) => r.id));
    const candidates = Object.keys(state.entries).filter((id) => opts.prune || planIds.has(id));
    if (candidates.length === 0) {
      console.log("Không có tài nguyên nào trong state để xoá.");
      return 0;
    }

    if (!opts.yes) {
      const confirmed = await confirm(`Xoá ${candidates.length} tài nguyên trên đích ${target}? (gõ "xoa")`);
      if (!confirmed) {
        console.log("Đã huỷ, không xoá gì.");
        return 1;
      }
    }

    const result = await destroyPlan(plan, provider, credentials, state, { prune: opts.prune });
    writeState(statePath, result.state);
    console.log(`Đã xoá ${result.destroyed.length} tài nguyên trên đích ${target}.`);
    return 0;
  } catch (e) {
    if (e instanceof ApplyError) {
      writeState(statePath, e.state);
      console.error(e.message);
      return 1;
    }
    console.error((e as Error).message);
    return 2;
  }
}

/** Asks for confirmation on stdin. If stdin ends before an answer is typed (piped from
 * `/dev/null`, no TTY, CI) `readline/promises`' `question()` never settles on its own — the
 * process would otherwise exit 0 with no answer and no message once the event loop drains, which
 * reads as a silent success for a destructive command. The explicit `close` listener treats that
 * case as a decline instead. */
async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await new Promise<boolean>((resolveAnswer) => {
      let answered = false;
      rl.question(`${question} `).then((answer) => {
        answered = true;
        resolveAnswer(answer.trim() === "xoa");
      });
      rl.on("close", () => {
        if (!answered) resolveAnswer(false);
      });
    });
  } finally {
    rl.close();
  }
}
