// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from "vitest";
import { request, HttpError } from "../src/http.js";
const TOKEN = "123456:AAH-fake-bot-token-do-not-leak";
afterEach(() => vi.unstubAllGlobals());
describe("http: a secret in the URL must not survive into the error", () => {
  it("redacts the token from HttpError.message and HttpError.url", async () => {
    vi.stubGlobal("fetch", async () => new Response("boom", { status: 500 }));
    const url = `https://api.telegram.org/bot${TOKEN}/getChat`;
    const err = await request(url, { method: "GET" }, [TOKEN]).catch((e) => e as HttpError);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).message, "token leaked through the message").not.toContain(TOKEN);
    expect((err as HttpError).url, "token leaked through the url field").not.toContain(TOKEN);
  });
});
