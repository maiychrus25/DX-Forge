# ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS) — DX-Pulse

Phiên bản 1.0, 09/09/2026. Phạm vi: toàn nền tảng, chi tiết ở M0 và M1, khung ở M2–M5. Tài liệu nguồn: [BRD.md](BRD.md), [ba/](ba/00-README.md), [superpowers/specs/](superpowers/specs/). Mã yêu cầu chức năng `FR-Mx-nn` truy vết tới trace code trong [ba/04-functions.md](ba/04-functions.md), use case `UC-nn` trong [ba/11-usecase-spec.md](ba/11-usecase-spec.md), user story `US-nn` trong [ba/13-user-stories.md](ba/13-user-stories.md) và yêu cầu nghiệp vụ `BR-nn` trong BRD.

## 1. Giới thiệu

### 1.1 Mục đích
Đặc tả đầy đủ những gì phần mềm DX-Pulse phải làm để đội phát triển (người và AI agent) xây dựng, người duyệt kiểm thử và giám khảo đối chiếu. Mọi thay đổi hành vi phải cập nhật tài liệu này trước khi vào sprint.

### 1.2 Phạm vi sản phẩm
DX-Pulse là nền tảng DX-OS kiến trúc Open-Core cho một doanh nghiệp (một bản cài, một tổ chức), gồm lõi tự viết DX-Core (Next.js) ghép với Keycloak, Nextcloud, n8n, Appsmith, Metabase, Qdrant, Postgres, Traefik và Telegram/Mattermost. Sáu module: M0 Đo lường, M1 Không gian [H], M2 Quy trình [P], M3 Dữ liệu [D], M4 Trí tuệ [I], M5 Vỏ nền tảng.

### 1.3 Định nghĩa
| Thuật ngữ | Nghĩa |
|---|---|
| HPDI | Bốn không gian điều khiển Human, Process, Data, Intelligence; H % + P % + D % + I % = 100 |
| DTI | Chỉ số chuyển đổi số theo 6 trụ cột (Chiến lược, Văn hoá, Khách hàng, Vận hành, Công nghệ, Dữ liệu), thang 0–100, 5 mức |
| Supp | Hệ số thực chứng nhân vào điểm DTI của từng trục P/D/I |
| Tầng (tier) | executive, manager, staff — ba nhóm người trả lời khảo sát |
| P.A.R.A | Projects, Areas, Resources, Archives — cấu trúc lưu trữ |
| Poka-yoke | Rào chắn kỹ thuật ngăn thao tác sai, ba lớp: giao diện, máy chủ, thiết bị |
| DX-Ticket | Bài toán mẫu quản lý yêu cầu khách hàng |
| HITL | Human-in-the-loop, người duyệt trước khi AI thực thi |
| DSL | Cấu trúc lệnh JSON có whitelist mà tác tử AI được phép sinh |
| LOD | Dữ liệu mở liên kết, ở đây là JSON-LD có `@context` |
| ResultV1 | Cấu trúc kết quả đợt đo, định nghĩa ở mục 5.2 |

### 1.4 Tài liệu tham chiếu
Sách "DX-OS in Action" (CC BY 4.0); Thể lệ OLP PMNM 2026 (vfossa.vn); Thể lệ cuộc thi ICTU 2026; tài liệu API Keycloak Admin REST, Nextcloud OCS/WebDAV/groupfolders, n8n Webhook, Telegram Bot API, Mattermost API, Google AI, Anthropic Messages, Ollama.

## 2. Mô tả tổng thể

### 2.1 Bối cảnh hệ thống
```
Trình duyệt / điện thoại ──► Traefik ──► DX-Core (Next.js) ──► Postgres (core, pulse, biz, lod)
                                   │           │  ├─► Keycloak (OIDC, admin REST)
                                   │           │  ├─► Nextcloud (WebDAV, OCS, groupfolders)
                                   │           │  ├─► n8n (webhook ↔ callback)
                                   │           │  ├─► Telegram Bot API / Mattermost API
                                   │           │  ├─► LLM provider (Gemini | Anthropic | Ollama | none)
                                   │           │  └─► Qdrant (M4)
                                   ├─► Appsmith (form/app DX-Ticket, nhúng iframe)
                                   ├─► Metabase (dashboard, nhúng JWT)
                                   └─► Nextcloud UI, n8n UI (mở tab mới)
```

