# DX-Forge — Spec M0 (giai đoạn `measure`): Đo lường DTI/HPDI

Giai đoạn đầu của đường ống DX-Forge (xem `2026-09-09-dx-forge-design.md`). ResultV1 là đầu vào bắt buộc của `interview` và `plan`, và là tham số của cổng trưởng thành. Là nội dung chính của ảnh chụp v0.1.0 nộp ICTU 30/09/2026. Tên module giữ là DX-Pulse.

Ngày: 2026-09-09. Trạng thái: đã duyệt qua thảo luận, chờ người dùng rà soát văn bản.

## 1. Bối cảnh và mục tiêu

- Cuộc thi: "Phát triển phần mềm mã nguồn mở tích hợp AI 2026" (Khoa CNTT, ICTU). Nộp kho mã 01/07–30/09/2026, chấm 01–08/10, chung kết 10/10/2026. Bảng điểm: 50 điểm PoF (chấm trước) + 50 điểm sản phẩm (nguyên gốc 10, hoàn thiện 10, thân thiện 10, tích hợp AI 10, trình diễn 10).
- Đường dài: OLP PMNM quốc gia tháng 12/2026, chủ đề "Xây dựng Hệ điều hành Doanh nghiệp số (DX-OS) dựa trên kiến trúc Open-Core", đề chính thức ra tháng 11. M0 là module đầu tiên của nền tảng và là nội dung chính của ảnh chụp v0.1.0 nộp ICTU 30/09.
- Sản phẩm tham chiếu: ICTU_Proteus-os là nền tảng vận hành; DX-Forge là bộ biên dịch sinh ra nền tảng. Phần đo lường này Proteus không có.
- Góc khác biệt của DX-Pulse: số hoá Phần I của sách "Xây dựng Hệ điều hành Doanh nghiệp số: Từ Tư duy đến Hành động" (TS. Tạ Tuấn Anh, FDS, CC BY 4.0) thành công cụ "bắt mạch" tổ chức, AI kê đơn lộ trình, sinh bộ kỷ luật P.A.R.A/Poka-yoke. Nhỏ, chạy trên 1 container, cài 5 phút.
- Ghi công: mọi nơi dùng phương pháp luận của sách phải ghi nguồn theo CC BY 4.0 (README, LICENSE_NOTICE, màn hình "Về DX-Pulse").

## 2. Phạm vi M0 (5 khối)

1. Khảo sát DTI 360°: 6 trụ cột (Chiến lược, Văn hoá, Khách hàng, Vận hành, Công nghệ, Dữ liệu), phát link ẩn danh cho 3 tầng (executive, manager, staff), đo độ vênh giữa tầng.
2. Engine HPDI: ánh xạ điểm DTI + hệ số thực chứng ra P/D/I/H, vẽ radar, phân loại 4 hình dạng, mức DTI 1–5.
3. AI kê đơn: lộ trình theo trật tự P → D → I, câu hỏi đối chất khi vênh tầng, ma trận 5 RÕ và danh sách Poka-yoke cho quy trình lõi người dùng chọn, "hỏi báo cáo".
4. Bộ kỷ luật tải về: zip gồm cây thư mục P.A.R.A theo phòng ban/dự án, README mỗi nhánh, quy ước đặt tên, templates, Poka-yoke.md, 5RO.md; xem trước cây trên web.
5. Theo dõi theo thời gian: nhiều đợt đo cho một tổ chức, biểu đồ radar/đường chồng theo vòng.

Ngoài phạm vi M0 (thuộc các giai đoạn interview/plan/apply): viết intent, sinh plan, cấp phát lên đích. M0 chỉ phụ thuộc đăng nhập wizard và notifier.

## 3. Kiến trúc

Hướng A đã chọn: Next.js full-stack, một container.

