# DX-Pulse — Spec M1: Không gian [H] — Môi trường làm việc số

Module 1 của nền tảng DX-OS (xem spec tổng). Chương tham chiếu trong sách: 4.2.1, 5.1–5.5, 10.4.2, 10.5.2.

## 1. Mục tiêu

Cấp cho một doanh nghiệp (một bản cài) bốn thứ mà sách gọi là "tầng móng": định danh tập trung, lưu trữ theo P.A.R.A có phân quyền, cổng thông tin nội bộ, trục giao tiếp tức thời. Tất cả được **cấp phát tự động** từ DX-Core (provisioner) chứ không cấu hình tay, và có thể **thu hồi trong 5 phút** (offboarding). Đây là chỗ Proteus chỉ mô tả, DX-Pulse chạy thật.

## 2. Thành phần

| Thành phần | Công cụ | Tự viết trong DX-Core |
|---|---|---|
| Định danh | Keycloak 26, realm `dxlab` | `KeycloakAdmin` (admin REST): tạo user, gán role, gán group, disable, logout-all; import realm từ `deploy/keycloak/realm-dxlab.json` |
| Lưu trữ | Nextcloud 30 (app `user_oidc`, `groupfolders`) | `NextcloudAdmin`: WebDAV tạo cây, OCS `groupfolders` API cấp quyền, listing cây Resources, kiểm tra quy ước tên |
| Cổng thông tin | trang `/` và `/portal/*` trong DX-Core | Portal: bảng tin, nút tác vụ, cây Resources nhúng, dashboard nhúng (M3), Sổ tay nghiệp vụ số (markdown từ Resources) |
| Giao tiếp | Telegram Bot API (mặc định), Mattermost (profile `chat`) | `Notifier` interface + 2 adapter + bảng định tuyến kênh |
| Năng suất cá nhân | Nextcloud Calendar/Tasks/Deck (bật app, không viết mã) | — |

Không có Outline: Resources trên Nextcloud + Portal là đủ cho giai đoạn 1 theo sách; Wiki là "vượt ngưỡng".

## 3. Định danh

- Realm `dxlab` import lúc khởi động (idempotent). Client: `dx-core` (OIDC, PKCE, public), `nextcloud` (confidential), `n8n` (confidential, để n8n gọi Core API bằng client credentials), `metabase-embed` không cần (Metabase OSS nhúng bằng JWT riêng).
- Vai trò realm: `dx-admin`, `manager`, `staff`. Nhóm = phòng ban (`/departments/<slug>`), thuộc tính `code` (ví dụ `FIN`, `OPS`) dùng cho quy ước đặt tên và P.A.R.A.
- DX-Core dùng `next-auth` với provider Keycloak; session chứa `sub`, `roles`, `groups`. Middleware chặn `/pulse/admin`, `/portal/admin` cho `dx-admin`/`manager`.
- Bảng `core.users` chỉ là cache (sub, email, name, roles, groups, lastSeenAt) cập nhật khi đăng nhập; nguồn sự thật là Keycloak.
- Dịch vụ không có OIDC ở bản cộng đồng (Appsmith CE, Metabase OSS, Mattermost Team): provisioner tạo tài khoản qua API của từng dịch vụ với cùng email, mật khẩu ngẫu nhiên gửi một lần qua notifier; Portal nhúng iframe. Ghi rõ giới hạn trong docs/architecture.md.

## 4. P.A.R.A trên Nextcloud

### 4.1 Cây chuẩn (group folder `DX-OS`)

```
DX-OS/
├── 1. [P] PROJECTS/                 # mỗi dự án một thư mục con
├── 2. [A] AREAS/<CODE>_<Tên phòng ban>/
├── 3. [R] RESOURCES/
│   ├── 00. Portal/                  # news.md, handbook/*.md (Sổ tay nghiệp vụ số)
│   ├── 10. GOVERNANCE/{11. Policies_Regulations, 12. SOP_Processes, 13. Technical_Manuals, 14. Templates_Forms}
│   ├── 20. EXPERIENCE/{21. Lessons_Learned, 22. Case_Studies, 23. Tips_Tricks, 24. FAQ_Troubleshooting}
│   ├── 30. EDUCATION/{31. Wiki_Onboarding, 32. Training_Courseware, 33. Product_Market_Info, 34. Reference_Library}
│   └── 40. ASSETS/{41. Structured_Data, 42. Unstructured_Data, 43. Brand_Media, 44. Versioned_Assets}
└── 4. [A] ARCHIVES/
```