### 2.2 Người dùng
Sáu actor theo [ba/05-permissions.md](ba/05-permissions.md): Quản trị viên DX (`dx-admin`), Quản lý (`manager`), Nhân viên (`staff`), Người trả lời khảo sát (ẩn danh, có token), Khách hàng (biểu mẫu công khai), Hệ thống tự động (n8n, tác tử AI, client credentials).

### 2.3 Ràng buộc chung
- Một bản cài = một tổ chức; không có `tenant_id`.
- Cấu hình chỉ qua biến môi trường (`.env`); không sửa mã bên thứ ba; AGPL-3.0-or-later với header SPDX mọi tệp mã.
- Giao diện tiếng Việt; mã, chú thích, commit tiếng Anh.
- Hồ sơ tổ chức là bản ghi đơn `core.settings.organization`; phòng ban là nhóm Keycloak `/departments/<slug>` có thuộc tính `code`.

### 2.4 Giả định
Xem BRD mục 8. Thêm: trình duyệt hỗ trợ ES2022; Postgres 16; Node 22.

## 3. Yêu cầu chức năng

Định dạng: mã, mô tả, đầu vào, xử lý, đầu ra, tiêu chí chấp nhận, truy vết.

### 3.1 M5 — Xác thực, thiết lập, vỏ nền tảng

**FR-M5-01 Đăng nhập một lần** — Người dùng đăng nhập qua Keycloak realm `dxlab` bằng OIDC Authorization Code + PKCE; DX-Core lưu phiên (sub, email, name, roles, groups) và cache vào `core.users`. Đăng xuất gọi end-session. AC: sau đăng nhập, mở Nextcloud không phải đăng nhập lại; đăng xuất làm phiên Nextcloud hết hạn trong ≤ 60 giây. Truy vết: M5-01/02, US-15, BR-04.

**FR-M5-02 Phân quyền theo vai trò** — Middleware chặn tuyến theo bảng [ba/05-permissions.md](ba/05-permissions.md); API trả 403 kèm mã lỗi khi thiếu quyền. AC: kiểm thử tự động cho mỗi dòng ma trận với 3 vai trò.

**FR-M5-03 Thiết lập tổ chức** — Form tên, ngành (danh mục 12 ngành), quy mô (5 dải), viết tắt 2–10 ký tự in hoa. Lưu `core.settings.organization`. AC: thay đổi phản ánh ngay trên Portal và kit.

**FR-M5-04 Thiết lập notifier** — Bảng định tuyến 5 kênh (`announce`, `alerts`, `dx-ticket`, `approvals`, `it-support`) → provider + target; nút gửi thử; token lưu mã hoá, không hiển thị lại. AC: gửi thử tạo bản ghi `core.notifications` với `ok=true`; kênh chưa cấu hình trả lỗi `NOTIFIER_CHANNEL_UNSET`. Truy vết: M5-07, SC-11.

**FR-M5-05 Thiết lập LLM** — Provider `none|gemini|anthropic|ollama`, khoá/URL/model; nút kiểm tra gọi một prompt ngắn và hiện độ trễ. AC: đổi provider có hiệu lực cho lời gọi kế tiếp mà không khởi động lại. Truy vết: M5-08, SC-12.

**FR-M5-06 Launchpad** — Trang `/` hiện bảng tin, nút tác vụ theo vai trò, cây Resources, dashboard nhúng (nếu M3 bật), thẻ gợi ý bước tiếp theo đọc `GET /api/pulse/latest`: chưa đo → "Đo trước"; `spear` → chỉ mở [H]; `kite` → [H]+[P]; `illusion` → khoá [I] kèm giải thích; `diamond`/`transitional` → tất cả. AC: đổi kết quả đo là thẻ đổi. Truy vết: M5-09, SC-02.

**FR-M5-07 Trang Về DX-Pulse** — Ghi công sách CC BY 4.0, giấy phép AGPL, phiên bản, liên kết mã nguồn. Truy vết: BR-11.

**FR-M5-08 Cài đặt một lệnh** — `deploy/setup.sh` sao chép `.env.example`, tạo bí mật, `docker compose --profile core|full up -d`, chờ healthcheck, in địa chỉ. AC: từ clone sạch trên máy đạt yêu cầu, profile `core` sẵn sàng ≤ 10 phút, `full` ≤ 15 phút. Truy vết: BR-10.

### 3.2 M0 — Đo lường DTI/HPDI