```
dx-pulse/
├── apps/web/                 # Next.js 15 App Router (UI + route handlers)
│   ├── src/app/              # pages + API routes
│   ├── src/lib/ai/           # LlmProvider + adapters (gemini, anthropic, ollama)
│   ├── src/lib/kit/          # P.A.R.A zip generator
│   ├── src/lib/db/           # Prisma client
│   └── prisma/schema.prisma
├── packages/hpdi-engine/     # TypeScript thuần, không phụ thuộc Next/DB
│   ├── src/questionnaire/    # schema + questionnaire.v1.json
│   ├── src/scoring.ts        # điểm trụ cột theo tầng, độ vênh
│   ├── src/mapping.ts        # DTI → HPDI
│   ├── src/shape.ts          # 4 hình dạng, mức DTI, kê đơn rule-based
│   └── test/                 # vitest, golden cases
├── docs/                     # BRD, architecture, ADR, screenshots, PoF
├── deploy/                   # docker-compose.yml, .env.example
└── LICENSE, LICENSE_NOTICE.md, DEPENDENCIES.md, BUILDING.md, CHANGELOG.md, DESIGN.md
```

- Monorepo npm workspaces theo spec tổng.
- Engine là gói riêng, không phụ thuộc Next/DB, để nhúng vào nơi khác mà không kéo theo UI.
- Prisma trên SQLite `.dxforge/wizard.db` (Forge nhẹ; Postgres là của đích). Artifacts (zip) nằm trong `.dxforge/artifacts`. Kit zip là đường tắt cho người chưa có đích; đường chính là `plan` + `apply`.
- Auth: đăng nhập wizard bằng mật khẩu quản trị (`FORGE_ADMIN_PASSWORD`) hoặc OIDC nếu đích oss đã có Keycloak. Khảo sát không cần đăng nhập, chỉ cần token link.
- Một thư mục làm việc `.dxforge/` = một tổ chức; hồ sơ tổ chức là bản ghi đơn trong wizard.db và được chép sang `intent.organization`.

## 4. Mô hình dữ liệu (Prisma)

| Bảng | Trường chính | Ghi chú |
|---|---|---|
| assessments | id, round (int, tăng dần), questionnaireVersion, status (open/closed), coreProcess (text, nullable), createdBy (keycloak sub), createdAt, closedAt | schema `pulse` |
| survey_links | id, assessmentId, tier (executive/manager/staff), token (unique), expiresAt | 3 link/đợt |
| responses | id, surveyLinkId, answers JSON, freeText, submittedAt | ẩn danh, không lưu IP |
| results | id, assessmentId (unique), payload JSON, engineVersion, computedAt | payload = ResultV1 (mục 5.4) |
| prescriptions | id, assessmentId, kind (roadmap/discrepancy/fiveRo/pokaYoke), provider, model, payload JSON, fallback (bool), tokensIn, tokensOut, latencyMs, createdAt | mỗi lần sinh một bản ghi |
| artifacts | id, assessmentId, kind (para-kit), path, sizeBytes, createdAt | zip lưu trong ./data/artifacts |
| llm_calls | id, provider, model, purpose, ok, fallback, tokensIn, tokensOut, latencyMs, createdAt | phục vụ bảng số liệu "tích hợp AI" |

Ràng buộc: unique (assessmentId, tier) trên survey_links; unique (round). Khi chốt đợt đo phát sự kiện `pulse.assessment.closed` (payload ResultV1) và gửi thông báo qua notifier kênh `announce`.

## 5. Engine HPDI

### 5.1 Bộ câu hỏi (dữ liệu, có phiên bản)

`questionnaire.v1.json` — schema:

```ts
type Question = {
  id: string;                 // "OPS-03"
  pillar: "strategy"|"culture"|"customer"|"operations"|"technology"|"data";
  tiers: ("executive"|"manager"|"staff")[];   // ai được hỏi
  type: "scale"|"choice"|"supp";
  text: string;               // tiếng Việt, hiển thị
  options?: { value: number; label: string }[];   // choice/supp
  max: number;                // điểm tối đa của câu
  supp?: { axis: "P"|"D"|"I" };  // câu thực chứng, value là hệ số 0/0.33/0.5/0.66/1
  weightEvidence?: boolean;   // câu "thao tác thực tế", nghiêng trọng số về staff
};
```