### 4.2 Phân quyền (chương 5.3.4)

| Nhánh | all-staff | nhóm phòng ban tương ứng | dx-admin |
|---|---|---|---|
| 3. [R] RESOURCES | đọc | đọc | ghi |
| 2. [A] AREAS/<phòng ban> | không | ghi | ghi |
| 1. [P] PROJECTS/<dự án> | không | ghi (thành viên dự án, nhóm `/projects/<slug>`) | ghi |
| 4. [A] ARCHIVES | không | không | ghi |

Thực thi bằng `groupfolders` ACL. Tắt chia sẻ công khai bằng link (cấu hình Nextcloud `shareapi_allow_links=no`).

### 4.3 Provisioner (DX-Core, chạy khi admin bấm hoặc theo sự kiện)

- `ensureParaTree()`: tạo thiếu, không xoá thừa; idempotent.
- `ensureDepartment(code, name)`: tạo nhóm Keycloak + thư mục AREAS + ACL.
- `createProject(slug, name, members[])`: nhóm `/projects/<slug>`, thư mục PROJECTS, ACL, README theo mẫu.
- `closeProject(slug)`: chuyển thư mục sang ARCHIVES (WebDAV MOVE), thu quyền ghi, tạo tác vụ "chắt lọc template về 14. Templates_Forms" gửi cho chủ dự án qua notifier (bước Distill/Express chương 5.3.3). Không tự chọn tệp nào là template: đó là việc của người.
- `exportToResources(path, targetFolder)`: dùng bởi M0 (kit) và M3 (snapshot).

### 4.4 Kiểm tra quy ước đặt tên (chương 5.3.2, 11.3)

- Job đêm (n8n cron gọi `POST /api/workspace/audit`): liệt kê RESOURCES và AREAS qua WebDAV, so với hai regex: `^\d{2}_[A-Za-z0-9]+_(V\d+|Final)_\d{8}\.` và `^\d{8}_[A-Z]{2,5}_[A-Za-z0-9]+\.`. Vi phạm ghi `core.naming_violations` và gửi tổng hợp vào kênh `alerts`. Không tự đổi tên.

## 5. Cổng thông tin (DX-Portal)

- `/` sau đăng nhập: bảng tin (đọc `00. Portal/news.md`), nút tác vụ theo vai trò (Tạo yêu cầu → Appsmith M2; Bảng điều khiển → Metabase M3; Đo lường → `/pulse`; Tệp của tôi → Nextcloud), cây Resources 3 cấp (WebDAV listing, mở tệp bằng link Nextcloud), khối dashboard nhúng (M3, ẩn khi chưa có).
- `/portal/handbook/[slug]`: render markdown từ `00. Portal/handbook/`. Sổ tay nghiệp vụ số (chương 9.4.1) sống trong Nextcloud, Portal chỉ hiển thị; sửa trên Nextcloud là Portal đổi theo.
- Launchpad gợi ý module theo `GET /api/pulse/latest` (M0): chưa đo → nút "Đo trước"; spear → chỉ mở [H]; kite → mở [P]; …
- Không có trang admin riêng cho Portal ở M1: nội dung là tệp trong Resources.

## 6. Notifier

```ts
interface Notifier { send(channel: ChannelKey, msg: { text: string; actions?: { id: string; label: string }[] }): Promise<{ messageId: string }>; }
type ChannelKey = "announce" | "alerts" | "dx-ticket" | "approvals" | "it-support";
```

