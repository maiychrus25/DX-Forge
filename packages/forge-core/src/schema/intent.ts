// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";

export const Layer = z.enum(["H", "P", "D", "I"]);
export type Layer = z.infer<typeof Layer>;
export const TargetKind = z.enum(["oss", "gws", "manifest"]);
export type TargetKind = z.infer<typeof TargetKind>;
export const ShapeName = z.enum(["spear", "kite", "illusion", "diamond", "transitional"]);
export type ShapeName = z.infer<typeof ShapeName>;

const slug = (min: number, max: number) => z.string().regex(new RegExp(`^[a-z0-9][a-z0-9-]{${min - 1},${max - 1}}$`));

const Department = z.object({
  code: slug(2, 20),
  name: z.string().min(1),
  head_email: z.string().email().optional(),
});

const Actors = z.object({
  R: z.string().min(1),
  A: z.string().min(1),
  C: z.array(z.string()).default([]),
  I: z.array(z.string()).default([]),
});

const CoreProcess = z.object({
  id: slug(2, 30),
  pack: z.string().optional(),
  name: z.string().min(1),
  actors: Actors,
  sla_hours: z.number().int().positive().default(24),
  external_entry: z.boolean().default(false),
});

export const Maturity = z.object({
  assessment_id: z.string().min(1),
  hpdi: z.object({ H: z.number().min(0).max(100), P: z.number().min(0).max(100), D: z.number().min(0).max(100), I: z.number().min(0).max(100) }),
  shape: ShapeName,
  dti_level: z.number().int().min(1).max(5),
  discrepancies: z.record(z.string(), z.number()).default({}),
});

export const IntentV1 = z.object({
  version: z.literal(1),
  organization: z.object({
    name: z.string().min(1),
    short_code: z.string().regex(/^[a-z0-9]{2,12}$/),
    sector: z.string().min(1),
    size_band: z.string().min(1),
    departments: z.array(Department).min(1),
  }),
  maturity: Maturity.optional(),
  core_processes: z.array(CoreProcess).min(1),
  channels: z.object({
    chat: z.enum(["telegram", "mattermost"]),
    notify_targets: z.object({ announce: z.string().min(1), alerts: z.string().min(1), approvals: z.string().min(1) }),
  }),
  target: z.object({
    kind: TargetKind,
    endpoint: z.string().url().optional(),
    /** Name of the environment variable holding credentials. Never the secret itself. */
    credentials_ref: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  }),
  constraints: z.object({ language: z.enum(["vi", "en"]).default("vi"), pii_masking: z.boolean().default(true) }).default({}),
});
export type IntentV1 = z.infer<typeof IntentV1>;

export function loadIntentFile(path: string): IntentV1 {
  return IntentV1.parse(parse(readFileSync(path, "utf8")));
}