**FR-M0-01 Mở đợt đo** — Đầu vào: phiên bản bộ câu hỏi, hạn link (mặc định +14 ngày), quy trình lõi (tuỳ chọn). Xử lý: kiểm không có đợt Open; tạo Assessment Draft→Open, round = max+1; sinh 3 `survey_links` token 32 byte ngẫu nhiên. Đầu ra: 3 URL + QR. AC: US-01; tạo trong ≤ 1 giây; đợt Open thứ hai bị từ chối `ASSESSMENT_ALREADY_OPEN`. Truy vết: M0-01/02, UC-01.

**FR-M0-02 Chia sẻ link** — Nút gửi 3 link vào kênh `announce` với nhãn tầng. AC: US-02. Truy vết: M1-11.

**FR-M0-03 Điền khảo sát** — Trang công khai `/pulse/s/[token]`: màn chào (tầng, số câu, thời gian, tuyên bố ẩn danh), một câu mỗi màn, tiến trình, lưu nháp `localStorage` theo token, gửi. Xử lý: kiểm token còn hạn và đợt Open; kiểm đủ câu bắt buộc; lưu `responses(answers, freeText≤2000)`; không lưu IP/UA. AC: US-03, US-04; token hết hạn hiện màn "Đợt đo đã đóng"; gửi hai lần cùng nháp bị chặn phía client và server không tạo trùng trong 10 giây. Truy vết: M0-03, UC-02, SC-06.

**FR-M0-04 Tiến độ phản hồi và nhắc** — Dashboard đợt đo hiện đếm theo tầng; cảnh báo tầng thiếu; nút Nhắc gửi thông báo. AC: US-05. Truy vết: M0-04.

**FR-M0-05 Chốt đợt đo** — Điều kiện: ≥ 1 executive và ≥ 1 staff; xác nhận 2 bước. Xử lý tuần tự: khoá token → tính Result (mục 5.2) → lưu → gọi AI roadmap (FR-M0-08) → phát sự kiện `pulse.assessment.closed` → gửi `announce`. AC: US-06, US-07; toàn bộ ≤ 30 giây với AI, ≤ 2 giây không AI; thiếu tầng trả `INSUFFICIENT_RESPONSES` kèm tầng thiếu. Truy vết: M0-05/06, UC-03.

**FR-M0-06 Dashboard đợt đo** — Radar 4 trục (H thang 0–100; P, D, I thang 0–30), lớp Hợp nhất + 3 lớp tầng bật/tắt, badge hình dạng và mức DTI, bảng 6 trụ cột với điểm từng tầng, hợp nhất, độ vênh (đỏ nếu > 0.3), chip Supp có tooltip. AC: US-07, US-08; số hiển thị khớp test golden của engine. Truy vết: M0-07, SC-05.

**FR-M0-07 Bộ câu hỏi có phiên bản** — Tệp `questionnaire.v1.json` theo schema mục 5.1; trang chỉ đọc liệt kê câu theo trụ cột và tầng. AC: thay tệp v2 không cần sửa mã; đợt đo cũ giữ phiên bản của nó. Truy vết: M0-16.

**FR-M0-08 Kê đơn lộ trình (AI)** — Đầu vào: ResultV1, freeText đã cắt, ngành, quy mô. Prompt hệ thống theo khung 5 RÕ; đầu ra zod `{focusAxis, diagnosis, phases[{name, axis, actions[], kpis[]}], warnings[]}`; thứ tự phase cố định P→D→I. Sai schema → thử lại 1 lần → fallback bảng rule-based theo hình dạng. AC: US-09, US-10; provider `none` vẫn có đơn, gắn nhãn "Rule-based"; bản ghi `prescriptions` có `fallback`, `latencyMs`, token. Truy vết: M0-08, UC-03.

**FR-M0-09 Câu hỏi đối chất (AI)** — Với mỗi trụ cột vênh > 0.3, ≥ 2 câu, ghi hỏi tầng nào, không nêu tên cá nhân; nút gửi vào `announce`. Fallback: bộ câu mẫu theo trụ cột. AC: US-11. Truy vết: M0-09, UC-04.

**FR-M0-10 Ma trận 5 RÕ và Poka-yoke (AI)** — Đầu vào: coreProcess ≤ 120 ký tự. Đầu ra zod `{process, steps[{step, role_R, role_A, role_C, role_I, standard, tool}], pokaYoke[{point, rule, layer∈{1,2,3}}]}`; ràng buộc mỗi bước đúng một A, `tool` thuộc danh mục hệ thống. AC: US-12; kết quả xuất hiện trong kit. Truy vết: M0-10, UC-05.

