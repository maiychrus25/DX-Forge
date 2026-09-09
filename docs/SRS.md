# ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS) — DX-Forge

Phiên bản 2.0, 09/09/2026 (thay bản 1.0). Nguồn: [BRD.md](BRD.md), [ba/](ba/00-README.md), [superpowers/specs/](superpowers/specs/). Mã yêu cầu `FR-<giai đoạn>-nn`; truy vết tới `BR-nn` (BRD), `UC-nn`, `US-nn` (ba/).

## 1. Giới thiệu

### 1.1 Mục đích
Đặc tả những gì DX-Forge phải làm để đội (người và AI agent) xây dựng, người duyệt kiểm thử, giám khảo đối chiếu.

### 1.2 Phạm vi
DX-Forge gồm: thư viện lõi `forge-core` (schema, planner, validator, state, diff), engine đo `hpdi-engine`, các provider đích (`oss`, `gws`, `proteus-manifest`), lớp AI, gói ngành, CLI `dxforge`, wizard web. Forge không chứa dữ liệu nghiệp vụ và không vận hành nghiệp vụ.

### 1.3 Định nghĩa
| Thuật ngữ | Nghĩa |
|---|---|
| Đường ống | measure → interview → plan → apply → verify → handbook |
| intent | Đặc tả ngắn của tổ chức và quy trình lõi (`intent.yaml`) |
| plan | Danh sách tài nguyên bốn lớp H/P/D/I có lý do, phụ thuộc, cổng (`plan.yaml`) |
| state | Ánh xạ tài nguyên plan sang id thật trên đích (`.dxforge/state.json`) |
| provider / adapter | Bộ mã cấp phát và kiểm chứng một loại tài nguyên trên một đích |
| đích (target) | oss, gws, proteus-manifest |
| gói ngành (pack) | Thư mục template thực thể, form, luật, workflow, dashboard theo lĩnh vực |
| cổng trưởng thành | Luật cho phép hoặc khoá lớp theo shape/mức HPDI |
| HPDI, DTI, Supp, tầng, P.A.R.A, Poka-yoke, HITL, LOD, ResultV1 | như bản 1.0 |

### 1.4 Tài liệu tham chiếu
Sách DX-OS (CC BY 4.0); thể lệ OLP 2026, ICTU 2026; API: Keycloak Admin REST, Nextcloud WebDAV/OCS/groupfolders, n8n REST (import workflow), Appsmith REST (import application), Metabase API, Qdrant, Telegram Bot API, Mattermost API v4, Google Drive v3, Sheets v4, Forms v1, Apps Script API, Looker Studio Linking API; đặc tả plugin manifest của Proteus (`docs/plugin-manifest-spec.md` trong repo Proteus).

## 2. Mô tả tổng thể

### 2.1 Bối cảnh
```
Người dùng ──► CLI dxforge ──┐
             ──► Wizard web ─┤──► forge-core ──► providers ──► Đích: oss | gws | proteus-manifest
                             │        │
                             │        └─► ai (gemini | anthropic | ollama | none)
                             └─► hpdi-engine (measure), SQLite .dxforge/wizard.db
```
Forge chạy trên máy người dùng hoặc một container; kết nối ra đích qua HTTPS bằng thông tin trong biến môi trường.

### 2.2 Người dùng
| Actor | Mô tả |
|---|---|
| Kiến trúc sư DX (`architect`) | Người chạy đường ống: tư vấn viên, IT nội bộ, sinh viên. Toàn quyền trên wizard/CLI |
| Lãnh đạo (`sponsor`) | Trả lời khảo sát tầng executive, duyệt plan trên wizard (chế độ chỉ xem + phê duyệt) |
| Người trả lời khảo sát | Ẩn danh, có token |
| Hệ thống đích | Nhận lệnh apply/verify; không phải người |
| Người dùng của hệ thống sinh ra | Ngoài phạm vi Forge; hành vi của họ do plan quy định (gói ngành) |

### 2.3 Ràng buộc chung
Nguồn mở AGPL-3.0; SPDX header; cấu hình qua `.env`/biến môi trường; mã và commit tiếng Anh, UI tiếng Việt; một thư mục làm việc một tổ chức; không ghi thông tin xác thực vào plan/state.

## 3. Yêu cầu chức năng