- v1 tự soạn: kế thừa cấu trúc 6 trụ cột của QĐ 1567/QĐ-BKHCN và 3 câu thực chứng chương 2.6 của sách. Giả định nêu rõ trong docs: chưa có bộ tiêu chí gốc; khi có, thay tệp JSON, engine không đổi. Khoảng 30–36 câu, mỗi tầng trả lời 15–20 câu, dưới 8 phút.
- Hệ số Supp theo sách: P_supp ∈ {0.33, 0.66, 1}; D_supp ∈ {0, 0.5, 1}; I_supp ∈ {0, 0.33, 0.66, 1}.

### 5.2 Tính điểm

- Điểm trụ cột theo tầng: tổng điểm câu / tổng max, chỉ trên câu tầng đó được hỏi. Cần tối thiểu 1 phản hồi/tầng để tính tầng đó; đợt đo tính được khi có ít nhất tầng executive và staff.
- Điểm hợp nhất mỗi trụ cột: trung bình có trọng số tầng {executive 0.25, manager 0.25, staff 0.5}; với câu `weightEvidence` chỉ lấy staff (nếu có).
- Độ vênh (discrepancy) mỗi trụ cột: max − min giữa các tầng có dữ liệu, theo thang 0–1. Ngưỡng cảnh báo 0.3.
- Supp mỗi trục: giá trị **thấp nhất** giữa các tầng (chống bệnh thành tích).

### 5.3 Ánh xạ HPDI (đúng chương 2.3–2.4)

- Nguồn: P ← operations, customer; D ← data; I ← technology (câu AI/ML) + câu supp I. H không có nguồn, là phần dư.
- `P% = (scoreP/maxP) × P_supp × 30`; tương tự D, I. `H% = 100 − (P+D+I)`.
- Mức DTI: tính điểm DTI tổng 0–100 (trung bình 6 trụ cột × 100) rồi tra bảng 0–10, 10–30, 30–70, 70–90, 90–100.

### 5.4 Hình dạng và kê đơn rule-based

| Hình dạng | Luật |
|---|---|
| spear (mũi giáo) | H ≥ 75 |
| kite (cánh diều lệch) | H < 75 và P ≥ 20 và D < 10 và I < 10 |
| illusion (ảo giác công nghệ) | H ≥ 60 và (I ≥ 10 hoặc D ≥ 10) và P < 20 |
| diamond (kim cương) | H ≤ 25 và P, D, I mỗi trục ≥ 20 |
| transitional | còn lại |

Kê đơn rule-based (fallback): bảng 3 đơn thuốc chương 2.5.3 + hướng dẫn P → D → I. Kết quả engine:

```ts
type ResultV1 = {
  engineVersion: "1.0";
  pillars: Record<Pillar, { byTier: Partial<Record<Tier, number>>; merged: number; discrepancy: number }>;
  supp: { P: number; D: number; I: number };
  hpdi: { H: number; P: number; D: number; I: number };
  dtiScore: number; dtiLevel: 1|2|3|4|5;
  shape: "spear"|"kite"|"illusion"|"diamond"|"transitional";
  responseCounts: Record<Tier, number>;
  ruleBasedPrescription: { focusAxis: "P"|"D"|"I"; steps: string[] };
};
```

### 5.5 Test golden (vitest)

- Ví dụ sách: P đạt tối đa nhưng P_supp 0.33, D_supp 0, I_supp 0 → P=10, D=0, I=0, H=90, shape spear, level 1.
- Kim cương: mọi trục tối đa, supp = 1 → P=D=I=30, H=10, diamond, level 5.
- Ca đối chứng: không có phản hồi → ném lỗi `InsufficientResponses`, không trả 0. Thiếu tầng staff → lỗi tương tự.
- Vênh: executive trả lời cao, staff thấp → discrepancy > 0.3 và merged nghiêng về staff.

## 6. Lớp AI

### 6.1 Provider

```ts
interface LlmProvider { complete(req: { system: string; user: string; jsonSchema: ZodSchema; maxTokens: number }): Promise<{ text: string; tokensIn: number; tokensOut: number }>; }
```

Adapter: `gemini` (Google AI Studio API), `anthropic` (Messages API), `ollama` (`/api/chat`, mặc định `qwen2.5:7b`). Chọn bằng `LLM_PROVIDER`; key/URL qua biến môi trường. Không có key → provider `none`, mọi tính năng chạy fallback.

