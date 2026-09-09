// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IntentV1 } from "../schema/intent.js";
import type { PlanV1 } from "../schema/plan.js";
import { applyGate } from "./gate.js";
import { RULES, type ValidationError } from "./rules.js";

export { allowedLayers, applyGate } from "./gate.js";
export { RULES, type ValidationError } from "./rules.js";

/** Gate + every rule, always all of them. There is deliberately no option to skip a rule. */
export function validatePlan(plan: PlanV1, intent: IntentV1): { plan: PlanV1; errors: ValidationError[] } {
  const gated = applyGate(plan, intent);
  return { plan: gated, errors: RULES.flatMap((rule) => rule(gated)) };
}
