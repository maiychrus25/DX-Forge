// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "../src/index.js";

describe("hpdi-engine package", () => {
  it("exposes the engine version", () => {
    expect(ENGINE_VERSION).toBe("1.0");
  });
});
