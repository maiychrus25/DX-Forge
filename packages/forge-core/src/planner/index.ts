// SPDX-License-Identifier: AGPL-3.0-or-later
import { checksum } from "../hash.js";
import { PackNotFound, renderPack, type LoadedPack } from "../packs/loader.js";
import type { IntentV1 } from "../schema/intent.js";
import { PlanV1, type Resource } from "../schema/plan.js";
import { layerD, layerH, layerI } from "./rules.js";

export class DuplicateResourceId extends Error {
  constructor(id: string) {
    super(`Duplicate resource id: ${id}`);
    this.name = "DuplicateResourceId";
  }
}

/** intent → ungated plan: rule-generated H, pack-expanded P, entity-derived D, rule-generated I. Validation is a separate step. */
export function buildPlan(intent: IntentV1, packs: Map<string, LoadedPack>, now: Date = new Date()): PlanV1 {
  const resources: Resource[] = [...layerH(intent)];
  for (const loaded of packs.values()) {
    if (loaded.pack.scope === "org") resources.push(...renderPack(loaded, { org: intent.organization }));
  }
  for (const process of intent.core_processes) {
    if (!process.pack) continue;
    const loaded = packs.get(process.pack);
    if (!loaded || loaded.pack.scope !== "process") throw new PackNotFound(process.pack);
    resources.push(...renderPack(loaded, { org: intent.organization, process }));
  }
  const entities = resources.filter((r) => r.type === "process.entity");
  resources.push(...layerD(intent, entities), ...layerI(intent));
  const seen = new Set<string>();
  for (const r of resources) {
    if (seen.has(r.id)) throw new DuplicateResourceId(r.id);
    seen.add(r.id);
  }
  return PlanV1.parse({ version: 1, generated_at: now.toISOString(), intent_hash: checksum(intent), target: intent.target.kind, resources, notes: [] });
}