**FR-M0-11 Hỏi báo cáo (AI)** — Chat neo vào JSON ResultV1 + roadmap; câu ngoài ngữ cảnh trả "không có trong báo cáo"; ẩn khi provider `none`. AC: 10 câu kiểm thử, 0 câu bịa số ngoài JSON. Truy vết: M0-11.

**FR-M0-12 Bộ kỷ luật P.A.R.A** — Form phòng ban (mặc định từ nhóm Keycloak), dự án, viết tắt; xem trước cây; tải zip theo cấu trúc [spec M0 mục 7](superpowers/specs/2026-09-09-m0-measurement-design.md); nút "Cấp phát lên Nextcloud" gọi FR-M1-03 khi M1 cấu hình. AC: US-13; zip có đủ 4 nhánh, 16 thư mục Resources, README mỗi nhánh, NAMING_CONVENTION.md, POKA_YOKE.md, 5RO_*.md. Truy vết: M0-12/13, UC-06, SC-08.

**FR-M0-13 Lịch sử theo vòng** — `/pulse` chồng radar ≤ 3 vòng gần nhất, bảng H/P/D/I theo vòng. AC: US-14. Truy vết: M0-14.

**FR-M0-14 Huỷ và lưu trữ đợt đo** — Huỷ chỉ khi chưa có phản hồi; lưu trữ khoá sửa. Truy vết: M0-15, [ba/03-state.md](ba/03-state.md) 3.1.

**FR-M0-15 Thống kê lời gọi AI** — Trang `/settings/llm` hiện từ `core.llm_calls`: số lời gọi, tỷ lệ hợp lệ lần đầu, fallback, độ trễ P50/P95, token theo provider và mục đích. Truy vết: M0-17.

**FR-M0-16 API kết quả mới nhất** — `GET /api/pulse/latest` trả `{assessmentId, round, closedAt, result: ResultV1}` hoặc 404. Dùng bởi Launchpad. Truy vết: spec M0 mục 13.

### 3.3 M1 — Không gian [H]

**FR-M1-01 Khởi tạo realm** — Khi DX-Core khởi động: import `deploy/keycloak/realm-dxlab.json` nếu chưa có (vai trò `dx-admin`, `manager`, `staff`; client `dx-core`, `nextcloud`, `n8n`); idempotent. AC: chạy 2 lần không tạo trùng. Truy vết: M1-01.

**FR-M1-02 Quản lý người dùng và phòng ban** — Tạo/sửa/vô hiệu người dùng qua Keycloak admin REST; tạo phòng ban = nhóm Keycloak (`code` 2–5 chữ in hoa, duy nhất) + thư mục AREAS + ACL. AC: người dùng mới nhận email đặt mật khẩu; phòng ban mới có thư mục trong ≤ 10 giây. Truy vết: M1-02/03, SC-09.

**FR-M1-03 Cấp phát cây P.A.R.A** — `POST /api/workspace/provision`: tạo group folder `DX-OS`, cây chuẩn, thư mục phòng ban, ACL theo bảng spec M1 mục 4.2, README; idempotent, không xoá. AC: US-16; staff PROPFIND được RESOURCES nhưng PUT bị 403; phòng ban PUT được AREAS của mình; chạy lại không đổi mtime thư mục có sẵn. Truy vết: M1-04, UC-06.

**FR-M1-04 Tạo và đóng dự án** — Tạo: nhóm `/projects/<slug>`, thư mục PROJECTS, ACL ghi cho thành viên. Đóng: MOVE sang ARCHIVES, thu quyền ghi, gửi tác vụ chắt lọc tới chủ dự án qua notifier, ghi sự kiện. AC: sau đóng, thành viên PUT bị 403; thông báo có tên dự án. Truy vết: M1-05/06, [ba/03-state.md](ba/03-state.md) 3.3.

**FR-M1-05 Duyệt Resources và Sổ tay** — Portal liệt kê cây `3. [R] RESOURCES` qua WebDAV (cache 60 giây), ẩn nhánh không có quyền; `/portal/handbook/[slug]` render markdown từ `00. Portal/handbook/`. AC: sửa tệp trên Nextcloud, Portal đổi trong ≤ 60 giây. Truy vết: M1-07/09/10.

**FR-M1-06 Kiểm quy ước đặt tên** — `POST /api/workspace/audit` (n8n cron 02:00): quét RESOURCES và AREAS, so hai regex `^\d{2}_[A-Za-z0-9]+_(V\d+|Final)_\d{8}\.` và `^\d{8}_[A-Z]{2,5}_[A-Za-z0-9]+\.`; ghi `core.naming_violations`; gửi tổng hợp kênh `alerts`; không đổi tên. AC: US-17. Truy vết: M1-08.

