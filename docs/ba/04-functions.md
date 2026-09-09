# 4. Danh sách chức năng — DX-Forge

Cột: Trace | Data object | Module | Function | Size | Type | Description | Phase (P1 = trước 30/09, P2 = trước 12/2026). Mã trace theo giai đoạn: W (wizard/chung), M0 (measure), I (interview), P (plan), A (apply/verify/destroy), H (handbook), K (gói ngành), C (CLI).

## Chung, xác thực, thiết lập, wizard

| Trace | Data object | Module | Function | Size | Type | Description | Phase |
|---|---|---|---|---|---|---|---|
| W-01 | Session | Auth | Đăng nhập wizard (mật khẩu quản trị hoặc OIDC) | S | Basic | 5 lần sai khoá 15 phút | P1 |
| W-02 | Session | Auth | Đăng xuất | S | Basic | | P1 |
| W-03 | Workspace | Thiết lập | Tạo / chọn thư mục làm việc `.dxforge/` | S | Basic | Một tổ chức một thư mục | P1 |
| W-04 | Settings | Thiết lập | Cấu hình LLM provider và khoá | S | Basic | gemini/anthropic/ollama/none, nút kiểm tra | P1 |
| W-05 | Settings | Thiết lập | Cấu hình đích (oss/gws/proteus-manifest) và `credentials_ref` | M | Basic | Không lưu giá trị bí mật | P1 |
| W-06 | Settings | Thiết lập | Cấu hình notifier tạm cho khảo sát | S | Basic | Telegram/Mattermost | P1 |
| W-07 | Run | Trang chủ | Thanh đường ống 6 bước, trạng thái từng bước, nút chạy | M | Advanced | Bước sau mở khi bước trước có sản phẩm | P1 |
| W-08 | Run | Báo cáo | Xem lịch sử chạy (`runs`) và báo cáo | S | Basic | | P2 |
| W-09 | Pack | Danh mục | Thư viện gói ngành: liệt kê, xem, thêm từ thư mục/URL | M | Basic | Từ chối gói sai schema | P2 |
| W-10 | Docs | Trợ giúp | Trang Về: ghi công, giấy phép, quan hệ với đích | S | Other | | P1 |
| W-11 | LlmCall | Báo cáo | Thống kê lời gọi AI theo giai đoạn | S | Other | | P1 |

## measure (module DX-Pulse)

| Trace | Data object | Module | Function | Size | Type | Description | Phase |
|---|---|---|---|---|---|---|---|
| M0-01 | Assessment | measure | Mở đợt đo | S | Workflow | round tăng, 3 token | P1 |
| M0-02 | SurveyLink | measure | Chia sẻ link theo tầng (sao chép, QR, gửi kênh) | S | Workflow | | P1 |
| M0-03 | Response | Khảo sát | Điền khảo sát ẩn danh, mobile-first, lưu nháp | M | Workflow | | P1 |
| M0-04 | Assessment | measure | Xem tiến độ phản hồi, nhắc | S | Basic | | P1 |
| M0-05 | Assessment | measure | Chốt đợt đo (điều kiện tối thiểu) | S | Workflow | | P1 |
| M0-06 | Result | measure | Tính điểm, độ vênh, HPDI, hình dạng, mức | M | Advanced | Engine thuần, golden | P1 |
| M0-07 | Result | measure | Dashboard đợt đo (radar, bảng trụ cột) | M | Advanced | | P1 |
| M0-08 | Prescription | AI | Kê đơn lộ trình P→D→I (fallback luật) | M | Advanced | | P1 |
| M0-09 | Prescription | AI | Câu hỏi đối chất khi vênh | S | Advanced | | P1 |
| M0-10 | Prescription | AI | Ma trận 5 RÕ và Poka-yoke cho quy trình lõi | M | Advanced | Nạp vào intent | P1 |
| M0-11 | Prescription | AI | Hỏi báo cáo | M | Advanced | Cắt đầu tiên nếu trễ | P2 |
| M0-12 | Artifact | measure | Tải bộ P.A.R.A kit (zip) — đường tắt | S | Other | | P1 |
| M0-13 | Assessment | measure | So sánh các vòng đo | S | Advanced | | P1 |
| M0-14 | Assessment | measure | Huỷ / lưu trữ đợt đo | S | Basic | | P1 |
| M0-15 | Questionnaire | Danh mục | Xem bộ câu hỏi theo phiên bản | S | Basic | | P1 |
| M0-16 | Result | API | `GET /api/pulse/latest` cho interview/plan | S | Other | | P1 |

## interview

