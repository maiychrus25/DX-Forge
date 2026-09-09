// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { CredentialsError, loadCredentials } from "../src/credentials.js";

describe("loadCredentials", () => {
  it("parses the JSON in the named env var and accepts partial sections", () => {
    const c = loadCredentials("X", { X: JSON.stringify({ keycloak: { url: "https://kc", admin: "a", password: "p" }, telegram: { botToken: "t", chatId: "-1" } }) });
    expect(c.keycloak?.url).toBe("https://kc");
    expect(c.nextcloud).toBeUndefined();
  });
  it("fails clearly when the variable is missing or not JSON, without echoing the value", () => {
    expect(() => loadCredentials("X", {})).toThrow(CredentialsError);
    expect(() => loadCredentials("X", {})).toThrow(/biến môi trường X/);
    try { loadCredentials("X", { X: "secret-not-json" }); } catch (e) { expect((e as Error).message).not.toContain("secret-not-json"); }
    expect(() => loadCredentials("X", { X: JSON.stringify({ keycloak: { url: "not a url" } }) })).toThrow(CredentialsError);
  });
});
