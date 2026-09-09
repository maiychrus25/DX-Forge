// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { checkPassword, isPublicPath, signSession, verifySession } from "../src/lib/auth.js";

const S = "0123456789abcdef0123456789abcdef";

describe("session cookie", () => {
  it("verifies a fresh cookie and rejects a tampered or expired one", () => {
    const c = signSession(S, 1_000_000);
    expect(verifySession(S, c, 1_000_000 + 60_000)).toBe(true);
    expect(verifySession(S, c + "x", 1_000_000)).toBe(false);
    expect(verifySession("other-secret-0123456789", c, 1_000_000)).toBe(false);
    expect(verifySession(S, c, 1_000_000 + 13 * 3600 * 1000)).toBe(false);
    expect(verifySession(S, "", 1_000_000)).toBe(false);
  });
});

describe("checkPassword", () => {
  it("compares without leaking length differences into exceptions", () => {
    expect(checkPassword("secret", "secret")).toBe(true);
    expect(checkPassword("secret", "secre")).toBe(false);
    expect(checkPassword("secret", "")).toBe(false);
  });
});

describe("isPublicPath", () => {
  it.each([["/pulse/s/abc", true], ["/api/pulse/survey/abc", true], ["/login", true], ["/api/auth/login", true], ["/api/health", true], ["/about", true], ["/pulse", false], ["/pulse/a/1", false], ["/api/pulse/latest", false]])("%s → %s", (p, pub) => {
    expect(isPublicPath(p)).toBe(pub);
  });
});