**FR-M1-07 Notifier** — Interface `send(channel, {text, actions?})`; adapter Telegram (Bot API, `message_thread_id`, inline keyboard) và Mattermost (bot, interactive buttons); callback `POST /api/notify/telegram|mattermost` xác thực secret; ghi `core.notifications`; hàng chờ gửi lại 3 lần khi lỗi mạng. AC: gửi thử thành công; nút bấm callback tạo bản ghi hành động. Truy vết: M1-11/12.

**FR-M1-08 Thu hồi truy cập** — `POST /api/workspace/offboard/{sub}` với người thay thế: 5 bước tuần tự (Keycloak disable + logout all; Nextcloud disable + chuyển sở hữu; Telegram ban / Mattermost deactivate; dịch vụ không OIDC vô hiệu hoặc ghi việc `it-support`; phát `workspace.user.offboarded`), ghi `offboardings.steps` và thời gian; dừng ở bước lỗi, cho chạy lại. AC: US-18; phiên đang mở bị đẩy ra ≤ 60 giây; tổng thời gian hiển thị. Truy vết: M1-13, UC-07, SC-10.

**FR-M1-09 Tài khoản dịch vụ không OIDC** — Khi tạo người dùng, tạo tài khoản Appsmith/Metabase/Mattermost cùng email qua API, mật khẩu ngẫu nhiên gửi một lần qua notifier riêng tư; khi offboard vô hiệu tương ứng. Truy vết: M1-15.

**FR-M1-10 LOD tổ chức** — `GET /api/lod/organization` trả JSON-LD schema.org `Organization` với `department` từ nhóm Keycloak; `Accept: application/ld+json`. Truy vết: M1-14, BR-08.

### 3.4 M2 — Quy trình [P] (DX-Ticket)

**FR-M2-01 Schema nghiệp vụ** — Schema `biz`: `customers`, `tickets` theo bảng [spec sách chương 6.2] gồm 17 cột ticket (thêm `priority`, `resolution`, `assignee_email`, `log_email`); migration SQL trong `plugins/dx-ticket/migrations`. Truy vết: BR-12.
**FR-M2-02 Biểu mẫu công khai** — Trường theo SC-13; regex SĐT `^[0-9]{10}$`; checkbox đồng ý không tích sẵn, lưu timestamp + phiên bản chính sách; khớp hoặc tạo khách hàng theo SĐT; tạo ticket `Chờ xử lý`; email xác nhận. AC: US-19. Truy vết: M2-02, UC chương 6.3 sách.
**FR-M2-03 Ứng dụng nội bộ (Appsmith)** — Ba lát cắt theo trạng thái; nút "Bắt đầu xử lý" gán `USEREMAIL()`; nút "Kết thúc xử lý" bắt nhập `resolution ≥ 50` ký tự; bộ lọc bảo mật `OR(status='Chờ xử lý', assignee_email=USEREMAIL())`. Truy vết: M2-03..07.
**FR-M2-04 Rào chắn máy chủ** — Trigger Postgres hoặc API kiểm: không `Đang xử lý` khi thiếu assignee; không `Đóng` khi `resolution` < 50; vi phạm → từ chối, ghi nhật ký. AC: US-20; sửa thẳng DB cũng bị chặn. Truy vết: M2-05, UC-08.
**FR-M2-05 Sự kiện và workflow** — `core.events` + webhook n8n: mở mới → email xác nhận; khiếu nại sang Đang xử lý → kênh `dx-ticket`; đóng → tính SLA, email CSAT, cắm cờ `log_email` chống trùng; n8n ack `POST /api/events/{id}/ack`. AC: mỗi sự kiện gửi đúng 1 lần dù chỉnh sửa nhiều lần. Truy vết: M2-08/09/11.
**FR-M2-06 CSAT công khai** — `/public/csat/[ticketId]` ghi điểm 1–5 một lần. Truy vết: M2-10.

### 3.5 M3 — Dữ liệu [D]

