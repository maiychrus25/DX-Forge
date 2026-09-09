// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";

export const CredentialsSchema = z.object({
  keycloak: z.object({ url: z.string().url(), admin: z.string().min(1), password: z.string().min(1), realmAdminClient: z.string().default("admin-cli") }).optional(),
  nextcloud: z.object({ url: z.string().url(), user: z.string().min(1), password: z.string().min(1), staffUser: z.string().optional(), staffPassword: z.string().optional() }).optional(),
  telegram: z.object({ botToken: z.string().min(1), chatId: z.string().min(1) }).optional(),
  mattermost: z.object({ url: z.string().url(), token: z.string().min(1), teamId: z.string().min(1) }).optional(),
}).passthrough();
export type Credentials = z.infer<typeof CredentialsSchema>;

export class CredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialsError";
  }
}

/** Reads and validates the JSON credentials held in the environment variable `ref`. The value is never included in errors. */
export function loadCredentials(ref: string, env: Record<string, string | undefined> = process.env): Credentials {
  const raw = env[ref];
  if (!raw) throw new CredentialsError(`Thiếu biến môi trường ${ref} chứa thông tin đăng nhập đích (JSON).`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CredentialsError(`Biến môi trường ${ref} không phải JSON hợp lệ.`);
  }
  const res = CredentialsSchema.safeParse(parsed);
  if (!res.success) throw new CredentialsError(`Thông tin đăng nhập trong ${ref} sai cấu trúc: ${res.error.issues.map((i) => i.path.join(".")).join(", ")}.`);
  return res.data;
}