### 6.2 Bốn tác vụ

| Tác vụ | Đầu vào | Đầu ra (zod) | Fallback |
|---|---|---|---|
| roadmap | ResultV1 + freeText + sector | `{ focusAxis, diagnosis, phases:[{name, axis, actions[], kpis[]}], warnings[] }` | ruleBasedPrescription |
| discrepancy | pillars có discrepancy > 0.3 | `{ questions:[{pillar, forTier, question, why}] }` | câu hỏi mẫu theo trụ cột |
| fiveRo | coreProcess + ResultV1 | `{ process, steps:[{step, role_R, role_A, role_C, role_I, standard, tool}], pokaYoke:[{point, rule, layer}] }` | template chung theo DX-Ticket |
| askReport | câu hỏi người dùng + ResultV1 + roadmap | `{ answer, citedFields[] }` | "Tính năng cần khoá API" |

- Prompt hệ thống viết theo khung 5 RÕ (vai trò, bối cảnh là JSON kết quả, hành động, định dạng JSON, ranh giới: không bịa số ngoài JSON, không khuyên mua phần mềm cụ thể, không nhảy cóc trật tự P→D→I).
- Validate zod; sai schema → retry 1 lần với thông báo lỗi; vẫn sai → fallback, đánh dấu `fallback=true`.
- Mọi lời gọi ghi `llm_calls`. Trang admin có bảng: số lời gọi, tỷ lệ hợp lệ lần đầu, độ trễ trung bình, token, tỷ lệ fallback theo provider.
- Không gửi dữ liệu định danh: chỉ gửi điểm số, ngành, quy mô, freeText đã cắt tối đa 2.000 ký tự.

## 7. Bộ kỷ luật tải về (P.A.R.A kit)

Đầu vào: departments của tổ chức, danh sách dự án đang chạy (nhập tay tại bước tạo kit), coreProcess. Đầu ra zip (jszip) — cấu trúc theo chương 5.3 và 7.3.3 của sách:

```
[ORG] DX-OS/
├── 1. [P] PROJECTS/<mỗi dự án>/README.md
├── 2. [A] AREAS/<mỗi phòng ban>/README.md
├── 3. [R] RESOURCES/
│   ├── 10. GOVERNANCE/{11. Policies_Regulations, 12. SOP_Processes, 13. Technical_Manuals, 14. Templates_Forms}
│   ├── 20. EXPERIENCE/{21..24}
│   ├── 30. EDUCATION/{31..34}
│   └── 40. ASSETS/{41. Structured_Data, 42. Unstructured_Data, 43. Brand_Media, 44. Versioned_Assets}
├── 4. [A] ARCHIVES/README.md
├── NAMING_CONVENTION.md     # hai kịch bản đặt tên của chương 5.3.2
├── POKA_YOKE.md             # từ tác vụ fiveRo (hoặc template)
└── 5RO_<coreProcess>.md
```

Xem trước dạng cây trên web trước khi tải. Artifact lưu `./data/artifacts/<assessmentId>/para-kit.zip`.

## 8. Giao diện

Trang (dưới `/pulse`): `/pulse` dashboard tổ chức (lịch sử radar theo vòng, nút mở đợt mới); `/pulse/a/[id]` dashboard đợt đo (radar 4 trục Recharts, 3 lớp theo tầng có bật/tắt, badge hình dạng, mức DTI, bảng trụ cột với cột độ vênh, số phản hồi theo tầng, nút "Chốt đợt đo"); `/pulse/a/[id]/prescription` (roadmap, câu đối chất, fiveRo, hộp hỏi báo cáo); `/pulse/a/[id]/kit` (form phòng ban/dự án, xem trước cây, tải zip); `/pulse/s/[token]` khảo sát (mobile-first, một câu mỗi màn, tiến trình, lưu nháp localStorage); `/about` ghi công sách và giấy phép.

DESIGN.md tạo trước khi làm UI: token màu sáng/tối, chữ, khoảng cách; radar dùng cùng bảng màu 4 trục cố định (H xám, P xanh lá, D cam, I tím) ở mọi biểu đồ.