**FR-M3-01 Dashboard Metabase** — Thẻ điểm (tổng ticket, CSAT trung bình, SLA trung bình), biểu đồ chuỗi thời gian, vành khuyên theo loại, bảng quá hạn; nhúng bằng JWT với tham số khoá phòng ban; PII che cho staff. Truy vết: M3-01/05, BR-07.
**FR-M3-02 Snapshot định kỳ** — n8n cron ngày 1 hằng tháng: xuất `biz.*` ra CSV và JSON-LD vào `41. Structured_Data/Snapshot_TICKETS_YYYYMM.*`; đặt chỉ đọc. Truy vết: M3-02.
**FR-M3-03 Báo cáo định kỳ** — Metabase subscription gửi PDF ngày 1; quy trình xác thực bằng chuyển tiếp email theo sách 7.2.4 (tài liệu hoá, không tự động). Truy vết: M3-03.
**FR-M3-04 LOD** — `GET /api/lod/{type}/{id}` và `/api/lod/catalog` với `@context` schema.org + từ vựng `dxos:` cho Ticket, Customer, Assessment, HpdiResult; catalog `lod.entities(uri, type, updated_at)`. Truy vết: M3-04, BR-08.

### 3.6 M4 — Trí tuệ [I]

**FR-M4-01 Nạp Resources** — Job nạp tệp `.md/.pdf/.docx/.csv` từ Resources vào Qdrant collection `resources` (chunk 800 token, overlap 100), tái nạp khi mtime đổi; ghi nguồn (đường dẫn, đoạn). Truy vết: M4-01.
**FR-M4-02 Hỏi đáp có trích nguồn** — `POST /api/ai/ask`: truy xuất top-k, sinh câu trả lời kèm danh sách nguồn; không có nguồn phù hợp → "không có trong tài liệu". AC: US-21. Truy vết: M4-02.
**FR-M4-03 Lệnh AI có người duyệt** — `POST /api/ai/command`: ngữ cảnh LOD + RAG → DSL `{action, effect∈{read,write}, params}`; whitelist action từ `plugins/*/actions.json`; bất biến kiểm trước (ví dụ số tiền > 0); `write` → `ai_commands` Pending → thẻ duyệt kênh `approvals` → callback Approved/Rejected → n8n → Executed/Failed; 24 giờ → Expired; audit đầy đủ. AC: US-22. Truy vết: M4-03/04, UC-09, [ba/03-state.md](ba/03-state.md) 3.4.
**FR-M4-04 Tác tử giám sát** — Cron: quét ticket quá SLA, đối chiếu SOP trong Resources, gửi báo cáo nguyên nhân vào `alerts`; chỉ đọc. Truy vết: M4-05.

## 4. Yêu cầu giao diện ngoài

### 4.1 Giao diện người dùng
Theo [ba/07-screens.md](ba/07-screens.md) (13 màn hình) và [ba/08-sitemap.md](ba/08-sitemap.md); DESIGN.md quy định token màu, chữ, khoảng cách; 4 trục HPDI màu cố định; responsive từ 375 px; ARIA cho biểu đồ.

### 4.2 Giao diện phần cứng
Không có yêu cầu riêng; máy chủ theo mục 6.2.

### 4.3 Giao diện phần mềm
| Hệ thống | Giao thức | Dùng cho |
|---|---|---|
| Keycloak 26 | OIDC (login), Admin REST v1 (user, group, role, logout-all) | FR-M5-01, FR-M1-01/02/08 |
| Nextcloud 30 | WebDAV (MKCOL, PROPFIND, MOVE, PUT), OCS Provisioning, app `groupfolders` API, app `user_oidc` | FR-M1-03/04/05/06/08, FR-M0-12 |
| n8n | Webhook nhận (POST JSON), gọi lại Core API bằng client credentials Keycloak | FR-M2-05, FR-M1-06, FR-M3-02, FR-M4-03 |
| Telegram Bot API | `sendMessage`, `banChatMember`, webhook callback với `secret_token` | FR-M1-07/08 |
| Mattermost API v4 | posts với `props.attachments.actions`, users deactivate, webhook callback | FR-M1-07/08 |
| Appsmith CE | REST API tạo user; nhúng iframe; ứng dụng nối Postgres schema `biz` | FR-M1-09, FR-M2-03 |
| Metabase OSS | API tạo user; embed JWT (`METABASE_EMBED_SECRET`) | FR-M1-09, FR-M3-01 |
| Qdrant | REST/gRPC collection `resources` | FR-M4-01/02 |
| LLM | Google AI `generateContent`; Anthropic Messages; Ollama `/api/chat` | FR-M0-08..11, FR-M4-02/03 |
| Postgres 16 | SQL, schema core/pulse/biz/lod; trigger cho rào chắn | tất cả |

### 4.4 Giao diện truyền thông
HTTPS qua Traefik cùng tên miền, định tuyến theo path (`/`, `/api`, `/auth`, `/files`, `/workflow`, `/apps`, `/analytics`, `/chat`); dịch vụ chỉ mở cổng nội bộ Docker network; webhook ngoài (Telegram) vào qua `/api/notify/telegram`.

