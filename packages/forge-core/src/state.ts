// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { resourceChecksum } from "./differ.js";
import type { TargetKind } from "./schema/intent.js";
import type { Resource } from "./schema/plan.js";
import { emptyState, StateV1, type StateEntry } from "./schema/state.js";

export class StateTargetMismatch extends Error {
  constructor(expected: string, found: string) {
    super(`state.json thuộc đích ${found}, không phải ${expected}. Dùng --state khác hoặc destroy trước.`);
    this.name = "StateTargetMismatch";
  }
}

export function readState(path: string, target: TargetKind): StateV1 {
  if (!existsSync(path)) return emptyState(target);
  const s = StateV1.parse(JSON.parse(readFileSync(path, "utf8")));
  if (s.target !== target) throw new StateTargetMismatch(target, s.target);
  return s;
}

export function writeState(path: string, state: StateV1): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(StateV1.parse(state), null, 2), { mode: 0o600 });
  renameSync(tmp, path);
}

export function entryFor(resource: Resource, externalId: string, now: Date): StateEntry {
  return { externalId, checksum: resourceChecksum(resource), appliedAt: now.toISOString(), layer: resource.layer, spec: structuredClone(resource.spec) };
}
