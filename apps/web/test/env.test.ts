// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/lib/env.js";

describe("parseEnv", () => {
  it("applies defaults and drops empty optional values", () => {
    const e = parseEnv({ FORGE_ADMIN_PASSWORD: "x", FORGE_SESSION_SECRET: "0123456789abcdef", TELEGRAM_BOT_TOKEN: "" });
    expect(e.dataDir).toBe(".dxforge");
    expect(e.baseUrl).toBe("http://localhost:3000");
    expect(e.telegramBotToken).toBeUndefined();
  });
  it("rejects a short session secret", () => {
    expect(() => parseEnv({ FORGE_ADMIN_PASSWORD: "x", FORGE_SESSION_SECRET: "short" })).toThrow();
  });
});