## 5. Mô hình dữ liệu và thuật toán

### 5.1 Schema bộ câu hỏi
```ts
type Question = { id: string; pillar: "strategy"|"culture"|"customer"|"operations"|"technology"|"data";
  tiers: ("executive"|"manager"|"staff")[]; type: "scale"|"choice"|"supp"; text: string;
  options?: { value: number; label: string }[]; max: number; supp?: { axis: "P"|"D"|"I" }; weightEvidence?: boolean };
```
Supp cho phép: P ∈ {0.33, 0.66, 1}; D ∈ {0, 0.5, 1}; I ∈ {0, 0.33, 0.66, 1}.

### 5.2 Thuật toán HPDI và ResultV1
1. Điểm trụ cột theo tầng = Σ điểm / Σ max trên câu tầng đó được hỏi (0–1).
2. Hợp nhất = trung bình có trọng số {executive 0.25, manager 0.25, staff 0.5}; câu `weightEvidence` chỉ lấy staff nếu có.
3. Độ vênh = max − min giữa các tầng có dữ liệu; cảnh báo > 0.3.
4. Supp mỗi trục = min giữa các tầng.
5. `P% = (scoreP/maxP) × P_supp × 30`, tương tự D, I; `H% = 100 − (P+D+I)`. Nguồn: P ← operations, customer; D ← data; I ← technology (câu AI/ML) + câu supp I.
6. `dtiScore` = trung bình 6 trụ cột × 100; mức 1..5 theo 0–10, 10–30, 30–70, 70–90, 90–100.
7. Hình dạng: `spear` H ≥ 75; `kite` H < 75 ∧ P ≥ 20 ∧ D < 10 ∧ I < 10; `illusion` H ≥ 60 ∧ (I ≥ 10 ∨ D ≥ 10) ∧ P < 20; `diamond` H ≤ 25 ∧ P, D, I ≥ 20; còn lại `transitional`.
8. Thiếu tầng executive hoặc staff → lỗi `InsufficientResponses`, không trả 0.

```ts
type ResultV1 = { engineVersion: "1.0"; pillars: Record<Pillar,{byTier: Partial<Record<Tier,number>>; merged: number; discrepancy: number}>;
  supp: {P:number;D:number;I:number}; hpdi: {H:number;P:number;D:number;I:number}; dtiScore: number; dtiLevel: 1|2|3|4|5;
  shape: "spear"|"kite"|"illusion"|"diamond"|"transitional"; responseCounts: Record<Tier,number>;
  ruleBasedPrescription: { focusAxis: "P"|"D"|"I"; steps: string[] } };
```
Test golden bắt buộc: ví dụ sách (P=10, D=0, I=0, H=90, spear, mức 1); kim cương (30/30/30/10, mức 5); ca không phản hồi → lỗi; ca vênh executive cao/staff thấp → discrepancy > 0.3 và merged nghiêng về staff.

### 5.3 Bảng dữ liệu
Schema `pulse`: `assessments`, `survey_links`, `responses`, `results`, `prescriptions`, `artifacts` — chi tiết cột trong [spec M0 mục 4](superpowers/specs/2026-09-09-m0-measurement-design.md). Schema `core`: `settings`, `users`, `events`, `notifications`, `naming_violations`, `offboardings`, `llm_calls`, `ai_commands` — [spec M1 mục 8](superpowers/specs/2026-09-09-m1-workspace-design.md). Schema `biz` (M2): `customers`, `tickets`, `csat`. Schema `lod` (M3): `entities`. Ràng buộc chính: unique `(assessmentId, tier)`; unique `round`; `resolution` ≥ 50 ký tự khi `status='Đóng'` (trigger); soft delete cho `users`.

### 5.4 Sự kiện chuẩn
`{ id, type, payload, source, createdAt, deliveredAt?, ackedAt? }`; loại: `pulse.assessment.closed`, `workspace.user.offboarded`, `workspace.project.closed`, `biz.ticket.created|started|closed`, `ai.command.pending|executed`.

## 6. Yêu cầu phi chức năng

Chi tiết tại [ba/14-nfr.md](ba/14-nfr.md). Tóm tắt bắt buộc:

