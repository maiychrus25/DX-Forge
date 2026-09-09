// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Adapter, ApplyContext, Credentials, Provider, Resource } from "@dx-forge/forge-core";
import { identityGroup, identityRealm, identityRole } from "./keycloak.js";
import { portalSite, storageAcl, storageTree } from "./nextcloud.js";
import { mattermostCommsChannel, mattermostCommsTopic } from "./mattermost.js";
import { telegramCommsChannel, telegramCommsTopic } from "./telegram.js";

/**
 * `comms.channel` and `comms.topic` have two backends (Telegram, Mattermost); which one applies
 * to a given resource is decided per resource, not once for the whole provider: `ossProvider`'s
 * own `creds` parameter cannot carry that decision, because an operator's credentials JSON may
 * legitimately hold *both* sections (e.g. mid-migration between platforms) with no signal here
 * for which one the compiled plan actually intends. That signal exists one layer up, on the
 * resource itself — `comms.channel.spec.kind` is copied straight from `intent.channels.chat` by
 * the planner (see `packages/forge-core/src/planner/rules.ts`) — so `comms.channel` dispatches on
 * its own `spec.kind`, and `comms.topic` (whose spec has no `kind` of its own) reads it back off
 * the state entry of the `comms.channel` resource it depends on (`spec.channel`), exactly the way
 * `storage.acl`/`portal.site` already read `storage.tree`'s `h.tree` state entry in `nextcloud.ts`.
 * A missing credentials section still fails with `MissingCredentials` for the one backend the
 * resource actually names, even if the other section is also present and unused.
 */
function backendKind(ctx: ApplyContext, resource: Resource): "telegram" | "mattermost" {
  if (resource.type === "comms.channel") {
    const kind = resource.spec.kind;
    if (kind === "telegram" || kind === "mattermost") return kind;
    throw new Error(`comms.channel "${resource.id}" has an invalid spec.kind (${JSON.stringify(kind)}); expected "telegram" or "mattermost".`);
  }
  const channelId = resource.spec.channel;
  const channelEntry = typeof channelId === "string" ? ctx.state.entries[channelId] : undefined;
  const kind = channelEntry?.spec.kind;
  if (kind === "telegram" || kind === "mattermost") return kind;
  throw new Error(`comms.topic "${resource.id}" cannot determine its chat backend: state entry "${String(channelId)}" (its comms.channel) is missing or has no spec.kind.`);
}

function backendFor(ctx: ApplyContext, resource: Resource): Adapter {
  const kind = backendKind(ctx, resource);
  if (resource.type === "comms.channel") return kind === "telegram" ? telegramCommsChannel : mattermostCommsChannel;
  return kind === "telegram" ? telegramCommsTopic : mattermostCommsTopic;
}

const commsChannel: Adapter = {
  type: "comms.channel",
  apply: (ctx, resource, previous) => backendFor(ctx, resource).apply(ctx, resource, previous),
  verify: (ctx, resource, entry) => backendFor(ctx, resource).verify(ctx, resource, entry),
  destroy: (ctx, resource, entry) => backendFor(ctx, resource).destroy(ctx, resource, entry),
};

const commsTopic: Adapter = {
  type: "comms.topic",
  apply: (ctx, resource, previous) => backendFor(ctx, resource).apply(ctx, resource, previous),
  verify: (ctx, resource, entry) => backendFor(ctx, resource).verify(ctx, resource, entry),
  destroy: (ctx, resource, entry) => backendFor(ctx, resource).destroy(ctx, resource, entry),
};

/** Builds the `oss` target provider. `creds` is accepted for symmetry with other target-kind
 * provider factories (`providerFor(kind, creds)`, plan 04 Task 7); every adapter here reads its
 * own credentials section from `ctx.credentials` at call time instead, which — in the real CLI
 * flow — is the same object as `creds`. */
export function ossProvider(creds: Credentials): Provider {
  void creds;
  return {
    name: "oss",
    adapters: {
      "identity.realm": identityRealm,
      "identity.role": identityRole,
      "identity.group": identityGroup,
      "storage.tree": storageTree,
      "storage.acl": storageAcl,
      "portal.site": portalSite,
      "comms.channel": commsChannel,
      "comms.topic": commsTopic,
    },
  };
}
