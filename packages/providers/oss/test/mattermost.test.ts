// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplyContext, Credentials, Resource, StateEntry, StateV1 } from "@dx-forge/forge-core";
import { MissingCredentials } from "@dx-forge/forge-core";
import { mattermostCommsChannel, mattermostCommsTopic } from "../src/mattermost.js";

const MM_URL = "https://mm.example.org";
const MM_TOKEN = "mm-s3cr3t-token";
const TEAM_ID = "team-1";

type RouteResult = { status: number; body?: unknown };
type RecordedCall = { method: string; path: string; body: unknown; headers: Record<string, string> };

/** Same tiny fetch router used by test/keycloak.test.ts and test/nextcloud.test.ts. */
function stubFetch(routes: Record<string, () => RouteResult>): RecordedCall[] {
  const calls: RecordedCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init: RequestInit = {}) => {
      const url = new URL(String(input));
      const method = (init.method ?? "GET").toUpperCase();
      const path = url.pathname + url.search;
      const headers = { ...(init.headers as Record<string, string> | undefined) };
      const body = typeof init.body === "string" ? tryParse(init.body) : undefined;
      calls.push({ method, path, body, headers });
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
  return { mattermost: { url: MM_URL, token: MM_TOKEN, teamId: TEAM_ID } };
}

