// SPDX-License-Identifier: AGPL-3.0-or-later
import { getEnv } from "@/lib/env";

/** Sends an operator notification. Always logs; posts to Telegram when configured. Never throws. */
export async function notify(text: string): Promise<void> {
  console.log(`[notify] ${text}`);
  const { telegramBotToken, telegramChatId } = getEnv();
  if (!telegramBotToken || !telegramChatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: telegramChatId, text, disable_web_page_preview: true }),
    });
  } catch (e) {
    console.warn(`[notify] telegram failed: ${(e as Error).message}`);
  }
}
