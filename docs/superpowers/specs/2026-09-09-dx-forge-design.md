# DX-Forge — Spec tổng (OLP PMNM 12/2026)

Ngày: 2026-09-09 (thay thế spec nền tảng cũ sau khi đổi ý tưởng lõi). Trạng thái: đã duyệt qua thảo luận, chờ rà soát văn bản.
Tài liệu con: `2026-09-09-m0-measurement-design.md` (giai đoạn measure), `2026-09-09-forge-core-oss-provider-design.md` (engine + provider oss lớp [H]).

## 1. Ý tưởng lõi và khác biệt

DX-Forge là **bộ biên dịch hệ điều hành doanh nghiệp số**: đo tổ chức, phỏng vấn ra đặc tả, sinh kế hoạch chi tiết theo 4 lớp H-P-D-I, cấp phát lên đích đã chọn, kiểm chứng, viết sổ tay, rồi đo lại. Forge **không phải nền tảng vận hành**: không có runtime, không có marketplace plugin, không có tác tử thường trực. Thứ Forge sinh ra mới là DX-Lab chạy thật, trên đích **nguồn mở** (Keycloak, Nextcloud, Postgres, n8n, Appsmith, Metabase, Qdrant, Telegram/Mattermost) hoặc **Google Workspace** (Drive, Sheets, Forms, Apps Script, Looker Studio, AppSheet theo hướng dẫn, Telegram) như sách DX-OS hướng dẫn.

So với các nền tảng ghép nguồn mở có marketplace và AI orchestrator: nền tảng là thứ bạn cài; Forge là thứ sinh ra thứ bạn cài. Forge còn có đích phụ xuất `manifest.yaml` theo chuẩn plugin của nền tảng đích, tức Forge nằm phía trên, không nằm cạnh.

Ba trục OLP kế thừa: low-code (Forge sinh form/app Appsmith và Sheets/Forms), LOD (mọi tài nguyên trong plan có URI và JSON-LD context; Forge sinh endpoint LOD cho đích), LLM + RAG (AI phỏng vấn, sinh plan, giải thích, viết sổ tay; hệ sinh ra có RAG trên Resources).

## 2. Đường ống

```
measure ──► interview ──► plan ──► apply ──► verify ──► handbook ──► (re-measure)
 M0 UI      AI chat       engine   provider   provider   AI + RAG
 ResultV1   intent.yaml   plan.yaml state.json report    Resources/00. Portal/handbook
```

| Giai đoạn | Đầu vào | Đầu ra | Ai làm |
|---|---|---|---|
| measure | Khảo sát 3 tầng | `ResultV1` (H/P/D/I, hình dạng, mức, độ vênh) | Engine M0 |
| interview | ResultV1, hội thoại | `intent.yaml` | AI + người; không có AI thì form |
| plan | intent | `plan.yaml` đã validate, kèm lý do từng tài nguyên và cổng trưởng thành | Engine luật + template gói ngành + AI đề xuất |
| apply | plan, đích, state | Tài nguyên thật; `state.json` ánh xạ id | Provider |
| verify | plan, state | Báo cáo đạt/không cho từng tài nguyên (đăng nhập được, ACL đúng, form chặn dữ liệu sai, workflow bắn thông báo) | Provider |
| handbook | plan, state | Sổ tay nghiệp vụ số (markdown) đẩy vào Resources của đích | AI, fallback template |

Mọi giai đoạn chạy được từ CLI và từ web wizard; wizard chỉ là vỏ gọi cùng thư viện.

## 3. Hai tầng đặc tả

### 3.1 intent.yaml (người và AI cùng viết, ≤ 80 dòng)
```yaml
version: 1
organization: { name, short_code, sector, size_band, departments: [{code, name, head_email?}] }
maturity: { assessment_id, hpdi: {H,P,D,I}, shape, dti_level, discrepancies: {pillar: value} }   # từ measure
core_processes:
  - id: cskh
    pack: dx-ticket            # gói ngành, tuỳ chọn
    name: Xử lý yêu cầu khách hàng
    actors: { R: staff, A: manager, C: [], I: [dx-admin] }
    sla_hours: 24
    external_entry: true       # có biểu mẫu công khai
channels: { chat: telegram | mattermost, notify_targets: {announce, alerts, approvals} }
target: { kind: oss | gws | manifest, endpoint, credentials_ref }
constraints: { language: vi, pii_masking: true }
```

