// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";

const EnvSchema = z.object({
  FORGE_ADMIN_PASSWORD: z.string().min(1),
  FORGE_SESSION_SECRET: z.string().min(16),
  FORGE_DATA_DIR: z.string().default(".dxforge"),
  FORGE_BASE_URL: z.string().url().default("http://localhost:3000"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
});

export type Env = {
  adminPassword: string;
  sessionSecret: string;
  dataDir: string;
  baseUrl: string;
  telegramBotToken?: string;
  telegramChatId?: string;
};

export function parseEnv(source: Record<string, string | undefined>): Env {
  const e = EnvSchema.parse(source);
  return {
    adminPassword: e.FORGE_ADMIN_PASSWORD,
    sessionSecret: e.FORGE_SESSION_SECRET,
    dataDir: e.FORGE_DATA_DIR,
    baseUrl: e.FORGE_BASE_URL,
    telegramBotToken: e.TELEGRAM_BOT_TOKEN || undefined,
    telegramChatId: e.TELEGRAM_CHAT_ID || undefined,
  };
}

let cached: Env | undefined;
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
