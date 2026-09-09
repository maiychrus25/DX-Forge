# DX-Forge — Spec forge-core và provider oss (lớp [H] trước)

Thay thế spec M1 cũ. Phần lớp [H] của đích oss kế thừa thiết kế Keycloak/Nextcloud/Telegram đã chốt, nay được **sinh ra từ plan** thay vì cấu hình tay.

## 1. forge-core

### 1.1 Schema (zod, gói `packages/forge-core/src/schema`)
- `IntentV1`: như spec tổng mục 3.1; `maturity` bắt buộc (không có → validator bật cờ `unmeasured`, chỉ cho lớp H).
- `PlanV1`: `{ version, generated_at, intent_hash, target, resources: Resource[] }`; `Resource = { id, layer: "H"|"P"|"D"|"I", type, spec, reason, depends_on: string[], gate: {allowed: boolean, why?: string} }`.
- `StateV1`: `{ target, entries: Record<resourceId, { externalId, checksum, appliedAt, verify?: {ok, checks[]} }> }`.

### 1.2 Planner
Đầu vào intent → đầu ra plan qua 3 bước:
1. **Template**: gói ngành (`packs/<id>/pack.yaml`) cung cấp thực thể, form, luật, workflow, dashboard mẫu; planner thay biến (`{{org.short_code}}`, `{{process.id}}`, phòng ban).
2. **Luật**: sinh lớp H từ `organization` và `channels` (realm, roles, groups theo phòng ban, cây P.A.R.A, ACL, topic); sinh lớp D tối thiểu từ mỗi thực thể (dashboard đếm theo trạng thái, snapshot tháng, lod_context); sinh lớp I từ Resources (rag_source) và từ quy trình có `A` (agent_policy với kênh approvals).
3. **AI (tuỳ chọn)**: đề xuất bổ sung trường, rào chắn, KPI, tên topic; đầu ra là danh sách `ResourcePatch` qua zod; planner áp patch rồi chạy validator; patch bị từ chối được ghi vào `plan.notes`.

### 1.3 Validator (không tắt được)
| Luật | Kiểm | Kết quả |
|---|---|---|
| Cổng trưởng thành | shape/dti_level so với layer của từng tài nguyên | `gate.allowed=false` + `why`; tài nguyên vẫn nằm trong plan để người thấy |
| Một A | mỗi `process.state_machine.transition` có đúng một vai trò A | lỗi |
| ≤ 5 bắt buộc | `process.form.fields.filter(required)` | lỗi, gợi ý đặt mặc định |
| Resources chỉ đọc | `storage.acl` cho `3. [R] RESOURCES` với all-staff phải là read | lỗi |
| PII | thực thể có trường `pii: true` phải có `data.dashboard.masking` | lỗi |
| HITL | `intel.agent_policy.approval_channel` không rỗng, `expire_hours ≤ 24` | lỗi |
| Phụ thuộc | đồ thị `depends_on` không vòng, id tồn tại | lỗi |

### 1.4 Apply, state, diff
- Thứ tự áp theo topo `depends_on`, theo lớp H → P → D → I.
- Mỗi tài nguyên: checksum spec; nếu state có checksum trùng → skip; khác → `update`; thiếu → `create`; có trong state nhưng không có trong plan → `destroy` (chỉ khi `--prune`).
- `--dry-run` in bảng create/update/destroy/skip kèm diff spec.
- Lỗi một tài nguyên: ghi state phần đã xong, dừng, `apply` lại tiếp tục từ chỗ dừng.

### 1.5 Verify
Mỗi adapter trả `Check[] = {name, ok, evidence}`; báo cáo tổng hợp markdown + JSON; wizard hiển thị xanh/đỏ theo lớp.

## 2. Provider oss — lớp [H]

| Tài nguyên | Adapter | apply | verify |
|---|---|---|---|
| identity.realm | keycloak | import realm `dxlab` nếu chưa có; clients `dx-forge-wizard`, `nextcloud`, `n8n` | GET realm 200 |
| identity.role | keycloak | tạo role dx-admin/manager/staff | role tồn tại |
| identity.group | keycloak | nhóm `/departments/<code>` với attribute code; `/projects/<slug>` | nhóm tồn tại, attribute đúng |
| storage.tree | nextcloud | group folder `DX-OS`; MKCOL cây P.A.R.A; PUT README.md mỗi nhánh | PROPFIND đủ nhánh |
| storage.acl | nextcloud (groupfolders ACL) | RESOURCES read all-staff; AREAS/<code> write nhóm; ARCHIVES admin | PUT bằng tài khoản staff vào RESOURCES trả 403; vào AREAS của mình trả 201 |
| portal.site | (sinh tệp) | `00. Portal/news.md`, `handbook/index.md`; wizard đích (nếu bật) đọc từ đây | tệp tồn tại |
| comms.channel / comms.topic | telegram, mattermost | Telegram: tạo topic trong supergroup đã cấu hình (bot admin), ghi `chat_id/thread_id`; Mattermost: tạo channel | gửi tin thử, nhận message_id |
| storage.audit_job | n8n | import workflow cron gọi `verify --naming` | workflow active |

Tài khoản dịch vụ dùng khi apply lấy từ `target.credentials_ref` (biến môi trường); không ghi vào plan/state.

## 3. Provider oss — lớp [P], [D], [I] (khung, chi tiết khi tới tuần)
- `process.entity` → postgres DDL (schema `biz`, cột, kiểu, khoá); `process.rule` → trigger PL/pgSQL; `process.form`/`process.app` → Appsmith app JSON (import qua API `/api/v1/applications/import`) với datasource Postgres; `process.workflow` → n8n workflow JSON (webhook → email/notify/update).
- `data.dashboard` → Metabase API (card, dashboard, filter); `data.snapshot` → n8n cron xuất CSV + JSON-LD vào Nextcloud `41. Structured_Data`; `data.lod_context` → tệp `context.jsonld` trong Resources và endpoint nhỏ do wizard đích phục vụ (tuỳ chọn).
- `intel.rag_source` → Qdrant collection + n8n ingest; `intel.agent_policy` → n8n workflow HITL (nhận lệnh, kiểm whitelist, gửi thẻ duyệt, thực thi).

## 4. Offboarding trong mô hình Forge
Không còn là tính năng của Forge; là một `process.workflow` sinh ra trong plan (gói lõi `packs/core`), chạy trên n8n của đích, 5 bước như thiết kế cũ, đo thời gian và ghi vào bảng `biz.offboardings`. Forge chỉ `verify` bằng cách chạy thử với tài khoản test.

## 5. Kiểm thử
- Unit: schema, planner với gói mẫu (snapshot plan), validator 20 ca, differ.
- Adapter: HTTP mock (nock) từng adapter; contract test với Keycloak/Nextcloud thật trong CI (compose `core`).
- Tích hợp: `plan` gói dx-ticket → `apply --target oss` → `verify` 100 % xanh → `apply` lần 2 toàn skip → `destroy --prune` sạch.
