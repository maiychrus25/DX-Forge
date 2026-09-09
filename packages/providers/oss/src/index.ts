// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Credentials, Provider } from "@dx-forge/forge-core";
import { identityGroup, identityRealm, identityRole } from "./keycloak.js";

/**
 * Builds the `oss` target provider. `creds` is accepted here (rather than only inside each
 * adapter's `ApplyContext`) because later resource types share one Keycloak/Nextcloud identity
 * but pick between alternative backends (Telegram vs. Mattermost) depending on which credentials
 * section is present; the adapters registered so far do not need that choice and read their own
 * section from `ctx.credentials` at call time.
 */
export function ossProvider(creds: Credentials): Provider {
  void creds;
  return {
    name: "oss",
    adapters: {
      "identity.realm": identityRealm,
      "identity.role": identityRole,
      "identity.group": identityGroup,
    },
  };
}