### 3.1 Chung và wizard (FR-W)
- **FR-W-01 Đăng nhập wizard**: mật khẩu quản trị từ `FORGE_ADMIN_PASSWORD` (băm khi khởi động) hoặc OIDC nếu cấu hình; phiên 8 giờ. AC: sai mật khẩu 5 lần khoá 15 phút.
- **FR-W-02 Thư mục làm việc**: chọn/tạo `.dxforge/` gồm `wizard.db`, `intent.yaml`, `plan.yaml`, `state.json`, `artifacts/`, `reports/`. AC: đổi thư mục là đổi tổ chức.
- **FR-W-03 Thiết lập**: LLM provider và khoá; đích và thông tin xác thực (`credentials_ref` trỏ biến môi trường, không lưu giá trị); notifier tạm cho measure. AC: nút kiểm tra kết nối cho từng mục.
- **FR-W-04 Điều hướng đường ống**: thanh 6 bước, bước sau chỉ mở khi bước trước có sản phẩm; cho phép quay lại và chạy lại. AC: trạng thái từng bước lưu trong wizard.db.
- **FR-W-05 Thư viện gói ngành**: liệt kê `packs/*` (tên, mô tả, quy trình, đích hỗ trợ), thêm gói từ thư mục hoặc URL git. AC: gói lỗi schema bị từ chối kèm lý do.
- **FR-W-06 Trang Về**: ghi công sách, giấy phép, phiên bản, quan hệ với các đích. Truy vết BR-13.

### 3.2 measure (FR-M0) — module DX-Pulse
Giữ nguyên FR-M0-01 đến FR-M0-16 của bản 1.0 với ba điều chỉnh: lưu trên SQLite wizard.db; kit zip (FR-M0-12) là đường tắt, nút chính là "Sang phỏng vấn"; FR-M0-16 `GET /api/pulse/latest` là nguồn của `intent.maturity`. Test golden và thuật toán mục 5 của bản 1.0 giữ nguyên (chép lại ở mục 5.1 dưới).

### 3.3 interview (FR-I)
- **FR-I-01 Phỏng vấn bằng AI**: hội thoại tiếng Việt, tối đa 12 lượt, prompt hệ thống theo 5 RÕ, ngữ cảnh gồm ResultV1 và hồ sơ tổ chức; đầu ra `intent.yaml` hợp lệ theo `IntentV1` (zod); mỗi câu hỏi có gợi ý trả lời. AC: 3 kịch bản mẫu (spear, kite, diamond) sinh intent hợp lệ; AI lỗi → chuyển sang form.
- **FR-I-02 Form intent**: khi provider `none`, form 5 phần (tổ chức, phòng ban, quy trình lõi với vai trò RACI và SLA, kênh, đích). AC: cùng schema, ≤ 5 trường bắt buộc mỗi phần.
- **FR-I-03 Chọn gói**: gợi ý gói ngành theo `sector`; quy trình lõi có thể gắn `pack`. AC: intent ghi `pack` đúng id.
- **FR-I-04 Xem và sửa intent**: trình soạn YAML có kiểm lỗi trực tiếp và bản xem dạng form. AC: lưu chỉ khi hợp lệ.
Truy vết: BR-02, UC-10, US-23..25.

### 3.4 plan (FR-P)
- **FR-P-01 Sinh plan**: `plan(intent, packs, ai?) → PlanV1` theo spec forge-core 1.2: template gói → luật lớp H/D/I → AI đề xuất patch (tuỳ chọn) → validator. AC: cùng intent, không AI, sinh plan giống nhau (deterministic); có AI, patch được ghi `source: ai`.
- **FR-P-02 Lý do**: mọi tài nguyên có `reason` ≤ 300 ký tự; luật sinh reason mẫu, AI làm giàu. AC: 100 % tài nguyên có reason.
- **FR-P-03 Cổng trưởng thành**: theo shape: spear → H; kite/transitional → H+P (+D nếu `hpdi.P ≥ 20`); illusion → cấm I, `why="GIGO: P<20"`; diamond → tất cả; chưa đo → chỉ H, cờ `unmeasured`. Tài nguyên bị khoá vẫn nằm trong plan với `gate.allowed=false` và không được apply. AC: 8 ca kiểm thử. Truy vết BR-04.
- **FR-P-04 Validator luật**: một A/transition; ≤ 5 required/form; RESOURCES read cho all-staff; PII → masking; agent_policy có approval_channel và expire ≤ 24h; đồ thị phụ thuộc không vòng. AC: mỗi luật có ca vi phạm bị chặn và thông điệp chỉ đúng tài nguyên. Truy vết BR-04.
- **FR-P-05 Xem và sửa plan**: wizard hiện cây theo lớp, mỗi nút hiện type, reason, gate; sửa spec inline theo schema; đánh dấu tài nguyên bỏ (`skip: true`). CLI: sửa tệp và `dxforge plan --check`. AC: sửa sai schema bị chặn tại chỗ.
- **FR-P-06 Giải thích bằng AI**: nút "Vì sao" trên tài nguyên trả lời dựa trên reason, intent, sách (ngữ cảnh đóng). Fallback: hiện reason.
Truy vết: BR-03, UC-11, US-26..29.

