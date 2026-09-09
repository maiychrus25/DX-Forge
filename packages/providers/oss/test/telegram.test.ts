// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplyContext, Credentials, Resource, StateEntry, StateV1 } from "@dx-forge/forge-core";
import { MissingCredentials } from "@dx-forge/forge-core";
import { telegramCommsChannel, telegramCommsTopic } from "../src/telegram.js";

const FAKE_TOKEN = "test-bot-token-123:ABC-fake";
const CHAT_ID = "-100123456";

type RouteResult = { status: number; body?: unknown };
type RecordedCall = { method: string; path: string; body: unknown };

/** Same tiny fetch router used by test/keycloak.test.ts and test/nextcloud.test.ts, adapted for
 * Telegram's `{ ok, result }` JSON envelope (see src/http.ts and src/telegram.ts). */
function stubFetch(routes: Record<string, () => RouteResult>): RecordedCall[] {
  const calls: RecordedCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init: RequestInit = {}) => {
      const url = new URL(String(input));
      const method = (init.method ?? "GET").toUpperCase();
      const path = url.pathname + url.search;
      const body = typeof init.body === "string" ? tryParse(init.body) : undefined;
      calls.push({ method, path, body });
      const key = `${method} ${path}`;
      const handler = routes[key];
      if (!handler) throw new Error(`no route stubbed for ${key}`);
      const result = handler();
      return new Response(result.body !== undefined ? JSON.stringify(result.body) : null, { status: result.status });
    }),
  );
  return calls;
}

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function creds(): Credentials {
  return { telegram: { botToken: FAKE_TOKEN, chatId: CHAT_ID } };
}

function stateWithChannel(): StateV1 {
  return {
    version: 1,
    target: "oss",
    entries: {
      "h.channel": {
        externalId: CHAT_ID,
        checksum: "0".repeat(64),
        appliedAt: "2026-09-10T00:00:00.000Z",
        layer: "H",
        spec: { kind: "telegram", name: "dxlab-dxlab", __type: "comms.channel" },
      },
    },
  };
}

function ctxFor(credentials: Credentials, state: StateV1 = { version: 1, target: "oss", entries: {} }): ApplyContext {
  return { target: "oss", credentials, state, log: () => {}, now: () => new Date("2026-09-10T00:00:00Z") };
}

function resource(overrides: Partial<Resource> & Pick<Resource, "id" | "type" | "spec">): Resource {
  return { layer: "H", reason: "x", depends_on: [], gate: { allowed: true }, ...overrides };
}

const GET_CHAT = `POST /bot${FAKE_TOKEN}/getChat`;

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("telegramCommsChannel", () => {
  it("apply confirms the bot can see the chat and that it is a forum, externalId is the chat id", async () => {
    const calls = stubFetch({
      [GET_CHAT]: () => ({ status: 200, body: { ok: true, result: { id: -100123456, is_forum: true } } }),
    });
    const ctx = ctxFor(creds());
    const r = resource({ id: "h.channel", type: "comms.channel", spec: { kind: "telegram", name: "dxlab-dxlab" } });

    const { externalId } = await telegramCommsChannel.apply(ctx, r);

    expect(externalId).toBe(CHAT_ID);
    const call = calls.find((c) => c.method === "POST" && c.path === `/bot${FAKE_TOKEN}/getChat`);
    expect(call?.body).toEqual({ chat_id: CHAT_ID });
  });

  it("apply fails when the chat is not a forum supergroup", async () => {
    stubFetch({
      [GET_CHAT]: () => ({ status: 200, body: { ok: true, result: { id: -100123456, is_forum: false } } }),
    });
    const ctx = ctxFor(creds());
    const r = resource({ id: "h.channel", type: "comms.channel", spec: { kind: "telegram", name: "dxlab-dxlab" } });

    await expect(telegramCommsChannel.apply(ctx, r)).rejects.toThrow();
  });

  it("fails with MissingCredentials when ctx.credentials.telegram is absent", async () => {
    const ctx = ctxFor({});
    const r = resource({ id: "h.channel", type: "comms.channel", spec: { kind: "telegram", name: "dxlab-dxlab" } });
    await expect(telegramCommsChannel.apply(ctx, r)).rejects.toThrow(MissingCredentials);
  });

  it("verify reports chat reachability and forum status", async () => {
    stubFetch({
      [GET_CHAT]: () => ({ status: 200, body: { ok: true, result: { id: -100123456, is_forum: true } } }),
    });
    const ctx = ctxFor(creds());
    const r = resource({ id: "h.channel", type: "comms.channel", spec: { kind: "telegram", name: "dxlab-dxlab" } });

    const checks = await telegramCommsChannel.verify(ctx, r, {} as StateEntry);
    expect(checks.every((c) => c.ok)).toBe(true);
    expect(checks).toHaveLength(2);
  });

  it("destroy is a no-op: the bot cannot delete a Telegram supergroup", async () => {
    const calls = stubFetch({});
    const ctx = ctxFor(creds());
    const r = resource({ id: "h.channel", type: "comms.channel", spec: { kind: "telegram", name: "dxlab-dxlab" } });

    await telegramCommsChannel.destroy(ctx, r, {} as StateEntry);
    expect(calls).toHaveLength(0);
  });

  it("treats a Telegram ok:false envelope as a failure even though the HTTP status is 200", async () => {
    stubFetch({
      [GET_CHAT]: () => ({ status: 200, body: { ok: false, error_code: 400, description: "Bad Request: chat not found" } }),
    });
    const ctx = ctxFor(creds());
    const r = resource({ id: "h.channel", type: "comms.channel", spec: { kind: "telegram", name: "dxlab-dxlab" } });

    await expect(telegramCommsChannel.apply(ctx, r)).rejects.toThrow();
  });

  it("never leaks the bot token (which travels in the URL path) through a failed request's error message", async () => {
    stubFetch({
      [GET_CHAT]: () => ({ status: 401, body: { ok: false, error_code: 401, description: "Unauthorized" } }),
    });
    const ctx = ctxFor(creds());
    const r = resource({ id: "h.channel", type: "comms.channel", spec: { kind: "telegram", name: "dxlab-dxlab" } });

    try {
      await telegramCommsChannel.apply(ctx, r);
      expect.fail("expected apply to throw");
    } catch (e) {
      const message = (e as Error).message;
      expect(message).not.toContain(FAKE_TOKEN);
      expect(message).not.toContain(`/bot${FAKE_TOKEN}/`);
    }
  });
});

