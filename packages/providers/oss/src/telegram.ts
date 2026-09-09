// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Adapter, ApplyContext, Credentials, Resource } from "@dx-forge/forge-core";
import { AdapterError, MissingCredentials } from "@dx-forge/forge-core";
import { HttpError, json, redact, request } from "./http.js";

type TelegramCredentials = NonNullable<Credentials["telegram"]>;

const TELEGRAM_API = "https://api.telegram.org";
const VERIFY_MESSAGE = "kiểm tra DX-Forge";

type TelegramEnvelope<T> = { ok: true; result: T } | { ok: false; error_code?: number; description?: string };

function requireTelegram(ctx: ApplyContext): TelegramCredentials {
  if (!ctx.credentials.telegram) throw new MissingCredentials("telegram");
  return ctx.credentials.telegram;
}

/**
 * Calls one Telegram Bot API method (`https://api.telegram.org/bot<TOKEN>/<method>`). Two things
 * make this endpoint shape harder to use safely than Keycloak's or Nextcloud's:
 *
 * 1. The bot token travels in the URL *path*, not a header. `http.ts#request()` builds its
 *    `HttpError` message as `HTTP <status> <url>: <bodySnippet>` and only redacts the body
 *    snippet — the raw, token-bearing URL goes straight into `.message` (and, via V8, into
 *    `.stack`). Re-running `redact()` on an already-thrown `HttpError` in place would not help:
 *    `.stack` is captured once, at the original throw site, and stays poisoned. So every failure
 *    path here constructs a *fresh* error (a fresh stack, captured only at this line) whose
 *    message has already had the token stripped by `redact()`.
 * 2. The API reports errors as `{ ok: false, error_code, description }` inside a 200 OK response,
 *    never (only) via HTTP status. `call()` therefore treats `ok: false` as a failure exactly like
 *    a non-2xx HTTP status.
 */
async function call<T>(botToken: string, resourceId: string, method: string, body: Record<string, unknown>): Promise<T> {
  const url = `${TELEGRAM_API}/bot${botToken}/${method}`;
  let res: Response;
  try {
    res = await request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), expect: [200] }, [botToken]);
  } catch (e) {
    if (e instanceof HttpError) {
      throw new AdapterError(resourceId, `Lỗi gọi Telegram Bot API (${method}): ${redact(e.message, [botToken])}`, e.status);
    }
    throw e;
  }
  const data = await json<TelegramEnvelope<T>>(res);
  if (!data.ok) {
    throw new AdapterError(resourceId, `Telegram API báo lỗi cho ${method}: ${redact(data.description ?? "không rõ nguyên nhân", [botToken])}`, data.error_code);
  }
  return data.result;
}

function telegramChatId(ctx: ApplyContext, resource: Resource): string {
  const channelId = resource.spec.channel;
  const entry = typeof channelId === "string" ? ctx.state.entries[channelId] : undefined;
  if (!entry) throw new Error(`Resource ${resource.id} requires state entry "${String(channelId)}" (comms.channel) already applied.`);
  return entry.externalId;
}

/** `comms.channel` (kind "telegram"): the Telegram supergroup itself is provisioned by the
 * operator, not by dxforge — the bot can only confirm it can see it and that Topics are enabled.
 * `externalId` is the configured chat id, unchanged across applies. */
export const telegramCommsChannel: Adapter = {
  type: "comms.channel",

  async apply(ctx, resource) {
    const creds = requireTelegram(ctx);
    const chat = await call<{ id: number; is_forum?: boolean }>(creds.botToken, resource.id, "getChat", { chat_id: creds.chatId });
    if (!chat.is_forum) {
      throw new AdapterError(resource.id, `Nhóm Telegram ${creds.chatId} chưa bật chế độ Chủ đề (Forum Topics); không thể tạo topic.`);
    }
    return { externalId: creds.chatId };
  },

  async verify(ctx, resource) {
    const creds = requireTelegram(ctx);
    const chat = await call<{ id: number; is_forum?: boolean }>(creds.botToken, resource.id, "getChat", { chat_id: creds.chatId });
    return [
      { name: "bot truy cập được nhóm", ok: true, evidence: `getChat(${creds.chatId}) -> id ${chat.id}` },
      { name: "nhóm đã bật Chủ đề (Forum Topics)", ok: chat.is_forum === true, evidence: `is_forum = ${chat.is_forum ?? false}` },
    ];
  },

  async destroy() {
    // The Bot API has no operation to delete a supergroup; it is not dxforge's to destroy.
  },
};

/** `comms.topic` (kind "telegram"): the Bot API cannot list a supergroup's forum topics, so this
 * adapter cannot look one up by name the way every other adapter does. The ruling (plan 04 Task 6)
 * is to create the topic once and, on every later apply, keep the thread id already recorded in
 * state (`previous.externalId`) rather than attempt a lookup. */
export const telegramCommsTopic: Adapter = {
  type: "comms.topic",

  async apply(ctx, resource, previous) {
    const creds = requireTelegram(ctx);
    if (previous) return { externalId: previous.externalId };
    const chatId = telegramChatId(ctx, resource);
    const name = resource.spec.name as string;
    const created = await call<{ message_thread_id: number }>(creds.botToken, resource.id, "createForumTopic", { chat_id: chatId, name });
    return { externalId: String(created.message_thread_id) };
  },

  async verify(ctx, resource, entry) {
    const creds = requireTelegram(ctx);
    const chatId = telegramChatId(ctx, resource);
    const messageThreadId = Number(entry.externalId);
    const sent = await call<{ message_id: number }>(creds.botToken, resource.id, "sendMessage", {
      chat_id: chatId,
      message_thread_id: messageThreadId,
      text: VERIFY_MESSAGE,
    });
    await call(creds.botToken, resource.id, "deleteMessage", { chat_id: chatId, message_id: sent.message_id });
    return [{ name: "gửi tin nhắn thử vào topic", ok: typeof sent.message_id === "number", evidence: `sendMessage -> message_id ${sent.message_id}` }];
  },

  async destroy(ctx, resource, entry) {
    const creds = requireTelegram(ctx);
    const chatId = telegramChatId(ctx, resource);
    await call(creds.botToken, resource.id, "deleteForumTopic", { chat_id: chatId, message_thread_id: Number(entry.externalId) });
  },
};