### 3.5 apply / verify / destroy (FR-A)
- **FR-A-01 Dry-run**: bảng create/update/skip/destroy với diff spec so với state. AC: không gọi API ghi nào trong dry-run (kiểm bằng mock).
- **FR-A-02 Apply theo thứ tự**: topo `depends_on`, lớp H → P → D → I; bỏ qua `gate.allowed=false` và `skip`; ghi state sau mỗi tài nguyên; tiến trình từng tài nguyên trên wizard/CLI. AC: apply lần 2 toàn skip; ngắt giữa chừng rồi chạy lại tiếp từ chỗ dừng.
- **FR-A-03 Verify**: mỗi adapter trả checks; báo cáo `reports/verify-<ts>.md|json`; wizard hiện xanh/đỏ theo lớp và tài nguyên. AC: gói dx-ticket trên oss 100 % xanh trong CI.
- **FR-A-04 Destroy**: xoá theo thứ tự ngược; `--prune` xoá cả tài nguyên không còn trong plan; xác nhận hai bước. AC: sau destroy, verify báo không tồn tại.
- **FR-A-05 Provider oss lớp H**: theo spec forge-core mục 2 (realm, role, group, tree, acl, portal files, channel/topic, audit_job). AC: staff PUT vào RESOURCES 403; phòng ban PUT vào AREAS 201; topic gửi tin thử thành công.
- **FR-A-06 Provider oss lớp P**: entity → DDL schema `biz`; rule → trigger; form/app → Appsmith import; workflow → n8n import và kích hoạt. AC: form từ chối SĐT sai; đóng ticket thiếu resolution bị trigger chặn; sự kiện gửi đúng 1 thông báo.
- **FR-A-07 Provider oss lớp D**: dashboard → Metabase; snapshot → n8n cron xuất CSV + JSON-LD vào Resources; lod_context → tệp `context.jsonld`. AC: dashboard có thẻ và biểu đồ theo spec; snapshot đúng lịch (kiểm bằng chạy tay).
- **FR-A-08 Provider oss lớp I**: rag_source → Qdrant collection + workflow ingest; agent_policy → workflow HITL n8n (nhận lệnh, kiểm whitelist, gửi thẻ duyệt tới approval_channel, thực thi khi duyệt, hết hạn 24h). AC: lệnh ngoài whitelist bị chặn; lệnh ghi không thực thi khi chưa bấm duyệt. Truy vết BR-10.
- **FR-A-09 Provider gws**: tree/acl → Drive; entity → Sheets (bảng có tên, data validation, protected header); form → Forms (validation regex, bắt buộc); workflow → Apps Script (sinh Code.gs từ template, tạo project, deploy, trigger); dashboard → Looker Studio Linking URL; app → `appsheet-config.json` + hướng dẫn markdown; channel → Telegram. AC: với tài khoản thử, apply tạo được thư mục, sheet, form, script; verify đọc lại được. Truy vết BR-06.
- **FR-A-10 Đích proteus-manifest**: xuất thư mục `out/proteus/<pack>/` gồm `manifest.yaml`, `db/seed_data.sql`, `workflows/*.json`, `dashboards/*.json` đúng schema manifest của Proteus; verify = validate schema. Truy vết BR-07.
Truy vết chung: BR-05, UC-12..14, US-30..36.

### 3.6 handbook (FR-H)
- **FR-H-01 Sinh sổ tay**: từ plan + state, AI viết theo cấu trúc 3 lớp (lưu đồ mô tả bằng chữ, hướng dẫn thao tác theo từng tài nguyên, xử lý lỗi từ rào chắn); fallback template. Đẩy vào `3. [R] RESOURCES/00. Portal/handbook/` của đích (oss: WebDAV; gws: Drive). AC: mỗi quy trình lõi có một trang; mỗi rào chắn có mục xử lý lỗi. Truy vết BR-08, UC-15, US-37.
- **FR-H-02 Sổ tay cho kiến trúc sư**: `reports/architecture.md` liệt kê tài nguyên, lý do, id thật, cách huỷ. AC: sinh sau mỗi apply.

