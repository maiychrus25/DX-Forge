# DX-Forge Plan 01 — Repo skeleton, hpdi-engine, forge-core, dx-ticket pack, CLI `plan`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From a clean clone, `dxforge plan -f examples/intent.example.yaml -o plan.yaml` produces a validated 4-layer `plan.yaml` (with maturity gates and reasons) from an intent plus the `dx-ticket` pack, and `hpdi-engine` turns survey responses into a `ResultV1`.

**Architecture:** npm-workspaces monorepo. `packages/hpdi-engine` is pure TypeScript (questionnaire → scoring → HPDI mapping → shape/level). `packages/forge-core` holds zod schemas (IntentV1, PlanV1, StateV1), a planner (pack templates + rule-generated H/D/I resources), a validator that can't be switched off (maturity gate + 6 rules), and a differ (plan vs state → create/update/skip/destroy). `apps/cli` is a thin commander wrapper. Providers, AI, and the web wizard are later plans.

**Tech Stack:** Node 22+, TypeScript 5, ESM, zod 3, yaml 2, commander 13, vitest 3, tsx. No database in this plan.

**Spec:** `docs/superpowers/specs/2026-09-09-dx-forge-design.md` (master), `docs/superpowers/specs/2026-09-09-forge-core-oss-provider-design.md` (§1 forge-core), `docs/superpowers/specs/2026-09-09-m0-measurement-design.md` (§5 engine). SRS: `docs/SRS.md` (FR-M0-*, FR-P-01..06, FR-C).

**Plan series (this is 01):**
01 core engine + CLI plan (this file) → 02 M0 measurement wizard (Next.js, Prisma/SQLite, survey, radar, P.A.R.A kit) → 03 AI layer + interview + handbook → 04 provider oss layer H + apply/state/verify/destroy → 05 provider oss layers P/D/I → 06 wizard plan/apply/verify screens → 07 provider gws → 08 manifest + release.

## Global Constraints

- License `AGPL-3.0-or-later`; first line of every `.ts`, `.js`, `.sh`, `.sql` file is `// SPDX-License-Identifier: AGPL-3.0-or-later` (`# ...` for `.sh`/`.yaml` that we author, `-- ...` for `.sql`).
- Code, comments, tests, commit messages in English. Only strings shown to end users (questionnaire text, prescriptions, CLI messages to the operator) are Vietnamese.
- Commit author `maiychrus <ninhkhuongpl7@gmail.com>`; no trailers of any kind. Use: `git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit`.
- Work on branch `develop`; `main` only receives tagged merges.
- Never write credentials into intent/plan/state; `target.credentials_ref` is an environment-variable name only.
- Validator rules cannot be disabled by any flag; AI (later plan) runs before the validator, never after.
- Maturity gate (spec §3): `spear` → H only; `kite`/`transitional` → H + P, plus D if `hpdi.P ≥ 20`; `illusion` → H + P + D, I forbidden with why `"GIGO"`; `diamond` → all; intent without `maturity` → flag `unmeasured`, H only.
- Other validator rules: exactly one A per state-machine transition; ≤ 5 required fields per form; `3. [R] RESOURCES` is read-only for `all-staff`; PII entities need dashboard masking; every `intel.agent_policy` has a non-empty `approval_channel` and `expire_hours ≤ 24`; `depends_on` acyclic with existing ids.
- HPDI: `P% = scoreP × P_supp × 30` (same for D, I), `H = 100 − (P+D+I)`, rounded to integers. Supp per axis = **minimum** across tiers with data; an axis with no supp answer uses the lowest option value of its supp question.
- Spec deviation locked here (the two golden cases in M0 spec §5.5 are contradictory under "mean of 6 pillars"): `dtiScore = 100 − H`, level = `score ≤ 10 → 1; ≤ 30 → 2; ≤ 70 → 3; < 90 → 4; ≥ 90 → 5`. M0 spec §5.3 is patched to say so.
- Shapes: `spear` H ≥ 75; `kite` H < 75 ∧ P ≥ 20 ∧ D < 10 ∧ I < 10; `illusion` H ≥ 60 ∧ (I ≥ 10 ∨ D ≥ 10) ∧ P < 20; `diamond` H ≤ 25 ∧ P,D,I ≥ 20; else `transitional`. Evaluate in that order.
- Tier merge weights executive 0.25 / manager 0.25 / staff 0.5, renormalised over tiers that have data; `weightEvidence` questions take the staff value only when staff data exists.
- A computation needs ≥ 1 response in `executive` **and** `staff`, otherwise throw `InsufficientResponses` (never return zeros).

---

## File structure

```
dx-forge/
├── package.json                      # workspaces, root scripts (test, typecheck)
├── tsconfig.base.json
├── vitest.config.ts
├── .gitignore  .editorconfig  LICENSE  LICENSE_NOTICE.md  README.md
├── examples/intent.example.yaml      # canonical sample intent used by tests and docs
├── packs/
│   ├── core/pack.yaml                # org-scoped: offboarding entity + workflow
│   └── dx-ticket/pack.yaml           # process-scoped: entity, form, states, rule, workflow, app
├── packages/hpdi-engine/
│   ├── package.json  tsconfig.json
│   ├── src/index.ts                  # compute(), re-exports
│   ├── src/types.ts                  # Pillar, Tier, Question, Questionnaire, Response, ResultV1
│   ├── src/questionnaire/schema.ts   # zod for Question/Questionnaire + loadQuestionnaire()
│   ├── src/questionnaire/questionnaire.v1.json
│   ├── src/scoring.ts                # pillar scores by tier, merged, discrepancy, supp
│   ├── src/mapping.ts                # DTI pillars → HPDI, dtiScore, dtiLevel
│   ├── src/shape.ts                  # shape + rule-based prescription
│   └── test/{questionnaire,scoring,compute}.test.ts
├── packages/forge-core/
│   ├── package.json  tsconfig.json
│   ├── src/index.ts
│   ├── src/schema/{intent,plan,state,specs}.ts
│   ├── src/hash.ts                   # canonicalJson(), checksum()
│   ├── src/packs/{template,loader}.ts
│   ├── src/planner/{rules,index}.ts
│   ├── src/validator/{gate,rules,index}.ts
│   ├── src/order.ts                  # topoSort by layer then depends_on
│   ├── src/differ.ts
│   └── test/{schema,hash,packs,planner,validator,order,differ}.test.ts
└── apps/cli/
    ├── package.json  tsconfig.json
    ├── src/index.ts                  # commander entry: plan | packs list | explain
    ├── src/commands/{plan,packs,explain}.ts
    └── test/cli.test.ts
```

---

### Task 1: Repository skeleton and toolchain

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `vitest.config.ts`, `.gitignore`, `.editorconfig`, `LICENSE`, `LICENSE_NOTICE.md`, `README.md`
- Create: `packages/hpdi-engine/package.json`, `packages/hpdi-engine/tsconfig.json`, `packages/hpdi-engine/src/index.ts`, `packages/hpdi-engine/test/smoke.test.ts`

**Interfaces:**
- Produces: workspace names `@dx-forge/hpdi-engine`, `@dx-forge/forge-core`, `@dx-forge/cli`; root scripts `npm test`, `npm run typecheck`.

- [ ] **Step 1: Create branch `develop`**

```bash
cd ~/dx-forge && git checkout -b develop
```

- [ ] **Step 2: Root package.json, tsconfig, vitest config, dotfiles**

