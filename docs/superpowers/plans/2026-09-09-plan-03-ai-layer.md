# DX-Forge Plan 03 — AI layer: providers, structured output, interview, plan patches, handbook, explain

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One `@dx-forge/ai` package that talks to Gemini, Anthropic or Ollama (or nothing) behind a single interface, always returns zod-validated JSON with a rule-based fallback, and powers four places: M0 prescriptions and "ask the report" in the wizard, the `interview` stage that writes `intent.yaml`, AI-proposed patches applied *before* the validator in `compile`, and the `handbook` and `explain` stages.

**Architecture:** `packages/ai` has no dependency on Next or SQLite. It exposes `LlmProvider`, `createProvider(env)`, `structured()` (call → extract JSON → zod → one retry with the error → throw), `withFallback()`, prompt builders in the 5 RÕ frame, and one module per task. Every call is reported to an injected `LlmLogger`; the wizard logs to `llm_calls`, the CLI to stderr. Providers are plain `fetch` calls (no vendor SDKs). Only scores, sector, size band and free text truncated to 2 000 characters ever leave the machine.

**Tech Stack:** TypeScript, zod, `fetch` (Node 22), vitest with a stubbed `fetch`; `readline/promises` for the terminal interview.

**Spec:** master spec §2 (interview, plan AI step, handbook, explain), §4 (`packages/ai`: LlmProvider gemini|anthropic|ollama|none, prompt 5 RÕ, zod, fallback; "AI runs before the validator, never after"); forge-core spec §1.2 step 3 (ResourcePatch, rejected patches into `plan.notes`); M0 spec §6 (provider interface, four tasks, prompts, retry, `llm_calls`, privacy).

**Plan series:** 01 done → 02 wizard → **03 this** → 04 oss H → 05 oss P/D/I → 06 wizard plan/apply → 07 gws → 08 manifest + packaging.

## Global Constraints

- Plan 01/02 Global Constraints still apply (SPDX, English code, Vietnamese user strings and prompts' user-facing output, commit identity, no trailers, no credentials on disk).
- Provider selection by `LLM_PROVIDER` ∈ `gemini | anthropic | ollama | none` (default `none`). Keys/URLs: `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-2.5-flash`), `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-sonnet-5`), `OLLAMA_BASE_URL` (default `http://localhost:11434`), `OLLAMA_MODEL` (default `qwen2.5:7b`). Missing key for the selected provider → `createProvider` returns the `none` provider and logs a warning once.
- `LlmProvider.complete({ system, user, maxTokens, temperature? })` → `{ text, tokensIn, tokensOut }`; providers throw `LlmError(provider, status, message)` on HTTP or network failure; a 30 s timeout via `AbortSignal.timeout`.
- `structured()` extracts the first JSON object or array from the text (code fences stripped), validates with the given zod schema, retries **once** with the zod error appended as a user message, then throws `StructuredOutputFailed`. Every attempt is one `LlmLogger.log()` entry with `ok` = validated on that attempt.
- `withFallback()` returns `{ data, fallback: true }` from the rule-based function when the provider is `none` or `structured()` throws; it never throws.
- Prompts are built in the 5 RÕ frame: role, context (JSON only), action, format (JSON schema in words), boundaries (no numbers outside the JSON, no product recommendations, never skip P → D → I, answer in Vietnamese).
- Privacy: prompt builders take only `{ hpdi, shape, dtiLevel, pillars(merged, discrepancy), sector, sizeBand, freeText? }` for M0 and the intent/plan documents for the compiler stages; never survey answers, tokens, emails or credential names.
- Validator authority: `compile()` applies AI patches, records rejected ones in `plan.notes`, then runs `validatePlan`. A patch can add or modify a resource's `spec`/`reason` or add a new resource; it can never touch `gate`, remove a resource, or change `id`/`layer`/`type` of an existing one.
- The prescription schemas (`RoadmapSchema`, `DiscrepancySchema`, `FiveRoSchema`, `PokaYokeSchema`) move from `apps/web/src/lib/prescribe.ts` to `packages/ai/src/tasks/m0.ts`; the web file re-exports them so plan 02's tests keep passing unchanged.

---

## File structure

```
packages/ai/
├── package.json  tsconfig.json
├── src/index.ts
├── src/provider.ts            LlmProvider, LlmRequest/Response, LlmError, LlmLogger, NONE provider
├── src/providers/{gemini,anthropic,ollama}.ts
├── src/config.ts              parse env → ProviderConfig; createProvider()
├── src/structured.ts          extractJson(), structured(), StructuredOutputFailed, withFallback()
├── src/prompt.ts              fiveRoSystem(), jsonFormat(), truncate()
├── src/tasks/m0.ts            schemas + roadmap/discrepancy/fiveRo/askReport prompt builders
├── src/tasks/interview.ts     IntentDraft schema, interview turn builder, draft → IntentV1 conversion
├── src/tasks/patches.ts       proposePatches(): plan + intent → ResourcePatch[]
├── src/tasks/handbook.ts      handbook polish prompt
├── src/tasks/explain.ts       explain-resource prompt
└── test/{structured,providers,m0,interview,patches}.test.ts
packages/forge-core/src/patches.ts      ResourcePatch schema, applyPatches()
packages/forge-core/src/handbook.ts     renderHandbook(plan, intent) template (no AI)
packages/forge-core/src/compile.ts      (modify) proposer hook + notes
apps/cli/src/commands/{interview,handbook}.ts, (modify) plan.ts, explain.ts
apps/web/src/lib/ai.ts                  provider + logger wired to llm_calls
apps/web/src/lib/prescribe.ts           (modify) AI builders with fallback; re-export schemas
apps/web/src/app/api/pulse/assessments/[id]/ask/route.ts
apps/web/src/app/api/interview/route.ts, src/app/interview/page.tsx, src/components/InterviewChat.tsx
apps/web/src/app/settings/ai/page.tsx   llm_calls statistics
```

---

### Task 1: `@dx-forge/ai` package — provider interface, `none` provider, `structured()`, `withFallback()`

**Files:**
- Create: `packages/ai/package.json`, `packages/ai/tsconfig.json`, `packages/ai/src/index.ts`, `packages/ai/src/provider.ts`, `packages/ai/src/structured.ts`, `packages/ai/src/prompt.ts`
- Modify: root `package.json` typecheck (`tsc -b … packages/ai`)
- Test: `packages/ai/test/structured.test.ts`

**Interfaces:**
```ts
export type LlmRequest = { system: string; user: string; maxTokens: number; temperature?: number };
export type LlmResponse = { text: string; tokensIn: number; tokensOut: number };
export interface LlmProvider { readonly name: string; readonly model: string; complete(req: LlmRequest, signal?: AbortSignal): Promise<LlmResponse>; }
export class LlmError extends Error { constructor(public provider: string, public status: number | null, message: string) }
export type LlmLogEntry = { provider: string; model: string; purpose: string; ok: boolean; fallback: boolean; tokensIn: number; tokensOut: number; latencyMs: number };
export interface LlmLogger { log(e: LlmLogEntry): void }
export const NONE: LlmProvider;           // name "none", complete() throws LlmError("none", null, "no provider")
export const consoleLogger: LlmLogger;    // stderr one line per call
export function extractJson(text: string): unknown;   // first {...} or [...] after stripping ``` fences; throws SyntaxError
export class StructuredOutputFailed extends Error { attempts: number }
export async function structured<T>(p: LlmProvider, log: LlmLogger, opts: { purpose: string; system: string; user: string; schema: ZodType<T>; maxTokens?: number }): Promise<{ data: T; tokensIn: number; tokensOut: number; latencyMs: number; attempts: 1 | 2 }>;
export async function withFallback<T>(p: LlmProvider, log: LlmLogger, opts: /* same */, fallback: () => T): Promise<{ data: T; fallback: boolean; provider: string; model: string | null; tokensIn: number; tokensOut: number; latencyMs: number }>;
export function fiveRoSystem(f: { role: string; context: string; action: string; format: string; boundaries: string[] }): string;
export function truncate(s: string | undefined, max = 2000): string | undefined;
```

- [ ] **Step 1: Failing tests**

`packages/ai/test/structured.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { extractJson, NONE, structured, StructuredOutputFailed, withFallback, type LlmLogEntry, type LlmProvider } from "../src/index.js";

const Schema = z.object({ focusAxis: z.enum(["P", "D", "I"]), steps: z.array(z.string()).min(1) });
function fake(replies: string[]): LlmProvider & { calls: { system: string; user: string }[] } {
  const calls: { system: string; user: string }[] = [];
  return { name: "fake", model: "f-1", calls, async complete(req) { calls.push({ system: req.system, user: req.user }); return { text: replies[calls.length - 1] ?? "", tokensIn: 10, tokensOut: 5 }; } };
}
const collect = () => { const entries: LlmLogEntry[] = []; return { entries, log: (e: LlmLogEntry) => { entries.push(e); } }; };

describe("extractJson", () => {
  it("reads a fenced object, a bare array, and text around JSON", () => {
    expect(extractJson('Here:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson("[1,2]")).toEqual([1, 2]);
    expect(extractJson('note {"a":{"b":[1]}} end')).toEqual({ a: { b: [1] } });
    expect(() => extractJson("nothing")).toThrow(SyntaxError);
  });
});

describe("structured", () => {
  it("returns validated data on the first attempt and logs ok", async () => {
    const p = fake(['{"focusAxis":"P","steps":["a"]}']);
    const { entries, log } = collect();
    const r = await structured(p, { log }, { purpose: "t", system: "s", user: "u", schema: Schema });
    expect(r.data.focusAxis).toBe("P");
    expect(r.attempts).toBe(1);
    expect(entries).toEqual([expect.objectContaining({ provider: "fake", model: "f-1", purpose: "t", ok: true, fallback: false, tokensIn: 10, tokensOut: 5 })]);
  });
  it("retries once with the validation error and succeeds", async () => {
    const p = fake(['{"focusAxis":"X","steps":[]}', '{"focusAxis":"D","steps":["b"]}']);
    const { entries, log } = collect();
    const r = await structured(p, { log }, { purpose: "t", system: "s", user: "u", schema: Schema });
    expect(r.attempts).toBe(2);
    expect(p.calls[1].user).toMatch(/focusAxis/);
    expect(entries.map((e) => e.ok)).toEqual([false, true]);
  });
  it("throws StructuredOutputFailed after two bad attempts", async () => {
    const p = fake(["nope", "still nope"]);
    const { log } = collect();
    await expect(structured(p, { log }, { purpose: "t", system: "s", user: "u", schema: Schema })).rejects.toBeInstanceOf(StructuredOutputFailed);
    expect(p.calls.length).toBe(2);
  });
});

describe("withFallback", () => {
  it("uses the fallback for the none provider without calling it and marks fallback", async () => {
    const { entries, log } = collect();
    const r = await withFallback(NONE, { log }, { purpose: "t", system: "s", user: "u", schema: Schema }, () => ({ focusAxis: "P" as const, steps: ["rule"] }));
    expect(r).toMatchObject({ data: { steps: ["rule"] }, fallback: true, provider: "none", model: null });
    expect(entries).toEqual([expect.objectContaining({ provider: "none", ok: false, fallback: true })]);
  });
  it("falls back when structured() fails", async () => {
    const { log } = collect();
    const r = await withFallback(fake(["x", "y"]), { log }, { purpose: "t", system: "s", user: "u", schema: Schema }, () => ({ focusAxis: "I" as const, steps: ["rule"] }));
    expect(r.fallback).toBe(true);
    expect(r.data.focusAxis).toBe("I");
  });
});
```

- [ ] **Step 2: Run to verify it fails** (`npx vitest run packages/ai`).

- [ ] **Step 3: Package and provider.ts**

`packages/ai/package.json`:
```json
{ "name": "@dx-forge/ai", "version": "0.1.0", "license": "AGPL-3.0-or-later", "type": "module", "main": "./src/index.ts", "types": "./src/index.ts",
  "dependencies": { "@dx-forge/forge-core": "0.1.0", "zod": "^3.24.0" } }
```
`packages/ai/tsconfig.json`: `{ "extends": "../../tsconfig.base.json", "compilerOptions": { "rootDir": "src", "outDir": "dist" }, "include": ["src/**/*.ts"], "references": [{ "path": "../forge-core" }] }`

`packages/ai/src/provider.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
export type LlmRequest = { system: string; user: string; maxTokens: number; temperature?: number };
export type LlmResponse = { text: string; tokensIn: number; tokensOut: number };

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  complete(req: LlmRequest, signal?: AbortSignal): Promise<LlmResponse>;
}

export class LlmError extends Error {
  constructor(public readonly provider: string, public readonly status: number | null, message: string) {
    super(`${provider}${status ? ` ${status}` : ""}: ${message}`);
    this.name = "LlmError";
  }
}

export type LlmLogEntry = { provider: string; model: string; purpose: string; ok: boolean; fallback: boolean; tokensIn: number; tokensOut: number; latencyMs: number };
export interface LlmLogger { log(e: LlmLogEntry): void }

export const NONE: LlmProvider = {
  name: "none", model: "-",
  async complete() { throw new LlmError("none", null, "no LLM provider configured"); },
};

export const consoleLogger: LlmLogger = {
  log: (e) => console.error(`[llm] ${e.provider}/${e.model} ${e.purpose} ok=${e.ok} fallback=${e.fallback} in=${e.tokensIn} out=${e.tokensOut} ${e.latencyMs}ms`),
};

export const DEFAULT_TIMEOUT_MS = 30_000;
```

- [ ] **Step 4: structured.ts and prompt.ts**

`packages/ai/src/structured.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ZodType } from "zod";
import { DEFAULT_TIMEOUT_MS, LlmError, type LlmLogger, type LlmProvider } from "./provider.js";

