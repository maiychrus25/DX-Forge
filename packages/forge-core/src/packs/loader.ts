// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { Resource } from "../schema/plan.js";
import { render } from "./template.js";

export const PackFile = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1),
  scope: z.enum(["org", "process"]),
  resources: z.array(Resource.omit({ gate: true, source: true })),
});
export type Pack = z.infer<typeof PackFile>;
export type LoadedPack = { pack: Pack; raw: string; dir: string };

export class PackNotFound extends Error {
  constructor(id: string) {
    super(`Pack not found: ${id}`);
    this.name = "PackNotFound";
  }
}

/** Reads every `<dir>/<id>/pack.yaml`. The template is validated once with placeholder values so broken packs fail at load time. */
export function loadPacks(dir: string): Map<string, LoadedPack> {
  const out = new Map<string, LoadedPack>();
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = join(dir, entry.name, "pack.yaml");
    if (!existsSync(file)) continue;
    const raw = readFileSync(file, "utf8");
    const probe = render(raw, PROBE_CONTEXT);
    const pack = PackFile.parse(parse(probe));
    if (pack.id !== entry.name) throw new Error(`Pack id "${pack.id}" does not match folder "${entry.name}"`);
    out.set(pack.id, { pack, raw, dir: join(dir, entry.name) });
  }
  return out;
}

/** Placeholder values used only to validate a pack's shape at load time. */
const PROBE_CONTEXT = {
  org: { name: "org", short_code: "org", sector: "x", size_band: "x", departments: [] },
  process: { id: "proc", name: "proc", pack: "x", actors: { R: "r", A: "a", C: [], I: [] }, sla_hours: 1, external_entry: false },
};

export type PackContext = { org: Record<string, unknown>; process?: Record<string, unknown> };

export function renderPack(loaded: LoadedPack, ctx: PackContext): Resource[] {
  const rendered = PackFile.parse(parse(render(loaded.raw, ctx as Record<string, unknown>)));
  const process = ctx.process ? String((ctx.process as { id: string }).id) : undefined;
  return rendered.resources.map((r) => Resource.parse({ ...r, source: { pack: loaded.pack.id, process } }));
}
