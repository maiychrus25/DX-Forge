// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Credentials } from "./credentials.js";
import type { TargetKind } from "./schema/intent.js";
import type { Resource } from "./schema/plan.js";
import type { Check, StateEntry, StateV1 } from "./schema/state.js";

export type ApplyContext = { target: TargetKind; credentials: Credentials; state: StateV1; log: (line: string) => void; now: () => Date };

export interface Adapter {
  readonly type: string;
  apply(ctx: ApplyContext, resource: Resource, previous?: StateEntry): Promise<{ externalId: string }>;
  verify(ctx: ApplyContext, resource: Resource, entry: StateEntry): Promise<Check[]>;
  destroy(ctx: ApplyContext, resource: Resource, entry: StateEntry): Promise<void>;
}

export interface Provider { readonly name: TargetKind; readonly adapters: Record<string, Adapter>; }

export class MissingCredentials extends Error {
  constructor(public readonly section: string) {
    super(`Thiếu thông tin đăng nhập cho ${section} trong credentials.`);
    this.name = "MissingCredentials";
  }
}
export class AdapterError extends Error {
  constructor(public readonly resourceId: string, message: string, public readonly status?: number) {
    super(message);
    this.name = "AdapterError";
  }
}
export type { Check };
