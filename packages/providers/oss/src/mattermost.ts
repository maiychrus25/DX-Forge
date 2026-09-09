// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Adapter, ApplyContext, Credentials, Resource } from "@dx-forge/forge-core";
import { MissingCredentials } from "@dx-forge/forge-core";
import { bearer, json, request } from "./http.js";

type MattermostCredentials = NonNullable<Credentials["mattermost"]>;
const VERIFY_MESSAGE = "kiểm tra DX-Forge";

function requireMattermost(ctx: ApplyContext): MattermostCredentials {
  if (!ctx.credentials.mattermost) throw new MissingCredentials("mattermost");
  return ctx.credentials.mattermost;
}

/** Thin client over the Mattermost REST API (`/api/v4`). Every call carries the personal/bot
 * access token as a secret so an unexpected-status body never leaks it into an error message. */
function mattermostClient(creds: MattermostCredentials) {
  async function call(path: string, init: RequestInit & { expect?: number[] }): Promise<Response> {
    return request(`${creds.url}${path}`, { ...init, headers: { ...(init.headers ?? {}), Authorization: bearer(creds.token) } }, [creds.token]);
  }
  return {
    get: (path: string) => call(path, { method: "GET", expect: [200, 404] }),
    post: (path: string, body: unknown) => call(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), expect: [200, 201] }),
    del: (path: string) => call(path, { method: "DELETE", expect: [200] }),
  };
}

type MattermostClient = ReturnType<typeof mattermostClient>;

/** Mattermost channel `name` must be a lowercase slug; `display_name` keeps the human-readable
 * text from the plan spec. Diacritics (Vietnamese department/topic names) are stripped rather
 * than rejected. */
function slugify(s: string): string {
  const slug = s
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug.length > 0 ? slug : "channel";
}

/** Idempotent by lookup, like every other adapter: a channel with this name in this team is found
 * by `GET .../channels/name/<name>` before `POST /api/v4/channels` creates one. */
async function ensureChannel(client: MattermostClient, teamId: string, name: string, displayName: string): Promise<string> {
  const found = await client.get(`/api/v4/teams/${teamId}/channels/name/${encodeURIComponent(name)}`);
  if (found.status === 200) {
    const data = await json<{ id: string }>(found);
    return data.id;
  }
  const created = await client.post("/api/v4/channels", { team_id: teamId, name, display_name: displayName, type: "O" });
  const data = await json<{ id: string }>(created);
  return data.id;
}

/** `comms.channel` (kind "mattermost"): ensures a channel named `spec.name` (slugified) in
 * `creds.teamId`. `externalId` is the Mattermost channel id. */
export const mattermostCommsChannel: Adapter = {
  type: "comms.channel",

  async apply(ctx, resource) {
    const creds = requireMattermost(ctx);
    const client = mattermostClient(creds);
    const displayName = resource.spec.name as string;
    const id = await ensureChannel(client, creds.teamId, slugify(displayName), displayName);
    return { externalId: id };
  },

  async verify(ctx, resource) {
    const creds = requireMattermost(ctx);
    const client = mattermostClient(creds);
    const name = slugify(resource.spec.name as string);
    const res = await client.get(`/api/v4/teams/${creds.teamId}/channels/name/${encodeURIComponent(name)}`);
    return [{ name: "kênh tồn tại", ok: res.status === 200, evidence: `GET channels/name/${name} -> ${res.status}` }];
  },

  async destroy(ctx, _resource, entry) {
    const creds = requireMattermost(ctx);
    const client = mattermostClient(creds);
    await client.del(`/api/v4/channels/${entry.externalId}`);
  },
};

function mattermostChannelName(ctx: ApplyContext, resource: Resource): string {
  const channelId = resource.spec.channel;
  const entry = typeof channelId === "string" ? ctx.state.entries[channelId] : undefined;
  const name = entry?.spec.name;
  if (typeof name !== "string") throw new Error(`Resource ${resource.id} requires state entry "${String(channelId)}" (comms.channel) already applied.`);
  return name;
}

/** `comms.topic` (kind "mattermost"): a topic is its own channel named `<channel>-<topic>`
 * (slugified), created in the same team as the parent channel. Idempotent by the same
 * lookup-then-create as `comms.channel` — Mattermost, unlike the Telegram Bot API, can list
 * channels by name, so no `previous`-based fallback is needed here. */
export const mattermostCommsTopic: Adapter = {
  type: "comms.topic",

  async apply(ctx, resource) {
    const creds = requireMattermost(ctx);
    const client = mattermostClient(creds);
    const channelName = mattermostChannelName(ctx, resource);
    const topicName = resource.spec.name as string;
    const name = `${slugify(channelName)}-${slugify(topicName)}`;
    const displayName = `${channelName}-${topicName}`;
    const id = await ensureChannel(client, creds.teamId, name, displayName);
    return { externalId: id };
  },

  async verify(ctx, _resource, entry) {
    const creds = requireMattermost(ctx);
    const client = mattermostClient(creds);
    const posted = await client.post("/api/v4/posts", { channel_id: entry.externalId, message: VERIFY_MESSAGE });
    const data = await json<{ id: string }>(posted);
    await client.del(`/api/v4/posts/${data.id}`);
    return [{ name: "gửi tin nhắn thử vào kênh topic", ok: typeof data.id === "string" && data.id.length > 0, evidence: `POST posts -> id ${data.id}` }];
  },

  async destroy(ctx, _resource, entry) {
    const creds = requireMattermost(ctx);
    const client = mattermostClient(creds);
    await client.del(`/api/v4/channels/${entry.externalId}`);
  },
};