`package.json`:
```json
{
  "name": "dx-forge",
  "private": true,
  "version": "0.1.0",
  "license": "AGPL-3.0-or-later",
  "type": "module",
  "workspaces": ["packages/*", "packages/providers/*", "apps/*"],
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b packages/hpdi-engine packages/forge-core apps/cli"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "declaration": true,
    "composite": true,
    "noEmit": false,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

`vitest.config.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/test/**/*.test.ts", "apps/**/test/**/*.test.ts"],
    coverage: { provider: "v8", include: ["packages/*/src/**"] },
  },
});
```

`.gitignore`:
```
node_modules/
dist/
.dxforge/
*.tsbuildinfo
coverage/
plan.yaml
__pycache__/
*.pyc
```

`.editorconfig`:
```
root = true
[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

- [ ] **Step 3: LICENSE, LICENSE_NOTICE.md, README.md**

```bash
cd ~/dx-forge && curl -fsSL https://www.gnu.org/licenses/agpl-3.0.txt -o LICENSE && head -3 LICENSE
```
Expected: first line `GNU AFFERO GENERAL PUBLIC LICENSE`.

`LICENSE_NOTICE.md`:
```markdown
# License notice

DX-Forge is licensed under the GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later). See `LICENSE`.

## Methodology attribution (CC BY 4.0)

The HPDI model, the P.A.R.A layout, the 5 RÕ framework, Poka-yoke layers and the DX-Ticket sample process implemented here come from the book *Xây dựng Hệ điều hành Doanh nghiệp số: Từ Tư duy đến Hành động* by Tạ Tuấn Anh (FDS), published at https://opendigitransform.gitbook.io/dx-os under CC BY 4.0. Changes: the methodology is encoded as data files, scoring rules and generators; no text of the book is reproduced verbatim.

## Compatible targets

DX-Forge generates artefacts for third-party systems (Keycloak, Nextcloud, PostgreSQL, n8n, Appsmith, Metabase, Qdrant, Telegram, Mattermost, Google Workspace) and can export a plugin manifest for platforms that consume one. None of their code is vendored here; see `DEPENDENCIES.md`.
```

`README.md`:
```markdown
# DX-Forge

A compiler for the digital enterprise operating system (DX-OS): measure an organisation, interview it into an `intent.yaml`, compile a four-layer (H-P-D-I) `plan.yaml`, apply it to an open-source or Google Workspace target, verify, and write the handbook.

Status: plan 01 (engine + core + CLI `plan`). See `docs/superpowers/specs/` and `docs/SRS.md`.

```bash
npm install
npm test
npx dxforge plan -f examples/intent.example.yaml -o plan.yaml
```

License: AGPL-3.0-or-later. Methodology © Tạ Tuấn Anh, CC BY 4.0 (see `LICENSE_NOTICE.md`).
```

- [ ] **Step 4: hpdi-engine package shell with a smoke test**

`packages/hpdi-engine/package.json`:
```json
{
  "name": "@dx-forge/hpdi-engine",
  "version": "0.1.0",
  "license": "AGPL-3.0-or-later",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": { "zod": "^3.24.0" }
}
```
(`main` points at `src` on purpose: tsx/vitest consume TS directly. `ponytail:` add a `tsc` build + `dist` exports when the CLI is published to npm in plan 08.)

`packages/hpdi-engine/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

`packages/hpdi-engine/src/index.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
export const ENGINE_VERSION = "1.0" as const;
```

`packages/hpdi-engine/test/smoke.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "../src/index.js";

describe("hpdi-engine package", () => {
  it("exposes the engine version", () => {
    expect(ENGINE_VERSION).toBe("1.0");
  });
});
```

- [ ] **Step 5: Install and run**

```bash
cd ~/dx-forge && npm install && npm test
```
Expected: `1 passed`.

- [ ] **Step 6: Commit**

```bash
git add -A && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "chore: bootstrap npm workspaces, vitest, license and notice"
```

---

### Task 2: hpdi-engine types, questionnaire schema and `questionnaire.v1.json`

**Files:**
- Create: `packages/hpdi-engine/src/types.ts`, `packages/hpdi-engine/src/questionnaire/schema.ts`, `packages/hpdi-engine/src/questionnaire/questionnaire.v1.json`
- Modify: `packages/hpdi-engine/src/index.ts`
- Test: `packages/hpdi-engine/test/questionnaire.test.ts`

**Interfaces:**
- Produces: `Pillar`, `Tier`, `Question`, `Questionnaire`, `Response`, `ResultV1`, `PILLARS`, `TIERS`, `TIER_WEIGHTS`; `QuestionnaireSchema` (zod); `loadQuestionnaireV1(): Questionnaire`.

- [ ] **Step 1: Write the failing test**

`packages/hpdi-engine/test/questionnaire.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { loadQuestionnaireV1, QuestionnaireSchema } from "../src/questionnaire/schema.js";
import { PILLARS, TIERS } from "../src/types.js";

describe("questionnaire v1", () => {
  const q = loadQuestionnaireV1();

  it("validates against the schema and has 30-36 questions", () => {
    expect(QuestionnaireSchema.safeParse(q).success).toBe(true);
    expect(q.questions.length).toBeGreaterThanOrEqual(30);
    expect(q.questions.length).toBeLessThanOrEqual(36);
  });

  it("has unique ids and covers all six pillars", () => {
    const ids = q.questions.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PILLARS) expect(q.questions.some((x) => x.pillar === p)).toBe(true);
  });

  it("asks each tier between 15 and 20 questions", () => {
    for (const t of TIERS) {
      const n = q.questions.filter((x) => x.tiers.includes(t)).length;
      expect(n, t).toBeGreaterThanOrEqual(15);
      expect(n, t).toBeLessThanOrEqual(20);
    }
  });

  it("has exactly one supp question per axis with the book's coefficients", () => {
    const supp = (axis: "P" | "D" | "I") => q.questions.filter((x) => x.supp?.axis === axis);
    expect(supp("P").map((x) => x.options!.map((o) => o.value))).toEqual([[0.33, 0.66, 1]]);
    expect(supp("D").map((x) => x.options!.map((o) => o.value))).toEqual([[0, 0.5, 1]]);
    expect(supp("I").map((x) => x.options!.map((o) => o.value))).toEqual([[0, 0.33, 0.66, 1]]);
  });

  it("rejects a question whose max is below its option values", () => {
    const bad = { ...q, questions: [{ ...q.questions[0], type: "choice", max: 1, options: [{ value: 3, label: "x" }] }] };
    expect(QuestionnaireSchema.safeParse(bad).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/hpdi-engine/test/questionnaire.test.ts`
Expected: FAIL, cannot resolve `../src/questionnaire/schema.js`.

- [ ] **Step 3: Types**

`packages/hpdi-engine/src/types.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
export const PILLARS = ["strategy", "culture", "customer", "operations", "technology", "data"] as const;
export type Pillar = (typeof PILLARS)[number];

export const TIERS = ["executive", "manager", "staff"] as const;
export type Tier = (typeof TIERS)[number];

/** Merge weights from M0 spec §5.2; renormalised over tiers that have data. */
export const TIER_WEIGHTS: Record<Tier, number> = { executive: 0.25, manager: 0.25, staff: 0.5 };

export type Axis = "P" | "D" | "I";

export type Question = {
  id: string;
  pillar: Pillar;
  tiers: Tier[];
  type: "scale" | "choice" | "supp";
  text: string;
  options?: { value: number; label: string }[];
  max: number;
  supp?: { axis: Axis };
  weightEvidence?: boolean;
};

export type Questionnaire = { version: string; questions: Question[] };

/** One anonymous submission: answers keyed by question id, value in [0, max] (or the supp coefficient). */
export type Response = { tier: Tier; answers: Record<string, number> };

export type Shape = "spear" | "kite" | "illusion" | "diamond" | "transitional";

export type ResultV1 = {
  engineVersion: "1.0";
  pillars: Record<Pillar, { byTier: Partial<Record<Tier, number>>; merged: number; discrepancy: number }>;
  supp: Record<Axis, number>;
  hpdi: { H: number; P: number; D: number; I: number };
  dtiScore: number;
  dtiLevel: 1 | 2 | 3 | 4 | 5;
  shape: Shape;
  responseCounts: Record<Tier, number>;
  ruleBasedPrescription: { focusAxis: Axis; steps: string[] };
};
```

- [ ] **Step 4: Schema and loader**

`packages/hpdi-engine/src/questionnaire/schema.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";
import { PILLARS, TIERS, type Questionnaire } from "../types.js";
import v1 from "./questionnaire.v1.json" with { type: "json" };

const Option = z.object({ value: z.number(), label: z.string().min(1) });

export const QuestionSchema = z
  .object({
    id: z.string().regex(/^[A-Z]{3}-\d{2}$/),
    pillar: z.enum(PILLARS),
    tiers: z.array(z.enum(TIERS)).min(1),
    type: z.enum(["scale", "choice", "supp"]),
    text: z.string().min(1),
    options: z.array(Option).min(2).optional(),
    max: z.number().positive(),
    supp: z.object({ axis: z.enum(["P", "D", "I"]) }).optional(),
    weightEvidence: z.boolean().optional(),
  })
  .superRefine((q, ctx) => {
    if (q.type !== "scale" && !q.options) ctx.addIssue({ code: "custom", message: "choice/supp needs options" });
    if (q.type === "supp" && !q.supp) ctx.addIssue({ code: "custom", message: "supp needs axis" });
    if (q.options && q.options.some((o) => o.value > q.max)) ctx.addIssue({ code: "custom", message: "option above max" });
  });

export const QuestionnaireSchema = z.object({
  version: z.string(),
  questions: z.array(QuestionSchema).min(1),
});

export function loadQuestionnaireV1(): Questionnaire {
  return QuestionnaireSchema.parse(v1) as Questionnaire;
}
```

- [ ] **Step 5: Questionnaire data (self-authored v1; replace the JSON when the QĐ 1567 instrument is available)**

`packages/hpdi-engine/src/questionnaire/questionnaire.v1.json` — scale questions are 0–4 (`max: 4`); `weightEvidence` questions are hands-on questions asked to manager and/or staff:
```json
{
  "version": "1.0",
  "questions": [
    { "id": "STR-01", "pillar": "strategy", "tiers": ["executive", "manager"], "type": "scale", "max": 4, "text": "Tổ chức có lộ trình chuyển đổi số bằng văn bản, có mốc và người chịu trách nhiệm?" },
    { "id": "STR-02", "pillar": "strategy", "tiers": ["executive", "staff"], "type": "scale", "max": 4, "text": "Anh/chị biết rõ 3 mục tiêu chuyển đổi số của tổ chức trong năm nay?" },
    { "id": "STR-03", "pillar": "strategy", "tiers": ["executive", "manager"], "type": "scale", "max": 4, "text": "Ngân sách cho chuyển đổi số được duyệt và theo dõi hằng quý?" },
    { "id": "STR-04", "pillar": "strategy", "tiers": ["executive"], "type": "scale", "max": 4, "text": "Lãnh đạo cao nhất trực tiếp chủ trì rà soát tiến độ chuyển đổi số?" },
    { "id": "CUL-01", "pillar": "culture", "tiers": ["executive", "staff"], "type": "scale", "max": 4, "text": "Nhân sự được khuyến khích thử cách làm mới và được phép sai trong phạm vi an toàn?" },
    { "id": "CUL-02", "pillar": "culture", "tiers": ["manager", "staff"], "type": "scale", "max": 4, "text": "Anh/chị được đào tạo kỹ năng số trong 12 tháng qua?", "weightEvidence": true },
    { "id": "CUL-03", "pillar": "culture", "tiers": ["staff"], "type": "scale", "max": 4, "text": "Thông tin nội bộ được chia sẻ qua kênh chung thay vì tin nhắn riêng?" },
    { "id": "CUL-04", "pillar": "culture", "tiers": ["manager", "staff"], "type": "scale", "max": 4, "text": "Khi quy trình đổi, anh/chị được thông báo và hướng dẫn trước khi áp dụng?", "weightEvidence": true },
    { "id": "CUL-05", "pillar": "culture", "tiers": ["executive", "manager"], "type": "scale", "max": 4, "text": "Có người/nhóm được giao rõ vai trò dẫn dắt chuyển đổi số?" },
    { "id": "CUS-01", "pillar": "customer", "tiers": ["executive", "staff"], "type": "scale", "max": 4, "text": "Khách hàng có thể gửi yêu cầu/khiếu nại qua kênh số và nhận mã theo dõi?" },
    { "id": "CUS-02", "pillar": "customer", "tiers": ["manager", "staff"], "type": "scale", "max": 4, "text": "Mọi yêu cầu của khách hàng đều được ghi vào một hệ thống chung, không nằm trong sổ tay cá nhân?", "weightEvidence": true },
    { "id": "CUS-03", "pillar": "customer", "tiers": ["manager"], "type": "scale", "max": 4, "text": "Thời gian phản hồi khách hàng được đo và công bố nội bộ?" },
    { "id": "CUS-04", "pillar": "customer", "tiers": ["executive", "manager"], "type": "scale", "max": 4, "text": "Phản hồi của khách hàng được dùng để sửa sản phẩm/quy trình ít nhất mỗi quý?" },
    { "id": "CUS-05", "pillar": "customer", "tiers": ["staff"], "type": "scale", "max": 4, "text": "Anh/chị tra được lịch sử giao dịch của một khách hàng trong dưới 1 phút?", "weightEvidence": true },
    { "id": "OPS-01", "pillar": "operations", "tiers": ["executive"], "type": "scale", "max": 4, "text": "Quy trình lõi được viết thành văn bản có bước, vai trò và tiêu chuẩn đầu ra?" },
    { "id": "OPS-02", "pillar": "operations", "tiers": ["manager", "staff"], "type": "scale", "max": 4, "text": "Anh/chị làm việc theo quy trình trên phần mềm, không phải theo trí nhớ hay tin nhắn?", "weightEvidence": true },
    { "id": "OPS-03", "pillar": "operations", "tiers": ["manager", "staff"], "type": "scale", "max": 4, "text": "Mỗi bước trong quy trình có đúng một người chịu trách nhiệm cuối cùng?" },
    { "id": "OPS-04", "pillar": "operations", "tiers": ["manager", "staff"], "type": "scale", "max": 4, "text": "Phần mềm chặn được dữ liệu nhập sai (thiếu trường, sai định dạng) ngay khi nhập?", "weightEvidence": true },
    { "id": "OPS-05", "pillar": "operations", "tiers": ["executive", "manager"], "type": "scale", "max": 4, "text": "Thời gian xử lý mỗi bước quy trình được đo tự động?" },
    { "id": "OPS-06", "pillar": "operations", "tiers": ["executive", "manager", "staff"], "type": "supp", "max": 1, "supp": { "axis": "P" }, "text": "Quy trình lõi hiện chạy ở đâu?", "options": [ { "value": 0.33, "label": "Chủ yếu trên giấy, chat, trí nhớ" }, { "value": 0.66, "label": "Một phần trên phần mềm, còn xử lý tay" }, { "value": 1, "label": "Toàn bộ trên phần mềm có kiểm soát" } ] },
    { "id": "TEC-01", "pillar": "technology", "tiers": ["staff"], "type": "scale", "max": 4, "text": "Nhân sự đăng nhập một lần và dùng được các công cụ nội bộ?" },
    { "id": "TEC-02", "pillar": "technology", "tiers": ["executive", "manager"], "type": "scale", "max": 4, "text": "Hệ thống nội bộ trao đổi dữ liệu với nhau tự động, không phải xuất/nhập file tay?" },
    { "id": "TEC-03", "pillar": "technology", "tiers": ["manager", "staff"], "type": "scale", "max": 4, "text": "Anh/chị tìm được tài liệu nội bộ cần dùng trong dưới 2 phút?", "weightEvidence": true },
    { "id": "TEC-04", "pillar": "technology", "tiers": ["staff"], "type": "scale", "max": 4, "text": "Tổ chức có dùng trợ lý AI hoặc tự động hoá cho việc lặp lại, có người duyệt trước khi thực thi?" },
    { "id": "TEC-05", "pillar": "technology", "tiers": ["executive"], "type": "scale", "max": 4, "text": "Sao lưu và phân quyền được rà soát định kỳ?" },
    { "id": "TEC-06", "pillar": "technology", "tiers": ["executive", "manager", "staff"], "type": "supp", "max": 1, "supp": { "axis": "I" }, "text": "AI/tự động hoá đang ở mức nào?", "options": [ { "value": 0, "label": "Chưa dùng" }, { "value": 0.33, "label": "Cá nhân tự dùng, không có quy tắc" }, { "value": 0.66, "label": "Có công cụ chung, chưa có duyệt/kiểm soát" }, { "value": 1, "label": "Tác tử có chính sách, whitelist và người duyệt" } ] },
    { "id": "DAT-01", "pillar": "data", "tiers": ["executive", "staff"], "type": "scale", "max": 4, "text": "Số liệu điều hành lấy từ một nguồn thống nhất, không phải mỗi phòng một bảng?" },
    { "id": "DAT-02", "pillar": "data", "tiers": ["executive", "manager"], "type": "scale", "max": 4, "text": "Lãnh đạo xem báo cáo trên bảng điều khiển cập nhật tự động?" },
    { "id": "DAT-03", "pillar": "data", "tiers": ["manager", "staff"], "type": "scale", "max": 4, "text": "Dữ liệu anh/chị nhập hằng ngày có xuất hiện trong báo cáo của tổ chức?", "weightEvidence": true },
    { "id": "DAT-04", "pillar": "data", "tiers": ["staff"], "type": "scale", "max": 4, "text": "Có quy tắc đặt tên, lưu trữ và phân loại tài liệu áp dụng chung?" },
    { "id": "DAT-05", "pillar": "data", "tiers": ["executive"], "type": "scale", "max": 4, "text": "Dữ liệu cá nhân của khách hàng/nhân sự được che khi hiển thị cho người không có quyền?" },
    { "id": "DAT-06", "pillar": "data", "tiers": ["executive", "manager", "staff"], "type": "supp", "max": 1, "supp": { "axis": "D" }, "text": "Báo cáo điều hành được lập như thế nào?", "options": [ { "value": 0, "label": "Tổng hợp tay từ nhiều file" }, { "value": 0.5, "label": "Bán tự động, có người chỉnh trước khi gửi" }, { "value": 1, "label": "Tự động từ dữ liệu quy trình" } ] }
  ]
}
```

Tier coverage with these `tiers` arrays: executive 18, manager 19, staff 20 questions; 32 questions in total (the test asserts 15–20 per tier and 30–36 total).

- [ ] **Step 6: Export from index**

`packages/hpdi-engine/src/index.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
export const ENGINE_VERSION = "1.0" as const;
export * from "./types.js";
export { QuestionSchema, QuestionnaireSchema, loadQuestionnaireV1 } from "./questionnaire/schema.js";
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run packages/hpdi-engine/test/questionnaire.test.ts`
Expected: 5 passed. If a tier count is off, adjust `tiers` arrays (never the 15–20 assertion).

- [ ] **Step 8: Commit**

```bash
git add packages/hpdi-engine && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(hpdi-engine): add types, questionnaire schema and v1 questionnaire"
```

---

### Task 3: hpdi-engine scoring (pillars by tier, merge, discrepancy, supp)

**Files:**
- Create: `packages/hpdi-engine/src/scoring.ts`
- Test: `packages/hpdi-engine/test/scoring.test.ts`

**Interfaces:**
- Produces: `class InsufficientResponses extends Error`; `scorePillars(q, responses): ResultV1["pillars"]`; `scoreSupp(q, responses): Record<Axis, number>`; `countResponses(responses): Record<Tier, number>`; `assertSufficient(counts)`.

- [ ] **Step 1: Write the failing test**

`packages/hpdi-engine/test/scoring.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { loadQuestionnaireV1 } from "../src/questionnaire/schema.js";
import { InsufficientResponses, assertSufficient, countResponses, scorePillars, scoreSupp } from "../src/scoring.js";
import type { Response, Tier } from "../src/types.js";

const q = loadQuestionnaireV1();

/** Build a response answering every question the tier is asked with `scaleValue` (0-4) and supp questions with `suppValue`. */
function respond(tier: Tier, scaleValue: number, suppValue = 1): Response {
  const answers: Record<string, number> = {};
  for (const x of q.questions) {
    if (!x.tiers.includes(tier)) continue;
    answers[x.id] = x.type === "supp" ? suppValue : scaleValue;
  }
  return { tier, answers };
}

describe("countResponses / assertSufficient", () => {
  it("throws InsufficientResponses when there are no responses", () => {
    expect(() => assertSufficient(countResponses([]))).toThrow(InsufficientResponses);
  });
  it("throws when the staff tier is missing", () => {
    expect(() => assertSufficient(countResponses([respond("executive", 4), respond("manager", 4)]))).toThrow(InsufficientResponses);
  });
  it("accepts executive + staff", () => {
    expect(() => assertSufficient(countResponses([respond("executive", 4), respond("staff", 4)]))).not.toThrow();
  });
});

describe("scorePillars", () => {
  it("gives 1.0 merged and 0 discrepancy when every tier answers the maximum", () => {
    const p = scorePillars(q, [respond("executive", 4), respond("manager", 4), respond("staff", 4)]);
    expect(p.operations.merged).toBeCloseTo(1, 5);
    expect(p.operations.discrepancy).toBeCloseTo(0, 5);
    expect(p.operations.byTier.staff).toBeCloseTo(1, 5);
  });

  it("flags discrepancy above 0.3 and leans to staff when executives over-rate", () => {
    const p = scorePillars(q, [respond("executive", 4), respond("staff", 0)]);
    expect(p.operations.discrepancy).toBeGreaterThan(0.3);
    // weights 0.25 exec / 0.5 staff renormalised -> exec 1/3, staff 2/3 -> merged 0.333.
    expect(p.operations.merged).toBeLessThan(0.34);
  });

  it("averages several responses inside one tier", () => {
    const p = scorePillars(q, [respond("executive", 2), respond("staff", 0), respond("staff", 4)]);
    expect(p.data.byTier.staff).toBeCloseTo(0.5, 5);
  });

  it("omits tiers without data from byTier and renormalises weights", () => {
    const p = scorePillars(q, [respond("executive", 4), respond("staff", 4)]);
    expect(p.strategy.byTier.manager).toBeUndefined();
    expect(p.strategy.merged).toBeCloseTo(1, 5);
  });
});

describe("scoreSupp", () => {
  it("takes the minimum coefficient across tiers", () => {
    const s = scoreSupp(q, [respond("executive", 4, 1), respond("staff", 4, 0.33)]);
    expect(s.P).toBeCloseTo(0.33, 5);
  });
  it("falls back to the lowest option when nobody answered the supp question", () => {
    const noSupp: Response = { tier: "staff", answers: { "OPS-01": 4 } };
    const s = scoreSupp(q, [noSupp]);
    expect(s).toEqual({ P: 0.33, D: 0, I: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/hpdi-engine/test/scoring.test.ts`
Expected: FAIL, cannot resolve `../src/scoring.js`.

- [ ] **Step 3: Implement scoring**

`packages/hpdi-engine/src/scoring.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { PILLARS, TIERS, TIER_WEIGHTS, type Axis, type Pillar, type Question, type Questionnaire, type Response, type ResultV1, type Tier } from "./types.js";

export class InsufficientResponses extends Error {
  constructor(counts: Record<Tier, number>) {
    super(`Need at least one executive and one staff response, got ${JSON.stringify(counts)}`);
    this.name = "InsufficientResponses";
  }
}

export function countResponses(responses: Response[]): Record<Tier, number> {
  const counts: Record<Tier, number> = { executive: 0, manager: 0, staff: 0 };
  for (const r of responses) counts[r.tier] += 1;
  return counts;
}

export function assertSufficient(counts: Record<Tier, number>): void {
  if (counts.executive < 1 || counts.staff < 1) throw new InsufficientResponses(counts);
}

/** Mean normalised answer (0..1) of one question inside one tier, or undefined when nobody in that tier answered it. */
function tierMean(question: Question, responses: Response[], tier: Tier): number | undefined {
  const values = responses
    .filter((r) => r.tier === tier && typeof r.answers[question.id] === "number")
    .map((r) => Math.min(Math.max(r.answers[question.id]!, 0), question.max) / question.max);
  if (values.length === 0) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function weightedMerge(byTier: Partial<Record<Tier, number>>): number {
  let num = 0;
  let den = 0;
  for (const t of TIERS) {
    const v = byTier[t];
    if (v === undefined) continue;
    num += v * TIER_WEIGHTS[t];
    den += TIER_WEIGHTS[t];
  }
  return den === 0 ? 0 : num / den;
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * Pillar score per tier = mean of that tier's normalised answers.
 * Merged = tier-weighted average (M0 spec §5.2); when staff data exists, executive/manager means used for
 * merging exclude `weightEvidence` questions so hands-on evidence is only counted through staff.
 */
export function scorePillars(q: Questionnaire, responses: Response[]): ResultV1["pillars"] {
  const out = {} as ResultV1["pillars"];
  const staffHasData = responses.some((r) => r.tier === "staff");
  const defined = (v: number | undefined): v is number => v !== undefined;
  for (const pillar of PILLARS) {
    const questions = q.questions.filter((x) => x.pillar === pillar && x.type !== "supp");
    const byTier: Partial<Record<Tier, number>> = {};
    const forMerge: Partial<Record<Tier, number>> = {};
    for (const tier of TIERS) {
      const all = questions.map((x) => tierMean(x, responses, tier)).filter(defined);
      if (all.length === 0) continue;
      byTier[tier] = mean(all);
      const nonEvidence =
        tier !== "staff" && staffHasData
          ? questions.filter((x) => !x.weightEvidence).map((x) => tierMean(x, responses, tier)).filter(defined)
          : all;
      forMerge[tier] = nonEvidence.length > 0 ? mean(nonEvidence) : byTier[tier]!;
    }
    const present = Object.values(byTier);
    out[pillar] = {
      byTier,
      merged: weightedMerge(forMerge),
      discrepancy: present.length > 1 ? Math.max(...present) - Math.min(...present) : 0,
    };
  }
  return out;
}

/** Lowest coefficient across tiers with data; falls back to the lowest option of the axis' supp question. */
export function scoreSupp(q: Questionnaire, responses: Response[]): Record<Axis, number> {
  const out: Record<Axis, number> = { P: 1, D: 1, I: 1 };
  for (const axis of ["P", "D", "I"] as const) {
    const question = q.questions.find((x) => x.type === "supp" && x.supp?.axis === axis);
    if (!question) continue;
    const lowest = Math.min(...question.options!.map((o) => o.value));
    const tierValues = TIERS.map((t) => {
      const vals = responses.filter((r) => r.tier === t && typeof r.answers[question.id] === "number").map((r) => r.answers[question.id]!);
      return vals.length === 0 ? undefined : mean(vals);
    }).filter((v): v is number => v !== undefined);
    out[axis] = tierValues.length === 0 ? lowest : Math.min(...tierValues);
  }
  return out;
}

export type { Pillar };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/hpdi-engine/test/scoring.test.ts`
Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/hpdi-engine && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(hpdi-engine): score pillars by tier with discrepancy and supp coefficients"
```

---

### Task 4: hpdi-engine mapping, shape, prescription and `compute()`

**Files:**
- Create: `packages/hpdi-engine/src/mapping.ts`, `packages/hpdi-engine/src/shape.ts`
- Modify: `packages/hpdi-engine/src/index.ts`
- Test: `packages/hpdi-engine/test/compute.test.ts`

**Interfaces:**
- Produces: `mapHpdi(pillars, supp): {H,P,D,I}`; `dtiLevel(score): 1|2|3|4|5`; `classifyShape(hpdi): Shape`; `prescribe(hpdi, shape): {focusAxis, steps}`; `compute(q, responses): ResultV1`.

- [ ] **Step 1: Write the failing golden test**

`packages/hpdi-engine/test/compute.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { compute, InsufficientResponses, loadQuestionnaireV1 } from "../src/index.js";
import { classifyShape, prescribe } from "../src/shape.js";
import { dtiLevel } from "../src/mapping.js";
import type { Response, Tier } from "../src/types.js";

const q = loadQuestionnaireV1();

function respond(tier: Tier, scaleValue: number, supp: { P: number; D: number; I: number }): Response {
  const answers: Record<string, number> = {};
  for (const x of q.questions) {
    if (!x.tiers.includes(tier)) continue;
    answers[x.id] = x.type === "supp" ? supp[x.supp!.axis] : scaleValue;
  }
  return { tier, answers };
}

describe("compute golden cases (M0 spec §5.5)", () => {
  it("book example: max survey, supp P 0.33 / D 0 / I 0 → P=10 D=0 I=0 H=90, spear, level 1", () => {
    const r = compute(q, [respond("executive", 4, { P: 0.33, D: 0, I: 0 }), respond("staff", 4, { P: 0.33, D: 0, I: 0 })]);
    expect(r.hpdi).toEqual({ H: 90, P: 10, D: 0, I: 0 });
    expect(r.shape).toBe("spear");
    expect(r.dtiLevel).toBe(1);
    expect(r.engineVersion).toBe("1.0");
    expect(r.responseCounts).toEqual({ executive: 1, manager: 0, staff: 1 });
  });

  it("diamond: max survey and supp 1 → P=D=I=30, H=10, diamond, level 5", () => {
    const all = { P: 1, D: 1, I: 1 };
    const r = compute(q, [respond("executive", 4, all), respond("manager", 4, all), respond("staff", 4, all)]);
    expect(r.hpdi).toEqual({ H: 10, P: 30, D: 30, I: 30 });
    expect(r.shape).toBe("diamond");
    expect(r.dtiLevel).toBe(5);
    expect(r.ruleBasedPrescription.focusAxis).toBe("I");
  });

  it("throws InsufficientResponses without responses and without staff", () => {
    expect(() => compute(q, [])).toThrow(InsufficientResponses);
    expect(() => compute(q, [respond("executive", 4, { P: 1, D: 1, I: 1 })])).toThrow(InsufficientResponses);
  });

  it("executive high, staff low → discrepancy > 0.3 and merged leaning to staff", () => {
    const r = compute(q, [respond("executive", 4, { P: 1, D: 1, I: 1 }), respond("staff", 0, { P: 1, D: 1, I: 1 })]);
    expect(r.pillars.operations.discrepancy).toBeGreaterThan(0.3);
    expect(r.pillars.operations.merged).toBeLessThan(0.34);
  });
});

describe("classifyShape", () => {
  it.each([
    [{ H: 80, P: 10, D: 5, I: 5 }, "spear"],
    [{ H: 70, P: 25, D: 3, I: 2 }, "kite"],
    [{ H: 65, P: 10, D: 15, I: 10 }, "illusion"],
    [{ H: 20, P: 30, D: 25, I: 25 }, "diamond"],
    [{ H: 50, P: 25, D: 15, I: 10 }, "transitional"],
  ])("%j → %s", (hpdi, shape) => {
    expect(classifyShape(hpdi)).toBe(shape);
  });
});

describe("dtiLevel boundaries", () => {
  it.each([[0, 1], [10, 1], [10.5, 2], [30, 2], [31, 3], [70, 3], [71, 4], [89, 4], [90, 5], [100, 5]])("score %d → level %d", (s, l) => {
    expect(dtiLevel(s)).toBe(l);
  });
});

describe("prescribe", () => {
  it("follows the P → D → I order: first axis under 20 is the focus", () => {
    expect(prescribe({ H: 60, P: 25, D: 10, I: 5 }, "transitional").focusAxis).toBe("D");
    expect(prescribe({ H: 90, P: 10, D: 0, I: 0 }, "spear").focusAxis).toBe("P");
  });
  it("warns about GIGO for illusion", () => {
    expect(prescribe({ H: 65, P: 10, D: 15, I: 10 }, "illusion").steps.join(" ")).toContain("GIGO");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/hpdi-engine/test/compute.test.ts`
Expected: FAIL, `compute` is not exported.

- [ ] **Step 3: Mapping**

`packages/hpdi-engine/src/mapping.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Axis, ResultV1 } from "./types.js";

/** Survey score per axis in 0..1, from the pillars named in M0 spec §5.3. */
export function axisScores(pillars: ResultV1["pillars"]): Record<Axis, number> {
  return {
    P: (pillars.operations.merged + pillars.customer.merged) / 2,
    D: pillars.data.merged,
    I: pillars.technology.merged,
  };
}

export function mapHpdi(pillars: ResultV1["pillars"], supp: Record<Axis, number>): ResultV1["hpdi"] {
  const s = axisScores(pillars);
  const P = Math.round(s.P * supp.P * 30);
  const D = Math.round(s.D * supp.D * 30);
  const I = Math.round(s.I * supp.I * 30);
  return { H: 100 - (P + D + I), P, D, I };
}

/** dtiScore = 100 − H (see plan Global Constraints for why not the pillar mean). */
export function dtiScore(hpdi: ResultV1["hpdi"]): number {
  return 100 - hpdi.H;
}

export function dtiLevel(score: number): ResultV1["dtiLevel"] {
  if (score <= 10) return 1;
  if (score <= 30) return 2;
  if (score <= 70) return 3;
  if (score < 90) return 4;
  return 5;
}
```

- [ ] **Step 4: Shape and prescription**

`packages/hpdi-engine/src/shape.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Axis, ResultV1, Shape } from "./types.js";

export function classifyShape({ H, P, D, I }: ResultV1["hpdi"]): Shape {
  if (H >= 75) return "spear";
  if (H < 75 && P >= 20 && D < 10 && I < 10) return "kite";
  if (H >= 60 && (I >= 10 || D >= 10) && P < 20) return "illusion";
  if (H <= 25 && P >= 20 && D >= 20 && I >= 20) return "diamond";
  return "transitional";
}

/** User-facing Vietnamese text: the three prescriptions of book chapter 2.5.3, applied in P → D → I order. */
const STEPS: Record<Axis, string[]> = {
  P: [
    "Chọn một quy trình lõi, viết 5 RÕ (ai làm, ai duyệt, tiêu chuẩn, công cụ, thời hạn).",
    "Đưa quy trình lên phần mềm có biểu mẫu chặn dữ liệu sai ngay khi nhập (Poka-yoke lớp 1).",
    "Đo thời gian mỗi bước; chỉ khi P chạy ổn 4 tuần mới sang dữ liệu.",
  ],
  D: [
    "Gom dữ liệu quy trình về một nguồn; dựng bảng điều khiển đếm theo trạng thái.",
    "Lập lịch chụp dữ liệu hằng tháng vào kho tài nguyên có cấu trúc (41. Structured_Data).",
    "Che dữ liệu cá nhân khi hiển thị; công bố chỉ số cho toàn tổ chức.",
  ],
  I: [
    "Nạp kho tài nguyên vào RAG để trợ lý trả lời theo tài liệu thật.",
    "Viết chính sách tác tử: whitelist hành động, kênh duyệt, hạn duyệt ≤ 24 giờ.",
    "Chỉ tự động hoá bước có dữ liệu sạch; giữ người duyệt (HITL) cho hành động ghi.",
  ],
};

export function prescribe(hpdi: ResultV1["hpdi"], shape: Shape): ResultV1["ruleBasedPrescription"] {
  const order: Axis[] = ["P", "D", "I"];
  const focusAxis = order.find((a) => hpdi[a] < 20) ?? "I";
  const steps = [...STEPS[focusAxis]];
  if (shape === "illusion") steps.unshift("Cảnh báo GIGO: công nghệ/dữ liệu đi trước quy trình. Tạm dừng lớp I, quay về chuẩn hoá P.");
  if (shape === "diamond") steps.unshift("Duy trì: đo lại mỗi quý, mở rộng sang quy trình lõi tiếp theo.");
  return { focusAxis, steps };
}
```

- [ ] **Step 5: `compute()` and exports**

`packages/hpdi-engine/src/index.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { dtiLevel, dtiScore, mapHpdi } from "./mapping.js";
import { assertSufficient, countResponses, scorePillars, scoreSupp } from "./scoring.js";
import { classifyShape, prescribe } from "./shape.js";
import type { Questionnaire, Response, ResultV1 } from "./types.js";

export const ENGINE_VERSION = "1.0" as const;
export * from "./types.js";
export { QuestionSchema, QuestionnaireSchema, loadQuestionnaireV1 } from "./questionnaire/schema.js";
export { InsufficientResponses, assertSufficient, countResponses, scorePillars, scoreSupp } from "./scoring.js";
export { axisScores, dtiLevel, dtiScore, mapHpdi } from "./mapping.js";
export { classifyShape, prescribe } from "./shape.js";

export function compute(q: Questionnaire, responses: Response[]): ResultV1 {
  const responseCounts = countResponses(responses);
  assertSufficient(responseCounts);
  const pillars = scorePillars(q, responses);
  const supp = scoreSupp(q, responses);
  const hpdi = mapHpdi(pillars, supp);
  const score = dtiScore(hpdi);
  const shape = classifyShape(hpdi);
  return {
    engineVersion: ENGINE_VERSION,
    pillars,
    supp,
    hpdi,
    dtiScore: score,
    dtiLevel: dtiLevel(score),
    shape,
    responseCounts,
    ruleBasedPrescription: prescribe(hpdi, shape),
  };
}
```

- [ ] **Step 6: Run all engine tests and typecheck**

Run: `npx vitest run packages/hpdi-engine && npx tsc -p packages/hpdi-engine --noEmit`
Expected: all passed; no type errors. Delete `test/smoke.test.ts` (superseded).

- [ ] **Step 7: Patch the M0 spec sentence to match the locked deviation**

In `docs/superpowers/specs/2026-09-09-m0-measurement-design.md` §5.3 replace the line starting `- Mức DTI:` with:
```
- Mức DTI: `dtiScore = 100 − H` (điểm "thực chất", tránh mâu thuẫn với hai ca golden), tra bảng: ≤10 → 1; ≤30 → 2; ≤70 → 3; <90 → 4; ≥90 → 5.
```

- [ ] **Step 8: Commit**

```bash
git add -A && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(hpdi-engine): map DTI to HPDI, classify shape, rule-based prescription, compute()"
```

---

### Task 5: forge-core schemas (IntentV1, PlanV1, StateV1, typed specs) and checksum

**Files:**
- Create: `packages/forge-core/package.json`, `packages/forge-core/tsconfig.json`, `packages/forge-core/src/index.ts`, `packages/forge-core/src/schema/intent.ts`, `packages/forge-core/src/schema/plan.ts`, `packages/forge-core/src/schema/state.ts`, `packages/forge-core/src/schema/specs.ts`, `packages/forge-core/src/hash.ts`, `examples/intent.example.yaml`
- Test: `packages/forge-core/test/schema.test.ts`, `packages/forge-core/test/hash.test.ts`

**Interfaces:**
- Produces: zod schemas `IntentV1`, `PlanV1`, `Resource`, `StateV1`, `StateEntry`, `Layer`, `TargetKind`, `ShapeName`; inferred types with the same names; `SPEC_SCHEMAS: Record<string, ZodTypeAny>` keyed by resource `type`; `canonicalJson(v): string`; `checksum(v): string` (sha256 hex, 64 chars); `emptyState(target): StateV1`; `loadIntentFile(path): IntentV1`.

- [ ] **Step 1: Write the failing tests**

`packages/forge-core/test/schema.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { IntentV1, loadIntentFile } from "../src/schema/intent.js";
import { PlanV1, Resource } from "../src/schema/plan.js";
import { StateV1, emptyState } from "../src/schema/state.js";
import { SPEC_SCHEMAS } from "../src/schema/specs.js";

export const EXAMPLE = fileURLToPath(new URL("../../../examples/intent.example.yaml", import.meta.url));

describe("IntentV1", () => {
  it("parses the example intent and applies defaults", () => {
    const intent = loadIntentFile(EXAMPLE);
    expect(intent.organization.short_code).toBe("abc");
    expect(intent.core_processes[0].pack).toBe("dx-ticket");
    expect(intent.constraints.pii_masking).toBe(true);
    expect(intent.maturity?.shape).toBe("transitional");
  });
  it("rejects an upper-case short_code and a credentials_ref that is not an env var name", () => {
    const base = loadIntentFile(EXAMPLE);
    expect(IntentV1.safeParse({ ...base, organization: { ...base.organization, short_code: "ABC" } }).success).toBe(false);
    expect(IntentV1.safeParse({ ...base, target: { ...base.target, credentials_ref: "hunter2" } }).success).toBe(false);
  });
  it("allows maturity to be absent (unmeasured)", () => {
    const { maturity: _m, ...rest } = loadIntentFile(EXAMPLE);
    expect(IntentV1.safeParse(rest).success).toBe(true);
  });
});

describe("PlanV1 / Resource", () => {
  const res = { id: "h.realm", layer: "H", type: "identity.realm", spec: { realm: "dxlab" }, reason: "SSO" };
  it("defaults depends_on and gate", () => {
    const r = Resource.parse(res);
    expect(r.depends_on).toEqual([]);
    expect(r.gate).toEqual({ allowed: true });
  });
  it("requires a 64-char intent_hash and ISO generated_at", () => {
    const ok = PlanV1.safeParse({ version: 1, generated_at: new Date().toISOString(), intent_hash: "a".repeat(64), target: "oss", resources: [res] });
    expect(ok.success).toBe(true);
    expect(PlanV1.safeParse({ ...ok.data, intent_hash: "abc" }).success).toBe(false);
  });
  it("rejects a type without a dot and an id with spaces", () => {
    expect(Resource.safeParse({ ...res, type: "realm" }).success).toBe(false);
    expect(Resource.safeParse({ ...res, id: "h realm" }).success).toBe(false);
  });
});

describe("StateV1", () => {
  it("emptyState is valid", () => {
    expect(StateV1.safeParse(emptyState("oss")).success).toBe(true);
  });
});

describe("SPEC_SCHEMAS", () => {
  it("covers the validator-relevant types", () => {
    for (const t of ["process.entity", "process.form", "process.state_machine", "storage.acl", "data.dashboard", "intel.agent_policy"]) {
      expect(SPEC_SCHEMAS[t], t).toBeDefined();
    }
  });
  it("process.form rejects a field without a name", () => {
    expect(SPEC_SCHEMAS["process.form"].safeParse({ entity: "x", fields: [{ label: "Tiêu đề" }] }).success).toBe(false);
  });
});
```

`packages/forge-core/test/hash.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { canonicalJson, checksum } from "../src/hash.js";

describe("canonicalJson / checksum", () => {
  it("is independent of key order and nested key order", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 1, e: 2 }] } })).toBe(canonicalJson({ a: { c: [3, { e: 2, f: 1 }], d: 2 }, b: 1 }));
  });
  it("produces a 64-char hex sha256 that changes with the value", () => {
    const h = checksum({ a: 1 });
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(checksum({ a: 2 })).not.toBe(h);
  });
  it("drops undefined properties like JSON.stringify does", () => {
    expect(checksum({ a: 1, b: undefined })).toBe(checksum({ a: 1 }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/forge-core`
Expected: FAIL, modules not found.

- [ ] **Step 3: Package shell and example intent**

`packages/forge-core/package.json`:
```json
{
  "name": "@dx-forge/forge-core",
  "version": "0.1.0",
  "license": "AGPL-3.0-or-later",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": { "yaml": "^2.6.0", "zod": "^3.24.0" }
}
```
`packages/forge-core/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

`examples/intent.example.yaml`:
```yaml
# SPDX-License-Identifier: AGPL-3.0-or-later
# Canonical sample intent: a small retail company digitising its customer-request process with the dx-ticket pack.
version: 1
organization:
  name: Công ty TNHH ABC
  short_code: abc
  sector: retail
  size_band: "10-50"
  departments:
    - { code: cskh, name: Chăm sóc khách hàng }
    - { code: kd, name: Kinh doanh }
maturity:
  assessment_id: demo-round-1
  hpdi: { H: 55, P: 25, D: 12, I: 8 }
  shape: transitional
  dti_level: 3
  discrepancies: { operations: 0.35 }
core_processes:
  - id: cskh
    pack: dx-ticket
    name: Xử lý yêu cầu khách hàng
    actors: { R: staff, A: manager, C: [], I: [dx-admin] }
    sla_hours: 24
    external_entry: true
channels:
  chat: telegram
  notify_targets: { announce: thong-bao, alerts: canh-bao, approvals: phe-duyet }
target:
  kind: oss
  endpoint: https://dxlab.example.org
  credentials_ref: DXFORGE_OSS_CREDENTIALS
constraints: { language: vi, pii_masking: true }
```

- [ ] **Step 4: Schemas**

`packages/forge-core/src/schema/intent.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";

export const Layer = z.enum(["H", "P", "D", "I"]);
export type Layer = z.infer<typeof Layer>;
export const TargetKind = z.enum(["oss", "gws", "manifest"]);
export type TargetKind = z.infer<typeof TargetKind>;
export const ShapeName = z.enum(["spear", "kite", "illusion", "diamond", "transitional"]);
export type ShapeName = z.infer<typeof ShapeName>;

const slug = (min: number, max: number) => z.string().regex(new RegExp(`^[a-z0-9][a-z0-9-]{${min - 1},${max - 1}}$`));

const Department = z.object({
  code: slug(2, 20),
  name: z.string().min(1),
  head_email: z.string().email().optional(),
});

const Actors = z.object({
  R: z.string().min(1),
  A: z.string().min(1),
  C: z.array(z.string()).default([]),
  I: z.array(z.string()).default([]),
});

const CoreProcess = z.object({
  id: slug(2, 30),
  pack: z.string().optional(),
  name: z.string().min(1),
  actors: Actors,
  sla_hours: z.number().int().positive().default(24),
  external_entry: z.boolean().default(false),
});

export const Maturity = z.object({
  assessment_id: z.string().min(1),
  hpdi: z.object({ H: z.number().min(0).max(100), P: z.number().min(0).max(100), D: z.number().min(0).max(100), I: z.number().min(0).max(100) }),
  shape: ShapeName,
  dti_level: z.number().int().min(1).max(5),
  discrepancies: z.record(z.string(), z.number()).default({}),
});

export const IntentV1 = z.object({
  version: z.literal(1),
  organization: z.object({
    name: z.string().min(1),
    short_code: z.string().regex(/^[a-z0-9]{2,12}$/),
    sector: z.string().min(1),
    size_band: z.string().min(1),
    departments: z.array(Department).min(1),
  }),
  maturity: Maturity.optional(),
  core_processes: z.array(CoreProcess).min(1),
  channels: z.object({
    chat: z.enum(["telegram", "mattermost"]),
    notify_targets: z.object({ announce: z.string().min(1), alerts: z.string().min(1), approvals: z.string().min(1) }),
  }),
  target: z.object({
    kind: TargetKind,
    endpoint: z.string().url().optional(),
    /** Name of the environment variable holding credentials. Never the secret itself. */
    credentials_ref: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  }),
  constraints: z.object({ language: z.enum(["vi", "en"]).default("vi"), pii_masking: z.boolean().default(true) }).default({}),
});
export type IntentV1 = z.infer<typeof IntentV1>;

export function loadIntentFile(path: string): IntentV1 {
  return IntentV1.parse(parse(readFileSync(path, "utf8")));
}
```

`packages/forge-core/src/schema/plan.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";
import { Layer, TargetKind } from "./intent.js";

export const ResourceId = z.string().regex(/^[a-z0-9][a-z0-9.-]*$/);

export const Resource = z.object({
  id: ResourceId,
  layer: Layer,
  type: z.string().regex(/^[a-z_]+\.[a-z_]+$/),
  spec: z.record(z.string(), z.unknown()),
  reason: z.string().min(1),
  depends_on: z.array(ResourceId).default([]),
  gate: z.object({ allowed: z.boolean(), why: z.string().optional() }).default({ allowed: true }),
  source: z.object({ pack: z.string().optional(), process: z.string().optional() }).optional(),
});
export type Resource = z.infer<typeof Resource>;

export const PlanV1 = z.object({
  version: z.literal(1),
  generated_at: z.string().datetime(),
  intent_hash: z.string().regex(/^[0-9a-f]{64}$/),
  target: TargetKind,
  resources: z.array(Resource),
  notes: z.array(z.string()).default([]),
});
export type PlanV1 = z.infer<typeof PlanV1>;
```

`packages/forge-core/src/schema/state.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";
import { TargetKind } from "./intent.js";

export const Check = z.object({ name: z.string(), ok: z.boolean(), evidence: z.string() });
export type Check = z.infer<typeof Check>;

export const StateEntry = z.object({
  externalId: z.string(),
  checksum: z.string().regex(/^[0-9a-f]{64}$/),
  appliedAt: z.string().datetime(),
  verify: z.object({ ok: z.boolean(), checks: z.array(Check) }).optional(),
});
export type StateEntry = z.infer<typeof StateEntry>;

export const StateV1 = z.object({
  version: z.literal(1),
  target: TargetKind,
  entries: z.record(z.string(), StateEntry),
});
export type StateV1 = z.infer<typeof StateV1>;

export function emptyState(target: TargetKind): StateV1 {
  return { version: 1, target, entries: {} };
}
```

`packages/forge-core/src/schema/specs.ts` (only the types the validator inspects; other types keep a free-form spec):
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";

const Name = z.string().regex(/^[a-z][a-z0-9_]*$/);

export const EntitySpec = z.object({
  table: Name,
  fields: z.array(z.object({
    name: Name,
    type: z.enum(["text", "int", "numeric", "bool", "date", "timestamp", "enum"]),
    required: z.boolean().optional(),
    pii: z.boolean().optional(),
    options: z.array(z.string()).optional(),
  })).min(1),
});

export const FormSpec = z.object({
  entity: z.string().min(1),
  fields: z.array(z.object({
    name: Name,
    label: z.string().min(1),
    required: z.boolean().optional(),
    pattern: z.string().optional(),
    options: z.array(z.string()).optional(),
  })).min(1),
});

export const StateMachineSpec = z.object({
  entity: z.string().min(1),
  states: z.array(Name).min(2),
  transitions: z.array(z.object({ from: Name, to: Name, A: z.array(z.string()) })).min(1),
});

export const AclSpec = z.object({ path: z.string().min(1), group: z.string().min(1), mode: z.enum(["read", "write", "admin"]) });

export const DashboardSpec = z.object({
  entity: z.string().min(1),
  cards: z.array(z.object({ name: z.string().min(1), kind: z.enum(["count_by_state", "sla_breach", "trend"]) })).min(1),
  masking: z.array(z.string()).default([]),
});

export const AgentPolicySpec = z.object({
  actions: z.array(z.string().min(1)).min(1),
  approval_channel: z.string(),
  expire_hours: z.number().positive(),
});

export const SPEC_SCHEMAS: Record<string, z.ZodTypeAny> = {
  "process.entity": EntitySpec,
  "process.form": FormSpec,
  "process.state_machine": StateMachineSpec,
  "storage.acl": AclSpec,
  "data.dashboard": DashboardSpec,
  "intel.agent_policy": AgentPolicySpec,
};
```

- [ ] **Step 5: Hash and index**

`packages/forge-core/src/hash.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash } from "node:crypto";

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
        .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

export function canonicalJson(v: unknown): string {
  return JSON.stringify(sortKeys(v));
}

export function checksum(v: unknown): string {
  return createHash("sha256").update(canonicalJson(v)).digest("hex");
}
```

`packages/forge-core/src/index.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
export * from "./schema/intent.js";
export * from "./schema/plan.js";
export * from "./schema/state.js";
export * from "./schema/specs.js";
export * from "./hash.js";
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run packages/forge-core && npx tsc -p packages/forge-core --noEmit`
Expected: 12 passed; no type errors.

- [ ] **Step 7: Commit**

```bash
git add examples packages/forge-core && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(forge-core): add IntentV1, PlanV1, StateV1 schemas, typed specs and checksum"
```

---

### Task 6: Packs — template renderer, loader, `core` and `dx-ticket` pack files

**Files:**
- Create: `packages/forge-core/src/packs/template.ts`, `packages/forge-core/src/packs/loader.ts`, `packs/core/pack.yaml`, `packs/dx-ticket/pack.yaml`
- Modify: `packages/forge-core/src/index.ts`
- Test: `packages/forge-core/test/packs.test.ts`

**Interfaces:**
- Produces: `render(text, ctx): string` and `class TemplateError`; `PackFile` zod, `type Pack`, `type LoadedPack = { pack: Pack; raw: string; dir: string }`; `loadPacks(dir): Map<string, LoadedPack>`; `renderPack(loaded, ctx): Resource[]`; `class PackNotFound`.
- Pack-generated ids reference rule-generated H ids `h.topic.alerts`, `h.topic.approvals`, `h.topic.announce` (Task 7 must create exactly those).

- [ ] **Step 1: Write the failing test**

`packages/forge-core/test/packs.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { loadIntentFile } from "../src/schema/intent.js";
import { loadPacks, renderPack } from "../src/packs/loader.js";
import { TemplateError, render } from "../src/packs/template.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const PACKS = `${ROOT}packs`;
const intent = loadIntentFile(`${ROOT}examples/intent.example.yaml`);

describe("render", () => {
  it("substitutes dotted paths and tolerates spaces", () => {
    expect(render("t_{{ org.short_code }}/{{process.id}}", { org: { short_code: "abc" }, process: { id: "cskh" } })).toBe("t_abc/cskh");
  });
  it("throws TemplateError naming the missing path", () => {
    expect(() => render("{{process.nope}}", { process: {} })).toThrow(TemplateError);
    expect(() => render("{{process.nope}}", { process: {} })).toThrow(/process\.nope/);
  });
});

describe("loadPacks", () => {
  const packs = loadPacks(PACKS);
  it("finds core (org scope) and dx-ticket (process scope)", () => {
    expect(packs.get("core")?.pack.scope).toBe("org");
    expect(packs.get("dx-ticket")?.pack.scope).toBe("process");
  });
  it("rejects a directory whose pack id differs from its folder name", () => {
    expect(() => loadPacks(`${ROOT}packages/forge-core/test/fixtures/bad-packs`)).toThrow(/id/);
  });
});

describe("renderPack dx-ticket", () => {
  const packs = loadPacks(PACKS);
  const resources = renderPack(packs.get("dx-ticket")!, { org: intent.organization, process: intent.core_processes[0] });
  it("yields six P resources prefixed with the process id", () => {
    expect(resources.map((r) => r.id).sort()).toEqual(["cskh.app", "cskh.entity", "cskh.form", "cskh.rule", "cskh.states", "cskh.workflow"]);
    expect(resources.every((r) => r.layer === "P")).toBe(true);
    expect(resources.every((r) => r.source?.pack === "dx-ticket" && r.source?.process === "cskh")).toBe(true);
  });
  it("substitutes actors into the state machine and keeps ≤ 5 required form fields", () => {
    const sm = resources.find((r) => r.id === "cskh.states")!.spec as { transitions: { A: string[] }[] };
    expect(sm.transitions[0].A).toEqual(["manager"]);
    const form = resources.find((r) => r.id === "cskh.form")!.spec as { fields: { required?: boolean }[] };
    expect(form.fields.filter((f) => f.required).length).toBeLessThanOrEqual(5);
  });
  it("core pack renders once per organisation", () => {
    const core = renderPack(packs.get("core")!, { org: intent.organization });
    expect(core.map((r) => r.id)).toEqual(["core.offboardings.entity", "core.offboarding.workflow"]);
  });
});
```

Fixture `packages/forge-core/test/fixtures/bad-packs/wrong/pack.yaml`:
```yaml
id: other
name: Wrong
description: id does not match folder
version: "1.0"
scope: org
resources: []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/forge-core/test/packs.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Template renderer**

`packages/forge-core/src/packs/template.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
export class TemplateError extends Error {
  constructor(path: string) {
    super(`Template variable not found: ${path}`);
    this.name = "TemplateError";
  }
}

function lookup(ctx: Record<string, unknown>, path: string): unknown {
  let cur: unknown = ctx;
  for (const key of path.split(".")) {
    if (cur === null || typeof cur !== "object" || !(key in (cur as object))) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/** Replace every `{{ a.b.c }}` with the context value; arrays join with ", ". Missing path → TemplateError. */
export function render(text: string, ctx: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, path: string) => {
    const v = lookup(ctx, path);
    if (v === undefined) throw new TemplateError(path);
    return Array.isArray(v) ? v.join(", ") : String(v);
  });
}
```

- [ ] **Step 4: Loader**

`packages/forge-core/src/packs/loader.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { Resource } from "../schema/plan.js";
import { render } from "./template.js";

export const PackFile = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1),
  scope: z.enum(["org", "process"]),
  resources: z.array(Resource.omit({ gate: true, source: true })),
});
export type Pack = z.infer<typeof PackFile>;
export type LoadedPack = { pack: Pack; raw: string; dir: string };

export class PackNotFound extends Error {
  constructor(id: string) {
    super(`Pack not found: ${id}`);
    this.name = "PackNotFound";
  }
}

/** Reads every `<dir>/<id>/pack.yaml`. The template is validated once with placeholder values so broken packs fail at load time. */
export function loadPacks(dir: string): Map<string, LoadedPack> {
  const out = new Map<string, LoadedPack>();
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = join(dir, entry.name, "pack.yaml");
    if (!existsSync(file)) continue;
    const raw = readFileSync(file, "utf8");
    const probe = render(raw, PROBE_CONTEXT);
    const pack = PackFile.parse(parse(probe));
    if (pack.id !== entry.name) throw new Error(`Pack id "${pack.id}" does not match folder "${entry.name}"`);
    out.set(pack.id, { pack, raw, dir: join(dir, entry.name) });
  }
  return out;
}

/** Placeholder values used only to validate a pack's shape at load time. */
const PROBE_CONTEXT = {
  org: { name: "org", short_code: "org", sector: "x", size_band: "x", departments: [] },
  process: { id: "proc", name: "proc", pack: "x", actors: { R: "r", A: "a", C: [], I: [] }, sla_hours: 1, external_entry: false },
};

export type PackContext = { org: Record<string, unknown>; process?: Record<string, unknown> };

export function renderPack(loaded: LoadedPack, ctx: PackContext): Resource[] {
  const rendered = PackFile.parse(parse(render(loaded.raw, ctx as Record<string, unknown>)));
  const process = ctx.process ? String((ctx.process as { id: string }).id) : undefined;
  return rendered.resources.map((r) => Resource.parse({ ...r, source: { pack: loaded.pack.id, process } }));
}
```

- [ ] **Step 5: Pack files**

`packs/dx-ticket/pack.yaml`:
```yaml
# SPDX-License-Identifier: AGPL-3.0-or-later
id: dx-ticket
name: DX-Ticket
description: Quy trình xử lý yêu cầu khách hàng theo mẫu DX-Ticket của sách DX-OS (lớp P). Biến {{process.*}} và {{org.*}} được thay khi sinh plan.
version: "1.0"
scope: process
resources:
  - id: "{{process.id}}.entity"
    layer: P
    type: process.entity
    reason: "Bảng dữ liệu cho quy trình {{process.name}}; là nguồn duy nhất cho form, app, dashboard."
    spec:
      table: ticket_{{process.id}}
      fields:
        - { name: code, type: text, required: true }
        - { name: title, type: text, required: true }
        - { name: description, type: text }
        - { name: customer_name, type: text, pii: true }
        - { name: customer_phone, type: text, pii: true }
        - { name: priority, type: enum, options: [low, normal, high] }
        - { name: status, type: enum, options: [new, assigned, in_progress, resolved, closed] }
        - { name: assignee, type: text }
        - { name: created_at, type: timestamp }
        - { name: due_at, type: timestamp }
  - id: "{{process.id}}.form"
    layer: P
    type: process.form
    depends_on: ["{{process.id}}.entity"]
    reason: "Rào chắn lớp 1: chặn dữ liệu sai ngay khi nhập; tối đa 5 trường bắt buộc."
    spec:
      entity: "{{process.id}}.entity"
      fields:
        - { name: title, label: Tiêu đề yêu cầu, required: true }
        - { name: description, label: Mô tả }
        - { name: customer_name, label: Tên khách hàng, required: true }
        - { name: customer_phone, label: Số điện thoại, required: true, pattern: '^0\d{9}$' }
        - { name: priority, label: Mức ưu tiên, required: true, options: [low, normal, high] }
  - id: "{{process.id}}.states"
    layer: P
    type: process.state_machine
    depends_on: ["{{process.id}}.entity"]
    reason: "Mỗi chuyển trạng thái có đúng một vai trò chịu trách nhiệm (A) theo 5 RÕ."
    spec:
      entity: "{{process.id}}.entity"
      states: [new, assigned, in_progress, resolved, closed]
      transitions:
        - { from: new, to: assigned, A: ["{{process.actors.A}}"] }
        - { from: assigned, to: in_progress, A: ["{{process.actors.R}}"] }
        - { from: in_progress, to: resolved, A: ["{{process.actors.R}}"] }
        - { from: resolved, to: closed, A: ["{{process.actors.A}}"] }
  - id: "{{process.id}}.rule"
    layer: P
    type: process.rule
    depends_on: ["{{process.id}}.entity"]
    reason: "Rào chắn lớp 2: không cho đóng yêu cầu khi chưa có người xử lý."
    spec:
      entity: "{{process.id}}.entity"
      name: no_resolve_without_assignee
      when: "status IN ('resolved','closed')"
      require: "assignee IS NOT NULL"
      message: "Chưa có người xử lý, không thể đóng yêu cầu."
  - id: "{{process.id}}.workflow"
    layer: P
    type: process.workflow
    depends_on: ["{{process.id}}.entity", h.topic.alerts, h.topic.approvals]
    reason: "Thông báo khi có yêu cầu mới và khi quá hạn SLA {{process.sla_hours}} giờ."
    spec:
      entity: "{{process.id}}.entity"
      events:
        - on: created
          actions:
            - { type: notify, topic: h.topic.alerts, template: "Yêu cầu mới #{code}: {title} ({priority})" }
        - on: sla_breach
          after_hours: {{process.sla_hours}}
          actions:
            - { type: notify, topic: h.topic.approvals, template: "Quá hạn SLA: #{code} {title}, người xử lý {assignee}" }
  - id: "{{process.id}}.app"
    layer: P
    type: process.app
    depends_on: ["{{process.id}}.form", "{{process.id}}.states"]
    reason: "Màn hình làm việc của {{process.actors.R}} và {{process.actors.A}}: danh sách, chi tiết, bảng kanban."
    spec:
      entity: "{{process.id}}.entity"
      views: [list, detail, board]
      filters: [status, priority, assignee]
      security: { row_filter: "department = current_user.department", roles: ["{{process.actors.R}}", "{{process.actors.A}}"] }
```

`packs/core/pack.yaml`:
```yaml
# SPDX-License-Identifier: AGPL-3.0-or-later
id: core
name: Core
description: Quy trình lõi mọi tổ chức đều cần; hiện gồm thu hồi truy cập (offboarding) chạy trên workflow của đích.
version: "1.0"
scope: org
resources:
  - id: core.offboardings.entity
    layer: P
    type: process.entity
    reason: "Ghi lại mỗi lần thu hồi truy cập để đo thời gian và làm bằng chứng kiểm chứng."
    spec:
      table: offboardings
      fields:
        - { name: employee_email, type: text, required: true, pii: true }
        - { name: requested_at, type: timestamp, required: true }
        - { name: completed_at, type: timestamp }
        - { name: duration_minutes, type: int }
        - { name: steps_done, type: int }
  - id: core.offboarding.workflow
    layer: P
    type: process.workflow
    depends_on: [core.offboardings.entity, h.topic.announce]
    reason: "Thu hồi truy cập 5 bước trong một lần chạy; Forge chỉ kiểm chứng bằng tài khoản thử."
    spec:
      entity: core.offboardings.entity
      events:
        - on: created
          actions:
            - { type: identity.disable }
            - { type: storage.transfer, to: "4. [A] ARCHIVES" }
            - { type: comms.remove }
            - { type: update, set: { completed_at: now } }
            - { type: notify, topic: h.topic.announce, template: "Đã thu hồi truy cập {employee_email} trong {duration_minutes} phút" }
```

- [ ] **Step 6: Export and run**

Append to `packages/forge-core/src/index.ts`:
```ts
export * from "./packs/template.js";
export * from "./packs/loader.js";
```
Run: `npx vitest run packages/forge-core/test/packs.test.ts`
Expected: 7 passed.

- [ ] **Step 7: Commit**

```bash
git add packs packages/forge-core && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(forge-core): pack template renderer and loader with core and dx-ticket packs"
```

---

### Task 7: Planner — rule-generated H/D/I layers and `buildPlan`

**Files:**
- Create: `packages/forge-core/src/planner/rules.ts`, `packages/forge-core/src/planner/index.ts`
- Modify: `packages/forge-core/src/index.ts`
- Test: `packages/forge-core/test/planner.test.ts`

**Interfaces:**
- Produces: `layerH(intent): Resource[]`, `layerD(intent, entities: Resource[]): Resource[]`, `layerI(intent): Resource[]`, `PARA_BRANCHES: string[]`, `buildPlan(intent, packs, now?: Date): PlanV1` (no gate yet; `gate.allowed` defaults true), `class DuplicateResourceId`.
- Generated ids: `h.realm`, `h.role.dx-admin|manager|staff`, `h.group.<dept>`, `h.tree`, `h.acl.resources`, `h.acl.areas.<dept>`, `h.acl.archives`, `h.portal`, `h.channel`, `h.topic.announce|alerts|approvals`, `d.dashboard.<key>`, `d.snapshot.<key>`, `d.lod.<key>`, `i.rag.resources`, `i.policy.<process>`, `i.assistant` where `<key>` = `source.process` or the entity id without `.entity`.

- [ ] **Step 1: Write the failing test**

`packages/forge-core/test/planner.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { loadIntentFile } from "../src/schema/intent.js";
import { loadPacks } from "../src/packs/loader.js";
import { DuplicateResourceId, buildPlan } from "../src/planner/index.js";
import { PlanV1 } from "../src/schema/plan.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const intent = loadIntentFile(`${ROOT}examples/intent.example.yaml`);
const packs = loadPacks(`${ROOT}packs`);
const NOW = new Date("2026-09-10T00:00:00.000Z");

describe("buildPlan", () => {
  const plan = buildPlan(intent, packs, NOW);
  const ids = plan.resources.map((r) => r.id);

  it("is a valid PlanV1 with a stable intent hash and the intent's target", () => {
    expect(PlanV1.safeParse(plan).success).toBe(true);
    expect(plan.target).toBe("oss");
    expect(plan.intent_hash).toBe(buildPlan(intent, packs, NOW).intent_hash);
  });

  it("generates the H layer from organisation and channels", () => {
    for (const id of ["h.realm", "h.role.dx-admin", "h.role.manager", "h.role.staff", "h.group.cskh", "h.group.kd", "h.tree", "h.acl.resources", "h.acl.areas.cskh", "h.acl.areas.kd", "h.acl.archives", "h.portal", "h.channel", "h.topic.announce", "h.topic.alerts", "h.topic.approvals"]) {
      expect(ids, id).toContain(id);
    }
    const acl = plan.resources.find((r) => r.id === "h.acl.resources")!;
    expect(acl.spec).toMatchObject({ path: "3. [R] RESOURCES", group: "all-staff", mode: "read" });
  });

  it("expands the process pack and the org-scoped core pack", () => {
    expect(ids).toEqual(expect.arrayContaining(["cskh.entity", "cskh.form", "cskh.states", "core.offboardings.entity", "core.offboarding.workflow"]));
  });

  it("derives one dashboard, snapshot and LOD context per entity, masking PII fields", () => {
    expect(ids).toEqual(expect.arrayContaining(["d.dashboard.cskh", "d.snapshot.cskh", "d.lod.cskh", "d.dashboard.core.offboardings"]));
    const dash = plan.resources.find((r) => r.id === "d.dashboard.cskh")!;
    expect(dash.spec).toMatchObject({ entity: "cskh.entity", masking: ["customer_name", "customer_phone"] });
    expect(dash.depends_on).toContain("cskh.entity");
  });

  it("derives the I layer with an HITL policy per core process", () => {
    const policy = plan.resources.find((r) => r.id === "i.policy.cskh")!;
    expect(policy.spec).toMatchObject({ approval_channel: "h.topic.approvals", expire_hours: 24 });
    expect(ids).toEqual(expect.arrayContaining(["i.rag.resources", "i.assistant"]));
  });

  it("every resource has a non-empty reason and all gates default to allowed", () => {
    expect(plan.resources.every((r) => r.reason.length > 0 && r.gate.allowed)).toBe(true);
  });

  it("throws on a duplicate id", () => {
    const twice = { ...intent, core_processes: [intent.core_processes[0], intent.core_processes[0]] };
    expect(() => buildPlan(twice, packs, NOW)).toThrow(DuplicateResourceId);
  });

  it("matches the snapshot", () => {
    expect(plan).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/forge-core/test/planner.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Rules**

`packages/forge-core/src/planner/rules.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IntentV1 } from "../schema/intent.js";
import type { Resource } from "../schema/plan.js";

/** P.A.R.A tree from the book (M0 spec §7). Department and project branches are added per organisation. */
export const PARA_BRANCHES = [
  "00. Portal",
  "1. [P] PROJECTS",
  "2. [A] AREAS",
  "3. [R] RESOURCES/10. GOVERNANCE/11. Policies_Regulations",
  "3. [R] RESOURCES/10. GOVERNANCE/12. SOP_Processes",
  "3. [R] RESOURCES/10. GOVERNANCE/13. Technical_Manuals",
  "3. [R] RESOURCES/10. GOVERNANCE/14. Templates_Forms",
  "3. [R] RESOURCES/20. EXPERIENCE/21. Case_Studies",
  "3. [R] RESOURCES/20. EXPERIENCE/22. Lessons_Learned",
  "3. [R] RESOURCES/20. EXPERIENCE/23. Customer_Feedback",
  "3. [R] RESOURCES/20. EXPERIENCE/24. Meeting_Notes",
  "3. [R] RESOURCES/30. EDUCATION/31. Onboarding",
  "3. [R] RESOURCES/30. EDUCATION/32. Training_Materials",
  "3. [R] RESOURCES/30. EDUCATION/33. Industry_Knowledge",
  "3. [R] RESOURCES/30. EDUCATION/34. Reading_List",
  "3. [R] RESOURCES/40. ASSETS/41. Structured_Data",
  "3. [R] RESOURCES/40. ASSETS/42. Unstructured_Data",
  "3. [R] RESOURCES/40. ASSETS/43. Brand_Media",
  "3. [R] RESOURCES/40. ASSETS/44. Versioned_Assets",
  "4. [A] ARCHIVES",
];

const ROLES = ["dx-admin", "manager", "staff"] as const;

export function layerH(intent: IntentV1): Resource[] {
  const org = intent.organization;
  const root = `[${org.short_code.toUpperCase()}] DX-OS`;
  const out: Resource[] = [
    {
      id: "h.realm", layer: "H", type: "identity.realm", depends_on: [], gate: { allowed: true },
      spec: { realm: "dxlab", clients: ["dx-forge-wizard", "nextcloud", "n8n"] },
      reason: "Một danh tính, đăng nhập một lần cho mọi công cụ của DX-Lab.",
    },
    ...ROLES.map<Resource>((name) => ({
      id: `h.role.${name}`, layer: "H", type: "identity.role", depends_on: ["h.realm"], gate: { allowed: true },
      spec: { name }, reason: `Vai trò ${name} dùng trong ACL, quy trình và chính sách tác tử.`,
    })),
    ...org.departments.map<Resource>((d) => ({
      id: `h.group.${d.code}`, layer: "H", type: "identity.group", depends_on: ["h.realm"], gate: { allowed: true },
      spec: { path: `/departments/${d.code}`, attributes: { code: d.code, name: d.name } },
      reason: `Nhóm phòng ban ${d.name} để cấp quyền theo AREAS và lọc dữ liệu.`,
    })),
    {
      id: "h.tree", layer: "H", type: "storage.tree", depends_on: ["h.realm"], gate: { allowed: true },
      spec: { root, branches: [...PARA_BRANCHES, ...org.departments.map((d) => `2. [A] AREAS/${d.name}`)], readme: true },
      reason: "Cây P.A.R.A chuẩn của sách: mọi tài liệu có đúng một chỗ.",
    },
    {
      id: "h.acl.resources", layer: "H", type: "storage.acl", depends_on: ["h.tree"], gate: { allowed: true },
      spec: { path: "3. [R] RESOURCES", group: "all-staff", mode: "read" },
      reason: "Kho tài nguyên chỉ đọc với toàn bộ nhân sự; chỉ quản trị mới sửa.",
    },
    ...org.departments.map<Resource>((d) => ({
      id: `h.acl.areas.${d.code}`, layer: "H", type: "storage.acl", depends_on: ["h.tree", `h.group.${d.code}`], gate: { allowed: true },
      spec: { path: `2. [A] AREAS/${d.name}`, group: `departments/${d.code}`, mode: "write" },
      reason: `Phòng ${d.name} tự quản khu vực của mình.`,
    })),
    {
      id: "h.acl.archives", layer: "H", type: "storage.acl", depends_on: ["h.tree", "h.role.dx-admin"], gate: { allowed: true },
      spec: { path: "4. [A] ARCHIVES", group: "dx-admin", mode: "admin" },
      reason: "Lưu trữ chỉ quản trị viên chạm vào; nhân sự không xoá lịch sử.",
    },
    {
      id: "h.portal", layer: "H", type: "portal.site", depends_on: ["h.tree"], gate: { allowed: true },
      spec: { files: ["00. Portal/news.md", "00. Portal/handbook/index.md"] },
      reason: "Cổng thông tin nội bộ: tin tức và sổ tay nghiệp vụ số do Forge sinh.",
    },
    {
      id: "h.channel", layer: "H", type: "comms.channel", depends_on: [], gate: { allowed: true },
      spec: { kind: intent.channels.chat, name: `${org.short_code}-dxlab` },
      reason: "Một kênh chung thay cho tin nhắn riêng lẻ.",
    },
    ...(["announce", "alerts", "approvals"] as const).map<Resource>((purpose) => ({
      id: `h.topic.${purpose}`, layer: "H", type: "comms.topic", depends_on: ["h.channel"], gate: { allowed: true },
      spec: { channel: "h.channel", name: intent.channels.notify_targets[purpose], purpose },
      reason: { announce: "Thông báo chung.", alerts: "Cảnh báo từ quy trình.", approvals: "Nơi người duyệt bấm duyệt cho tác tử và SLA." }[purpose],
    })),
  ];
  return out;
}

const entityKey = (e: Resource) => e.source?.process ?? e.id.replace(/\.entity$/, "");

export function layerD(_intent: IntentV1, entities: Resource[]): Resource[] {
  return entities.flatMap<Resource>((e) => {
    const key = entityKey(e);
    const fields = (e.spec as { fields: { name: string; pii?: boolean }[] }).fields;
    const masking = fields.filter((f) => f.pii).map((f) => f.name);
    return [
      {
        id: `d.dashboard.${key}`, layer: "D", type: "data.dashboard", depends_on: [e.id], gate: { allowed: true },
        spec: { entity: e.id, cards: [{ name: "Theo trạng thái", kind: "count_by_state" }, { name: "Quá hạn SLA", kind: "sla_breach" }], masking },
        reason: `Bảng điều khiển tối thiểu cho ${key}: đếm theo trạng thái, quá hạn; che ${masking.length} trường PII.`,
      },
      {
        id: `d.snapshot.${key}`, layer: "D", type: "data.snapshot", depends_on: [e.id, "h.tree"], gate: { allowed: true },
        spec: { entity: e.id, schedule: "0 2 1 * *", destination: "3. [R] RESOURCES/40. ASSETS/41. Structured_Data", formats: ["csv", "jsonld"] },
        reason: "Chụp dữ liệu hằng tháng vào kho tài nguyên có cấu trúc để so sánh theo thời gian.",
      },
      {
        id: `d.lod.${key}`, layer: "D", type: "data.lod_context", depends_on: [e.id], gate: { allowed: true },
        spec: { entity: e.id, context: { "@vocab": "https://schema.org/", id: "@id", ...Object.fromEntries(fields.map((f) => [f.name, `https://schema.org/${f.name}`])) } },
        reason: "Ngữ cảnh JSON-LD để dữ liệu mở liên kết được (trục LOD).",
      },
    ];
  });
}

export function layerI(intent: IntentV1): Resource[] {
  return [
    {
      id: "i.rag.resources", layer: "I", type: "intel.rag_source", depends_on: ["h.tree"], gate: { allowed: true },
      spec: { paths: ["3. [R] RESOURCES"], collection: `${intent.organization.short_code}_resources` },
      reason: "Trợ lý chỉ trả lời theo tài liệu thật trong kho tài nguyên.",
    },
    ...intent.core_processes.map<Resource>((p) => ({
      id: `i.policy.${p.id}`, layer: "I", type: "intel.agent_policy", depends_on: ["h.topic.approvals"], gate: { allowed: true },
      spec: { actions: [`${p.id}.read`, `${p.id}.comment`, `${p.id}.assign`], approval_channel: "h.topic.approvals", expire_hours: 24, approver_role: p.actors.A },
      reason: `Tác tử cho ${p.name} chỉ được làm việc trong whitelist; hành động ghi cần ${p.actors.A} duyệt trong 24 giờ.`,
    })),
    {
      id: "i.assistant", layer: "I", type: "intel.assistant", depends_on: ["i.rag.resources"], gate: { allowed: true },
      spec: {
        rag_source: "i.rag.resources",
        system_prompt: `Vai trò: trợ lý nội bộ của ${intent.organization.name}. Bối cảnh: chỉ dùng tài liệu trong kho tài nguyên. Hành động: trả lời ngắn, dẫn nguồn. Định dạng: tiếng Việt, gạch đầu dòng. Ranh giới: không bịa, không thực thi hành động ghi khi chưa có duyệt.`,
      },
      reason: "Prompt hệ thống theo khung 5 RÕ; mọi câu trả lời dẫn nguồn.",
    },
  ];
}
```

- [ ] **Step 4: buildPlan**

`packages/forge-core/src/planner/index.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { checksum } from "../hash.js";
import { PackNotFound, renderPack, type LoadedPack } from "../packs/loader.js";
import type { IntentV1 } from "../schema/intent.js";
import { PlanV1, type Resource } from "../schema/plan.js";
import { layerD, layerH, layerI } from "./rules.js";

export class DuplicateResourceId extends Error {
  constructor(id: string) {
    super(`Duplicate resource id: ${id}`);
    this.name = "DuplicateResourceId";
  }
}

/** intent → ungated plan: rule-generated H, pack-expanded P, entity-derived D, rule-generated I. Validation is a separate step. */
export function buildPlan(intent: IntentV1, packs: Map<string, LoadedPack>, now: Date = new Date()): PlanV1 {
  const resources: Resource[] = [...layerH(intent)];
  for (const loaded of packs.values()) {
    if (loaded.pack.scope === "org") resources.push(...renderPack(loaded, { org: intent.organization }));
  }
  for (const process of intent.core_processes) {
    if (!process.pack) continue;
    const loaded = packs.get(process.pack);
    if (!loaded || loaded.pack.scope !== "process") throw new PackNotFound(process.pack);
    resources.push(...renderPack(loaded, { org: intent.organization, process }));
  }
  const entities = resources.filter((r) => r.type === "process.entity");
  resources.push(...layerD(intent, entities), ...layerI(intent));
  const seen = new Set<string>();
  for (const r of resources) {
    if (seen.has(r.id)) throw new DuplicateResourceId(r.id);
    seen.add(r.id);
  }
  return PlanV1.parse({ version: 1, generated_at: now.toISOString(), intent_hash: checksum(intent), target: intent.target.kind, resources, notes: [] });
}
```

Append to `packages/forge-core/src/index.ts`:
```ts
export * from "./planner/rules.js";
export * from "./planner/index.js";
```

- [ ] **Step 5: Run, inspect the snapshot, typecheck**

Run: `npx vitest run packages/forge-core/test/planner.test.ts && npx tsc -p packages/forge-core --noEmit`
Expected: 8 passed; a snapshot file `test/__snapshots__/planner.test.ts.snap` is written. Open it and confirm the plan has 16 H + 8 P + 6 D + 3 I = 33 resources.

- [ ] **Step 6: Commit**

```bash
git add packages/forge-core && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(forge-core): planner builds H/P/D/I plan from intent, packs and rules"
```

---

### Task 8: Validator — maturity gate, six rules, `compile()`

**Files:**
- Create: `packages/forge-core/src/validator/gate.ts`, `packages/forge-core/src/validator/rules.ts`, `packages/forge-core/src/validator/index.ts`, `packages/forge-core/src/compile.ts`
- Modify: `packages/forge-core/src/index.ts`
- Test: `packages/forge-core/test/validator.test.ts`

**Interfaces:**
- Produces: `type ValidationError = { rule: string; resourceId?: string; message: string }`; `allowedLayers(maturity): { layers: Set<Layer>; why: Partial<Record<Layer, string>> }`; `applyGate(plan, intent): PlanV1`; `RULES: Array<(plan: PlanV1) => ValidationError[]>`; `validatePlan(plan, intent): { plan: PlanV1; errors: ValidationError[] }`; `compile(intent, packs, now?): { plan: PlanV1; errors: ValidationError[] }`.
- Rule names (used in CLI output and tests): `spec_schema`, `one_a`, `max_required`, `resources_read_only`, `pii_masking`, `hitl`, `dependencies`.

- [ ] **Step 1: Write the failing tests (20+ cases)**

`packages/forge-core/test/validator.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { loadIntentFile, type IntentV1 } from "../src/schema/intent.js";
import { loadPacks } from "../src/packs/loader.js";
import { buildPlan } from "../src/planner/index.js";
import { allowedLayers, applyGate } from "../src/validator/gate.js";
import { validatePlan } from "../src/validator/index.js";
import { compile } from "../src/compile.js";
import type { PlanV1, Resource } from "../src/schema/plan.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const intent = loadIntentFile(`${ROOT}examples/intent.example.yaml`);
const packs = loadPacks(`${ROOT}packs`);
const base = () => buildPlan(intent, packs, new Date("2026-09-10T00:00:00Z"));

function withMaturity(hpdi: { H: number; P: number; D: number; I: number }, shape: NonNullable<IntentV1["maturity"]>["shape"]): IntentV1 {
  return { ...intent, maturity: { assessment_id: "t", hpdi, shape, dti_level: 3, discrepancies: {} } };
}
function patch(plan: PlanV1, id: string, fn: (r: Resource) => Resource): PlanV1 {
  return { ...plan, resources: plan.resources.map((r) => (r.id === id ? fn(r) : r)) };
}
const rules = (plan: PlanV1, i: IntentV1 = intent) => validatePlan(plan, i).errors.map((e) => e.rule);

describe("maturity gate", () => {
  it("spear → only H", () => {
    expect([...allowedLayers(withMaturity({ H: 90, P: 10, D: 0, I: 0 }, "spear").maturity).layers]).toEqual(["H"]);
  });
  it("kite with P < 20 → H + P", () => {
    expect([...allowedLayers(withMaturity({ H: 75, P: 15, D: 5, I: 5 }, "kite").maturity).layers].sort()).toEqual(["H", "P"]);
  });
  it("transitional with P ≥ 20 → H + P + D", () => {
    expect([...allowedLayers(intent.maturity).layers].sort()).toEqual(["D", "H", "P"]);
  });
  it("illusion → H + P + D, I forbidden with GIGO", () => {
    const g = allowedLayers(withMaturity({ H: 65, P: 10, D: 15, I: 10 }, "illusion").maturity);
    expect(g.layers.has("I")).toBe(false);
    expect(g.why.I).toMatch(/GIGO/);
  });
  it("diamond → all four", () => {
    expect(allowedLayers(withMaturity({ H: 10, P: 30, D: 30, I: 30 }, "diamond").maturity).layers.size).toBe(4);
  });
  it("unmeasured → only H with an 'unmeasured' reason", () => {
    const g = allowedLayers(undefined);
    expect([...g.layers]).toEqual(["H"]);
    expect(g.why.P).toMatch(/unmeasured/);
  });
  it("applyGate keeps gated resources in the plan with allowed=false and why", () => {
    const gated = applyGate(base(), intent);
    const policy = gated.resources.find((r) => r.id === "i.policy.cskh")!;
    expect(policy.gate.allowed).toBe(false);
    expect(policy.gate.why).toBeTruthy();
    expect(gated.resources.find((r) => r.id === "h.realm")!.gate.allowed).toBe(true);
    expect(gated.resources.length).toBe(base().resources.length);
  });
});

describe("rules on the generated plan", () => {
  it("the generated plan for the example intent has no errors", () => {
    expect(validatePlan(base(), intent).errors).toEqual([]);
  });
  it("spec_schema: an entity without fields", () => {
    expect(rules(patch(base(), "cskh.entity", (r) => ({ ...r, spec: { table: "x" } })))).toContain("spec_schema");
  });
  it("one_a: a transition with two A roles fails; with one passes", () => {
    const bad = patch(base(), "cskh.states", (r) => ({ ...r, spec: { ...r.spec, transitions: [{ from: "new", to: "assigned", A: ["manager", "staff"] }] } }));
    expect(rules(bad)).toContain("one_a");
    const none = patch(base(), "cskh.states", (r) => ({ ...r, spec: { ...r.spec, transitions: [{ from: "new", to: "assigned", A: [] }] } }));
    expect(rules(none)).toContain("one_a");
  });
  it("max_required: six required fields fail with a hint about defaults", () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ name: `f${i}`, label: `F${i}`, required: true }));
    const bad = patch(base(), "cskh.form", (r) => ({ ...r, spec: { ...r.spec, fields: six } }));
    const err = validatePlan(bad, intent).errors.find((e) => e.rule === "max_required")!;
    expect(err.resourceId).toBe("cskh.form");
    expect(err.message).toMatch(/mặc định|default/);
  });
  it("resources_read_only: all-staff write on RESOURCES fails; read passes", () => {
    expect(rules(patch(base(), "h.acl.resources", (r) => ({ ...r, spec: { ...r.spec, mode: "write" } })))).toContain("resources_read_only");
    expect(rules(base())).not.toContain("resources_read_only");
  });
  it("pii_masking: a dashboard on a PII entity that does not mask every PII field fails", () => {
    expect(rules(patch(base(), "d.dashboard.cskh", (r) => ({ ...r, spec: { ...r.spec, masking: ["customer_name"] } })))).toContain("pii_masking");
  });
  it("pii_masking: entity without PII needs no masking", () => {
    const noPii = patch(base(), "cskh.entity", (r) => ({ ...r, spec: { ...r.spec, fields: [{ name: "code", type: "text" }] } }));
    const unmasked = patch(noPii, "d.dashboard.cskh", (r) => ({ ...r, spec: { ...r.spec, masking: [] } }));
    expect(rules(unmasked)).not.toContain("pii_masking");
  });
  it("hitl: empty approval_channel or expire_hours > 24 fails", () => {
    expect(rules(patch(base(), "i.policy.cskh", (r) => ({ ...r, spec: { ...r.spec, approval_channel: "" } })))).toContain("hitl");
    expect(rules(patch(base(), "i.policy.cskh", (r) => ({ ...r, spec: { ...r.spec, expire_hours: 48 } })))).toContain("hitl");
  });
  it("hitl: approval_channel must be an existing comms.topic", () => {
    expect(rules(patch(base(), "i.policy.cskh", (r) => ({ ...r, spec: { ...r.spec, approval_channel: "h.topic.nope" } })))).toContain("hitl");
  });
  it("dependencies: unknown id fails", () => {
    expect(rules(patch(base(), "cskh.form", (r) => ({ ...r, depends_on: ["ghost"] })))).toContain("dependencies");
  });
  it("dependencies: a cycle fails", () => {
    const cyc = patch(patch(base(), "cskh.form", (r) => ({ ...r, depends_on: ["cskh.app"] })), "cskh.app", (r) => ({ ...r, depends_on: ["cskh.form"] }));
    expect(rules(cyc)).toContain("dependencies");
  });
  it("errors are collected from all rules at once, not the first only", () => {
    const bad = patch(patch(base(), "h.acl.resources", (r) => ({ ...r, spec: { ...r.spec, mode: "write" } })), "cskh.form", (r) => ({ ...r, depends_on: ["ghost"] }));
    expect(new Set(rules(bad))).toEqual(new Set(["resources_read_only", "dependencies"]));
  });
});

describe("compile", () => {
  it("returns a gated plan and no errors for the example", () => {
    const { plan, errors } = compile(intent, packs, new Date("2026-09-10T00:00:00Z"));
    expect(errors).toEqual([]);
    expect(plan.resources.filter((r) => !r.gate.allowed).map((r) => r.layer)).toEqual(["I", "I", "I"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/forge-core/test/validator.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Gate**

`packages/forge-core/src/validator/gate.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IntentV1, Layer } from "../schema/intent.js";
import type { PlanV1 } from "../schema/plan.js";

export type Gate = { layers: Set<Layer>; why: Partial<Record<Layer, string>> };

/** Master spec §3 "Cổng trưởng thành". Cannot be disabled. */
export function allowedLayers(maturity: IntentV1["maturity"]): Gate {
  if (!maturity) {
    const why = "unmeasured: chưa có kết quả đo, chỉ dựng lớp H (hạ tầng). Chạy `dxforge measure` trước.";
    return { layers: new Set(["H"]), why: { P: why, D: why, I: why } };
  }
  const { shape, hpdi } = maturity;
  const layers = new Set<Layer>(["H"]);
  const why: Partial<Record<Layer, string>> = {};
  switch (shape) {
    case "spear":
      why.P = why.D = why.I = `spear (H=${hpdi.H}): tổ chức chưa có quy trình số; dựng hạ tầng và chuẩn hoá trước.`;
      break;
    case "kite":
    case "transitional":
      layers.add("P");
      if (hpdi.P >= 20) layers.add("D");
      else why.D = `${shape}: P=${hpdi.P} < 20, dữ liệu chưa đủ sạch để dựng lớp D.`;
      why.I = `${shape}: lớp I mở khi P và D đạt ≥ 20 (đúng trật tự P → D → I).`;
      break;
    case "illusion":
      layers.add("P");
      layers.add("D");
      why.I = `GIGO: ${shape} (P=${hpdi.P} < 20 nhưng D/I đã cao). Cấm lớp I cho tới khi quy trình được chuẩn hoá.`;
      break;
    case "diamond":
      layers.add("P");
      layers.add("D");
      layers.add("I");
      break;
  }
  return { layers, why };
}

export function applyGate(plan: PlanV1, intent: IntentV1): PlanV1 {
  const gate = allowedLayers(intent.maturity);
  return {
    ...plan,
    resources: plan.resources.map((r) =>
      gate.layers.has(r.layer) ? { ...r, gate: { allowed: true } } : { ...r, gate: { allowed: false, why: gate.why[r.layer] } },
    ),
  };
}
```

- [ ] **Step 4: Rules**

`packages/forge-core/src/validator/rules.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PlanV1, Resource } from "../schema/plan.js";
import { AclSpec, AgentPolicySpec, DashboardSpec, EntitySpec, FormSpec, SPEC_SCHEMAS, StateMachineSpec } from "../schema/specs.js";

export type ValidationError = { rule: string; resourceId?: string; message: string };
type Rule = (plan: PlanV1) => ValidationError[];

const byType = (plan: PlanV1, type: string) => plan.resources.filter((r) => r.type === type);

export const specSchema: Rule = (plan) =>
  plan.resources.flatMap((r) => {
    const schema = SPEC_SCHEMAS[r.type];
    if (!schema) return [];
    const res = schema.safeParse(r.spec);
    return res.success ? [] : [{ rule: "spec_schema", resourceId: r.id, message: res.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }];
  });

export const oneA: Rule = (plan) =>
  byType(plan, "process.state_machine").flatMap((r) => {
    const parsed = StateMachineSpec.safeParse(r.spec);
    if (!parsed.success) return [];
    return parsed.data.transitions
      .filter((t) => t.A.length !== 1)
      .map((t) => ({ rule: "one_a", resourceId: r.id, message: `Chuyển ${t.from} → ${t.to} phải có đúng một vai trò A, hiện có ${t.A.length}.` }));
  });

export const maxRequired: Rule = (plan) =>
  byType(plan, "process.form").flatMap((r) => {
    const parsed = FormSpec.safeParse(r.spec);
    if (!parsed.success) return [];
    const n = parsed.data.fields.filter((f) => f.required).length;
    return n > 5 ? [{ rule: "max_required", resourceId: r.id, message: `Form có ${n} trường bắt buộc (> 5). Đặt giá trị mặc định (default) cho các trường ít quan trọng.` }] : [];
  });

export const resourcesReadOnly: Rule = (plan) =>
  byType(plan, "storage.acl").flatMap((r) => {
    const parsed = AclSpec.safeParse(r.spec);
    if (!parsed.success) return [];
    const { path, group, mode } = parsed.data;
    return path.startsWith("3. [R] RESOURCES") && group === "all-staff" && mode !== "read"
      ? [{ rule: "resources_read_only", resourceId: r.id, message: "RESOURCES phải chỉ đọc (read) với all-staff." }]
      : [];
  });

export const piiMasking: Rule = (plan) => {
  const piiFields = new Map<string, string[]>();
  for (const e of byType(plan, "process.entity")) {
    const parsed = EntitySpec.safeParse(e.spec);
    if (parsed.success) piiFields.set(e.id, parsed.data.fields.filter((f) => f.pii).map((f) => f.name));
  }
  return byType(plan, "data.dashboard").flatMap((d) => {
    const parsed = DashboardSpec.safeParse(d.spec);
    if (!parsed.success) return [];
    const missing = (piiFields.get(parsed.data.entity) ?? []).filter((f) => !parsed.data.masking.includes(f));
    return missing.length > 0 ? [{ rule: "pii_masking", resourceId: d.id, message: `Dashboard chưa che trường PII: ${missing.join(", ")}.` }] : [];
  });
};

export const hitl: Rule = (plan) => {
  const topics = new Set(byType(plan, "comms.topic").map((t) => t.id));
  return byType(plan, "intel.agent_policy").flatMap((r) => {
    const parsed = AgentPolicySpec.safeParse(r.spec);
    if (!parsed.success) return [];
    const errs: ValidationError[] = [];
    if (!parsed.data.approval_channel) errs.push({ rule: "hitl", resourceId: r.id, message: "Chính sách tác tử phải có kênh duyệt (approval_channel)." });
    else if (!topics.has(parsed.data.approval_channel)) errs.push({ rule: "hitl", resourceId: r.id, message: `Kênh duyệt ${parsed.data.approval_channel} không phải comms.topic trong plan.` });
    if (parsed.data.expire_hours > 24) errs.push({ rule: "hitl", resourceId: r.id, message: `Hạn duyệt ${parsed.data.expire_hours}h vượt 24h.` });
    return errs;
  });
};

export const dependencies: Rule = (plan) => {
  const ids = new Map(plan.resources.map((r) => [r.id, r] as [string, Resource]));
  const errs: ValidationError[] = [];
  for (const r of plan.resources) {
    for (const d of r.depends_on) if (!ids.has(d)) errs.push({ rule: "dependencies", resourceId: r.id, message: `depends_on trỏ tới id không tồn tại: ${d}.` });
  }
  const state = new Map<string, 0 | 1 | 2>();
  const visit = (id: string, path: string[]): void => {
    const s = state.get(id) ?? 0;
    if (s === 2) return;
    if (s === 1) {
      errs.push({ rule: "dependencies", resourceId: id, message: `Vòng phụ thuộc: ${[...path, id].join(" → ")}.` });
      return;
    }
    state.set(id, 1);
    for (const d of ids.get(id)?.depends_on ?? []) if (ids.has(d)) visit(d, [...path, id]);
    state.set(id, 2);
  };
  for (const r of plan.resources) visit(r.id, []);
  return errs;
};

export const RULES: Rule[] = [specSchema, oneA, maxRequired, resourcesReadOnly, piiMasking, hitl, dependencies];
```

- [ ] **Step 5: validatePlan and compile**

`packages/forge-core/src/validator/index.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IntentV1 } from "../schema/intent.js";
import type { PlanV1 } from "../schema/plan.js";
import { applyGate } from "./gate.js";
import { RULES, type ValidationError } from "./rules.js";

export { allowedLayers, applyGate } from "./gate.js";
export { RULES, type ValidationError } from "./rules.js";

/** Gate + every rule, always all of them. There is deliberately no option to skip a rule. */
export function validatePlan(plan: PlanV1, intent: IntentV1): { plan: PlanV1; errors: ValidationError[] } {
  const gated = applyGate(plan, intent);
  return { plan: gated, errors: RULES.flatMap((rule) => rule(gated)) };
}
```

`packages/forge-core/src/compile.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { LoadedPack } from "./packs/loader.js";
import { buildPlan } from "./planner/index.js";
import type { IntentV1 } from "./schema/intent.js";
import type { PlanV1 } from "./schema/plan.js";
import { validatePlan, type ValidationError } from "./validator/index.js";

/** intent + packs → validated, gated plan. AI patches (plan 03) slot in between buildPlan and validatePlan. */
export function compile(intent: IntentV1, packs: Map<string, LoadedPack>, now: Date = new Date()): { plan: PlanV1; errors: ValidationError[] } {
  return validatePlan(buildPlan(intent, packs, now), intent);
}
```

Append to `packages/forge-core/src/index.ts`:
```ts
export * from "./validator/index.js";
export * from "./compile.js";
```

- [ ] **Step 6: Run, typecheck**

Run: `npx vitest run packages/forge-core && npx tsc -p packages/forge-core --noEmit`
Expected: all passed (validator file: 20 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/forge-core && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(forge-core): validator with maturity gate and six rules, compile()"
```

---

### Task 9: Apply order and differ (plan vs state)

**Files:**
- Create: `packages/forge-core/src/order.ts`, `packages/forge-core/src/differ.ts`
- Modify: `packages/forge-core/src/index.ts`
- Test: `packages/forge-core/test/order.test.ts`, `packages/forge-core/test/differ.test.ts`

**Interfaces:**
- Produces: `LAYER_ORDER: Layer[]`, `topoSort(resources): Resource[]` (stable; layer rank first, then `depends_on`; throws `CyclicDependency`); `type ChangeAction = "create" | "update" | "skip" | "destroy" | "gated"`; `type Change = { id; action; layer?; type?; before?; after? }`; `diffPlan(plan, state, opts?: { prune?: boolean }): Change[]`; `resourceChecksum(r): string` (checksum of `{type, spec}`).

- [ ] **Step 1: Write the failing tests**

`packages/forge-core/test/order.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { CyclicDependency, topoSort } from "../src/order.js";
import type { Resource } from "../src/schema/plan.js";

const r = (id: string, layer: Resource["layer"], depends_on: string[] = []): Resource => ({ id, layer, type: "x.y", spec: {}, reason: "t", depends_on, gate: { allowed: true } });

describe("topoSort", () => {
  it("orders by layer H → P → D → I, then by dependencies, keeping input order otherwise", () => {
    const out = topoSort([r("i1", "I"), r("d1", "D", ["p1"]), r("p1", "P", ["h2"]), r("h2", "H", ["h1"]), r("h1", "H"), r("h3", "H")]).map((x) => x.id);
    expect(out).toEqual(["h1", "h2", "h3", "p1", "d1", "i1"]);
  });
  it("lets a dependency inside the same layer come first even if listed later", () => {
    expect(topoSort([r("b", "H", ["a"]), r("a", "H")]).map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("throws on a cycle", () => {
    expect(() => topoSort([r("a", "H", ["b"]), r("b", "H", ["a"])])).toThrow(CyclicDependency);
  });
});
```

`packages/forge-core/test/differ.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { loadIntentFile } from "../src/schema/intent.js";
import { loadPacks } from "../src/packs/loader.js";
import { compile } from "../src/compile.js";
import { emptyState, type StateV1 } from "../src/schema/state.js";
import { diffPlan, resourceChecksum } from "../src/differ.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const intent = loadIntentFile(`${ROOT}examples/intent.example.yaml`);
const packs = loadPacks(`${ROOT}packs`);
const { plan } = compile(intent, packs, new Date("2026-09-10T00:00:00Z"));

function stateFor(ids: string[]): StateV1 {
  const s = emptyState("oss");
  for (const id of ids) {
    const r = plan.resources.find((x) => x.id === id)!;
    s.entries[id] = { externalId: `ext-${id}`, checksum: resourceChecksum(r), appliedAt: "2026-09-10T00:00:00.000Z" };
  }
  return s;
}

describe("diffPlan", () => {
  it("empty state → every allowed resource is created, gated ones are reported as gated, in apply order", () => {
    const changes = diffPlan(plan, emptyState("oss"));
    expect(changes[0]).toMatchObject({ id: "h.realm", action: "create", layer: "H" });
    expect(changes.filter((c) => c.action === "gated").map((c) => c.id)).toEqual(["i.rag.resources", "i.policy.cskh", "i.assistant"]);
    const layers = changes.filter((c) => c.action === "create").map((c) => c.layer);
    expect(layers.indexOf("P")).toBeGreaterThan(layers.lastIndexOf("H"));
    expect(layers.indexOf("D")).toBeGreaterThan(layers.lastIndexOf("P"));
  });
  it("same checksum → skip; changed spec → update with before/after", () => {
    const state = stateFor(["h.realm", "h.role.staff"]);
    state.entries["h.role.staff"].checksum = "0".repeat(64);
    const byId = Object.fromEntries(diffPlan(plan, state).map((c) => [c.id, c]));
    expect(byId["h.realm"].action).toBe("skip");
    expect(byId["h.role.staff"]).toMatchObject({ action: "update", after: { name: "staff" } });
    expect(byId["h.role.staff"].before).toBeUndefined(); // state holds only a checksum, not the old spec
  });
  it("entries in state but not in plan are destroyed only with prune, after everything else, in reverse order", () => {
    const state = stateFor(["h.realm"]);
    state.entries["zz.old"] = { externalId: "e", checksum: "1".repeat(64), appliedAt: "2026-09-10T00:00:00.000Z" };
    state.entries["aa.old"] = { externalId: "e", checksum: "1".repeat(64), appliedAt: "2026-09-10T00:00:00.000Z" };
    expect(diffPlan(plan, state).some((c) => c.action === "destroy")).toBe(false);
    const pruned = diffPlan(plan, state, { prune: true });
    expect(pruned.slice(-2).map((c) => [c.id, c.action])).toEqual([["aa.old", "destroy"], ["zz.old", "destroy"]]);
  });
  it("resourceChecksum ignores reason and gate but not spec or type", () => {
    const r = plan.resources[0];
    expect(resourceChecksum({ ...r, reason: "other", gate: { allowed: false } })).toBe(resourceChecksum(r));
    expect(resourceChecksum({ ...r, spec: { ...r.spec, extra: 1 } })).not.toBe(resourceChecksum(r));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/forge-core/test/order.test.ts packages/forge-core/test/differ.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Order**

`packages/forge-core/src/order.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Layer } from "./schema/intent.js";
import type { Resource } from "./schema/plan.js";

export const LAYER_ORDER: Layer[] = ["H", "P", "D", "I"];

export class CyclicDependency extends Error {
  constructor(id: string) {
    super(`Cyclic dependency at ${id}`);
    this.name = "CyclicDependency";
  }
}

/** Stable topological order: layer rank first, then depends_on, then input order. */
export function topoSort(resources: Resource[]): Resource[] {
  const byId = new Map(resources.map((r) => [r.id, r]));
  const ranked = [...resources].sort((a, b) => LAYER_ORDER.indexOf(a.layer) - LAYER_ORDER.indexOf(b.layer));
  const out: Resource[] = [];
  const state = new Map<string, 1 | 2>();
  const visit = (r: Resource) => {
    const s = state.get(r.id);
    if (s === 2) return;
    if (s === 1) throw new CyclicDependency(r.id);
    state.set(r.id, 1);
    for (const d of r.depends_on) {
      const dep = byId.get(d);
      if (dep) visit(dep);
    }
    state.set(r.id, 2);
    out.push(r);
  };
  for (const r of ranked) visit(r);
  return out;
}
```

- [ ] **Step 4: Differ**

`packages/forge-core/src/differ.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { checksum } from "./hash.js";
import { topoSort } from "./order.js";
import type { Layer } from "./schema/intent.js";
import type { PlanV1, Resource } from "./schema/plan.js";
import type { StateV1 } from "./schema/state.js";

export type ChangeAction = "create" | "update" | "skip" | "destroy" | "gated";
export type Change = { id: string; action: ChangeAction; layer?: Layer; type?: string; before?: unknown; after?: unknown; why?: string };

/** What apply compares against state: only the things that change the real resource. */
export function resourceChecksum(r: Resource): string {
  return checksum({ type: r.type, spec: r.spec });
}

export function diffPlan(plan: PlanV1, state: StateV1, opts: { prune?: boolean } = {}): Change[] {
  const changes: Change[] = [];
  for (const r of topoSort(plan.resources)) {
    const base = { id: r.id, layer: r.layer, type: r.type };
    if (!r.gate.allowed) {
      changes.push({ ...base, action: "gated", why: r.gate.why });
      continue;
    }
    const entry = state.entries[r.id];
    if (!entry) changes.push({ ...base, action: "create", after: r.spec });
    else if (entry.checksum === resourceChecksum(r)) changes.push({ ...base, action: "skip" });
    else changes.push({ ...base, action: "update", after: r.spec });
  }
  if (opts.prune) {
    const planIds = new Set(plan.resources.map((r) => r.id));
    const stale = Object.keys(state.entries).filter((id) => !planIds.has(id)).sort().reverse();
    for (const id of stale) changes.push({ id, action: "destroy" });
  }
  return changes;
}
```
(Destroy order: no layer info survives in state, so stale ids are destroyed in reverse lexical order. `ponytail:` store `layer` in StateEntry in plan 04 when real destroys need H last.)

Append to `packages/forge-core/src/index.ts`:
```ts
export * from "./order.js";
export * from "./differ.js";
```

- [ ] **Step 5: Run, typecheck, commit**

Run: `npx vitest run packages/forge-core && npx tsc -p packages/forge-core --noEmit`
Expected: all passed.

```bash
git add packages/forge-core && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(forge-core): topological apply order and plan/state differ"
```

---

### Task 10: CLI — `dxforge plan`, `dxforge packs list`, `dxforge explain`

**Files:**
- Create: `apps/cli/package.json`, `apps/cli/tsconfig.json`, `apps/cli/src/index.ts`, `apps/cli/src/commands/plan.ts`, `apps/cli/src/commands/packs.ts`, `apps/cli/src/commands/explain.ts`, `apps/cli/src/tree.ts`
- Modify: `package.json` (root script `dxforge`), `README.md`
- Test: `apps/cli/test/cli.test.ts`

**Interfaces:**
- Consumes: `loadIntentFile`, `loadPacks`, `compile`, `PlanV1`, `ValidationError` from `@dx-forge/forge-core`.
- Produces: root script `npm run dxforge -- <args>`; exit codes `0` ok, `1` validation errors, `2` bad input (unreadable/invalid intent, missing pack). `dxforge plan` writes `plan.yaml` only when there are no errors.
- `renderTree(plan): string` groups resources by layer with `✓` / `⛔` markers (used again by the wizard in plan 06).

- [ ] **Step 1: Write the failing test**

`apps/cli/test/cli.test.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { PlanV1 } from "@dx-forge/forge-core";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
function run(args: string[]): { code: number; out: string } {
  try {
    return { code: 0, out: execFileSync("npx", ["tsx", "apps/cli/src/index.ts", ...args], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, out: `${err.stdout}${err.stderr}` };
  }
}

describe("dxforge CLI", () => {
  const tmp = mkdtempSync(join(tmpdir(), "dxforge-"));

  it("plan writes a valid plan.yaml and prints the tree with gated I resources", () => {
    const out = join(tmp, "plan.yaml");
    const r = run(["plan", "-f", "examples/intent.example.yaml", "-o", out]);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain("[H]");
    expect(r.out).toContain("⛔ i.policy.cskh");
    expect(PlanV1.safeParse(parse(readFileSync(out, "utf8"))).success).toBe(true);
  });

  it("plan exits 1 and writes nothing when validation fails", () => {
    const intent = readFileSync(join(ROOT, "examples/intent.example.yaml"), "utf8");
    const packsDir = join(tmp, "packs");
    execFileSync("cp", ["-r", join(ROOT, "packs"), packsDir]);
    const bad = readFileSync(join(packsDir, "dx-ticket/pack.yaml"), "utf8").replace('A: ["{{process.actors.A}}"] }\n        - { from: assigned', 'A: [] }\n        - { from: assigned');
    writeFileSync(join(packsDir, "dx-ticket/pack.yaml"), bad);
    const intentFile = join(tmp, "intent.yaml");
    writeFileSync(intentFile, intent);
    const out = join(tmp, "bad-plan.yaml");
    const r = run(["plan", "-f", intentFile, "-o", out, "--packs-dir", packsDir]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("one_a");
    expect(existsSync(out)).toBe(false);
  });

  it("plan exits 2 on an invalid intent file", () => {
    const f = join(tmp, "broken.yaml");
    writeFileSync(f, "version: 2\n");
    const r = run(["plan", "-f", f]);
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/version/);
  });

  it("packs list shows core and dx-ticket", () => {
    const r = run(["packs", "list"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("dx-ticket");
    expect(r.out).toContain("core");
  });

  it("explain prints the reason, layer and gate of a resource", () => {
    const out = join(tmp, "plan2.yaml");
    run(["plan", "-f", "examples/intent.example.yaml", "-o", out]);
    const r = run(["explain", "i.policy.cskh", "-p", out]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("intel.agent_policy");
    expect(r.out).toContain("Lý do");
    expect(r.out).toMatch(/gate.*false/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/cli`
Expected: FAIL, `apps/cli/src/index.ts` not found.

- [ ] **Step 3: Package and entry**

`apps/cli/package.json`:
```json
{
  "name": "@dx-forge/cli",
  "version": "0.1.0",
  "license": "AGPL-3.0-or-later",
  "type": "module",
  "dependencies": {
    "@dx-forge/forge-core": "0.1.0",
    "@dx-forge/hpdi-engine": "0.1.0",
    "commander": "^13.0.0",
    "yaml": "^2.6.0"
  }
}
```
`apps/cli/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"], "references": [{ "path": "../../packages/forge-core" }, { "path": "../../packages/hpdi-engine" }] }
```
Root `package.json` scripts: add `"dxforge": "tsx apps/cli/src/index.ts"`. Run `npm install` so the workspace links resolve.

`apps/cli/src/index.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { Command } from "commander";
import { registerExplain } from "./commands/explain.js";
import { registerPacks } from "./commands/packs.js";
import { registerPlan } from "./commands/plan.js";

const program = new Command("dxforge").description("DX-Forge: compile an organisation into a running DX-OS").version("0.1.0");
registerPlan(program);
registerPacks(program);
registerExplain(program);
program.parseAsync(process.argv).catch((e: Error) => {
  console.error(e.message);
  process.exit(2);
});
```

- [ ] **Step 4: Tree renderer and commands**

`apps/cli/src/tree.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { LAYER_ORDER, type PlanV1 } from "@dx-forge/forge-core";

const LAYER_NAME = { H: "Hạ tầng", P: "Quy trình", D: "Dữ liệu", I: "Trí tuệ" } as const;

export function renderTree(plan: PlanV1): string {
  const lines: string[] = [];
  for (const layer of LAYER_ORDER) {
    const rs = plan.resources.filter((r) => r.layer === layer);
    if (rs.length === 0) continue;
    lines.push(`[${layer}] ${LAYER_NAME[layer]} (${rs.length})`);
    for (const r of rs) {
      lines.push(r.gate.allowed ? `  ✓ ${r.id}  ${r.type}` : `  ⛔ ${r.id}  ${r.type}  — ${r.gate.why ?? ""}`);
    }
  }
  return lines.join("\n");
}
```

`apps/cli/src/commands/plan.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Command } from "commander";
import { stringify } from "yaml";
import { ZodError } from "zod";
import { compile, loadIntentFile, loadPacks, type ValidationError } from "@dx-forge/forge-core";
import { renderTree } from "../tree.js";

export function registerPlan(program: Command): void {
  program
    .command("plan")
    .description("Sinh plan.yaml từ intent.yaml và các gói ngành")
    .requiredOption("-f, --file <intent>", "đường dẫn intent.yaml")
    .option("-o, --out <plan>", "đường dẫn plan.yaml", "plan.yaml")
    .option("--packs-dir <dir>", "thư mục gói ngành", resolve(process.cwd(), "packs"))
    .option("--no-ai", "bỏ qua bước AI đề xuất (chưa có trong bản này)")
    .action((opts: { file: string; out: string; packsDir: string }) => {
      process.exitCode = runPlan(opts);
    });
}

export function runPlan(opts: { file: string; out: string; packsDir: string }): number {
  let intent;
  try {
    intent = loadIntentFile(opts.file);
  } catch (e) {
    console.error(`Intent không hợp lệ: ${e instanceof ZodError ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : (e as Error).message}`);
    return 2;
  }
  let result;
  try {
    result = compile(intent, loadPacks(opts.packsDir));
  } catch (e) {
    console.error((e as Error).message);
    return 2;
  }
  console.log(renderTree(result.plan));
  if (result.errors.length > 0) {
    console.error(`\n${result.errors.length} lỗi validator:`);
    for (const err of result.errors) console.error(formatError(err));
    console.error("Không ghi plan. Sửa intent hoặc gói rồi chạy lại.");
    return 1;
  }
  writeFileSync(opts.out, stringify(result.plan));
  console.log(`\nĐã ghi ${opts.out} (${result.plan.resources.length} tài nguyên).`);
  return 0;
}

function formatError(e: ValidationError): string {
  return `  [${e.rule}] ${e.resourceId ?? "-"}: ${e.message}`;
}
```

`apps/cli/src/commands/packs.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { resolve } from "node:path";
import type { Command } from "commander";
import { loadPacks } from "@dx-forge/forge-core";

export function registerPacks(program: Command): void {
  const packs = program.command("packs").description("Quản lý gói ngành");
  packs
    .command("list")
    .option("--packs-dir <dir>", "thư mục gói ngành", resolve(process.cwd(), "packs"))
    .action((opts: { packsDir: string }) => {
      for (const { pack } of loadPacks(opts.packsDir).values()) {
        console.log(`${pack.id.padEnd(14)} ${pack.version.padEnd(6)} ${pack.scope.padEnd(8)} ${pack.resources.length} tài nguyên  ${pack.name}`);
      }
    });
}
```

`apps/cli/src/commands/explain.ts`:
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from "node:fs";
import type { Command } from "commander";
import { parse } from "yaml";
import { PlanV1 } from "@dx-forge/forge-core";

export function registerExplain(program: Command): void {
  program
    .command("explain <id>")
    .description("Giải thích một tài nguyên trong plan: lý do, phụ thuộc, cổng")
    .option("-p, --plan <plan>", "đường dẫn plan.yaml", "plan.yaml")
    .action((id: string, opts: { plan: string }) => {
      const plan = PlanV1.parse(parse(readFileSync(opts.plan, "utf8")));
      const r = plan.resources.find((x) => x.id === id);
      if (!r) {
        console.error(`Không có tài nguyên ${id} trong ${opts.plan}`);
        process.exitCode = 2;
        return;
      }
      console.log(`${r.id}  [${r.layer}] ${r.type}`);
      console.log(`Lý do: ${r.reason}`);
      console.log(`Phụ thuộc: ${r.depends_on.length ? r.depends_on.join(", ") : "(không)"}`);
      console.log(`Gate: allowed=${r.gate.allowed}${r.gate.why ? ` — ${r.gate.why}` : ""}`);
      if (r.source) console.log(`Nguồn: gói ${r.source.pack}${r.source.process ? `, quy trình ${r.source.process}` : ""}`);
    });
}
```

- [ ] **Step 5: README usage**

Replace the code block in `README.md` with:
```bash
npm install
npm test
npm run dxforge -- plan -f examples/intent.example.yaml -o plan.yaml
npm run dxforge -- explain i.policy.cskh -p plan.yaml
npm run dxforge -- packs list
```

- [ ] **Step 6: Run everything**

Run: `npm install && npm test && npm run typecheck`
Expected: all tests pass (CLI tests spawn tsx, allow ~10 s); typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add -A && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "feat(cli): dxforge plan, packs list and explain commands"
```

---

### Task 11: CI, open-source compliance documents, changelog

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/feature_request.md`, `.github/pull_request_template.md`, `DEPENDENCIES.md`, `BUILDING.md`, `CHANGELOG.md`, `CONTRIBUTING.md`

**Interfaces:**
- Produces: green CI on `develop`; open-source compliance documents that later plans append to.

- [ ] **Step 1: CI workflow**

`.github/workflows/ci.yml`:
```yaml
# SPDX-License-Identifier: AGPL-3.0-or-later
name: ci
on:
  push:
    branches: [develop, main]
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - name: SPDX headers present
        run: |
          missing=$(grep -rL "SPDX-License-Identifier: AGPL-3.0-or-later" --include='*.ts' packages apps || true)
          if [ -n "$missing" ]; then echo "$missing"; exit 1; fi
```

- [ ] **Step 2: Templates**

`.github/ISSUE_TEMPLATE/bug_report.md`:
```markdown
---
name: Bug report
about: Something in DX-Forge misbehaves
---
**Command / screen**:
**Intent or plan excerpt** (no credentials):
**Expected**:
**Actual** (paste output):
**Version** (`git rev-parse --short HEAD`):
```
`.github/ISSUE_TEMPLATE/feature_request.md`:
```markdown
---
name: Feature request
about: A pack, adapter, rule or screen you need
---
**Which stage** (measure / interview / plan / apply / verify / handbook):
**What should happen**:
**Which layer and resource type**:
**Why (business reason)**:
```
`.github/pull_request_template.md`:
```markdown
## What
## Why
## How verified
- [ ] `npm test` green
- [ ] `npm run typecheck` green
- [ ] SPDX header on new files
- [ ] CHANGELOG updated
```

- [ ] **Step 3: Open-source compliance documents**

`DEPENDENCIES.md`:
```markdown
# Dependencies

No third-party code is vendored or modified. All packages are fetched from npm at build time.

| Package | License | Used for |
|---|---|---|
| zod | MIT | schema validation (intent, plan, state, questionnaire) |
| yaml | ISC | reading/writing YAML files |
| commander | MIT | CLI argument parsing |
| typescript | Apache-2.0 | compiler (dev) |
| vitest | MIT | tests (dev) |
| tsx | MIT | running TypeScript without a build step (dev) |

Targets (Keycloak, Nextcloud, PostgreSQL, n8n, Appsmith, Metabase, Qdrant, Telegram, Mattermost, Google Workspace) are external systems DX-Forge talks to over HTTP; none of their code is included.
```

`BUILDING.md`:
```markdown
# Building and running

Requirements: Node 22+, npm 10+. No database, no Docker for this stage.

```bash
git clone <repo> dx-forge && cd dx-forge
npm ci
npm test              # vitest: engine, core, CLI
npm run typecheck
npm run dxforge -- plan -f examples/intent.example.yaml -o plan.yaml
```

Configuration is by environment variables only; none are needed for `plan`. Credentials for `apply` (later release) are read from the variable named in `target.credentials_ref` and never written to disk.
```

`CHANGELOG.md`:
```markdown
# Changelog

All notable changes to this project are documented here. Format: Keep a Changelog; versioning: SemVer.

## [Unreleased]
### Added
- hpdi-engine: questionnaire v1 (32 questions, 6 pillars, 3 tiers), scoring with tier discrepancy, supp coefficients, HPDI mapping, 4 shapes, DTI level, rule-based prescription.
- forge-core: IntentV1 / PlanV1 / StateV1 schemas, pack template loader, planner (rule-generated H/D/I + pack-generated P), validator (maturity gate + 6 rules), topological order, plan/state differ.
- packs: `core` (offboarding) and `dx-ticket`.
- cli: `dxforge plan`, `dxforge packs list`, `dxforge explain`.
```

`CONTRIBUTING.md`:
```markdown
# Contributing

- Branch from `develop`; `main` only receives tagged releases.
- Code, comments, tests and commit messages in English. Strings shown to end users are Vietnamese.
- Every source file starts with `// SPDX-License-Identifier: AGPL-3.0-or-later`.
- Tests first (vitest). A validator rule without a failing and a passing case is not done.
- Never commit credentials, `.dxforge/`, or generated `plan.yaml`.
- Commit messages: Conventional Commits (`feat(scope): ...`), one logical change per commit.
```

- [ ] **Step 4: Verify locally what CI will run, then commit**

```bash
npm ci && npm run typecheck && npm test && grep -rL "SPDX-License-Identifier" --include='*.ts' packages apps
```
Expected: tests pass, typecheck clean, the grep prints nothing.

```bash
git add -A && git -c user.name=maiychrus -c user.email=ninhkhuongpl7@gmail.com commit -m "chore: add CI workflow, issue and PR templates, PoF documents and changelog"
```

---

## Self-review

**Spec coverage (this plan's slice):**
- M0 spec §5.1–5.5 (questionnaire schema, scoring, mapping, shapes, prescription, golden tests): Tasks 2–4. §5.1 "≈30–36 câu, mỗi tầng 15–20": asserted by test. §5.2 weights, evidence weighting, discrepancy threshold, supp minimum: Task 3. §5.5 four goldens: Task 4.
- forge-core spec §1.1 schemas: Task 5 (maturity optional → `unmeasured` handled in Task 8). §1.2 planner steps 1 (template) and 2 (rules): Tasks 6–7; step 3 (AI patches) is plan 03 and has its insertion point named in `compile.ts`. §1.3 validator table, all seven rows: Task 8. §1.4 order H→P→D→I, checksum skip/update/create, `--prune` destroy: Task 9 (the apply loop, resume and `--dry-run` printing belong to plan 04 with the first provider). §1.5 verify: `Check` type in Task 5; adapters are plan 04.
- Master spec §3.1/3.2 intent and plan shapes, resource types by layer: Tasks 5–7. §4 layout `packages/forge-core`, `packages/hpdi-engine`, `packs/`, `apps/cli`: Task 1. §6 CLI `plan`, `packs list`: Task 10; `explain` added as the "AI giải thích" fallback. §7 open-source compliance (license, SPDX, notice, DEPENDENCIES, BUILDING, CHANGELOG, templates, CI): Tasks 1 and 11. §7 tests "validator 20 ca", "hpdi golden", "planner snapshot", "differ": Tasks 4, 7, 8, 9.
- Not in this plan (by design, see series): wizard, Prisma, survey UI, AI adapters, providers, handbook, gws, manifest, Playwright, compose.

**Placeholder scan:** no TBD/TODO; every code step has full code; the only deferred items are marked `ponytail:` with the plan number that picks them up.

**Type consistency:** `Resource.gate` default `{ allowed: true }` is relied on by Task 7 tests and Task 9; `LAYER_ORDER` defined in Task 9 and imported by Task 10; `compile()` signature `(intent, packs, now?)` used identically in Tasks 8, 9, 10; rule names in Task 8's `RULES` match the strings asserted in the Task 8 and Task 10 tests; `resourceChecksum` hashes `{type, spec}` in Task 9 and the differ test constructs state with the same function. Pack-referenced ids `h.topic.alerts|approvals|announce` are produced by `layerH` in Task 7.