### 3.7 Gói ngành (FR-K)
- **FR-K-01 Cấu trúc gói**: `packs/<id>/pack.yaml` (metadata, sector, targets), `entities/*.yaml`, `forms/*.yaml`, `rules/*.yaml`, `workflows/*.yaml`, `dashboards/*.yaml`, `handbook/*.md`; biến `{{ }}`. AC: schema zod; gói dx-ticket và core là ví dụ chuẩn.
- **FR-K-02 Gói core**: offboarding 5 bước (workflow n8n hoặc Apps Script), audit tên hằng đêm, snapshot tháng. Truy vết BR-11.
- **FR-K-03 Gói dx-ticket**: khách hàng, ticket 17 trường, biểu mẫu công khai, hai rào chắn, ba workflow, dashboard, CSAT. Thay được theo đề tháng 11.

### 3.8 CLI (FR-C)
`dxforge measure [--open]`, `interview [-o]`, `plan -f intent.yaml [-o] [--no-ai] [--check]`, `apply plan.yaml --target <t> [--dry-run] [--prune]`, `verify [--naming]`, `handbook`, `destroy [--prune]`, `packs list|add <path|url>`, `explain <resourceId>`. Mã thoát: 0 thành công, 2 lỗi validate, 3 lỗi đích. Đầu ra `--json`. AC: `--help` cho mọi lệnh; kiểm thử snapshot đầu ra.

## 4. Giao diện ngoài
### 4.1 Người dùng
Wizard 7 màn + thiết lập + thư viện gói theo [ba/07-screens.md](ba/07-screens.md); CLI theo 3.8. DESIGN.md; 4 màu H/P/D/I cố định; responsive từ 375 px cho khảo sát và xem plan.
### 4.2 Phần mềm
| Đích/dịch vụ | Giao thức | Dùng ở |
|---|---|---|
| Keycloak | Admin REST v1 | FR-A-05 |
| Nextcloud | WebDAV, OCS, groupfolders API | FR-A-05, FR-H-01 |
| Postgres | SQL (DDL, trigger) | FR-A-06 |
| n8n | REST `/rest/workflows` import + activate; webhook | FR-A-05..08 |
| Appsmith CE | REST import application, datasource | FR-A-06 |
| Metabase OSS | API card/dashboard | FR-A-07 |
| Qdrant | REST | FR-A-08 |
| Telegram / Mattermost | Bot API / API v4 | FR-A-05, FR-M0-02 |
| Google Drive/Sheets/Forms/Apps Script | REST v3/v4/v1/Apps Script API, OAuth 2.0 | FR-A-09 |
| Looker Studio | Linking API (URL) | FR-A-09 |
| LLM | Gemini, Anthropic, Ollama | FR-I-01, FR-P-01/06, FR-H-01, FR-M0-08..11 |
### 4.3 Truyền thông
HTTPS tới đích; wizard phục vụ trên `localhost:3000` hoặc sau reverse proxy; webhook Telegram chỉ cần cho measure (nhắc khảo sát) và có thể thay bằng polling.

## 5. Mô hình dữ liệu và thuật toán
### 5.1 HPDI và ResultV1
Như bản 1.0 mục 5.1–5.2 (bộ câu hỏi có phiên bản; điểm theo tầng; hợp nhất 0.25/0.25/0.5; độ vênh; Supp = min tầng; P/D/I ≤ 30; H phần dư; mức DTI; 5 hình dạng; test golden).
### 5.2 IntentV1, PlanV1, StateV1
Theo spec forge-core 1.1 và spec tổng 3.1–3.2. Ràng buộc: `resources[].id` duy nhất, dạng `<layer>.<type>.<slug>`; `depends_on` tham chiếu id tồn tại; `intent_hash` để phát hiện plan cũ.
### 5.3 Wizard.db (SQLite, Prisma)
Bảng của measure (assessments, survey_links, responses, results, prescriptions, artifacts), `sessions`, `settings`, `llm_calls`, `runs` (giai đoạn, bắt đầu, kết thúc, kết quả, đường dẫn báo cáo).
### 5.4 Gói ngành
Schema `PackV1`; biến thay thế; tài nguyên gói sinh ra được gắn `origin: pack:<id>`.