describe("telegramCommsTopic", () => {
  it("apply creates a forum topic when there is no previous state entry, externalId is the message_thread_id", async () => {
    const calls = stubFetch({
      [`POST /bot${FAKE_TOKEN}/createForumTopic`]: () => ({ status: 200, body: { ok: true, result: { message_thread_id: 55, name: "Thông báo" } } }),
    });
    const ctx = ctxFor(creds(), stateWithChannel());
    const r = resource({ id: "h.topic.announce", type: "comms.topic", spec: { channel: "h.channel", name: "Thông báo", purpose: "announce" } });

    const { externalId } = await telegramCommsTopic.apply(ctx, r);

    expect(externalId).toBe("55");
    const call = calls.find((c) => c.method === "POST" && c.path === `/bot${FAKE_TOKEN}/createForumTopic`);
    expect(call?.body).toEqual({ chat_id: CHAT_ID, name: "Thông báo" });
  });

  it("is idempotent: a second apply with a previous state entry keeps the thread id and creates nothing", async () => {
    const calls = stubFetch({
      [`POST /bot${FAKE_TOKEN}/createForumTopic`]: () => ({ status: 200, body: { ok: true, result: { message_thread_id: 55, name: "Thông báo" } } }),
    });
    const ctx = ctxFor(creds(), stateWithChannel());
    const r = resource({ id: "h.topic.announce", type: "comms.topic", spec: { channel: "h.channel", name: "Thông báo", purpose: "announce" } });

    const first = await telegramCommsTopic.apply(ctx, r);
    const previous: StateEntry = { externalId: first.externalId, checksum: "0".repeat(64), appliedAt: "2026-09-10T00:00:00.000Z", layer: "H", spec: {} };
    const second = await telegramCommsTopic.apply(ctx, r, previous);

    expect(first.externalId).toBe("55");
    expect(second.externalId).toBe("55");
    const creates = calls.filter((c) => c.method === "POST" && c.path === `/bot${FAKE_TOKEN}/createForumTopic`);
    expect(creates).toHaveLength(1);
  });

  it("verify sends a probe message into the topic thread and deletes it again", async () => {
    const calls = stubFetch({
      [`POST /bot${FAKE_TOKEN}/sendMessage`]: () => ({ status: 200, body: { ok: true, result: { message_id: 77 } } }),
      [`POST /bot${FAKE_TOKEN}/deleteMessage`]: () => ({ status: 200, body: { ok: true, result: true } }),
    });
    const ctx = ctxFor(creds(), stateWithChannel());
    const r = resource({ id: "h.topic.announce", type: "comms.topic", spec: { channel: "h.channel", name: "Thông báo", purpose: "announce" } });
    const entry: StateEntry = { externalId: "55", checksum: "0".repeat(64), appliedAt: "2026-09-10T00:00:00.000Z", layer: "H", spec: {} };

    const checks = await telegramCommsTopic.verify(ctx, r, entry);

    expect(checks.every((c) => c.ok)).toBe(true);
    const sent = calls.find((c) => c.method === "POST" && c.path === `/bot${FAKE_TOKEN}/sendMessage`);
    expect(sent?.body).toEqual({ chat_id: CHAT_ID, message_thread_id: 55, text: "kiểm tra DX-Forge" });
    const deleted = calls.find((c) => c.method === "POST" && c.path === `/bot${FAKE_TOKEN}/deleteMessage`);
    expect(deleted?.body).toEqual({ chat_id: CHAT_ID, message_id: 77 });
  });

  it("destroy deletes the forum topic by thread id", async () => {
    const calls = stubFetch({
      [`POST /bot${FAKE_TOKEN}/deleteForumTopic`]: () => ({ status: 200, body: { ok: true, result: true } }),
    });
    const ctx = ctxFor(creds(), stateWithChannel());
    const r = resource({ id: "h.topic.announce", type: "comms.topic", spec: { channel: "h.channel", name: "Thông báo", purpose: "announce" } });
    const entry: StateEntry = { externalId: "55", checksum: "0".repeat(64), appliedAt: "2026-09-10T00:00:00.000Z", layer: "H", spec: {} };

    await telegramCommsTopic.destroy(ctx, r, entry);

    const call = calls.find((c) => c.method === "POST" && c.path === `/bot${FAKE_TOKEN}/deleteForumTopic`);
    expect(call?.body).toEqual({ chat_id: CHAT_ID, message_thread_id: 55 });
  });

  it("fails with MissingCredentials when ctx.credentials.telegram is absent", async () => {
    const ctx = ctxFor({}, stateWithChannel());
    const r = resource({ id: "h.topic.announce", type: "comms.topic", spec: { channel: "h.channel", name: "Thông báo", purpose: "announce" } });
    await expect(telegramCommsTopic.apply(ctx, r)).rejects.toThrow(MissingCredentials);
  });
});
