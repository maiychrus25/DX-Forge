// SPDX-License-Identifier: AGPL-3.0-or-later
import { ossProvider } from "@dx-forge/provider-oss";
import type { Credentials, Provider, TargetKind } from "@dx-forge/forge-core";

/** Thrown by `providerFor` for a target kind this build of the CLI cannot apply to yet. */
export class UnsupportedTarget extends Error {
  constructor(public readonly kind: TargetKind) {
    super(`Đích ${kind} có ở plan 07/08`);
    this.name = "UnsupportedTarget";
  }
}

/** Resolves the `Provider` for a target kind. Only `oss` (plan 04) exists in this build; `gws`
 * (plan 07) and `manifest` (plan 08) are not implemented yet. */
export function providerFor(kind: TargetKind, creds: Credentials): Provider {
  if (kind === "oss") return ossProvider(creds);
  throw new UnsupportedTarget(kind);
}
