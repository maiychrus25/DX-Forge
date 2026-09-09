// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplyContext, Credentials, Resource, StateV1 } from "@dx-forge/forge-core";
import { MissingCredentials } from "@dx-forge/forge-core";
import { ossProvider } from "../src/index.js";

const H_TYPES = ["identity.realm", "identity.role", "identity.group", "storage.tree", "storage.acl", "portal.site", "comms.channel", "comms.topic"];

type RouteResult = { status: number; body?: unknown };

/** Same tiny fetch router used by the other test files in this package. */
function stubFetch(routes: Record<string, () => RouteResult>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init: RequestInit = {}) => {
      const url = new URL(String(input));
      const method = (init.method ?? "GET").toUpperCase();
      const path = url.pathname + url.search;
      const key = `${method} ${path}`;
      const handler = routes[key];
      if (!handler) throw new Error(`no route stubbed for ${key}`);
      const result = handler();
      return new Response(result.body !== undefined ? JSON.stringify(result.body) : null, { status: result.status });
    }),
  );
}

function ctxFor(credentials: Credentials, state: StateV1 = { version: 1, target: "oss", entries: {} }): ApplyContext {
  return { target: "oss", credentials, state, log: () => {}, now: () => new Date("2026-09-10T00:00:00Z") };
}

function resource(overrides: Partial<Resource> & Pick<Resource, "id" | "type" | "spec">): Resource {
  return { layer: "H", reason: "x", depends_on: [], gate: { allowed: true }, ...overrides };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("ossProvider", () => {
  it("registers exactly one adapter for every layer-H resource type the planner emits", () => {
    const provider = ossProvider({});
    expect(Object.keys(provider.adapters).sort()).toEqual([...H_TYPES].sort());
    for (const type of H_TYPES) {
      expect(provider.adapters[type]?.type).toBe(type);
    }
  });

  it("comms.channel dispatches on the resource's own spec.kind, not on which credential sections happen to be configured", async () => {
    // Both backends are configured, but only mattermost has a *valid* section; the resource says
    // "telegram", so the missing-credentials error must name "telegram" — proving the resource's
    // spec.kind (which mirrors intent.channels.chat at plan time), not credential presence, decides.
    const provider = ossProvider({});
    const creds: Credentials = { mattermost: { url: "https://mm.example.org", token: "tok", teamId: "team-1" } };
    const ctx = ctxFor(creds);
    const r = resource({ id: "h.channel", type: "comms.channel", spec: { kind: "telegram", name: "dxlab-dxlab" } });

    await expect(provider.adapters["comms.channel"]!.apply(ctx, r)).rejects.toThrow(MissingCredentials);
    try {
      await provider.adapters["comms.channel"]!.apply(ctx, r);
    } catch (e) {
      expect((e as InstanceType<typeof MissingCredentials>).section).toBe("telegram");
    }
  });

  it("comms.channel routes a mattermost-kind resource to the mattermost backend even when telegram credentials are also present", async () => {
    stubFetch({
      "GET /api/v4/teams/team-1/channels/name/dxlab-dxlab": () => ({ status: 200, body: { id: "chan-1" } }),
    });
    const provider = ossProvider({});
    const creds: Credentials = {
      telegram: { botToken: "tok", chatId: "-1001" },
      mattermost: { url: "https://mm.example.org", token: "tok", teamId: "team-1" },
    };
    const ctx = ctxFor(creds);
    const r = resource({ id: "h.channel", type: "comms.channel", spec: { kind: "mattermost", name: "dxlab-dxlab" } });

    const { externalId } = await provider.adapters["comms.channel"]!.apply(ctx, r);
    expect(externalId).toBe("chan-1");
  });

  it("comms.topic resolves its backend from the state entry of the channel it references, regardless of which extra credential sections are present", async () => {
    stubFetch({
      "POST /bottok/sendMessage": () => ({ status: 200, body: { ok: true, result: { message_id: 1 } } }),
      "POST /bottok/deleteMessage": () => ({ status: 200, body: { ok: true, result: true } }),
    });
    const provider = ossProvider({});
    const creds: Credentials = {
      telegram: { botToken: "tok", chatId: "-1001" },
      mattermost: { url: "https://mm.example.org", token: "tok", teamId: "team-1" },
    };
    const state: StateV1 = {
      version: 1,
      target: "oss",
      entries: {
        "h.channel": {
          externalId: "-1001",
          checksum: "0".repeat(64),
          appliedAt: "2026-09-10T00:00:00.000Z",
          layer: "H",
          spec: { kind: "telegram", name: "dxlab-dxlab", __type: "comms.channel" },
        },
      },
    };
    const ctx = ctxFor(creds, state);
    const r = resource({ id: "h.topic.announce", type: "comms.topic", spec: { channel: "h.channel", name: "Thông báo", purpose: "announce" } });
    const entry = { externalId: "55", checksum: "0".repeat(64), appliedAt: "2026-09-10T00:00:00.000Z", layer: "H" as const, spec: {} };

    const checks = await provider.adapters["comms.topic"]!.verify(ctx, r, entry);
    expect(checks.every((c) => c.ok)).toBe(true);
  });
});
