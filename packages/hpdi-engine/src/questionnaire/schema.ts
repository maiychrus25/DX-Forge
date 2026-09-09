// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";
import { PILLARS, TIERS, type Questionnaire } from "../types.js";
import v1 from "./questionnaire.v1.json" with { type: "json" };

const Option = z.object({ value: z.number(), label: z.string().min(1) });

export const QuestionSchema = z
  .object({
    id: z.string().regex(/^[A-Z]{3}-\d{2}$/),
    pillar: z.enum(PILLARS),
    tiers: z.array(z.enum(TIERS)).min(1),
    type: z.enum(["scale", "choice", "supp"]),
    text: z.string().min(1),
    options: z.array(Option).min(2).optional(),
    max: z.number().positive(),
    supp: z.object({ axis: z.enum(["P", "D", "I"]) }).optional(),
    weightEvidence: z.boolean().optional(),
  })
  .superRefine((q, ctx) => {
    if (q.type !== "scale" && !q.options) ctx.addIssue({ code: "custom", message: "choice/supp needs options" });
    if (q.type === "supp" && !q.supp) ctx.addIssue({ code: "custom", message: "supp needs axis" });
    if (q.options && q.options.some((o) => o.value > q.max)) ctx.addIssue({ code: "custom", message: "option above max" });
  });

export const QuestionnaireSchema = z.object({
  version: z.string(),
  questions: z.array(QuestionSchema).min(1),
});

export function loadQuestionnaireV1(): Questionnaire {
  return QuestionnaireSchema.parse(v1) as Questionnaire;
}