| Trace | Data object | Module | Function | Size | Type | Description | Phase |
|---|---|---|---|---|---|---|---|
| I-01 | Intent | interview | Phỏng vấn bằng AI ra intent.yaml (≤ 12 lượt) | M | Advanced | Ngữ cảnh ResultV1 | P2 |
| I-02 | Intent | interview | Form intent khi không có AI | M | Workflow | 5 phần | P1 |
| I-03 | Intent | interview | Gợi ý và gắn gói ngành cho quy trình lõi | S | Basic | | P2 |
| I-04 | Intent | interview | Xem, sửa, kiểm lỗi intent (YAML + form) | M | Basic | | P1 |

## plan

| Trace | Data object | Module | Function | Size | Type | Description | Phase |
|---|---|---|---|---|---|---|---|
| P-01 | Plan | plan | Sinh plan từ intent (template + luật) | L | Advanced | Deterministic | P1 |
| P-02 | Plan | plan | AI đề xuất patch tài nguyên | M | Advanced | Qua zod, validator sau | P2 |
| P-03 | Plan | plan | Cổng trưởng thành theo shape | M | Advanced | 8 ca kiểm thử | P1 |
| P-04 | Plan | plan | Validator luật (một A, ≤5 bắt buộc, RESOURCES đọc, PII, HITL, phụ thuộc) | M | Advanced | | P1 |
| P-05 | Plan | plan | Xem plan dạng cây theo lớp, lý do, cổng | M | Advanced | | P1 |
| P-06 | Plan | plan | Sửa spec tài nguyên inline, đánh dấu bỏ | M | Basic | | P2 |
| P-07 | Plan | AI | Giải thích "Vì sao" cho tài nguyên | S | Advanced | Fallback reason | P2 |
| P-08 | Plan | plan | Kiểm plan đã sửa (`--check`) | S | Basic | | P1 |

## apply / verify / destroy

| Trace | Data object | Module | Function | Size | Type | Description | Phase |
|---|---|---|---|---|---|---|---|
| A-01 | Run | apply | Dry-run: bảng create/update/skip/destroy + diff | M | Advanced | Không gọi API ghi | P1 |
| A-02 | State | apply | Apply theo topo và lớp, ghi state từng tài nguyên, chạy tiếp sau ngắt | L | Workflow | | P1 |
| A-03 | Report | verify | Verify từng tài nguyên, báo cáo xanh/đỏ | M | Workflow | | P1 |
| A-04 | State | destroy | Destroy theo thứ tự ngược, `--prune`, xác nhận 2 bước | M | Workflow | | P2 |
| A-05 | Resource | provider oss | Lớp H: realm, role, group, cây P.A.R.A, ACL, portal files, channel/topic, audit job | L | Advanced | | P1 |
| A-06 | Resource | provider oss | Lớp P: DDL, trigger, Appsmith app, n8n workflow | L | Advanced | | P2 |
| A-07 | Resource | provider oss | Lớp D: Metabase dashboard, snapshot, lod_context | M | Advanced | | P2 |
| A-08 | Resource | provider oss | Lớp I: Qdrant + ingest, workflow HITL theo agent_policy | M | Advanced | | P2 |
| A-09 | Resource | provider gws | Drive, Sheets, Forms, Apps Script, Looker link, AppSheet guide, Telegram | L | Advanced | | P2 |
| A-10 | Resource | provider proteus-manifest | Xuất manifest.yaml + SQL + workflows + dashboards | M | Other | Validate schema | P2 |
| A-11 | Report | verify | Kiểm quy ước đặt tên (`verify --naming`) | S | Other | | P2 |

## handbook, gói ngành, CLI

| Trace | Data object | Module | Function | Size | Type | Description | Phase |
|---|---|---|---|---|---|---|---|
| H-01 | Handbook | handbook | Sinh sổ tay nghiệp vụ số, đẩy vào Resources của đích | M | Advanced | AI, fallback template | P2 |
| H-02 | Report | handbook | Sinh `architecture.md` cho kiến trúc sư | S | Other | | P1 |
| K-01 | Pack | packs | Schema gói, nạp gói, thay biến | M | Advanced | | P1 |
| K-02 | Pack | packs | Gói core: offboarding 5 bước, audit tên, snapshot | M | Workflow | | P2 |
| K-03 | Pack | packs | Gói dx-ticket mẫu | M | Workflow | Thay được theo đề tháng 11 | P2 |
| C-01 | — | CLI | `measure`, `interview`, `plan`, `apply`, `verify`, `handbook`, `destroy`, `packs`, `explain`; `--json`; mã thoát | M | Other | | P1 |