export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "");
  const start = [...cleaned.matchAll(/[{[]/g)].map((m) => m.index!);
  for (const s of start) {
    const open = cleaned[s];
    const close = open === "{" ? "}" : "]";
    let depth = 0;
    for (let i = s; i < cleaned.length; i++) {
      if (cleaned[i] === open) depth++;
      else if (cleaned[i] === close && --depth === 0) {
        try { return JSON.parse(cleaned.slice(s, i + 1)); } catch { break; }
      }
    }
  }
  throw new SyntaxError("no JSON object or array found");
}

export class StructuredOutputFailed extends Error {
  constructor(public readonly attempts: number, cause: string) {
    super(`structured output failed after ${attempts} attempts: ${cause}`);
    this.name = "StructuredOutputFailed";
  }
}

export type StructuredOpts<T> = { purpose: string; system: string; user: string; schema: ZodType<T>; maxTokens?: number; temperature?: number };
export type StructuredResult<T> = { data: T; tokensIn: number; tokensOut: number; latencyMs: number; attempts: 1 | 2 };

export async function structured<T>(p: LlmProvider, log: LlmLogger, o: StructuredOpts<T>): Promise<StructuredResult<T>> {
  let user = o.user;
  let tokensIn = 0, tokensOut = 0;
  const started = Date.now();
  let lastError = "";
  for (const attempt of [1, 2] as const) {
    const t0 = Date.now();
    let res;
    try {
      res = await p.complete({ system: o.system, user, maxTokens: o.maxTokens ?? 2048, temperature: o.temperature ?? 0.2 }, AbortSignal.timeout(DEFAULT_TIMEOUT_MS));
    } catch (e) {
      log.log({ provider: p.name, model: p.model, purpose: o.purpose, ok: false, fallback: false, tokensIn: 0, tokensOut: 0, latencyMs: Date.now() - t0 });
      throw e instanceof LlmError ? e : new LlmError(p.name, null, (e as Error).message);
    }
    tokensIn += res.tokensIn; tokensOut += res.tokensOut;
    let parsed: ReturnType<ZodType<T>["safeParse"]> | undefined;
    try { parsed = o.schema.safeParse(extractJson(res.text)); } catch (e) { lastError = (e as Error).message; }
    const ok = !!parsed?.success;
    log.log({ provider: p.name, model: p.model, purpose: o.purpose, ok, fallback: false, tokensIn: res.tokensIn, tokensOut: res.tokensOut, latencyMs: Date.now() - t0 });
    if (parsed?.success) return { data: parsed.data, tokensIn, tokensOut, latencyMs: Date.now() - started, attempts: attempt };
    if (parsed && !parsed.success) lastError = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    user = `${o.user}\n\nCâu trả lời trước không hợp lệ (${lastError}). Trả lời lại CHỈ bằng một JSON hợp lệ đúng định dạng đã nêu.`;
  }
  throw new StructuredOutputFailed(2, lastError);
}

export type FallbackResult<T> = { data: T; fallback: boolean; provider: string; model: string | null; tokensIn: number; tokensOut: number; latencyMs: number };

/** Never throws: uses the rule-based fallback when there is no provider or the model cannot produce valid output. */
export async function withFallback<T>(p: LlmProvider, log: LlmLogger, o: StructuredOpts<T>, fallback: () => T): Promise<FallbackResult<T>> {
  const t0 = Date.now();
  if (p.name === "none") {
    log.log({ provider: "none", model: "-", purpose: o.purpose, ok: false, fallback: true, tokensIn: 0, tokensOut: 0, latencyMs: 0 });
    return { data: fallback(), fallback: true, provider: "none", model: null, tokensIn: 0, tokensOut: 0, latencyMs: Date.now() - t0 };
  }
  try {
    const r = await structured(p, log, o);
    return { data: r.data, fallback: false, provider: p.name, model: p.model, tokensIn: r.tokensIn, tokensOut: r.tokensOut, latencyMs: r.latencyMs };
  } catch {
    log.log({ provider: p.name, model: p.model, purpose: o.purpose, ok: false, fallback: true, tokensIn: 0, tokensOut: 0, latencyMs: Date.now() - t0 });
    return { data: fallback(), fallback: true, provider: p.name, model: p.model, tokensIn: 0, tokensOut: 0, latencyMs: Date.now() - t0 };
  }
}
```

`packages/ai/src/prompt.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
/** Builds a system prompt in the book's 5 RÕ frame (role, context, action, format, boundaries). Output language is Vietnamese. */
export function fiveRoSystem(f: { role: string; context: string; action: string; format: string; boundaries: string[] }): string {
  return [
    `VAI TRÒ: ${f.role}`,
    `BỐI CẢNH: ${f.context}`,
    `HÀNH ĐỘNG: ${f.action}`,
    `ĐỊNH DẠNG: ${f.format} Trả lời CHỈ bằng JSON, không có văn bản khác.`,
    `RANH GIỚI: ${[...f.boundaries, "Không bịa số liệu ngoài dữ liệu được cung cấp.", "Không gợi ý mua phần mềm cụ thể.", "Không nhảy cóc trật tự P → D → I.", "Mọi chuỗi văn bản viết bằng tiếng Việt."].map((b) => `- ${b}`).join("\n")}`,
  ].join("\n\n");
}

export function truncate(s: string | undefined, max = 2000): string | undefined {
  if (!s) return undefined;
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
```

`packages/ai/src/index.ts`: export everything from `provider.js`, `structured.js`, `prompt.js` (later tasks add `config.js`, `providers/*`, `tasks/*`).

- [ ] **Step 5: Root typecheck, install, run, commit**

Root `typecheck`: `tsc -b packages/hpdi-engine packages/forge-core packages/ai apps/cli && tsc -p apps/web --noEmit`. `npm install`; `npx vitest run packages/ai` (7 passed); `npm run typecheck`.

```bash
git add packages/ai package.json package-lock.json && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(ai): provider interface, structured JSON output with retry, rule-based fallback"
```

---

### Task 2: Gemini, Anthropic, Ollama adapters and `createProvider(env)`

**Files:**
- Create: `packages/ai/src/providers/gemini.ts`, `packages/ai/src/providers/anthropic.ts`, `packages/ai/src/providers/ollama.ts`, `packages/ai/src/config.ts`
- Modify: `packages/ai/src/index.ts`
- Test: `packages/ai/test/providers.test.ts`

**Interfaces:**
- `gemini(apiKey, model): LlmProvider` → POST `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=…` body `{ systemInstruction: { parts: [{ text }] }, contents: [{ role: "user", parts: [{ text }] }], generationConfig: { maxOutputTokens, temperature, responseMimeType: "application/json" } }`; text = `candidates[0].content.parts.map(p=>p.text).join("")`; tokens from `usageMetadata.promptTokenCount/candidatesTokenCount`.
- `anthropic(apiKey, model): LlmProvider` → POST `https://api.anthropic.com/v1/messages` headers `x-api-key`, `anthropic-version: 2023-06-01`; body `{ model, max_tokens, temperature, system, messages: [{ role: "user", content }] }`; text = `content.filter(b=>b.type==="text").map(b=>b.text).join("")`; tokens `usage.input_tokens/output_tokens`.
- `ollama(baseUrl, model): LlmProvider` → POST `${baseUrl}/api/chat` body `{ model, stream: false, format: "json", options: { temperature, num_predict }, messages: [{ role: "system", content }, { role: "user", content }] }`; text = `message.content`; tokens `prompt_eval_count/eval_count`.
- `parseProviderConfig(env): ProviderConfig` and `createProvider(env, warn = console.warn): LlmProvider`.
- All three: non-2xx → `LlmError(name, status, bodySnippet)`; network/abort → `LlmError(name, null, message)`.

- [ ] **Step 1: Failing tests** (stub `globalThis.fetch`)

`packages/ai/test/providers.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from "vitest";
import { anthropic } from "../src/providers/anthropic.js";
import { gemini } from "../src/providers/gemini.js";
import { ollama } from "../src/providers/ollama.js";
import { createProvider } from "../src/config.js";
import { LlmError } from "../src/provider.js";

const req = { system: "S", user: "U", maxTokens: 100, temperature: 0 };
function stubFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }); });
  return calls;
}
afterEach(() => vi.unstubAllGlobals());

describe("gemini", () => {
  it("posts system instruction and user content, reads text and usage", async () => {
    const calls = stubFetch(200, { candidates: [{ content: { parts: [{ text: '{"a":' }, { text: "1}" }] } }], usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 3 } });
    const r = await gemini("k", "gemini-2.5-flash").complete(req);
    expect(r).toEqual({ text: '{"a":1}', tokensIn: 12, tokensOut: 3 });
    expect(calls[0].url).toContain("models/gemini-2.5-flash:generateContent");
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.systemInstruction.parts[0].text).toBe("S");
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(calls[0].url).not.toContain("k@");
  });
  it("wraps HTTP errors in LlmError with the status", async () => {
    stubFetch(429, { error: { message: "quota" } });
    await expect(gemini("k", "m").complete(req)).rejects.toMatchObject({ name: "LlmError", provider: "gemini", status: 429 });
  });
});

describe("anthropic", () => {
  it("sends the messages API shape and reads text blocks", async () => {
    const calls = stubFetch(200, { content: [{ type: "text", text: "{}" }], usage: { input_tokens: 5, output_tokens: 2 } });
    const r = await anthropic("k", "claude-sonnet-5").complete(req);
    expect(r).toEqual({ text: "{}", tokensIn: 5, tokensOut: 2 });
    expect((calls[0].init.headers as Record<string, string>)["x-api-key"]).toBe("k");
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({ model: "claude-sonnet-5", system: "S", max_tokens: 100 });
  });
});

describe("ollama", () => {
  it("uses /api/chat with format json and reads counts", async () => {
    const calls = stubFetch(200, { message: { content: "[]" }, prompt_eval_count: 7, eval_count: 1 });
    const r = await ollama("http://localhost:11434", "qwen2.5:7b").complete(req);
    expect(r).toEqual({ text: "[]", tokensIn: 7, tokensOut: 1 });
    expect(calls[0].url).toBe("http://localhost:11434/api/chat");
    expect(JSON.parse(calls[0].init.body as string).format).toBe("json");
  });
  it("turns a connection failure into LlmError without status", async () => {
    vi.stubGlobal("fetch", async () => { throw new TypeError("fetch failed"); });
    await expect(ollama("http://localhost:1", "m").complete(req)).rejects.toBeInstanceOf(LlmError);
  });
});

describe("createProvider", () => {
  it("returns none by default and when the selected provider lacks its key, with a warning", () => {
    const warn = vi.fn();
    expect(createProvider({}, warn).name).toBe("none");
    expect(createProvider({ LLM_PROVIDER: "gemini" }, warn).name).toBe("none");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(createProvider({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: "k" }, warn)).toMatchObject({ name: "gemini", model: "gemini-2.5-flash" });
    expect(createProvider({ LLM_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k", ANTHROPIC_MODEL: "x" }, warn).model).toBe("x");
    expect(createProvider({ LLM_PROVIDER: "ollama" }, warn)).toMatchObject({ name: "ollama", model: "qwen2.5:7b" });
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Adapters** (shared helper first)

`packages/ai/src/providers/http.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { LlmError } from "../provider.js";

export async function postJson<T>(provider: string, url: string, body: unknown, headers: Record<string, string>, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal });
  } catch (e) {
    throw new LlmError(provider, null, (e as Error).message);
  }
  if (!res.ok) throw new LlmError(provider, res.status, (await res.text().catch(() => "")).slice(0, 300));
  return (await res.json()) as T;
}
```

`packages/ai/src/providers/gemini.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { LlmProvider } from "../provider.js";
import { postJson } from "./http.js";

type GeminiResponse = { candidates?: { content?: { parts?: { text?: string }[] } }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };

export function gemini(apiKey: string, model: string): LlmProvider {
  return {
    name: "gemini", model,
    async complete(req, signal) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const r = await postJson<GeminiResponse>("gemini", url, {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: "user", parts: [{ text: req.user }] }],
        generationConfig: { maxOutputTokens: req.maxTokens, temperature: req.temperature ?? 0.2, responseMimeType: "application/json" },
      }, { "x-goog-api-key": apiKey }, signal);
      return { text: (r.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join(""), tokensIn: r.usageMetadata?.promptTokenCount ?? 0, tokensOut: r.usageMetadata?.candidatesTokenCount ?? 0 };
    },
  };
}
```

`packages/ai/src/providers/anthropic.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { LlmProvider } from "../provider.js";
import { postJson } from "./http.js";

type AnthropicResponse = { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } };

export function anthropic(apiKey: string, model: string): LlmProvider {
  return {
    name: "anthropic", model,
    async complete(req, signal) {
      const r = await postJson<AnthropicResponse>("anthropic", "https://api.anthropic.com/v1/messages", {
        model, max_tokens: req.maxTokens, temperature: req.temperature ?? 0.2, system: req.system, messages: [{ role: "user", content: req.user }],
      }, { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, signal);
      return { text: (r.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join(""), tokensIn: r.usage?.input_tokens ?? 0, tokensOut: r.usage?.output_tokens ?? 0 };
    },
  };
}
```

`packages/ai/src/providers/ollama.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { LlmProvider } from "../provider.js";
import { postJson } from "./http.js";

type OllamaResponse = { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number };

export function ollama(baseUrl: string, model: string): LlmProvider {
  return {
    name: "ollama", model,
    async complete(req, signal) {
      const r = await postJson<OllamaResponse>("ollama", `${baseUrl.replace(/\/$/, "")}/api/chat`, {
        model, stream: false, format: "json", options: { temperature: req.temperature ?? 0.2, num_predict: req.maxTokens },
        messages: [{ role: "system", content: req.system }, { role: "user", content: req.user }],
      }, {}, signal);
      return { text: r.message?.content ?? "", tokensIn: r.prompt_eval_count ?? 0, tokensOut: r.eval_count ?? 0 };
    },
  };
}
```

`packages/ai/src/config.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { NONE, type LlmProvider } from "./provider.js";
import { anthropic } from "./providers/anthropic.js";
import { gemini } from "./providers/gemini.js";
import { ollama } from "./providers/ollama.js";

export type ProviderName = "gemini" | "anthropic" | "ollama" | "none";

/** Builds the provider named by LLM_PROVIDER; falls back to `none` (with one warning) when its key is missing. */
export function createProvider(env: Record<string, string | undefined>, warn: (msg: string) => void = console.warn): LlmProvider {
  const name = (env.LLM_PROVIDER ?? "none") as ProviderName;
  switch (name) {
    case "gemini":
      if (!env.GEMINI_API_KEY) { warn("LLM_PROVIDER=gemini but GEMINI_API_KEY is missing; running without AI"); return NONE; }
      return gemini(env.GEMINI_API_KEY, env.GEMINI_MODEL ?? "gemini-2.5-flash");
    case "anthropic":
      if (!env.ANTHROPIC_API_KEY) { warn("LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is missing; running without AI"); return NONE; }
      return anthropic(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL ?? "claude-sonnet-5");
    case "ollama":
      return ollama(env.OLLAMA_BASE_URL ?? "http://localhost:11434", env.OLLAMA_MODEL ?? "qwen2.5:7b");
    default:
      return NONE;
  }
}
```

- [ ] **Step 4: Export, run, commit**

`npx vitest run packages/ai` (13 passed); `npm run typecheck`.

```bash
git add packages/ai && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(ai): gemini, anthropic and ollama adapters with env-based provider selection"
```

---

### Task 3: M0 tasks — schemas and prompts for roadmap, discrepancy, 5 RÕ, ask-report; wire into the wizard

**Files:**
- Create: `packages/ai/src/tasks/m0.ts`, `apps/web/src/lib/ai.ts`, `apps/web/src/app/api/pulse/assessments/[id]/ask/route.ts`, `apps/web/src/components/AskReport.tsx`
- Modify: `packages/ai/src/index.ts`, `apps/web/src/lib/prescribe.ts` (schemas re-exported from `@dx-forge/ai`; builders become async with AI + fallback), `apps/web/src/app/pulse/a/[id]/prescription/page.tsx` (await, show provider, ask box), `apps/web/src/lib/i18n.vi.ts` (ask strings), `apps/web/.env.example` (LLM vars), `apps/web/package.json` (dep `@dx-forge/ai`)
- Test: `packages/ai/test/m0.test.ts`; `apps/web/test/prescribe.test.ts` must still pass unchanged apart from `await`.

**Interfaces:**
- `packages/ai/src/tasks/m0.ts` exports `RoadmapSchema`, `DiscrepancySchema`, `FiveRoSchema`, `PokaYokeSchema`, `AskReportSchema = z.object({ answer: z.string(), citedFields: z.array(z.string()) })`, the types, `M0Context = { hpdi; shape; dtiLevel; pillars: Record<string,{merged;discrepancy}>; sector; sizeBand; coreProcess?: string; freeText?: string }`, and prompt builders `roadmapPrompt(ctx)`, `discrepancyPrompt(ctx)`, `fiveRoPrompt(ctx)`, `pokaYokePrompt(ctx)`, `askReportPrompt(ctx, roadmap, question)` each returning `{ system, user }`.
- `apps/web/src/lib/ai.ts`: `getProvider()` (from `process.env`, cached), `dbLogger(db): LlmLogger` (→ `repo.logLlmCall`), `m0Context(result, org, assessment, freeTexts)`.
- Prescriptions: `getOrBuildPrescriptions(db, id)` becomes `async`; each kind is built with `withFallback(provider, logger, prompt, ruleBasedBuilder)` and stored with the real `provider/model/fallback/tokens/latency`.
- `POST /api/pulse/assessments/:id/ask` `{ question }` → `{ answer, citedFields, fallback }`; with `none` provider the fallback answer is `vi.ask.needKey`.

- [ ] **Step 1: Failing tests**

`packages/ai/test/m0.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { askReportPrompt, discrepancyPrompt, fiveRoPrompt, roadmapPrompt, RoadmapSchema, type M0Context } from "../src/tasks/m0.js";

const ctx: M0Context = { hpdi: { H: 55, P: 25, D: 12, I: 8 }, shape: "transitional", dtiLevel: 3, pillars: { operations: { merged: 0.5, discrepancy: 0.35 }, data: { merged: 0.3, discrepancy: 0.1 } }, sector: "retail", sizeBand: "10-50", freeText: "x".repeat(3000) };

describe("m0 prompts", () => {
  it("roadmap prompt carries the 5 RÕ frame, the JSON context, and truncates free text", () => {
    const p = roadmapPrompt(ctx);
    expect(p.system).toMatch(/VAI TRÒ:/);
    expect(p.system).toMatch(/P → D → I/);
    expect(p.user).toContain('"H":55');
    expect(p.user.length).toBeLessThan(3500);
    expect(p.user).not.toContain("x".repeat(2100));
  });
  it("discrepancy prompt lists only pillars above 0.3", () => {
    expect(discrepancyPrompt(ctx).user).toContain("operations");
    expect(discrepancyPrompt(ctx).user).not.toContain('"data"');
  });
  it("fiveRo prompt names the process; askReport includes the question and forbids numbers outside the JSON", () => {
    expect(fiveRoPrompt({ ...ctx, coreProcess: "Xử lý yêu cầu" }).user).toContain("Xử lý yêu cầu");
    const a = askReportPrompt(ctx, { focusAxis: "P", diagnosis: "d", phases: [], warnings: [] }, "Vì sao H cao?");
    expect(a.user).toContain("Vì sao H cao?");
    expect(a.system).toMatch(/Không bịa số liệu/);
  });
  it("RoadmapSchema is the same contract the wizard fallback satisfies", () => {
    expect(RoadmapSchema.safeParse({ focusAxis: "P", diagnosis: "d", phases: [{ name: "n", axis: "P", actions: ["a"], kpis: ["k"] }], warnings: [] }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: m0.ts**

`packages/ai/src/tasks/m0.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";
import { fiveRoSystem, truncate } from "../prompt.js";

export const RoadmapSchema = z.object({
  focusAxis: z.enum(["P", "D", "I"]),
  diagnosis: z.string().min(1),
  phases: z.array(z.object({ name: z.string(), axis: z.enum(["P", "D", "I"]), actions: z.array(z.string()).min(1), kpis: z.array(z.string()).min(1) })),
  warnings: z.array(z.string()),
});
export const DiscrepancySchema = z.object({ questions: z.array(z.object({ pillar: z.string(), forTier: z.enum(["executive", "manager", "staff"]), question: z.string(), why: z.string() })) });
export const FiveRoSchema = z.object({ process: z.string(), steps: z.array(z.object({ step: z.string(), role_R: z.string(), role_A: z.string(), role_C: z.string(), role_I: z.string(), standard: z.string(), tool: z.string() })).min(1) });
export const PokaYokeSchema = z.object({ pokaYoke: z.array(z.object({ point: z.string(), rule: z.string(), layer: z.union([z.literal(1), z.literal(2), z.literal(3)]) })).min(1) });
export const AskReportSchema = z.object({ answer: z.string().min(1), citedFields: z.array(z.string()) });
export type Roadmap = z.infer<typeof RoadmapSchema>;
export type DiscrepancyQuestions = z.infer<typeof DiscrepancySchema>;
export type FiveRo = z.infer<typeof FiveRoSchema>;
export type PokaYoke = z.infer<typeof PokaYokeSchema>;
export type AskReport = z.infer<typeof AskReportSchema>;

export type M0Context = {
  hpdi: { H: number; P: number; D: number; I: number };
  shape: string; dtiLevel: number;
  pillars: Record<string, { merged: number; discrepancy: number }>;
  sector: string; sizeBand: string; coreProcess?: string; freeText?: string;
};

const ROLE = "Chuyên gia chuyển đổi số theo phương pháp DX-OS (HPDI, 5 RÕ, P.A.R.A, Poka-yoke).";
const ctxJson = (c: M0Context) => JSON.stringify({ hpdi: c.hpdi, shape: c.shape, dtiLevel: c.dtiLevel, pillars: c.pillars, sector: c.sector, sizeBand: c.sizeBand, coreProcess: c.coreProcess, freeText: truncate(c.freeText) });

export function roadmapPrompt(c: M0Context) {
  return {
    system: fiveRoSystem({ role: ROLE, context: "Kết quả đo HPDI của một tổ chức, dạng JSON do người dùng cung cấp.", action: "Chẩn đoán và kê lộ trình ba giai đoạn theo trật tự P → D → I, bắt đầu từ trục yếu nhất dưới 20.", format: 'JSON {"focusAxis":"P|D|I","diagnosis":string,"phases":[{"name":string,"axis":"P|D|I","actions":[string],"kpis":[string]}],"warnings":[string]}.', boundaries: ["Nếu shape là illusion, warnings phải có cảnh báo GIGO.", "Mỗi phase 3–5 actions, 2–3 kpis đo được."] }),
    user: ctxJson(c),
  };
}

export function discrepancyPrompt(c: M0Context) {
  const gaps = Object.fromEntries(Object.entries(c.pillars).filter(([, p]) => p.discrepancy > 0.3));
  return {
    system: fiveRoSystem({ role: ROLE, context: "Các trụ cột có độ vênh giữa tầng lớn hơn 0,3.", action: "Với mỗi trụ cột, viết một câu hỏi đối chất dành cho tầng chấm thấp hơn để xác minh thực tế.", format: 'JSON {"questions":[{"pillar":string,"forTier":"executive|manager|staff","question":string,"why":string}]}.', boundaries: ["Câu hỏi mở, cụ thể, hỏi về việc đã xảy ra, không hỏi cảm nhận."] }),
    user: JSON.stringify({ gaps, sector: c.sector }),
  };
}

export function fiveRoPrompt(c: M0Context) {
  return {
    system: fiveRoSystem({ role: ROLE, context: "Một quy trình lõi cần chuẩn hoá theo ma trận 5 RÕ (làm, chịu trách nhiệm, tham vấn, được báo, tiêu chuẩn, công cụ).", action: "Chia quy trình thành 4–6 bước; mỗi bước đúng một vai trò A.", format: 'JSON {"process":string,"steps":[{"step":string,"role_R":string,"role_A":string,"role_C":string,"role_I":string,"standard":string,"tool":string}]}.', boundaries: ["Tiêu chuẩn phải đo được (thời gian, số lượng, điều kiện)."] }),
    user: JSON.stringify({ process: c.coreProcess ?? "Xử lý yêu cầu khách hàng", sector: c.sector, sizeBand: c.sizeBand }),
  };
}

export function pokaYokePrompt(c: M0Context) {
  return {
    system: fiveRoSystem({ role: ROLE, context: "Quy trình lõi và ba lớp Poka-yoke: lớp 1 chặn khi nhập, lớp 2 chặn khi chuyển trạng thái, lớp 3 phân quyền và dữ liệu.", action: "Liệt kê 5–8 điểm chống sai, mỗi điểm thuộc một lớp.", format: 'JSON {"pokaYoke":[{"point":string,"rule":string,"layer":1|2|3}]}.', boundaries: [] }),
    user: JSON.stringify({ process: c.coreProcess ?? "Xử lý yêu cầu khách hàng", sector: c.sector }),
  };
}

export function askReportPrompt(c: M0Context, roadmap: Roadmap, question: string) {
  return {
    system: fiveRoSystem({ role: ROLE, context: "Kết quả đo và lộ trình đã kê, dạng JSON.", action: "Trả lời câu hỏi của người dùng chỉ dựa trên hai JSON đó; nêu các trường đã dùng.", format: 'JSON {"answer":string,"citedFields":[string]}.', boundaries: ["Nếu câu hỏi ngoài dữ liệu, nói rõ là không có dữ liệu."] }),
    user: JSON.stringify({ result: JSON.parse(ctxJson(c)), roadmap, question: truncate(question, 500) }),
  };
}
```

- [ ] **Step 4: Wizard wiring**

`apps/web/src/lib/ai.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createProvider, type LlmLogger, type LlmProvider } from "@dx-forge/ai";
import type { M0Context } from "@dx-forge/ai";
import type { ResultV1 } from "@dx-forge/hpdi-engine";
import type Database from "better-sqlite3";
import * as repo from "./repo.js";

let provider: LlmProvider | undefined;
export function getProvider(): LlmProvider {
  provider ??= createProvider(process.env);
  return provider;
}
/** Test seam. */
export function setProvider(p: LlmProvider | undefined): void { provider = p; }

export function dbLogger(db: Database.Database): LlmLogger {
  return { log: (e) => repo.logLlmCall(db, e) };
}

export function m0Context(result: ResultV1, org: repo.Organization, assessment: repo.Assessment, freeTexts: string[]): M0Context {
  return {
    hpdi: result.hpdi, shape: result.shape, dtiLevel: result.dtiLevel,
    pillars: Object.fromEntries(Object.entries(result.pillars).map(([k, p]) => [k, { merged: Number(p.merged.toFixed(3)), discrepancy: Number(p.discrepancy.toFixed(3)) }])),
    sector: org.sector, sizeBand: org.sizeBand, coreProcess: assessment.coreProcess ?? undefined,
    freeText: freeTexts.filter(Boolean).join("\n---\n") || undefined,
  };
}
```

`apps/web/src/lib/prescribe.ts` changes: replace the four local schemas with `export { RoadmapSchema, DiscrepancySchema, FiveRoSchema, PokaYokeSchema } from "@dx-forge/ai"; import type { … }`; keep `buildRoadmap`, `buildDiscrepancyQuestions`, `buildFiveRo`, `buildPokaYoke` as the fallbacks; `getOrBuildPrescriptions` becomes:
```ts
export async function getOrBuildPrescriptions(db: Database.Database, assessmentId: string): Promise<Prescriptions> {
  const a = repo.getAssessment(db, assessmentId); const res = repo.getResult(db, assessmentId); const org = repo.getOrganization(db);
  if (!a || !res || !org) throw new Error("assessment not closed");
  const cached = repo.getPrescription(db, assessmentId, "roadmap");
  if (cached) { /* unchanged: read the four rows */ }
  const result = res.payload as ResultV1;
  const ctx = m0Context(result, org, a, repo.listResponses(db, assessmentId).map((r) => r.freeText ?? ""));
  const p = getProvider(); const log = dbLogger(db);
  const roadmap = await withFallback(p, log, { purpose: "roadmap", ...roadmapPrompt(ctx), schema: RoadmapSchema }, () => buildRoadmap(result));
  const discrepancy = await withFallback(p, log, { purpose: "discrepancy", ...discrepancyPrompt(ctx), schema: DiscrepancySchema }, () => buildDiscrepancyQuestions(result));
  const fiveRo = await withFallback(p, log, { purpose: "fiveRo", ...fiveRoPrompt(ctx), schema: FiveRoSchema }, () => buildFiveRo(a.coreProcess));
  const pokaYoke = await withFallback(p, log, { purpose: "pokaYoke", ...pokaYokePrompt(ctx), schema: PokaYokeSchema }, () => buildPokaYoke(a.coreProcess));
  for (const [kind, r] of [["roadmap", roadmap], ["discrepancy", discrepancy], ["fiveRo", fiveRo], ["pokaYoke", pokaYoke]] as const) {
    repo.savePrescription(db, { assessmentId, kind, provider: r.provider, model: r.model, payload: r.data, fallback: r.fallback, tokensIn: r.tokensIn, tokensOut: r.tokensOut, latencyMs: r.latencyMs });
  }
  return { roadmap: roadmap.data, discrepancy: discrepancy.data, fiveRo: fiveRo.data, pokaYoke: pokaYoke.data, provider: roadmap.provider, fallback: roadmap.fallback };
}
```
Update `apps/web/test/prescribe.test.ts`: `await getOrBuildPrescriptions(...)` (two places); everything else unchanged (provider is `none` in tests, so `provider: "none"`, four rows).

`apps/web/src/app/api/pulse/assessments/[id]/ask/route.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from "next/server";
import { z } from "zod";
import { AskReportSchema, askReportPrompt, withFallback } from "@dx-forge/ai";
import type { ResultV1 } from "@dx-forge/hpdi-engine";
import { dbLogger, getProvider, m0Context } from "@/lib/ai";
import { getDb } from "@/lib/db";
import { vi } from "@/lib/i18n.vi";
import { getOrBuildPrescriptions } from "@/lib/prescribe";
import * as repo from "@/lib/repo";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = z.object({ question: z.string().min(1).max(500) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const db = getDb();
  const a = repo.getAssessment(db, id); const res = repo.getResult(db, id); const org = repo.getOrganization(db);
  if (!a || !res || !org) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { roadmap } = await getOrBuildPrescriptions(db, id);
  const ctx = m0Context(res.payload as ResultV1, org, a, []);
  const r = await withFallback(getProvider(), dbLogger(db), { purpose: "askReport", ...askReportPrompt(ctx, roadmap, body.data.question), schema: AskReportSchema }, () => ({ answer: vi.ask.needKey, citedFields: [] }));
  repo.savePrescription(db, { assessmentId: id, kind: "askReport", provider: r.provider, model: r.model, payload: { question: body.data.question, ...r.data }, fallback: r.fallback, tokensIn: r.tokensIn, tokensOut: r.tokensOut, latencyMs: r.latencyMs });
  return NextResponse.json({ ...r.data, fallback: r.fallback });
}
```

`apps/web/src/components/AskReport.tsx` (client): a textarea, a button `vi.ask.submit`, shows `answer` and `citedFields` chips, and a muted line `vi.ask.fallbackNote` when `fallback`. Add to `i18n.vi.ts`: `ask: { title: "Hỏi báo cáo", placeholder: "Ví dụ: Vì sao trục P thấp dù vận hành chấm cao?", submit: "Hỏi", needKey: "Tính năng này cần khoá API của nhà cung cấp LLM (LLM_PROVIDER).", fallbackNote: "Trả lời theo luật, chưa dùng AI." }`. The prescription page renders `<AskReport id={id} />` under the roadmap and shows `${p.provider}${p.fallback ? " (fallback)" : ""}` in the source line.

`apps/web/.env.example`: add `LLM_PROVIDER=none`, `GEMINI_API_KEY=`, `GEMINI_MODEL=gemini-2.5-flash`, `ANTHROPIC_API_KEY=`, `ANTHROPIC_MODEL=claude-sonnet-5`, `OLLAMA_BASE_URL=http://localhost:11434`, `OLLAMA_MODEL=qwen2.5:7b`.

- [ ] **Step 5: Run everything, commit**

`npx vitest run packages/ai apps/web` (all green, prescribe tests unchanged but awaited); `npm run typecheck`.

```bash
git add packages/ai apps/web && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(ai): M0 prescription prompts with fallback and ask-the-report in the wizard"
```

---

### Task 4: AI statistics page in the wizard

**Files:**
- Create: `apps/web/src/app/settings/ai/page.tsx`
- Modify: `apps/web/src/lib/i18n.vi.ts` (`settings.ai` strings), `apps/web/src/app/layout.tsx` (nav link), `apps/web/src/lib/auth.ts` (nothing: `/settings/**` is protected by adding it to the middleware matcher)
- Modify: `apps/web/src/middleware.ts` matcher → `["/pulse/:path*", "/api/pulse/:path*", "/settings/:path*", "/interview/:path*", "/api/interview/:path*"]`

- [ ] **Step 1: Page**

`apps/web/src/app/settings/ai/page.tsx`:
```tsx
// SPDX-License-Identifier: AGPL-3.0-or-later
import { getProvider } from "@/lib/ai";
import { getDb } from "@/lib/db";
import { vi } from "@/lib/i18n.vi";
import * as repo from "@/lib/repo";

export const dynamic = "force-dynamic";

export default function AiSettingsPage() {
  const p = getProvider();
  const rows = repo.llmStats(getDb());
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{vi.settings.ai.title}</h1>
      <p className="text-sm text-muted">{vi.settings.ai.current}: <b>{p.name}</b> {p.model !== "-" && <span className="font-mono">{p.model}</span>} — {vi.settings.ai.hint}</p>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted"><tr><th className="p-3">{vi.settings.ai.provider}</th><th className="text-right">{vi.settings.ai.calls}</th><th className="text-right">{vi.settings.ai.okFirst}</th><th className="text-right">{vi.settings.ai.fallbacks}</th><th className="text-right">{vi.settings.ai.tokens}</th><th className="text-right">{vi.settings.ai.latency}</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td className="p-3 text-muted" colSpan={6}>{vi.settings.ai.empty}</td></tr>}
            {rows.map((r) => <tr key={r.provider} className="border-t border-border"><td className="p-3">{r.provider}</td><td className="text-right font-mono">{r.calls}</td><td className="text-right font-mono">{r.calls ? Math.round((r.okFirstTry / r.calls) * 100) : 0}%</td><td className="text-right font-mono">{r.fallbacks}</td><td className="text-right font-mono">{r.tokensIn} / {r.tokensOut}</td><td className="text-right font-mono">{r.avgLatencyMs} ms</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```
Strings: `settings: { ai: { title: "Tích hợp AI", current: "Nhà cung cấp hiện tại", hint: "đổi bằng biến môi trường LLM_PROVIDER", provider: "Nhà cung cấp", calls: "Lời gọi", okFirst: "Hợp lệ lần đầu", fallbacks: "Fallback", tokens: "Token vào / ra", latency: "Độ trễ TB", empty: "Chưa có lời gọi nào." } }`. Nav: add `<Link href="/settings/ai">` with label `vi.settings.ai.title`.

- [ ] **Step 2: Typecheck, build, commit**

```bash
npm run typecheck && git add apps/web && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(web): AI usage statistics page"
```

---

### Task 5: forge-core `ResourcePatch`, `applyPatches`, proposer hook in `compile`; `proposePatches` task

**Files:**
- Create: `packages/forge-core/src/patches.ts`, `packages/ai/src/tasks/patches.ts`
- Modify: `packages/forge-core/src/compile.ts`, `packages/forge-core/src/index.ts`, `packages/ai/src/index.ts`, `apps/cli/src/commands/plan.ts` (`--no-ai` honoured; provider from env; prints `plan.notes`)
- Test: `packages/forge-core/test/patches.test.ts`, `packages/ai/test/patches.test.ts`

**Interfaces:**
```ts
// forge-core
export const ResourcePatch = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add"), resource: Resource.omit({ gate: true }) , reason: z.string().min(1) }),
  z.object({ op: z.literal("update"), id: ResourceId, spec: z.record(z.string(), z.unknown()).optional(), reason: z.string().optional(), rationale: z.string().min(1) }),
]);
export type ResourcePatch = z.infer<typeof ResourcePatch>;
export function applyPatches(plan: PlanV1, patches: unknown[]): { plan: PlanV1; notes: string[] };
// rules: invalid shape → note "rejected: <zod error>"; add with existing id → rejected; update with unknown id → rejected;
// update must keep id/layer/type (only spec/reason change); any patch touching a gated resource is applied to spec only, gate untouched.
export type Proposer = (plan: PlanV1, intent: IntentV1) => Promise<unknown[]>;
export function compile(intent, packs, opts?: { now?: Date; proposer?: Proposer }): Promise<{ plan; errors; notes }>;   // now async
// ai
export const PatchListSchema = z.array(ResourcePatch);
export function patchesPrompt(plan: PlanV1, intent: IntentV1): { system; user };
export function proposePatches(p: LlmProvider, log: LlmLogger): Proposer;  // withFallback → []
```
- `compile` is now async: update `apps/cli/src/commands/plan.ts` (`await`), `packages/forge-core/test/{validator,differ}.test.ts` and `apps/cli/test/cli.test.ts` accordingly (only the `await` and `opts` object change; assertions unchanged).

- [ ] **Step 1: Failing tests**

`packages/forge-core/test/patches.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { loadIntentFile } from "../src/schema/intent.js";
import { loadPacks } from "../src/packs/loader.js";
import { buildPlan } from "../src/planner/index.js";
import { applyPatches } from "../src/patches.js";
import { compile } from "../src/compile.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const intent = loadIntentFile(`${ROOT}examples/intent.example.yaml`);
const packs = loadPacks(`${ROOT}packs`);
const base = () => buildPlan(intent, packs, new Date("2026-09-10T00:00:00Z"));

describe("applyPatches", () => {
  it("applies a valid update to spec and reason, keeping id/layer/type/gate", () => {
    const { plan, notes } = applyPatches(base(), [{ op: "update", id: "cskh.form", spec: { entity: "cskh.entity", fields: [{ name: "title", label: "Tiêu đề", required: true }] }, rationale: "shorter form" }]);
    const f = plan.resources.find((r) => r.id === "cskh.form")!;
    expect((f.spec as { fields: unknown[] }).fields.length).toBe(1);
    expect(f.layer).toBe("P");
    expect(notes).toEqual([]);
  });
  it("adds a new resource and rejects duplicates, unknown ids and malformed patches with notes", () => {
    const { plan, notes } = applyPatches(base(), [
      { op: "add", resource: { id: "cskh.kpi", layer: "D", type: "data.dashboard", spec: { entity: "cskh.entity", cards: [{ name: "x", kind: "trend" }], masking: ["customer_name", "customer_phone"] }, reason: "KPI", depends_on: ["cskh.entity"] }, reason: "KPI board" },
      { op: "add", resource: { id: "h.realm", layer: "H", type: "identity.realm", spec: {}, reason: "dup" }, reason: "dup" },
      { op: "update", id: "ghost", spec: {}, rationale: "x" },
      { op: "delete", id: "h.realm" },
    ]);
    expect(plan.resources.some((r) => r.id === "cskh.kpi")).toBe(true);
    expect(plan.resources.filter((r) => r.id === "h.realm").length).toBe(1);
    expect(notes.length).toBe(3);
    expect(notes.every((n) => n.startsWith("rejected:"))).toBe(true);
  });
});

describe("compile with a proposer", () => {
  it("runs the proposer before the validator and records notes", async () => {
    const proposer = async () => [{ op: "update", id: "cskh.form", spec: { entity: "cskh.entity", fields: Array.from({ length: 6 }, (_, i) => ({ name: `f${i}`, label: `F${i}`, required: true })) }, rationale: "bad idea" }];
    const out = await compile(intent, packs, { now: new Date("2026-09-10T00:00:00Z"), proposer });
    expect(out.errors.map((e) => e.rule)).toContain("max_required");   // validator still catches the AI's bad patch
    expect(out.notes).toEqual([]);
  });
  it("works without a proposer as before", async () => {
    const out = await compile(intent, packs, { now: new Date("2026-09-10T00:00:00Z") });
    expect(out.errors).toEqual([]);
    expect(out.plan.resources.length).toBe(33);
  });
});
```

`packages/ai/test/patches.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { buildPlan, loadIntentFile, loadPacks } from "@dx-forge/forge-core";
import { NONE, type LlmProvider } from "../src/provider.js";
import { patchesPrompt, proposePatches } from "../src/tasks/patches.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const intent = loadIntentFile(`${ROOT}examples/intent.example.yaml`);
const plan = buildPlan(intent, loadPacks(`${ROOT}packs`), new Date("2026-09-10T00:00:00Z"));
const log = { log: () => {} };

describe("patchesPrompt", () => {
  it("sends the plan without gates and forbids delete/rename", () => {
    const p = patchesPrompt(plan, intent);
    expect(p.user).toContain("cskh.form");
    expect(p.user).not.toContain('"gate"');
    expect(p.system).toMatch(/không xoá/i);
  });
});

describe("proposePatches", () => {
  it("returns [] for the none provider and validated patches from a model", async () => {
    expect(await proposePatches(NONE, log)(plan, intent)).toEqual([]);
    const fake: LlmProvider = { name: "fake", model: "f", async complete() { return { text: '[{"op":"update","id":"cskh.form","reason":"r","rationale":"x"}]', tokensIn: 1, tokensOut: 1 }; } };
    const out = await proposePatches(fake, log)(plan, intent);
    expect(out).toEqual([{ op: "update", id: "cskh.form", reason: "r", rationale: "x" }]);
  });
});
```

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: patches.ts (forge-core) and compile change**

`packages/forge-core/src/patches.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";
import { PlanV1, Resource, ResourceId } from "./schema/plan.js";

export const ResourcePatch = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add"), resource: Resource.omit({ gate: true }), reason: z.string().min(1) }),
  z.object({ op: z.literal("update"), id: ResourceId, spec: z.record(z.string(), z.unknown()).optional(), reason: z.string().optional(), rationale: z.string().min(1) }),
]);
export type ResourcePatch = z.infer<typeof ResourcePatch>;

/** Applies AI-proposed patches. Never removes resources, never changes id/layer/type/gate. Rejections go to notes. */
export function applyPatches(plan: PlanV1, patches: unknown[]): { plan: PlanV1; notes: string[] } {
  const notes: string[] = [];
  const resources = plan.resources.map((r) => ({ ...r }));
  for (const raw of patches) {
    const parsed = ResourcePatch.safeParse(raw);
    if (!parsed.success) { notes.push(`rejected: malformed patch (${parsed.error.issues.map((i) => i.message).join("; ")})`); continue; }
    const p = parsed.data;
    if (p.op === "add") {
      if (resources.some((r) => r.id === p.resource.id)) { notes.push(`rejected: add ${p.resource.id} already exists`); continue; }
      resources.push(Resource.parse({ ...p.resource, reason: p.reason, source: { pack: "ai" } }));
    } else {
      const target = resources.find((r) => r.id === p.id);
      if (!target) { notes.push(`rejected: update ${p.id} not found`); continue; }
      if (p.spec) target.spec = p.spec;
      if (p.reason) target.reason = p.reason;
    }
  }
  return { plan: PlanV1.parse({ ...plan, resources }), notes };
}
```

`packages/forge-core/src/compile.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { LoadedPack } from "./packs/loader.js";
import { applyPatches } from "./patches.js";
import { buildPlan } from "./planner/index.js";
import type { IntentV1 } from "./schema/intent.js";
import type { PlanV1 } from "./schema/plan.js";
import { validatePlan, type ValidationError } from "./validator/index.js";

export type Proposer = (plan: PlanV1, intent: IntentV1) => Promise<unknown[]>;

/** intent + packs → (AI patches) → validated, gated plan. The validator always runs last. */
export async function compile(intent: IntentV1, packs: Map<string, LoadedPack>, opts: { now?: Date; proposer?: Proposer } = {}): Promise<{ plan: PlanV1; errors: ValidationError[]; notes: string[] }> {
  let plan = buildPlan(intent, packs, opts.now ?? new Date());
  let notes: string[] = [];
  if (opts.proposer) {
    const patches = await opts.proposer(plan, intent);
    ({ plan, notes } = applyPatches(plan, patches));
  }
  const v = validatePlan({ ...plan, notes }, intent);
  return { plan: v.plan, errors: v.errors, notes };
}
```
Export `patches.js` from `src/index.ts`. Update callers: `apps/cli/src/commands/plan.ts` (`const result = await compile(intent, loadPacks(dir), { proposer: opts.ai ? proposePatches(createProvider(process.env), consoleLogger) : undefined })`, print `notes` as `  ℹ <note>` lines after the tree), `runPlan` becomes async and `registerPlan` awaits it; tests: `validator.test.ts` `compile(intent, packs, { now })` with `await`, same in `differ.test.ts`; CLI dependency `@dx-forge/ai` added to `apps/cli/package.json`.

- [ ] **Step 4: patches task (ai)**

`packages/ai/src/tasks/patches.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";
import { ResourcePatch, type IntentV1, type PlanV1, type Proposer } from "@dx-forge/forge-core";
import { fiveRoSystem } from "../prompt.js";
import type { LlmLogger, LlmProvider } from "../provider.js";
import { withFallback } from "../structured.js";

export const PatchListSchema = z.array(ResourcePatch);

export function patchesPrompt(plan: PlanV1, intent: IntentV1) {
  const slim = plan.resources.map(({ id, layer, type, spec, reason, depends_on }) => ({ id, layer, type, spec, reason, depends_on }));
  return {
    system: fiveRoSystem({
      role: "Kiến trúc sư DX-OS rà soát kế hoạch do máy sinh.",
      context: "intent.yaml và danh sách tài nguyên của plan (không có cổng), dạng JSON.",
      action: "Đề xuất tối đa 8 vá: bổ sung trường hoặc rào chắn cho form, KPI cho dashboard, tên kênh/chủ đề dễ hiểu, hoặc thêm tài nguyên còn thiếu cho quy trình lõi.",
      format: 'JSON mảng các vá: {"op":"update","id":string,"spec"?:object,"reason"?:string,"rationale":string} hoặc {"op":"add","resource":{id,layer,type,spec,reason,depends_on},"reason":string}.',
      boundaries: ["Không xoá tài nguyên, không đổi id/layer/type, không nhắc tới gate.", "Form không quá 5 trường bắt buộc.", "Mỗi chuyển trạng thái đúng một vai trò A.", "Trả về [] nếu không có gì đáng sửa."],
    }),
    user: JSON.stringify({ intent: { organization: intent.organization, core_processes: intent.core_processes, channels: intent.channels }, resources: slim }),
  };
}

export function proposePatches(p: LlmProvider, log: LlmLogger): Proposer {
  return async (plan, intent) => (await withFallback(p, log, { purpose: "planPatches", ...patchesPrompt(plan, intent), schema: PatchListSchema, maxTokens: 4096 }, () => [])).data;
}
```

- [ ] **Step 5: Run, commit**

`npm test` (all green incl. updated compile callers); `npm run typecheck`.

```bash
git add packages apps && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(core,ai): AI-proposed resource patches applied before the validator"
```

---

### Task 6: Interview — intent draft schema, AI turn, CLI `dxforge interview`, wizard interview page

**Files:**
- Create: `packages/ai/src/tasks/interview.ts`, `apps/cli/src/commands/interview.ts`, `apps/web/src/app/api/interview/route.ts`, `apps/web/src/app/interview/page.tsx`, `apps/web/src/components/InterviewChat.tsx`
- Modify: `apps/cli/src/index.ts`, `apps/web/src/lib/i18n.vi.ts`, `apps/web/src/app/layout.tsx` (nav)
- Test: `packages/ai/test/interview.test.ts`, `apps/cli/test/cli.test.ts` (one new case: interview with `--no-ai` and answers from stdin)

**Interfaces:**
```ts
export const IntentDraft = z.object({
  organization: z.object({ name: z.string(), short_code: z.string(), sector: z.string(), size_band: z.string(), departments: z.array(z.object({ code: z.string(), name: z.string() })) }).partial(),
  core_processes: z.array(z.object({ id: z.string(), pack: z.string().optional(), name: z.string(), actors: z.object({ R: z.string(), A: z.string(), C: z.array(z.string()).default([]), I: z.array(z.string()).default([]) }), sla_hours: z.number().optional(), external_entry: z.boolean().optional() })).default([]),
  channels: z.object({ chat: z.enum(["telegram", "mattermost"]), notify_targets: z.object({ announce: z.string(), alerts: z.string(), approvals: z.string() }) }).partial().optional(),
  target: z.object({ kind: z.enum(["oss", "gws", "manifest"]) }).partial().optional(),
});
export const InterviewTurn = z.object({ draft: IntentDraft, nextQuestion: z.string().nullable(), done: z.boolean() });
export type Transcript = { role: "assistant" | "user"; text: string }[];
export function interviewPrompt(ctx: { maturity?: Maturity; organization?: Organization-like; transcript: Transcript; draft: IntentDraft }): { system; user };
export function nextTurn(p, log, ctx): Promise<{ turn: InterviewTurn; fallback: boolean }>;       // fallback: scripted 6-question form flow
export const SCRIPTED_QUESTIONS: { key: string; text: string; apply(draft, answer): IntentDraft }[]; // name/short_code, sector+size, departments, core process name, actors R/A, sla + channel
export function draftToIntent(draft, maturity?, defaults: { target: "oss"|"gws"|"manifest"; credentials_ref: string }): { intent?: IntentV1; missing: string[] };
export function intentToYaml(intent: IntentV1): string;    // yaml.stringify with a header comment, ≤ 80 lines for the example
```
- CLI: `dxforge interview [-o intent.yaml] [--no-ai] [--from-latest <url>]` — prompts in the terminal (`readline/promises`); `--from-latest` fetches `GET <url>/api/pulse/latest` for `maturity` (needs the session cookie: pass `--cookie`), otherwise asks whether to continue unmeasured; writes YAML; exit 0; exit 2 when required fields are still missing after the flow.
- Web: `/interview` chat page: left transcript, right live YAML preview; `POST /api/interview` `{ transcript, draft }` → `{ turn, fallback, yaml? }`; "Tải intent.yaml" when `done`; also saves `<dataDir>/intent.yaml`.

- [ ] **Step 1: Failing tests**

`packages/ai/test/interview.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { draftToIntent, intentToYaml, nextTurn, SCRIPTED_QUESTIONS } from "../src/tasks/interview.js";
import { NONE } from "../src/provider.js";

const log = { log: () => {} };
const maturity = { assessment_id: "a1", hpdi: { H: 55, P: 25, D: 12, I: 8 }, shape: "transitional" as const, dti_level: 3, discrepancies: {} };

describe("scripted fallback flow", () => {
  it("walks the six questions and produces a complete draft", async () => {
    let draft = {} as Parameters<typeof draftToIntent>[0];
    const answers = ["Công ty ABC / abc", "retail / 10-50", "cskh, Chăm sóc khách hàng\nkd, Kinh doanh", "Xử lý yêu cầu khách hàng", "staff / manager", "24 / telegram"];
    let turn = (await nextTurn(NONE, log, { maturity, transcript: [], draft })).turn;
    expect(turn.done).toBe(false);
    expect(turn.nextQuestion).toBe(SCRIPTED_QUESTIONS[0].text);
    const transcript: { role: "assistant" | "user"; text: string }[] = [];
    for (const a of answers) {
      transcript.push({ role: "assistant", text: turn.nextQuestion! }, { role: "user", text: a });
      ({ turn } = await nextTurn(NONE, log, { maturity, transcript, draft: turn.draft }));
    }
    expect(turn.done).toBe(true);
    const { intent, missing } = draftToIntent(turn.draft, maturity, { target: "oss", credentials_ref: "DXFORGE_OSS_CREDENTIALS" });
    expect(missing).toEqual([]);
    expect(intent?.organization.short_code).toBe("abc");
    expect(intent?.core_processes[0]).toMatchObject({ id: "cskh", pack: "dx-ticket", actors: { R: "staff", A: "manager" }, sla_hours: 24 });
    expect(intent?.channels.chat).toBe("telegram");
    expect(intent?.maturity?.assessment_id).toBe("a1");
    const yaml = intentToYaml(intent!);
    expect(yaml.split("\n").length).toBeLessThanOrEqual(80);
    expect(yaml).toMatch(/^# intent\.yaml/);
  });
  it("reports missing fields for an incomplete draft", () => {
    expect(draftToIntent({ organization: { name: "x" }, core_processes: [] }, undefined, { target: "oss", credentials_ref: "X" }).missing).toEqual(expect.arrayContaining(["organization.short_code", "core_processes"]));
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: interview.ts**

`packages/ai/src/tasks/interview.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";
import { stringify } from "yaml";
import { IntentV1, type Maturity } from "@dx-forge/forge-core";
import { fiveRoSystem } from "../prompt.js";
import type { LlmLogger, LlmProvider } from "../provider.js";
import { withFallback } from "../structured.js";

export const IntentDraft = z.object({
  organization: z.object({ name: z.string(), short_code: z.string(), sector: z.string(), size_band: z.string(), departments: z.array(z.object({ code: z.string(), name: z.string() })) }).partial().default({}),
  core_processes: z.array(z.object({ id: z.string(), pack: z.string().optional(), name: z.string(), actors: z.object({ R: z.string(), A: z.string(), C: z.array(z.string()).default([]), I: z.array(z.string()).default([]) }), sla_hours: z.number().optional(), external_entry: z.boolean().optional() })).default([]),
  channels: z.object({ chat: z.enum(["telegram", "mattermost"]), notify_targets: z.object({ announce: z.string(), alerts: z.string(), approvals: z.string() }) }).partial().optional(),
  target: z.object({ kind: z.enum(["oss", "gws", "manifest"]) }).partial().optional(),
});
export type IntentDraft = z.infer<typeof IntentDraft>;
export const InterviewTurn = z.object({ draft: IntentDraft, nextQuestion: z.string().nullable(), done: z.boolean() });
export type InterviewTurn = z.infer<typeof InterviewTurn>;
export type Transcript = { role: "assistant" | "user"; text: string }[];
export type InterviewCtx = { maturity?: Maturity; transcript: Transcript; draft: IntentDraft };

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
const split = (s: string) => s.split("/").map((x) => x.trim());

export const SCRIPTED_QUESTIONS: { key: string; text: string; apply(d: IntentDraft, a: string): IntentDraft }[] = [
  { key: "org", text: "Tên tổ chức và mã ngắn (ví dụ: Công ty ABC / abc)?", apply: (d, a) => { const [name, code] = split(a); return { ...d, organization: { ...d.organization, name, short_code: (code ?? slug(name)).replace(/[^a-z0-9]/g, "").slice(0, 12) } }; } },
  { key: "sector", text: "Ngành và quy mô nhân sự (ví dụ: retail / 10-50)?", apply: (d, a) => { const [sector, size_band] = split(a); return { ...d, organization: { ...d.organization, sector, size_band: size_band ?? "10-50" } }; } },
  { key: "departments", text: "Các phòng ban, mỗi dòng: mã, tên (ví dụ: cskh, Chăm sóc khách hàng)?", apply: (d, a) => ({ ...d, organization: { ...d.organization, departments: a.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [code, ...rest] = l.split(","); return { code: slug(code), name: rest.join(",").trim() || code.trim() }; }) } }) },
  { key: "process", text: "Quy trình lõi muốn chuẩn hoá trước (ví dụ: Xử lý yêu cầu khách hàng)?", apply: (d, a) => ({ ...d, core_processes: [{ id: slug(a) === "xu-ly-yeu-cau-khach-hang" ? "cskh" : slug(a), pack: "dx-ticket", name: a.trim(), actors: { R: "staff", A: "manager", C: [], I: ["dx-admin"] }, external_entry: true }] }) },
  { key: "actors", text: "Ai làm (R) và ai chịu trách nhiệm (A) trong quy trình đó (ví dụ: staff / manager)?", apply: (d, a) => { const [R, A] = split(a); return { ...d, core_processes: d.core_processes.map((p) => ({ ...p, actors: { ...p.actors, R: R || "staff", A: A || "manager" } })) }; } },
  { key: "sla", text: "Hạn xử lý (giờ) và kênh chat của tổ chức (ví dụ: 24 / telegram)?", apply: (d, a) => { const [h, chat] = split(a); return { ...d, core_processes: d.core_processes.map((p) => ({ ...p, sla_hours: Number(h) || 24 })), channels: { chat: chat === "mattermost" ? "mattermost" : "telegram", notify_targets: { announce: "thong-bao", alerts: "canh-bao", approvals: "phe-duyet" } } }; } },
];

function scriptedTurn(ctx: InterviewCtx): InterviewTurn {
  const answered = ctx.transcript.filter((t) => t.role === "user").length;
  let draft = IntentDraft.parse(ctx.draft);
  if (answered > 0 && answered <= SCRIPTED_QUESTIONS.length) draft = SCRIPTED_QUESTIONS[answered - 1].apply(draft, ctx.transcript.filter((t) => t.role === "user")[answered - 1].text);
  const next = SCRIPTED_QUESTIONS[answered];
  return { draft, nextQuestion: next?.text ?? null, done: !next };
}

export function interviewPrompt(ctx: InterviewCtx) {
  return {
    system: fiveRoSystem({
      role: "Người phỏng vấn của DX-Forge, thu thập đủ thông tin để viết intent.yaml.",
      context: "Kết quả đo (maturity), bản nháp intent hiện tại và hội thoại tới giờ, dạng JSON.",
      action: "Cập nhật bản nháp từ câu trả lời mới nhất; nếu còn thiếu (tổ chức, phòng ban, một quy trình lõi với R/A, hạn xử lý, kênh chat) thì hỏi đúng MỘT câu tiếp theo; nếu đủ thì done=true.",
      format: 'JSON {"draft":{organization,core_processes,channels,target},"nextQuestion":string|null,"done":boolean}.',
      boundaries: ["Mã ngắn và id chỉ chữ thường, số, gạch ngang.", "Không hỏi lại điều đã có trong bản nháp.", "Không đề xuất lớp I nếu shape không phải diamond."],
    }),
    user: JSON.stringify({ maturity: ctx.maturity ?? null, draft: ctx.draft, transcript: ctx.transcript.slice(-12) }),
  };
}

export async function nextTurn(p: LlmProvider, log: LlmLogger, ctx: InterviewCtx): Promise<{ turn: InterviewTurn; fallback: boolean }> {
  const r = await withFallback(p, log, { purpose: "interview", ...interviewPrompt(ctx), schema: InterviewTurn }, () => scriptedTurn(ctx));
  return { turn: r.data, fallback: r.fallback };
}

export function draftToIntent(draft: IntentDraft, maturity: Maturity | undefined, defaults: { target: "oss" | "gws" | "manifest"; credentials_ref: string }): { intent?: IntentV1; missing: string[] } {
  const candidate = {
    version: 1,
    organization: draft.organization,
    maturity,
    core_processes: draft.core_processes,
    channels: draft.channels ?? { chat: "telegram", notify_targets: { announce: "thong-bao", alerts: "canh-bao", approvals: "phe-duyet" } },
    target: { kind: draft.target?.kind ?? defaults.target, credentials_ref: defaults.credentials_ref },
    constraints: {},
  };
  const parsed = IntentV1.safeParse(candidate);
  if (parsed.success) return { intent: parsed.data, missing: [] };
  const missing = [...new Set(parsed.error.issues.map((i) => i.path.slice(0, 2).join(".")))];
  return { missing };
}

export function intentToYaml(intent: IntentV1): string {
  return `# intent.yaml — sinh bởi dxforge interview. Sửa tay được; chạy \`dxforge plan -f intent.yaml\` để sinh plan.\n${stringify(intent)}`;
}
```
(`packages/ai/package.json` gains `"yaml": "^2.6.0"`.)

- [ ] **Step 4: CLI command**

`apps/cli/src/commands/interview.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { writeFileSync } from "node:fs";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import type { Command } from "commander";
import { consoleLogger, createProvider, draftToIntent, intentToYaml, NONE, nextTurn, type IntentDraft, type Transcript } from "@dx-forge/ai";
import type { Maturity } from "@dx-forge/forge-core";

export function registerInterview(program: Command): void {
  program
    .command("interview")
    .description("Phỏng vấn để viết intent.yaml (có AI nếu cấu hình LLM_PROVIDER)")
    .option("-o, --out <file>", "đường dẫn intent.yaml", "intent.yaml")
    .option("--no-ai", "dùng luồng câu hỏi cố định, không gọi AI")
    .option("--from-latest <url>", "URL wizard để lấy kết quả đo mới nhất (/api/pulse/latest)")
    .option("--cookie <cookie>", "cookie phiên wizard (forge_session=...)")
    .option("--target <kind>", "oss | gws | manifest", "oss")
    .option("--credentials-ref <env>", "tên biến môi trường chứa thông tin đăng nhập đích", "DXFORGE_OSS_CREDENTIALS")
    .action(async (opts: { out: string; ai: boolean; fromLatest?: string; cookie?: string; target: "oss" | "gws" | "manifest"; credentialsRef: string }) => {
      process.exitCode = await runInterview(opts);
    });
}

export async function runInterview(opts: { out: string; ai: boolean; fromLatest?: string; cookie?: string; target: "oss" | "gws" | "manifest"; credentialsRef: string }): Promise<number> {
  let maturity: Maturity | undefined;
  if (opts.fromLatest) {
    const r = await fetch(`${opts.fromLatest.replace(/\/$/, "")}/api/pulse/latest`, { headers: opts.cookie ? { cookie: opts.cookie } : {} });
    if (r.ok) maturity = (await r.json()).maturity;
    else console.error(`Không lấy được kết quả đo (${r.status}); tiếp tục ở trạng thái chưa đo (chỉ lớp H).`);
  }
  const provider = opts.ai ? createProvider(process.env) : NONE;
  const rl = createInterface({ input: stdin, output: stdout });
  const transcript: Transcript = [];
  let draft: IntentDraft = { organization: {}, core_processes: [] };
  try {
    for (;;) {
      const { turn } = await nextTurn(provider, consoleLogger, { maturity, transcript, draft });
      draft = turn.draft;
      if (turn.done || !turn.nextQuestion) break;
      const answer = await rl.question(`${turn.nextQuestion}\n> `);
      transcript.push({ role: "assistant", text: turn.nextQuestion }, { role: "user", text: answer });
    }
  } finally { rl.close(); }
  const { intent, missing } = draftToIntent(draft, maturity, { target: opts.target, credentials_ref: opts.credentialsRef });
  if (!intent) { console.error(`Còn thiếu: ${missing.join(", ")}`); return 2; }
  writeFileSync(opts.out, intentToYaml(intent));
  console.log(`Đã ghi ${opts.out}. Chạy: dxforge plan -f ${opts.out}`);
  return 0;
}
```
Register in `apps/cli/src/index.ts`. Multi-line answers (departments) are entered with `;` separators in the terminal: extend `SCRIPTED_QUESTIONS[2].apply` to split on `\n` **or** `;`.

CLI test (`apps/cli/test/cli.test.ts`): spawn `interview --no-ai -o <tmp>/intent.yaml` with `input` = the six answers joined by `\n`, expect exit 0 and that `loadIntentFile(<tmp>/intent.yaml)` parses with `organization.short_code === "abc"` and no `maturity`.

- [ ] **Step 5: Web interview**

`apps/web/src/app/api/interview/route.ts`: `POST { transcript, draft }` → loads `maturity` from `repo.latestResult` via `resultToMaturity` if present; `nextTurn(getProvider(), dbLogger(db), …)`; when `turn.done`, builds `draftToIntent(turn.draft, maturity, { target: "oss", credentials_ref: "DXFORGE_OSS_CREDENTIALS" })`, writes `<dataDir>/intent.yaml`, returns `{ turn, fallback, yaml, missing }`. `GET /api/interview` returns the saved YAML as `text/yaml` (download).

`apps/web/src/components/InterviewChat.tsx` (client): state `transcript`, `draft`, `question`; on mount POSTs an empty transcript to get the first question; renders bubbles, an input with Enter to send, right pane `<pre>` with `yaml` when done, a download link to `/api/interview`, a chip "AI" or "luật" from `fallback`. `apps/web/src/app/interview/page.tsx` renders it with a title `vi.interview.title`. Strings: `interview: { title: "Phỏng vấn intent", send: "Gửi", download: "Tải intent.yaml", done: "Đã đủ thông tin.", ai: "AI", rules: "luồng cố định", unmeasured: "Chưa có kết quả đo: plan sẽ chỉ mở lớp H." }`.

- [ ] **Step 6: Run, commit**

`npm test`, `npm run typecheck`, `npm run e2e` (existing E2E still green).

```bash
git add packages apps && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(ai,cli,web): interview stage producing intent.yaml with scripted fallback"
```

---

### Task 7: Handbook — template renderer in forge-core, AI polish, CLI and web endpoints

**Files:**
- Create: `packages/forge-core/src/handbook.ts`, `packages/ai/src/tasks/handbook.ts`, `apps/cli/src/commands/handbook.ts`, `apps/web/src/app/api/handbook/route.ts`
- Modify: `packages/forge-core/src/index.ts`, `packages/ai/src/index.ts`, `apps/cli/src/index.ts`
- Test: `packages/forge-core/test/handbook.test.ts`, `packages/ai/test/handbook.test.ts`

**Interfaces:**
- `renderHandbook(plan: PlanV1, intent: IntentV1): string` — deterministic markdown: title with org name; "Cách tổ chức làm việc số" (P.A.R.A tree from `h.tree`, ACL rules from `storage.acl`); per core process: 5 RÕ table derived from `process.state_machine` transitions (A) and `process.form` (fields), SLA from `process.workflow`; "Kênh thông báo" from `comms.topic`; "Dữ liệu" from `data.dashboard`/`data.snapshot`; "Trợ lý AI" section only when I-layer resources are `gate.allowed`, otherwise a sentence saying the layer is locked and why; appendix listing every resource id with its reason.
- `HandbookSchema = z.object({ markdown: z.string().min(200) })`; `polishHandbook(p, log, markdown, intent)` → `withFallback` returning the template markdown unchanged on fallback; boundary: keep every heading, never add tools or numbers not in the input.
- CLI: `dxforge handbook -p plan.yaml -f intent.yaml [-o handbook.md] [--no-ai]`.
- Web: `POST /api/handbook { plan, intent }` → `{ markdown, fallback }` (used by plan 06's UI).

- [ ] **Step 1: Failing tests**

`packages/forge-core/test/handbook.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { compile } from "../src/compile.js";
import { renderHandbook } from "../src/handbook.js";
import { loadPacks } from "../src/packs/loader.js";
import { loadIntentFile } from "../src/schema/intent.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const intent = loadIntentFile(`${ROOT}examples/intent.example.yaml`);
const packs = loadPacks(`${ROOT}packs`);

describe("renderHandbook", () => {
  it("writes the organisation, P.A.R.A rules, one 5 RÕ table per process, channels and the locked I layer", async () => {
    const { plan } = await compile(intent, packs, { now: new Date("2026-09-10T00:00:00Z") });
    const md = renderHandbook(plan, intent);
    expect(md).toMatch(/^# Sổ tay nghiệp vụ số — Công ty TNHH ABC/);
    expect(md).toContain("3. [R] RESOURCES");
    expect(md).toContain("chỉ đọc");
    expect(md).toContain("## Quy trình: Xử lý yêu cầu khách hàng");
    expect(md).toMatch(/\| new → assigned \| manager \|/);
    expect(md).toContain("customer_phone");
    expect(md).toContain("thong-bao");
    expect(md).toMatch(/Lớp I.*khoá/);
    expect(md).toContain("## Phụ lục: tài nguyên");
    expect(md.split("\n").filter((l) => l.startsWith("- `")).length).toBe(33);
  });
  it("describes the assistant when the I layer is open", async () => {
    const diamond = { ...intent, maturity: { ...intent.maturity!, shape: "diamond" as const, hpdi: { H: 10, P: 30, D: 30, I: 30 } } };
    const { plan } = await compile(diamond, packs, { now: new Date("2026-09-10T00:00:00Z") });
    expect(renderHandbook(plan, diamond)).toContain("## Trợ lý AI");
  });
});
```

`packages/ai/test/handbook.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { NONE, type LlmProvider } from "../src/provider.js";
import { polishHandbook } from "../src/tasks/handbook.js";

const log = { log: () => {} };
const md = "# Sổ tay\n\n## A\n\n" + "x".repeat(300);

describe("polishHandbook", () => {
  it("returns the template unchanged for none, and the model text when valid and headings are preserved", async () => {
    expect((await polishHandbook(NONE, log, md, { organization: { name: "ABC" } })).markdown).toBe(md);
    const good: LlmProvider = { name: "f", model: "m", async complete() { return { text: JSON.stringify({ markdown: md.replace("x".repeat(300), "văn bản đã chỉnh ".repeat(20)) }), tokensIn: 1, tokensOut: 1 }; } };
    expect((await polishHandbook(good, log, md, { organization: { name: "ABC" } })).markdown).toContain("văn bản đã chỉnh");
    const dropsHeading: LlmProvider = { name: "f", model: "m", async complete() { return { text: JSON.stringify({ markdown: "# Khác\n\n" + "y".repeat(300) }), tokensIn: 1, tokensOut: 1 }; } };
    expect((await polishHandbook(dropsHeading, log, md, { organization: { name: "ABC" } })).markdown).toBe(md);   // heading check fails → fallback
  });
});
```

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: handbook.ts (forge-core)**

`packages/forge-core/src/handbook.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IntentV1 } from "./schema/intent.js";
import type { PlanV1, Resource } from "./schema/plan.js";
import { AclSpec, DashboardSpec, FormSpec, StateMachineSpec } from "./schema/specs.js";

const by = (plan: PlanV1, type: string) => plan.resources.filter((r) => r.type === type);
const byProcess = (plan: PlanV1, pid: string, type: string) => plan.resources.find((r) => r.type === type && r.source?.process === pid);

export function renderHandbook(plan: PlanV1, intent: IntentV1): string {
  const org = intent.organization;
  const out: string[] = [`# Sổ tay nghiệp vụ số — ${org.name}`, "", `Sinh bởi DX-Forge từ plan ${plan.intent_hash.slice(0, 8)} (${plan.generated_at.slice(0, 10)}). Mọi quy tắc dưới đây đã được cấp phát lên hệ thống; sổ tay này mô tả cách làm việc, không thay thế cấu hình.`, ""];

  const tree = by(plan, "storage.tree")[0];
  if (tree) {
    out.push("## Cách tổ chức làm việc số (P.A.R.A)", "", `Gốc: \`${(tree.spec as { root: string }).root}\``, "");
    for (const b of (tree.spec as { branches: string[] }).branches) out.push(`- \`${b}\``);
    out.push("");
    const acls = by(plan, "storage.acl").map((r) => AclSpec.safeParse(r.spec)).filter((p) => p.success).map((p) => p.data!);
    if (acls.length) {
      out.push("### Quyền truy cập", "");
      for (const a of acls) out.push(`- \`${a.path}\`: ${a.group} ${a.mode === "read" ? "chỉ đọc" : a.mode === "write" ? "được ghi" : "toàn quyền"}`);
      out.push("");
    }
  }

  for (const p of intent.core_processes) {
    out.push(`## Quy trình: ${p.name}`, "", `Người làm (R): ${p.actors.R} · Người chịu trách nhiệm (A): ${p.actors.A} · Hạn xử lý: ${p.sla_hours} giờ${p.external_entry ? " · Có biểu mẫu công khai" : ""}`, "");
    const sm = byProcess(plan, p.id, "process.state_machine");
    const smSpec = sm && StateMachineSpec.safeParse(sm.spec);
    if (smSpec?.success) {
      out.push("| Chuyển trạng thái | Người chịu trách nhiệm (A) |", "|---|---|");
      for (const t of smSpec.data.transitions) out.push(`| ${t.from} → ${t.to} | ${t.A.join(", ")} |`);
      out.push("");
    }
    const form = byProcess(plan, p.id, "process.form");
    const formSpec = form && FormSpec.safeParse(form.spec);
    if (formSpec?.success) {
      out.push("Biểu mẫu tiếp nhận:", "");
      for (const f of formSpec.data.fields) out.push(`- ${f.label} (\`${f.name}\`)${f.required ? ", bắt buộc" : ""}${f.pattern ? `, định dạng \`${f.pattern}\`` : ""}${f.options ? `, chọn: ${f.options.join(" / ")}` : ""}`);
      out.push("");
    }
  }

  const topics = by(plan, "comms.topic");
  if (topics.length) {
    out.push("## Kênh thông báo", "");
    for (const t of topics) out.push(`- ${(t.spec as { name: string }).name}: ${t.reason}`);
    out.push("");
  }

  const dashboards = by(plan, "data.dashboard").map((r) => ({ r, s: DashboardSpec.safeParse(r.spec) })).filter((x) => x.s.success);
  if (dashboards.length) {
    out.push("## Dữ liệu và báo cáo", "");
    for (const { r, s } of dashboards) out.push(`- ${r.id}: ${s.data!.cards.map((c) => c.name).join(", ")}${s.data!.masking.length ? ` (che: ${s.data!.masking.join(", ")})` : ""}${r.gate.allowed ? "" : " — chưa mở"}`);
    out.push("");
  }

  const intel = plan.resources.filter((r) => r.layer === "I");
  if (intel.some((r) => r.gate.allowed)) {
    out.push("## Trợ lý AI", "", "Trợ lý chỉ trả lời theo tài liệu trong kho tài nguyên và chỉ thực hiện hành động trong danh sách cho phép sau khi có người duyệt trong 24 giờ.", "");
  } else if (intel.length) {
    out.push("## Trợ lý AI", "", `Lớp I đang khoá: ${intel[0].gate.why ?? ""}`, "");
  }

  out.push("## Phụ lục: tài nguyên", "");
  for (const r of plan.resources as Resource[]) out.push(`- \`${r.id}\` [${r.layer}] ${r.type}: ${r.reason}${r.gate.allowed ? "" : " (khoá)"}`);
  return out.join("\n") + "\n";
}
```

- [ ] **Step 4: AI polish, CLI, web**

`packages/ai/src/tasks/handbook.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";
import { fiveRoSystem } from "../prompt.js";
import type { LlmLogger, LlmProvider } from "../provider.js";
import { withFallback } from "../structured.js";

export const HandbookSchema = z.object({ markdown: z.string().min(200) });
const headings = (md: string) => md.split("\n").filter((l) => /^#{1,3} /.test(l));

export async function polishHandbook(p: LlmProvider, log: LlmLogger, markdown: string, intent: { organization: { name: string } }): Promise<{ markdown: string; fallback: boolean }> {
  const required = headings(markdown);
  const schema = HandbookSchema.refine((h) => required.every((r) => h.markdown.includes(r)), { message: "missing heading" });
  const r = await withFallback(p, log, {
    purpose: "handbook", schema, maxTokens: 6000,
    system: fiveRoSystem({ role: `Biên tập viên sổ tay nghiệp vụ của ${intent.organization.name}.`, context: "Sổ tay markdown do máy sinh.", action: "Viết lại cho dễ đọc với nhân viên mới: câu ngắn, ví dụ ngắn, giữ nguyên MỌI tiêu đề và MỌI bảng.", format: 'JSON {"markdown":string}.', boundaries: ["Không thêm công cụ, số liệu hay quy tắc không có trong bản gốc.", "Không bỏ tiêu đề nào."] }),
    user: markdown,
  }, () => ({ markdown }));
  return { markdown: r.data.markdown, fallback: r.fallback };
}
```

`apps/cli/src/commands/handbook.ts`: options `-p plan.yaml`, `-f intent.yaml`, `-o handbook.md`, `--no-ai`; reads both files (`PlanV1.parse`, `loadIntentFile`), `renderHandbook`, `polishHandbook` unless `--no-ai`, writes the file, prints `Đã ghi <out>` and `(AI)`/`(mẫu)`; exit 2 on unreadable input.

`apps/web/src/app/api/handbook/route.ts`: `POST { plan, intent }` (both validated with the zod schemas) → `{ markdown, fallback }`.

- [ ] **Step 5: Run, commit**

`npm test`; `npm run typecheck`; manual: `npm run dxforge -- handbook -p plan.yaml -f examples/intent.example.yaml --no-ai -o /tmp/h.md && head -20 /tmp/h.md`.

```bash
git add packages apps && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(core,ai,cli,web): handbook renderer with optional AI polish"
```

---

### Task 8: `dxforge explain --ai` and web explain endpoint

**Files:**
- Create: `packages/ai/src/tasks/explain.ts`, `apps/web/src/app/api/explain/route.ts`
- Modify: `apps/cli/src/commands/explain.ts`, `packages/ai/src/index.ts`
- Test: `packages/ai/test/explain.test.ts`

**Interfaces:**
- `ExplainSchema = z.object({ explanation: z.string().min(1), risksIfRemoved: z.array(z.string()), relatedIds: z.array(z.string()) })`; `explainResource(p, log, resource, plan, intent)` → `withFallback` with the rule-based fallback `{ explanation: resource.reason, risksIfRemoved: [dependents...], relatedIds: [...depends_on, ...dependents] }`.
- CLI `explain <id> -p plan.yaml [--ai] [-f intent.yaml]` prints the current output, then the AI explanation and risks when `--ai`.
- Web `POST /api/explain { plan, intent, id }` → `{ …ExplainSchema, fallback }`.

- [ ] **Step 1: Failing test** — `explain.test.ts`: fallback lists dependents of `cskh.entity` (form, states, rule, workflow, dashboard, snapshot, lod) in `risksIfRemoved`; a fake provider's valid JSON is returned; an invalid one falls back.
- [ ] **Step 2–4:** implement per the interface (prompt: role "Kiến trúc sư DX-OS", context = the resource + its neighbours + intent process, action "giải thích vì sao tài nguyên này tồn tại cho lãnh đạo không kỹ thuật, 3–5 câu; liệt kê rủi ro nếu bỏ", boundaries "không nhắc tên sản phẩm đích cụ thể nếu resource không nêu").
- [ ] **Step 5: Run, commit** — `git commit -m "feat(ai,cli,web): AI-assisted explain for plan resources"`.

---

### Task 9: Docs, env, changelog

**Files:**
- Modify: `README.md` (roadmap 03 ✅; CLI table gains `interview`, `handbook`, `explain --ai`; a short "Tích hợp AI" section: providers, fallback, privacy), `BUILDING.md` (LLM env vars), `DEPENDENCIES.md` (no new deps besides `yaml` already listed), `CHANGELOG.md`, `apps/web/.env.example`, `deploy/.env.example`, `docs/superpowers/specs/2026-09-09-m0-measurement-design.md` §6.1 (adapters use `fetch`, no SDKs), `docs/SRS.md` FR-I-01..04 status notes.

- [ ] **Step 1:** Apply the edits; every command in README must be runnable (`--no-ai` shown for offline use).
- [ ] **Step 2:** `npm test && npm run typecheck && npm run e2e`; commit `docs: document the AI layer, interview and handbook commands`.

---

## Self-review

**Spec coverage:** master §4 `packages/ai` (LlmProvider gemini|anthropic|ollama|none, 5 RÕ prompts, zod, fallback) → Tasks 1–3; "AI chỉ ở interview, plan (đề xuất), handbook, giải thích; validator chạy sau AI" → Tasks 5–8 with the validator last in `compile`; M0 §6.1 interface and env selection → Tasks 1–2; §6.2 four tasks with fallbacks, retry once, `llm_calls`, admin stats → Tasks 3–4; §6.2 privacy (scores, sector, size, free text ≤ 2 000) → `m0Context` + `truncate`; forge-core §1.2 step 3 (ResourcePatch, notes) → Task 5; master §2 interview producing `intent.yaml` ≤ 80 lines with `maturity` from measure → Task 6; handbook markdown → Task 7; explain → Task 8. Out of scope here: pushing the handbook into the target's Resources (plan 04, `portal.handbook` adapter) and the wizard screens for plan/apply (plan 06).

**Placeholder scan:** Task 8 gives interfaces, fallback semantics and the prompt frame but not the full test/route code; its shape mirrors Task 7 exactly and is the only task written at that level (small, 3 files).

**Type consistency:** `compile` is async from Task 5 on and every caller listed is updated in the same task; `withFallback` result shape (`data, fallback, provider, model, tokensIn, tokensOut, latencyMs`) is what `savePrescription` consumes in Task 3 and Task 6/7 read; `Proposer` type is defined in forge-core and implemented in `packages/ai`; `Maturity` type import path is `@dx-forge/forge-core` (Task 5 of plan 02).
