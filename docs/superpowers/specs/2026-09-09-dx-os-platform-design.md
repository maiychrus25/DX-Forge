# DX-Pulse — Spec tổng nền tảng DX-OS (OLP PMNM 12/2026)

Ngày: 2026-09-09. Trạng thái: đã duyệt các quyết định lớn qua thảo luận, chờ rà soát văn bản.
Tài liệu con: `2026-09-09-m0-measurement-design.md` (M0), `2026-09-09-m1-workspace-design.md` (M1). M2–M5 viết khi bắt đầu module.

## 1. Mục tiêu và bối cảnh

- Đích chính: OLP Phần mềm nguồn mở 2026, chủ đề "Xây dựng Hệ điều hành Doanh nghiệp số (DX-OS) dựa trên kiến trúc Open-Core". Đề chính thức ra tháng 11/2026; chấm kho mã 07–09/12; chung kết 10/12. Đội tối đa 3 sinh viên + 1 giảng viên, mỗi trường tối đa 2 đội.
- Mốc phụ: vòng ICTU "PMNM tích hợp AI 2026", nộp 30/09/2026, chung kết 10/10. Nộp ảnh chụp trạng thái lúc đó (tag v0.1.0), không đổi ưu tiên.
- Ban tổ chức OLP gợi ý rõ ba trục kế thừa: low-code (OLP 2024), dữ liệu mở liên kết LOD (OLP 2025), LLM + RAG (OLP 2023), và yêu cầu DX-Lab mô phỏng đủ 4 không gian H-P-D-I.
- Đối thủ tham chiếu: ICTU_Proteus-os (cùng bộ công cụ). Proteus không có đo lường (Phần I sách), P.A.R.A và LOD chỉ trên giấy, cần 16–32GB.
- Phương pháp luận gốc: sách "Xây dựng Hệ điều hành Doanh nghiệp số: Từ Tư duy đến Hành động" (TS. Tạ Tuấn Anh, FDS, CC BY 4.0). Ghi công ở README, LICENSE_NOTICE, trang About. FDS là nhà tài trợ VFOSSA; ghi công đúng là điểm cộng.

## 2. Nguyên tắc khác biệt (đưa vào mọi bài trình bày)

1. **Đo trước, lắp sau.** M0 cho tổ chức biết mình đang ở đâu trên trục HPDI rồi mới bật module. Proteus lắp trước, không đo.
2. **P.A.R.A chạy thật.** Cây thư mục, phân quyền, quy ước tên được cấp phát và kiểm tra tự động trên Nextcloud, không phải mô tả.
3. **LOD chạy thật.** Thực thể lõi (tổ chức, phòng ban, người, ticket, khách hàng) có JSON-LD context, endpoint xuất theo LOD, catalog siêu dữ liệu. Đáp trục OLP 2025.
4. **Một doanh nghiệp một bản cài.** DX-Lab là hộp cát của một tổ chức. Không realm đa thuê, không RLS theo tenant. Đơn giản hơn Proteus 30–40% khối lượng.
5. **Ghi công minh bạch** và cấu hình hoàn toàn qua `.env`.

## 3. Kiến trúc tổng

```
                    ┌──────────── Traefik (80/443, path routing) ────────────┐
                    │                                                         │
   ┌────────────────▼──────────────┐    ┌─────────────┐   ┌────────────────┐  │
   │ web (Next.js) — "DX-Core"     │    │ Keycloak    │   │ n8n            │  │
   │  /            Launchpad+Portal│◄──►│ realm dxlab │   │ workflows      │  │
   │  /pulse       M0 đo lường     │    └─────────────┘   └───────┬────────┘  │
   │  /api/*       Core API        │◄─────────── webhooks/callbacks ┘         │
   │  provisioner, notifier, LOD   │                                          │
   └───┬───────┬───────┬───────┬───┘                                          │
       │       │       │       │                                              │
   Postgres  Nextcloud Appsmith Metabase   Qdrant   Mattermost(optional)      │
   (+pgvector│(P.A.R.A)│(forms) │(BI)      (RAG)    Telegram bot (default)    │
    optional)│         │        │                                             │
```

- **DX-Core (web)**: Next.js 15 App Router, một container, chứa Launchpad/Portal, M0, Core API, provisioner (Keycloak + Nextcloud + Telegram/Mattermost), notifier, LOD endpoints, AI orchestrator (M4). Là toàn bộ "Innovation Layer" tự viết.
- **Dịch vụ ghép** (không sửa mã): Keycloak (SSO), Nextcloud (lưu trữ P.A.R.A), n8n (workflow), Appsmith (form/app nghiệp vụ), Metabase (dashboard), Qdrant (vector), Mattermost (tuỳ chọn), Postgres (dùng chung cho core + nghiệp vụ, schema tách), Traefik.
- **Compose profiles**: `core` = traefik, postgres, keycloak, web, n8n, nextcloud (≈6GB); `full` = + appsmith, metabase, qdrant; `chat` = + mattermost; `local-llm` = + ollama. Demo tháng 12 chạy `full` trên VPS 8 vCPU/16GB.