### 3.2 plan.yaml (engine sinh, người sửa, apply đọc)
Một danh sách tài nguyên có `id`, `layer` (H/P/D/I), `type`, `spec`, `reason`, `depends_on`, `gate`:
- Lớp H: `identity.realm`, `identity.role`, `identity.group`, `storage.tree` (P.A.R.A), `storage.acl`, `portal.site`, `portal.handbook`, `comms.channel`, `comms.topic`.
- Lớp P: `process.entity` (bảng, trường, kiểu), `process.form` (trường hiển thị, rào chắn lớp 1: regex, bắt buộc, danh sách), `process.rule` (rào chắn lớp 2: điều kiện chuyển trạng thái), `process.state_machine`, `process.workflow` (sự kiện → hành động: email, thông báo, cập nhật), `process.app` (khung nhìn, nút, bộ lọc bảo mật).
- Lớp D: `data.dashboard` (thẻ, biểu đồ, bộ lọc), `data.snapshot` (lịch, đích thư mục), `data.lod_context` (JSON-LD cho thực thể), `data.report_schedule`.
- Lớp I: `intel.rag_source` (thư mục Resources nào được nạp), `intel.agent_policy` (whitelist hành động, kênh duyệt, hạn duyệt), `intel.assistant` (prompt hệ thống theo 5 RÕ).

**Cổng trưởng thành** (validator, không thể tắt): shape `spear` → chỉ lớp H; `kite`/`transitional` → H + P (+ D nếu P đủ); `illusion` → cấm lớp I, ghi lý do "GIGO"; `diamond` → tất cả. Luật khác: mỗi bước quy trình đúng một A; ≤ 5 trường bắt buộc mỗi form; Resources chỉ đọc với all-staff; mọi `intel.agent_policy` phải có kênh duyệt; mọi thực thể có PII phải có `pii_masking`.

## 4. Kiến trúc mã

```
dx-forge/
├── packages/forge-core/        # schema zod (intent, plan, state), planner, validator, differ, reporter
├── packages/hpdi-engine/       # M0: bộ câu hỏi, tính điểm, ánh xạ, hình dạng (không đổi)
├── packages/providers/
│   ├── oss/                    # keycloak, nextcloud, postgres, n8n, appsmith, metabase, qdrant, telegram, mattermost
│   ├── gws/                    # drive, sheets, forms, apps-script, looker, appsheet-guide, telegram
│   └── manifest/       # xuất manifest.yaml + SQL + n8n json theo chuẩn plugin của nền tảng đích
├── packages/ai/                # LlmProvider (gemini | anthropic | ollama | none), prompt 5 RÕ, zod, fallback
├── packs/                      # gói ngành: dx-ticket (mẫu), sau thêm truong-hoc, ban-le
├── apps/cli/                   # dxforge measure|interview|plan|apply|verify|handbook|destroy
├── apps/web/                   # wizard Next.js: đo lường, phỏng vấn, xem/sửa plan, apply, verify, handbook, thư viện gói
├── deploy/                     # compose cho đích oss demo (không phải một phần của Forge; là đích)
└── docs/
```

- `Provider` interface: `plan(resource) → PlannedChange`, `apply(resource, state) → StateEntry`, `verify(resource, state) → Check[]`, `destroy(resource, state)`. Mỗi loại tài nguyên có một adapter; adapter không biết về lớp khác.
- State: `.dxforge/state.json` (id plan → id thật, checksum spec); apply là idempotent, có `--dry-run` hiện diff.
- AI: chỉ ở interview, plan (đề xuất), handbook, giải thích. Validator luật chạy sau AI, AI không được bỏ qua validator.
- Forge tự thân là một ứng dụng nhẹ: CLI Node + wizard Next.js + SQLite cho phiên wizard (`.dxforge/wizard.db`). Nặng là ở đích, không ở Forge.

## 5. Đích

| Đích | Tự động | Bán tự động | Ghi chú |
|---|---|---|---|
| oss | Keycloak realm/role/group; Nextcloud group folder + ACL + README; Postgres DDL + trigger; n8n import workflow; Appsmith import app; Metabase card/dashboard; Qdrant collection + ingest; Telegram topic (bot tạo topic), Mattermost channel | — | Demo chính tháng 12 |
| gws | Drive thư mục + quyền; Sheets bảng + data validation + protected range; Forms + validation; Apps Script tạo/deploy Code.gs sinh từ workflow; Looker Studio Linking API; Telegram | AppSheet: sinh `appsheet-config.json` + hướng dẫn từng bước + kiểm chứng bằng cách đọc lại Sheets | Đúng "0 đồng" của sách |
| manifest | Xuất `manifest.yaml`, `db/seed.sql`, `workflows/*.json`, `dashboards/*.json` theo đặc tả manifest của nền tảng đích | — | Chứng minh vị trí "phía trên" |