## 9. Hạ tầng và PoF

- Giấy phép AGPL-3.0-or-later; header SPDX ở dòng đầu mọi tệp mã (ts, tsx, js, sql, sh); LICENSE toàn văn; LICENSE_NOTICE.md nêu mục đích + ma trận tương thích + ghi công sách CC BY 4.0.
- DEPENDENCIES.md: danh mục gói, không vendor, không sửa mã bên thứ ba. BUILDING.md: Docker và bare-metal (Node 22+), cấu hình chỉ qua `.env`.
- Hạ tầng theo spec tổng (compose profile `core` là đủ cho M0). Ảnh chụp 30/09 chạy profile `core` trên VPS riêng, không dùng VPS AHV.
- CI GitHub Actions: lint, typecheck, vitest, build, Playwright smoke. Issue templates (bug, feature), PR template, CHANGELOG theo Keep a Changelog, release v1.0.0 tag + tar.gz trước 30/09.
- Quy ước: mã, chú thích, commit tiếng Anh; chuỗi giao diện tiếng Việt. Nhánh `develop` làm việc, `main` chỉ nhận merge có tag.

## 10. Kiểm thử và nghiệm thu

- Engine: vitest, golden cases mục 5.5, coverage ≥ 90% cho packages/hpdi-engine.
- E2E Playwright: đăng ký → tạo tổ chức → mở đợt đo → điền 3 tầng → chốt → thấy radar đúng số kỳ vọng → sinh roadmap (provider `none`, kiểm fallback) → tải kit, kiểm zip có đủ nhánh.
- Stress 2 vòng trước khi nộp, mỗi vòng desktop 1440 và mobile 375: không tràn ngang, sáng/tối nhất quán, khảo sát điền xong dưới 8 phút.
- Tiêu chí xong M0: compose `core` lên từ clone sạch dưới 10 phút; 50/50 PoF tự chấm có minh chứng; demo trên VPS công khai; video 3 phút cho ICTU.

## 11. Lịch (trích từ spec tổng, luồng A)

| Ngày | Việc |
|---|---|
| 10–12/09 | Repo, PoF skeleton, workspaces, Prisma, auth, DESIGN.md; engine schema + scoring + mapping + test golden |
| 13–16/09 | questionnaire.v1.json, trang khảo sát, chốt đợt đo, dashboard radar |
| 17–20/09 | Lớp AI (3 adapter, zod, fallback, llm_calls), trang kê đơn, askReport |
| 21–23/09 | P.A.R.A kit + xem trước, lịch sử theo vòng, trang about/ghi công |
| 24–26/09 | Docs (BRD, architecture, ADR, PoF compliance), Dockerfile/compose, VPS, CI xanh |
| 27–28/09 | Stress 2 vòng, sửa lỗi, video, release v1.0.0 |
| 29–30/09 | Dự phòng, nộp form |

## 12. Rủi ro

- Không có bộ câu hỏi QĐ 1567 gốc → v1 tự soạn, ghi rõ; thay JSON khi có.
- Tiếng Việt của Ollama 7B yếu → demo chính dùng Gemini/Anthropic, Ollama là minh chứng nguồn mở.
- Giám khảo so với Proteus về độ "to" → trình bày bằng bảng đối chiếu: Proteus không đo được gì, DX-Pulse là bước 0 bắt buộc trước mọi DX-Lab; M0 chạy được trên profile `core`.
- Quỹ giờ đội sinh viên → khối 5 (lịch sử) và askReport là hai thứ cắt đầu tiên nếu trễ.

## 13. Giao diện với các giai đoạn khác

- `GET /api/pulse/latest` trả ResultV1 + shape + level; `interview` nạp vào `intent.maturity`; validator dùng để mở hoặc khoá lớp H/P/D/I trong plan.
- Wizard chuyển thẳng từ màn kê đơn sang màn phỏng vấn với ngữ cảnh đã điền (tổ chức, phòng ban, quy trình lõi).
- Notifier của Forge chỉ dùng để gửi link khảo sát và báo chốt đợt; kênh lấy từ `intent.channels` nếu có, hoặc cấu hình tạm trong wizard.