## 4. Ranh giới module và giao diện

| Module | Sở hữu | Cung cấp cho module khác | Phụ thuộc |
|---|---|---|---|
| M0 Đo lường | schema `pulse` trong Postgres; `packages/hpdi-engine` | `GET /api/pulse/latest` (ResultV1, shape, level) để Launchpad gợi ý module; sự kiện `pulse.assessment.closed` | Keycloak (đăng nhập), notifier |
| M1 [H] | Keycloak realm + roles + groups; Nextcloud cây P.A.R.A + share; Portal; `Notifier`; sự kiện offboarding | `provisioner.ensureUser/ensureDepartment/offboard`; `notifier.send(channelKey, msg)`; `resources.listTree()`; `resources.exportToResources(file)` | Keycloak, Nextcloud, Telegram/Mattermost |
| M2 [P] | schema `biz` (DX-Ticket), Appsmith app, n8n workflows, Poka-yoke rules, bảng `events` | webhooks `n8n/*`; `POST /api/events` (sự kiện chuẩn hoá); `GET /api/biz/tickets` | M1 (notifier, roles), Postgres, Appsmith, n8n |
| M3 [D] | Metabase dashboards, snapshot job, JSON-LD catalog `lod`, `/api/lod/*` | `GET /api/lod/{type}/{id}` (JSON-LD), `/api/lod/catalog`; snapshot CSV vào `40. ASSETS/41. Structured_Data` | M1 (Nextcloud), M2 (dữ liệu), Metabase |
| M4 [I] | Qdrant collection `resources`, ingest job, DSL + validator, agent HITL | `POST /api/ai/ask` (RAG), `POST /api/ai/command` (DSL → n8n, chờ duyệt qua notifier) | M1 (Resources, notifier), M2 (events, webhooks), M3 (LOD làm ngữ cảnh), Qdrant, LLM provider |
| M5 Vỏ | Launchpad, cài đặt một lệnh, docs PoF, video | — | tất cả |

Quy ước chung:
- Một gói `packages/contracts` chứa kiểu TypeScript + zod của mọi payload chéo module (ResultV1, Event, DslCommand, LodEntity). Module không import lẫn nhau ngoài `contracts`.
- Sự kiện: bảng `core.events (id, type, payload jsonb, source, created_at, delivered_at)`; DX-Core ghi rồi gọi webhook n8n; n8n gọi lại `POST /api/events/{id}/ack`. Không dùng Redis (ADR-001: một dịch vụ ít hơn, khối lượng sự kiện nhỏ, có audit sẵn).
- Định danh: mọi dịch vụ hỗ trợ OIDC dùng realm `dxlab`. Dịch vụ không hỗ trợ OIDC ở bản cộng đồng (Appsmith CE, Metabase OSS, Mattermost Team) dùng tài khoản riêng do provisioner tạo qua API + nhúng iframe trong Portal. Ghi rõ trong docs để giám khảo thấy hiểu giới hạn.
- Vai trò Keycloak: `dx-admin`, `manager`, `staff`. Nhóm = phòng ban. Vai trò và nhóm là nguồn sự thật cho phân quyền Nextcloud và bộ lọc dữ liệu Appsmith.

## 5. Dữ liệu và LOD

- Postgres một instance, schema: `core` (users cache, events, settings), `pulse` (M0), `biz` (M2, đổi theo đề tháng 11), `lod` (M3 catalog). Prisma cho `core`+`pulse`; SQL migration thuần cho `biz` (để Appsmith/Metabase/n8n đọc thẳng).
- LOD: mỗi thực thể lõi có `@context` riêng (schema.org cho Organization/Person/Department; từ vựng `dxos:` tự định nghĩa cho Ticket, Customer, Assessment, HpdiResult). Endpoint content negotiation `Accept: application/ld+json`. Catalog `lod.entities` lưu URI, type, updated_at để làm "Nguồn sự thật duy nhất" và làm ngữ cảnh cho RAG.
- Snapshot: cuối tháng, job xuất `biz.*` ra CSV + JSON-LD vào Nextcloud `41. Structured_Data` (chương 7.6.3 sách).

## 6. AI xuyên suốt