## 6. Giao diện người dùng

- CLI: `dxforge measure --open` (mở wizard đo), `dxforge interview [-o intent.yaml]`, `dxforge plan -f intent.yaml [-o plan.yaml] [--no-ai]`, `dxforge apply plan.yaml --target oss --dry-run`, `dxforge verify`, `dxforge handbook`, `dxforge destroy`, `dxforge packs list|add`.
- Wizard: 7 màn theo đường ống + thư viện gói + thiết lập (LLM, đích, notifier). Xem plan dạng cây theo lớp, mỗi tài nguyên có lý do, sửa inline, diff trước apply, tiến trình apply theo tài nguyên, báo cáo verify xanh/đỏ.

## 7. PoF, quy ước, kiểm thử

- AGPL-3.0-or-later, SPDX header, LICENSE_NOTICE ghi công sách CC BY 4.0 và nêu các đích tương thích, DEPENDENCIES.md, BUILDING.md (CLI cài bằng `npm i -g` hoặc `npx`; wizard bằng compose một container), CHANGELOG, Issue template, CI.
- Mã, chú thích, commit tiếng Anh; chuỗi UI tiếng Việt; `develop` → `main` có tag.
- Kiểm thử: vitest cho forge-core (validator: 20 ca cổng trưởng thành và luật), hpdi-engine (golden), providers với HTTP mock; tích hợp trong CI với compose đích oss `core` (Keycloak + Nextcloud + Postgres + n8n): apply plan mẫu rồi verify phải xanh; E2E Playwright cho wizard: đo → phỏng vấn (provider none) → plan → apply dry-run → verify report; stress 2 vòng desktop/mobile.
- Tiêu chí xong v1.0.0: từ clone sạch, `dxforge plan` + `apply --target oss` dựng được DX-Lab gói dx-ticket trong ≤ 10 phút và `verify` 100 % xanh; `apply --target gws` dựng được Drive/Sheets/Forms/Apps Script với tài khoản thử; wizard chạy trọn đường ống.

## 8. Lịch 13 tuần (3 luồng AI agent, 3 người duyệt)

| Tuần | Luồng A (measure + wizard) | Luồng B (forge-core + provider oss) | Luồng C (packs, provider gws, AI) |
|---|---|---|---|
| T1 10–16/09 | repo, PoF skeleton, hpdi-engine + test, khảo sát UI | schema intent/plan/state, validator + cổng trưởng thành, CLI skeleton | gói dx-ticket (entity, form, rule, workflow) dạng template |
| T2 17–23/09 | radar, chốt đợt, kê đơn (AI + fallback) | provider oss: keycloak, nextcloud, telegram; apply/verify/state | prompt interview + plan, zod, fallback |
| T3 24–30/09 | wizard: đo → plan → apply → verify; **v0.1.0 nộp ICTU** | dry-run diff, destroy, docs CLI | handbook sinh từ plan |
| T4–T5 01–14/10 | chung kết ICTU 10/10; sửa phản hồi | provider oss: postgres DDL + trigger, n8n, appsmith, metabase | gói dx-ticket hoàn chỉnh trên đích oss, E2E |
| T6–T7 15–28/10 | xem/sửa plan dạng cây, diff | qdrant + rag_source, lod_context, snapshot | agent_policy sinh workflow HITL trên n8n |
| T8–T9 29/10–11/11 | thư viện gói, thiết lập | provider gws: drive, sheets, forms, apps-script, looker | appsheet-guide; gói ngành thứ hai |
| T10 12–18/11 | **đề chính thức**: điều chỉnh gói và wizard | manifest target | AI giải thích tài nguyên |
| T11–T12 19/11–02/12 | stress 2 vòng, video | verify tự động 2 đích, PoF | v1.0.0 |
| T13 03–06/12 | dự phòng, nộp | | |

## 9. Rủi ro

- Phạm vi provider rộng → ưu tiên oss đầy đủ trước; gws tối thiểu Drive + Sheets + Forms + Apps Script; AppSheet chỉ hướng dẫn.
- AI sinh plan sai → validator luật là chốt chặn; mọi tài nguyên có `reason` để người duyệt.
- Đề tháng 11 đổi bài mẫu → chỉ thêm gói ngành, không đổi engine.
- Giám khảo hỏi "có chạy thật không" → demo luôn kết bằng verify report và đăng nhập vào hệ thống vừa sinh.