function stateWithChannel(): StateV1 {
  return {
    version: 1,
    target: "oss",
    entries: {
      "h.channel": {
        externalId: "chan-1",
        checksum: "0".repeat(64),
        appliedAt: "2026-09-10T00:00:00.000Z",
        layer: "H",
        spec: { kind: "mattermost", name: "dxlab-dxlab", __type: "comms.channel" },
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

const CHANNEL_BY_NAME = `/api/v4/teams/${TEAM_ID}/channels/name/dxlab-dxlab`;

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("mattermostCommsChannel", () => {
  it("creates the channel (slugified name) in the team when it does not exist yet", async () => {
    const calls = stubFetch({
      [`GET ${CHANNEL_BY_NAME}`]: () => ({ status: 404, body: { status_code: 404, message: "not found" } }),
      "POST /api/v4/channels": () => ({ status: 201, body: { id: "chan-1", name: "dxlab-dxlab" } }),
    });
    const ctx = ctxFor(creds());
    const r = resource({ id: "h.channel", type: "comms.channel", spec: { kind: "mattermost", name: "dxlab-dxlab" } });

    const { externalId } = await mattermostCommsChannel.apply(ctx, r);

    expect(externalId).toBe("chan-1");
    const create = calls.find((c) => c.method === "POST" && c.path === "/api/v4/channels");
    expect(create?.body).toEqual({ team_id: TEAM_ID, name: "dxlab-dxlab", display_name: "dxlab-dxlab", type: "O" });
    expect(create?.headers.Authorization).toBe(`Bearer ${MM_TOKEN}`);
  });

  it("is idempotent: a second apply issues no POST when the channel already exists", async () => {
    const calls = stubFetch({
      [`GET ${CHANNEL_BY_NAME}`]: () => ({ status: 200, body: { id: "chan-1", name: "dxlab-dxlab" } }),
    });
    const ctx = ctxFor(creds());
    const r = resource({ id: "h.channel", type: "comms.channel", spec: { kind: "mattermost", name: "dxlab-dxlab" } });

    const first = await mattermostCommsChannel.apply(ctx, r);
    const second = await mattermostCommsChannel.apply(ctx, r);

    expect(first.externalId).toBe("chan-1");
    expect(second.externalId).toBe("chan-1");
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("verify checks the channel exists by name, destroy deletes it by id", async () => {
    const calls = stubFetch({
      [`GET ${CHANNEL_BY_NAME}`]: () => ({ status: 200, body: { id: "chan-1", name: "dxlab-dxlab" } }),
      "DELETE /api/v4/channels/chan-1": () => ({ status: 200, body: { status: "OK" } }),
    });
    const ctx = ctxFor(creds());
    const r = resource({ id: "h.channel", type: "comms.channel", spec: { kind: "mattermost", name: "dxlab-dxlab" } });

    const checks = await mattermostCommsChannel.verify(ctx, r, {} as StateEntry);
    expect(checks).toEqual([{ name: "kênh tồn tại", ok: true, evidence: `GET channels/name/dxlab-dxlab -> 200` }]);

    await mattermostCommsChannel.destroy(ctx, r, { ...({} as StateEntry), externalId: "chan-1" });
    expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/v4/channels/chan-1")).toBe(true);
  });

  it("fails with MissingCredentials when ctx.credentials.mattermost is absent", async () => {
    const ctx = ctxFor({});
    const r = resource({ id: "h.channel", type: "comms.channel", spec: { kind: "mattermost", name: "dxlab-dxlab" } });
    await expect(mattermostCommsChannel.apply(ctx, r)).rejects.toThrow(MissingCredentials);
  });
});

describe("mattermostCommsTopic", () => {
  const TOPIC_CHANNEL_BY_NAME = `/api/v4/teams/${TEAM_ID}/channels/name/dxlab-dxlab-thong-bao`;

  it("creates a channel named <channel>-<topic> (slugified) for the topic", async () => {
    const calls = stubFetch({
      [`GET ${TOPIC_CHANNEL_BY_NAME}`]: () => ({ status: 404, body: { status_code: 404, message: "not found" } }),
      "POST /api/v4/channels": () => ({ status: 201, body: { id: "topic-chan-1" } }),
    });
    const ctx = ctxFor(creds(), stateWithChannel());
    const r = resource({ id: "h.topic.announce", type: "comms.topic", spec: { channel: "h.channel", name: "Thông báo", purpose: "announce" } });

    const { externalId } = await mattermostCommsTopic.apply(ctx, r);

    expect(externalId).toBe("topic-chan-1");
    const create = calls.find((c) => c.method === "POST" && c.path === "/api/v4/channels");
    expect(create?.body).toMatchObject({ team_id: TEAM_ID, name: "dxlab-dxlab-thong-bao", type: "O" });
  });

  it("is idempotent: a second apply issues no POST when the topic channel already exists", async () => {
    const calls = stubFetch({
      [`GET ${TOPIC_CHANNEL_BY_NAME}`]: () => ({ status: 200, body: { id: "topic-chan-1" } }),
    });
    const ctx = ctxFor(creds(), stateWithChannel());
    const r = resource({ id: "h.topic.announce", type: "comms.topic", spec: { channel: "h.channel", name: "Thông báo", purpose: "announce" } });

    const first = await mattermostCommsTopic.apply(ctx, r);
    const second = await mattermostCommsTopic.apply(ctx, r);

    expect(first.externalId).toBe("topic-chan-1");
    expect(second.externalId).toBe("topic-chan-1");
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("verify posts a probe message into the topic channel and deletes it, destroy deletes the channel", async () => {
    const calls = stubFetch({
      "POST /api/v4/posts": () => ({ status: 201, body: { id: "post-1" } }),
      "DELETE /api/v4/posts/post-1": () => ({ status: 200, body: { status: "OK" } }),
      "DELETE /api/v4/channels/topic-chan-1": () => ({ status: 200, body: { status: "OK" } }),
    });
    const ctx = ctxFor(creds(), stateWithChannel());
    const r = resource({ id: "h.topic.announce", type: "comms.topic", spec: { channel: "h.channel", name: "Thông báo", purpose: "announce" } });
    const entry: StateEntry = { externalId: "topic-chan-1", checksum: "0".repeat(64), appliedAt: "2026-09-10T00:00:00.000Z", layer: "H", spec: {} };

    const checks = await mattermostCommsTopic.verify(ctx, r, entry);
    expect(checks.every((c) => c.ok)).toBe(true);
    const post = calls.find((c) => c.method === "POST" && c.path === "/api/v4/posts");
    expect(post?.body).toEqual({ channel_id: "topic-chan-1", message: "kiểm tra DX-Forge" });
    expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/v4/posts/post-1")).toBe(true);

    await mattermostCommsTopic.destroy(ctx, r, entry);
    expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/v4/channels/topic-chan-1")).toBe(true);
  });

  it("fails with MissingCredentials when ctx.credentials.mattermost is absent", async () => {
    const ctx = ctxFor({}, stateWithChannel());
    const r = resource({ id: "h.topic.announce", type: "comms.topic", spec: { channel: "h.channel", name: "Thông báo", purpose: "announce" } });
    await expect(mattermostCommsTopic.apply(ctx, r)).rejects.toThrow(MissingCredentials);
  });
});