- Định tuyến trong `core.settings.notifier`: mỗi ChannelKey → `{ provider: "telegram"|"mattermost", target: string }` (Telegram: `chat_id` + `message_thread_id` của Topic; Mattermost: channel id).
- Telegram: bot token, Supergroup có Topics theo chương 5.5 (`#Thong_bao`, `#DX_Ticket`, `#Canh_bao`, `#Phe_duyet`, `#Tra_da` không định tuyến). `actions` → inline keyboard; callback webhook `POST /api/notify/telegram` xác thực bằng secret token; dùng cho HITL của M4 và duyệt của M2.
- Mattermost (profile `chat`): bot account, interactive message buttons, callback `POST /api/notify/mattermost`.
- Bảng `core.notifications` ghi mọi lần gửi (channel, provider, ok, messageId) để truy vết.

## 7. Offboarding 5 phút (chương 10.5.2)

Một nút "Thu hồi truy cập" trên `/portal/admin/users/[sub]` chạy tuần tự, mỗi bước ghi kết quả, dừng ở bước lỗi và cho chạy lại:

1. Keycloak: disable user, logout all sessions.
2. Nextcloud: `users/{id}/disable`; chuyển quyền sở hữu tệp cá nhân sang tài khoản `archive` (occ `files:transfer-ownership` qua container exec, hoặc để tệp trong group folder vốn không thuộc cá nhân).
3. Telegram: `banChatMember` khỏi Supergroup (bot cần quyền admin); Mattermost: deactivate.
4. Appsmith/Metabase (nếu có tài khoản riêng): gọi API vô hiệu hoá; thiếu API thì ghi việc thủ công vào kênh `it-support`.
5. Định tuyến công việc: ghi `core.events` `workspace.user.offboarded` để M2 chuyển ticket đang gán sang người thay thế.

Đo thời gian toàn chuỗi, hiển thị trên màn hình; mục tiêu < 5 phút, thực tế dự kiến < 30 giây.

## 8. Dữ liệu (schema `core`)

| Bảng | Trường |
|---|---|
| settings | key (pk), value jsonb (organization, notifier, para) |
| users | sub (pk), email, name, roles text[], groups text[], lastSeenAt, disabledAt |
| events | id, type, payload jsonb, source, createdAt, deliveredAt, ackedAt |
| notifications | id, channel, provider, target, messageId, ok, error, createdAt |
| naming_violations | id, path, rule, seenAt, resolvedAt |
| offboardings | id, sub, steps jsonb, startedAt, finishedAt, ok |
| llm_calls | (dùng chung với M0/M4) |

## 9. API (Core, đều yêu cầu role trừ webhook)

- `POST /api/workspace/provision` (dx-admin): ensureParaTree + ensure tất cả phòng ban từ Keycloak.
- `POST /api/workspace/departments` `{code,name}`; `POST /api/workspace/projects` `{slug,name,members}`; `POST /api/workspace/projects/{slug}/close`.
- `GET /api/workspace/resources?path=` (mọi người đã đăng nhập): listing.
- `POST /api/workspace/audit` (n8n client credentials).
- `POST /api/workspace/offboard/{sub}` (dx-admin).
- `POST /api/notify` (n8n, dx-admin) `{channel,text,actions}`; `POST /api/notify/telegram|mattermost` (callback).
- `GET /api/lod/organization` (JSON-LD, schema.org Organization + department) — mầm của M3.

## 10. Kiểm thử

- Unit: regex quy ước tên; định tuyến notifier; provisioner với HTTP mock (nock).
- Tích hợp (CI với compose `core`): import realm, đăng nhập OIDC, provision cây, kiểm ACL bằng WebDAV PROPFIND với 2 tài khoản (staff không ghi được RESOURCES, phòng ban ghi được AREAS của mình), gửi thông báo tới Telegram test group, offboarding tài khoản test và xác nhận 401 khi tái dùng session.
- E2E Playwright: đăng nhập → Portal hiện cây Resources → mở handbook → nút Đo lường dẫn sang `/pulse`.
- Stress 2 vòng desktop/mobile cho Portal theo quy tắc chung.

## 11. Ngoài phạm vi M1

Wiki riêng (Outline), LMS, CMS (chương 5.6, "vượt ngưỡng"); Google Keep/Tasks/Calendar (thay bằng app Nextcloud); MDM/DLP nâng cao (chương 10.6).
