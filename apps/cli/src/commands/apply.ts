// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Command } from "commander";
import { parse } from "yaml";
import {
  applyPlan,
  ApplyError,
  diffPlan,
  Layer,
  PlanV1,
  readState,
  renderDryRun,
  writeState,
  loadCredentials,
  type Credentials,
  type ProgressEvent,
  type TargetKind,
} from "@dx-forge/forge-core";
import { providerFor } from "../providers.js";

export type ApplyOpts = {
  target?: string;
  dryRun?: boolean;
  prune?: boolean;
  state: string;
  credentialsRef: string;
  layers?: string;
};

export function registerApply(program: Command): void {
  program
    .command("apply <plan>")
    .description("Áp dụng plan lên đích: tạo/cập nhật tài nguyên trên đích và ghi state")
    .option("--target <target>", "đích áp dụng (mặc định lấy từ plan)")
    .option("--dry-run", "chỉ hiển thị thay đổi, không gọi đích và không ghi state")
    .option("--prune", "xoá khỏi đích các tài nguyên không còn trong plan")
    .option("--state <path>", "đường dẫn state.json", ".dxforge/state.json")
    .option("--credentials-ref <name>", "tên biến môi trường chứa thông tin đăng nhập JSON", "DXFORGE_OSS_CREDENTIALS")
    .option("--layers <layers>", "chỉ áp dụng các lớp này, ví dụ H,P (mặc định tất cả)")
    .action(async (planPath: string, opts: ApplyOpts) => {
      process.exitCode = await runApply(planPath, opts);
    });
}

export async function runApply(planPath: string, opts: ApplyOpts): Promise<number> {
  let plan: PlanV1;
  try {
    plan = PlanV1.parse(parse(readFileSync(planPath, "utf8")));
  } catch (e) {
    console.error(`Plan không hợp lệ: ${(e as Error).message}`);
    return 2;
  }

  const target = (opts.target ?? plan.target) as TargetKind;
  const statePath = resolve(process.cwd(), opts.state);

  let filtered = plan;
  try {
    const layers = parseLayers(opts.layers);
    if (layers) filtered = { ...plan, resources: plan.resources.filter((r) => layers.includes(r.layer)) };
  } catch (e) {
    console.error((e as Error).message);
    return 2;
  }

  try {
    const provider = providerFor(target, {});

    if (opts.dryRun) {
      // One code path with a real apply, so the table an operator reviews is the one apply will act
      // on. `applyPlan` no longer refuses a dry run over resource types this provider cannot serve;
      // it reports them instead, which is precisely what the operator needs to see before running.
      const state = readState(statePath, target);
      const result = await applyPlan(filtered, provider, {} as Credentials, state, { dryRun: true, prune: opts.prune });
      console.log(renderDryRun(result.changes));
      if (result.missingAdapters.length > 0) {
        console.log(`\nĐích ${target} chưa có adapter cho: ${result.missingAdapters.join(", ")}. Dùng --layers H để áp dụng phần đã hỗ trợ.`);
      }
      return 0;
    }

    const credentials: Credentials = loadCredentials(opts.credentialsRef);
    const state = readState(statePath, target);
    const onProgress = (e: ProgressEvent) => {
      if (e.status === "start") return;
      const symbol = e.status === "failed" ? "✗" : e.status === "skipped" ? (e.action === "gated" ? "⛔" : "·") : e.action === "update" ? "↻" : "✓";
      console.log(`${symbol} ${e.id}`);
    };
    const result = await applyPlan(filtered, provider, credentials, state, { prune: opts.prune, onProgress });
    writeState(statePath, result.state);
    console.log(
      `\nApply hoàn tất: tạo/cập nhật ${result.applied.length}, bỏ qua ${result.skipped.length}, gate chặn ${result.gated.length}` +
        `${opts.prune ? `, xoá ${result.destroyed.length}` : ""}.`,
    );
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

function parseLayers(raw: string | undefined): Layer[] | undefined {
  if (!raw) return undefined;
  const tokens = raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return tokens.map((t) => {
    const r = Layer.safeParse(t);
    if (!r.success) throw new Error(`Lớp không hợp lệ: ${t} (phải là H, P, D hoặc I).`);
    return r.data;
  });
}
