// SPDX-License-Identifier: AGPL-3.0-or-later
import type { LoadedPack } from "./packs/loader.js";
import { buildPlan } from "./planner/index.js";
import type { IntentV1 } from "./schema/intent.js";
import type { PlanV1 } from "./schema/plan.js";
import { validatePlan, type ValidationError } from "./validator/index.js";

/** intent + packs → validated, gated plan. AI patches (plan 03) slot in between buildPlan and validatePlan. */
export function compile(intent: IntentV1, packs: Map<string, LoadedPack>, now: Date = new Date()): { plan: PlanV1; errors: ValidationError[] } {
  return validatePlan(buildPlan(intent, packs, now), intent);
}