| Nhóm | Yêu cầu đo được |
|---|---|
| Bảo mật | OIDC + PKCE; 2FA bắt buộc cho dx-admin; khảo sát không lưu IP; PII che cho staff; khoá API không hiển thị lại; AI ghi phải HITL; audit không xoá |
| Hiệu năng | Portal/dashboard ≤ 2 giây P95 với 10.000 phản hồi; engine ≤ 500 ms; chốt có AI ≤ 30 giây; khảo sát chuyển câu ≤ 200 ms |
| Tải | ≤ 500 người dùng, 50 đồng thời, 20.000 ticket/năm |
| Nền tảng | Ubuntu 22.04/24.04, Docker Compose v2; `core` ≤ 6 GB, `full` ≤ 14 GB RAM; Chrome/Edge/Safari 2 bản gần nhất; 375 px |
| Khả dụng | Khởi động `full` ≤ 15 phút; healthcheck; DX-Core sống khi Metabase/Appsmith/Qdrant tắt |
| Dễ dùng | Khảo sát ≤ 8 phút; ≤ 5 trường bắt buộc/màn; trạng thái rỗng có hành động; lỗi nói cách sửa |
| Sao lưu | Dump Postgres + đồng bộ Nextcloud hằng đêm; snapshot tháng; RPO 24 giờ, RTO 2 giờ |
| Nguồn mở | AGPL-3.0, SPDX header, không vendor, build từ nguồn, tar.gz có phiên bản, CHANGELOG, bug tracker |

## 7. Ràng buộc thiết kế và triển khai

- Monorepo npm workspaces: `apps/web`, `packages/hpdi-engine` (không phụ thuộc Next/DB), `packages/contracts` (zod cho ResultV1, Event, DslCommand, LodEntity), `plugins/dx-ticket`, `deploy/`, `docs/`.
- Module chỉ giao tiếp qua `contracts` và API/sự kiện ở mục 5.4; không import chéo.
- Prisma cho `core`, `pulse`; SQL migration thuần cho `biz`; Alembic/Flyway không dùng.
- Compose profile `core`, `full`, `chat`, `local-llm`; volume `./data`.
- Nhánh `develop` làm việc, `main` chỉ merge có tag; CI: lint, typecheck, vitest, build, Playwright smoke.

## 8. Kiểm thử và nghiệm thu

| Cấp | Phạm vi | Công cụ | Điều kiện đạt |
|---|---|---|---|
| Đơn vị | hpdi-engine (golden), regex quy ước tên, định tuyến notifier, zod schema AI | vitest | engine coverage ≥ 90 % |
| Tích hợp | Keycloak import, OIDC login, provision Nextcloud + ACL bằng 2 tài khoản, notifier gửi thử, offboarding, rào chắn DB | compose `core` trong CI | tất cả xanh |
| E2E | Đăng nhập → mở đợt → 3 tầng điền → chốt → radar đúng số → kê đơn (provider none) → tải kit; Portal → handbook → /pulse | Playwright | hành trình trọn vẹn bằng vai trò khác người tạo dữ liệu |
| UAT | AC của 22 user story | người thật, môi trường dev | cuối mỗi sprint |
| Stress | 2 vòng trước mỗi release, desktop 1440 và mobile 375 | Playwright + đo tương phản | không tràn ngang, sáng/tối nhất quán, khảo sát ≤ 8 phút |

## 9. Ma trận truy vết (rút gọn)

| BR | FR | UC | US |
|---|---|---|---|
| BR-01 | FR-M0-03/05/06/07 | UC-02, UC-03 | US-03..08 |
| BR-02 | FR-M0-08 | UC-03 | US-09, US-10 |
| BR-03 | FR-M0-06/09 | UC-04 | US-08, US-11 |
| BR-04 | FR-M5-01, FR-M1-01/02/08 | UC-07 | US-15, US-18 |
| BR-05 | FR-M0-12, FR-M1-03/04/05/06 | UC-06 | US-13, US-16, US-17 |
| BR-06 | FR-M2-02..05 | UC-08 | US-19, US-20 |
| BR-07 | FR-M3-01/02/03 | — | — |
| BR-08 | FR-M1-10, FR-M3-04 | — | — |
| BR-09 | FR-M0-11, FR-M4-01..04, FR-M0-15 | UC-09 | US-21, US-22 |
| BR-10 | FR-M5-08, mục 6 nguồn mở | — | — |
| BR-11 | FR-M5-07 | — | — |
| BR-12 | FR-M2-01, mục 7 | — | — |

## 10. Lịch sử thay đổi
| Phiên bản | Ngày | Nội dung |
|---|---|---|
| 1.0 | 09/09/2026 | Bản đầu, sau khi chốt spec tổng, M0, M1 và bộ BA 15 mục |