## 6. Yêu cầu phi chức năng
| Nhóm | Yêu cầu đo được |
|---|---|
| Bảo mật | Không ghi thông tin xác thực vào tệp plan/state/báo cáo; khoá LLM chỉ trong biến môi trường; khảo sát không lưu IP; AI không nhận PII (chỉ mã, điểm, tên quy trình); mọi lệnh ghi lên đích ghi nhật ký `runs` |
| Hiệu năng | `plan` ≤ 5 giây không AI, ≤ 60 giây có AI; `apply` gói dx-ticket oss ≤ 10 phút; `verify` ≤ 3 phút; wizard tải trang ≤ 2 giây |
| Nền tảng | Node 22+, npm; wizard Docker một container ≤ 1 GB RAM; đích oss theo yêu cầu riêng của đích (16 GB cho bộ đầy đủ) |
| Tin cậy | apply idempotent; ngắt và chạy lại được; state có backup trước mỗi apply |
| Dễ dùng | Khảo sát ≤ 8 phút; intent ≤ 80 dòng; mỗi tài nguyên có lý do; thông điệp validate chỉ đúng tài nguyên và cách sửa |
| Bền vững | Gói ngành và adapter có schema và tài liệu đóng góp; test bao phủ forge-core ≥ 90 %, hpdi-engine ≥ 90 % |
| Nguồn mở | AGPL-3.0, SPDX, không vendor, build từ nguồn, tar.gz có phiên bản, CHANGELOG, bug tracker |

## 7. Ràng buộc thiết kế
Monorepo npm workspaces theo spec tổng mục 4; provider không import chéo; AI không được bỏ qua validator; wizard chỉ gọi thư viện, không có logic riêng; compose trong `deploy/` là **đích demo**, không phải thành phần Forge.

## 8. Kiểm thử
| Cấp | Phạm vi | Đạt |
|---|---|---|
| Đơn vị | hpdi-engine golden; forge-core schema/planner snapshot/validator 20 ca/differ; adapter với HTTP mock | xanh, coverage như mục 6 |
| Tích hợp | compose đích `core` (Keycloak, Nextcloud, Postgres, n8n): plan dx-ticket → apply → verify 100 % → apply lần 2 toàn skip → destroy --prune sạch | xanh trong CI |
| gws | Tài khoản thử: apply tạo Drive/Sheets/Forms/Script, verify đọc lại | chạy tay trước release |
| E2E | Playwright wizard: đo → phỏng vấn (none) → plan → sửa một tài nguyên → dry-run → apply → verify → handbook | hành trình bằng người khác người tạo dữ liệu |
| Stress | 2 vòng desktop 1440 / mobile 375 trước mỗi release | không tràn ngang, sáng/tối nhất quán |

## 9. Ma trận truy vết (rút gọn)
| BR | FR | UC | US |
|---|---|---|---|
| BR-01 | FR-M0-* | UC-01..05 | US-01..14 |
| BR-02 | FR-I-01..04 | UC-10 | US-23..25 |
| BR-03 | FR-P-01/02/05/06 | UC-11 | US-26..29 |
| BR-04 | FR-P-03/04 | UC-11 | US-27 |
| BR-05 | FR-A-01..05, FR-C | UC-12, UC-13 | US-30..33 |
| BR-06 | FR-A-09 | UC-12 | US-35 |
| BR-07 | FR-A-10 | UC-12 | US-36 |
| BR-08 | FR-H-01/02 | UC-15 | US-37 |
| BR-09 | FR-I-02, FR-P-01, FR-H-01 fallback | — | US-10, US-24 |
| BR-10 | FR-A-08 | UC-14 | US-34 |
| BR-11 | FR-K-01..03 | — | US-38 |
| BR-12 | FR-C, mục 6 nguồn mở, FR-W-02 | — | — |
| BR-13 | FR-W-06 | — | — |

## 10. Lịch sử thay đổi
| Phiên bản | Ngày | Nội dung |
|---|---|---|
| 1.0 | 09/09/2026 | Nền tảng DX-Pulse (đã thay) |
| 2.0 | 09/09/2026 | Viết lại theo DX-Forge: đường ống, hai tầng đặc tả, provider, gói ngành, CLI |