- `LlmProvider` một interface, adapter gemini / anthropic / ollama, chọn bằng `LLM_PROVIDER`; `none` → fallback rule-based. Mọi lời gọi ghi `core.llm_calls`.
- M0: kê đơn, đối chất, 5 RÕ. M4: RAG trên Resources (Qdrant), tác tử DSL có whitelist + HITL qua notifier. Không cho AI ghi dữ liệu nghiệp vụ nếu chưa có nút duyệt.
- Bảng số liệu "tích hợp AI" xuất từ `llm_calls` cho bài trình bày.

## 7. PoF và quy ước kỹ thuật

- AGPL-3.0-or-later, SPDX header mọi tệp mã, LICENSE toàn văn, LICENSE_NOTICE (mục đích + ma trận tương thích + ghi công CC BY 4.0), DEPENDENCIES.md (không vendor, không sửa mã bên thứ ba), BUILDING.md, CHANGELOG (Keep a Changelog), Issue/PR template, CI (lint, typecheck, vitest, build, Playwright smoke), release tag + tar.gz.
- Monorepo npm workspaces: `apps/web`, `packages/hpdi-engine`, `packages/contracts`, `deploy/`, `plugins/dx-ticket/` (SQL, appsmith export, n8n json, metabase json), `docs/`.
- Mã, chú thích, commit tiếng Anh; chuỗi UI tiếng Việt. Nhánh `develop`, `main` chỉ nhận merge có tag. Không mã AHV nào được đưa vào.
- DESIGN.md trước khi làm UI; sáng/tối nhất quán; mobile-first cho khảo sát và Portal.

## 8. Lịch 13 tuần (3 luồng AI agent song song, 3 người thật duyệt)

Nhân lực: 6 AI coding agent chia 3 luồng (A, B, C), mỗi luồng một agent thực thi + một agent review theo kế hoạch của từng module; 3 thành viên đứng tên chịu trách nhiệm duyệt merge, chạy demo, trình bày. Mọi PR của agent phải qua một người thật duyệt trước khi vào `develop`.

| Tuần | Luồng A (Core/M0) | Luồng B (M1/hạ tầng) | Luồng C (M2→M3→M4) |
|---|---|---|---|
| T1 10–16/09 | repo, PoF skeleton, contracts, engine + test golden | compose `core`, Keycloak realm, Traefik, web auth OIDC | học Appsmith/n8n, dựng schema `biz` DX-Ticket nháp |
| T2 17–23/09 | khảo sát 360°, radar, chốt đợt đo | Nextcloud + provisioner P.A.R.A, notifier Telegram | Appsmith app DX-Ticket v0, n8n webhook mẫu |
| T3 24–30/09 | AI kê đơn + kit; **tag v0.1.0, nộp ICTU 30/09** | Portal v1, offboarding | Poka-yoke lớp 1+2 |
| T4 01–07/10 | sửa theo phản hồi, docs M0 | Mattermost adapter, kiểm tra quy ước tên | events + n8n workflows (mở/đóng/khiếu nại) |
| T5 08–14/10 | **chung kết ICTU 10/10**; LOD context cho pulse | ADR, BUILDING, CI xanh | M2 hoàn thiện, E2E DX-Ticket |
| T6–T7 15–28/10 | Launchpad đọc `pulse/latest` gợi ý module | Metabase, snapshot job | M3: dashboards, `/api/lod/*`, catalog |
| T8–T9 29/10–11/11 | AI "hỏi báo cáo" dùng LOD | Qdrant, ingest Resources | M4: RAG, DSL, HITL |
| T10 12–18/11 | **đề chính thức**: điều chỉnh `biz` và bài mẫu | compose `full` trên VPS 16GB | tác tử theo đề |
| T11 19–25/11 | stress vòng 1 (desktop + mobile) | docs PoF, video | sửa lỗi |
| T12 26/11–02/12 | stress vòng 2, release v1.0.0 | landing page, showcase | trình diễn thử |
| T13 03–06/12 | dự phòng, nộp | | |

Luồng C không chờ luồng B: T1–T2 làm trên Postgres + Appsmith cục bộ, ghép SSO ở T3.

## 9. Rủi ro

- Dịch vụ CE thiếu OIDC → đã có phương án tài khoản riêng + iframe; nêu rõ trong docs.
- 16GB đủ chạy nhưng laptop dev cần ≥16GB; profile `core` cho dev.
- Đề tháng 11 đổi bài mẫu → chỉ `plugins/dx-ticket` và schema `biz` đổi; các module khác neo vào contracts.
- Mã do AI agent sinh → mọi PR phải được người thật đọc hiểu và duyệt; khi trình bày phải giải thích được từng phần kiến trúc. Ghi quy trình này trong CONTRIBUTING.md.
- Trùng bộ công cụ với Proteus → mọi demo mở đầu bằng M0 và kết thúc bằng LOD + P.A.R.A chạy thật.
