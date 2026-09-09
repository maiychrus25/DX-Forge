# 4. Danh sách chức năng

Cột: Trace code | Data object | Module | Function | Size (S/M/L) | Type (Workflow/Basic/Advanced/Other) | Description / Objective / Remarks | Phase (P1 = trước 30/09, P2 = trước 12/2026).

## Chức năng chung (Vỏ nền tảng, M5) và Xác thực

| Trace | Data object | Module | Function | Size | Type | Description | Phase |
|---|---|---|---|---|---|---|---|
| M5-01 | User | Auth | Đăng nhập qua Keycloak (OIDC) | S | Basic | Một định danh cho toàn hệ sinh thái | P1 |
| M5-02 | User | Auth | Đăng xuất toàn phiên | S | Basic | Gọi end-session Keycloak | P1 |
| M5-03 | User | Auth | Đổi mật khẩu / quên mật khẩu | S | Basic | Chuyển hướng sang trang Keycloak, không tự viết | P1 |
| M5-04 | User | Hồ sơ | Xem, cập nhật hồ sơ cá nhân | S | Basic | Tên, ảnh; email chỉ đọc | P1 |
| M5-05 | Notification | Thông báo | Xem lịch sử thông báo đã gửi | S | Basic | Bảng `core.notifications`, lọc theo kênh | P2 |
| M5-06 | Settings | Thiết lập | Cấu hình tổ chức (tên, ngành, quy mô) | S | Basic | Bản ghi đơn | P1 |
| M5-07 | Settings | Thiết lập | Cấu hình notifier (kênh → provider, target) | M | Advanced | Telegram/Mattermost | P1 |
| M5-08 | Settings | Thiết lập | Cấu hình LLM provider và khoá | S | Basic | gemini/anthropic/ollama/none | P1 |
| M5-09 | Launchpad | Trang chủ | Hiển thị Launchpad gợi ý module theo kết quả đo | M | Advanced | Đọc `pulse/latest` | P2 |
| M5-10 | Docs | Trợ giúp | Trang Về DX-Pulse, ghi công, giấy phép | S | Other | CC BY 4.0, AGPL | P1 |
| M5-11 | Setup | Triển khai | Cài đặt một lệnh (compose profiles) | M | Other | `core`, `full`, `chat`, `local-llm` | P1 |

## M0 — Đo lường DTI/HPDI

| Trace | Data object | Module | Function | Size | Type | Description | Phase |
|---|---|---|---|---|---|---|---|
| M0-01 | Assessment | Đo lường | Mở đợt đo | S | Workflow | Tăng round, chọn phiên bản bộ câu hỏi | P1 |
| M0-02 | SurveyLink | Đo lường | Sinh và chia sẻ link khảo sát theo tầng | S | Workflow | 3 token, có hạn | P1 |
| M0-03 | Response | Khảo sát | Điền khảo sát ẩn danh (mobile-first) | M | Workflow | Một câu mỗi màn, lưu nháp cục bộ | P1 |
| M0-04 | Assessment | Đo lường | Xem tiến độ phản hồi theo tầng | S | Basic | Đếm, nhắc qua notifier | P1 |
| M0-05 | Assessment | Đo lường | Chốt đợt đo | S | Workflow | Kiểm điều kiện tối thiểu | P1 |
| M0-06 | Result | Đo lường | Tính điểm trụ cột, độ vênh, HPDI, hình dạng, mức DTI | M | Advanced | Engine thuần, có test golden | P1 |
| M0-07 | Result | Đo lường | Xem dashboard đợt đo (radar, bảng trụ cột) | M | Advanced | Recharts, 3 lớp tầng | P1 |
| M0-08 | Prescription | AI | Sinh lộ trình kê đơn (roadmap) | M | Advanced | AI + fallback rule-based | P1 |
| M0-09 | Prescription | AI | Sinh câu hỏi đối chất khi vênh tầng | S | Advanced | | P1 |
| M0-10 | Prescription | AI | Sinh ma trận 5 RÕ và Poka-yoke cho quy trình lõi | M | Advanced | Nhập tên quy trình lõi | P1 |
| M0-11 | Prescription | AI | Hỏi báo cáo (chat neo vào JSON kết quả) | M | Advanced | Cắt đầu tiên nếu trễ | P1 |
| M0-12 | Artifact | Bộ kỷ luật | Xem trước và tải bộ P.A.R.A kit (zip) | M | Other | jszip | P1 |
| M0-13 | Artifact | Bộ kỷ luật | Cấp phát P.A.R.A lên Nextcloud | S | Workflow | Gọi provisioner M1 | P2 |
| M0-14 | Assessment | Đo lường | Xem lịch sử radar theo vòng | S | Advanced | Chồng radar các vòng | P1 |
| M0-15 | Assessment | Đo lường | Huỷ / lưu trữ đợt đo | S | Basic | | P1 |
| M0-16 | Questionnaire | Danh mục | Xem bộ câu hỏi theo phiên bản | S | Basic | Chỉ đọc, thay bằng tệp JSON | P1 |
| M0-17 | LlmCall | Báo cáo | Xem thống kê lời gọi AI (tỷ lệ hợp lệ, fallback, độ trễ, token) | S | Other | Phục vụ trình bày | P1 |
| M0-18 | Result | Báo cáo | Xuất báo cáo đợt đo PDF/Markdown | S | Other | | P2 |

## M1 — Không gian [H]

| Trace | Data object | Module | Function | Size | Type | Description | Phase |
|---|---|---|---|---|---|---|---|
| M1-01 | Realm | Định danh | Import realm, vai trò, client lúc khởi động | M | Other | Idempotent | P1 |
| M1-02 | User | Danh mục | Tạo/sửa/vô hiệu người dùng (đồng bộ Keycloak) | M | Basic | Qua admin REST | P1 |
| M1-03 | Department | Danh mục | Tạo/sửa phòng ban (nhóm Keycloak + thư mục AREAS) | M | Basic | Mã 2–5 chữ in hoa | P1 |
| M1-04 | ParaTree | Lưu trữ | Cấp phát cây P.A.R.A và ACL | M | Workflow | groupfolders | P1 |
| M1-05 | Project | Lưu trữ | Tạo dự án (nhóm, thư mục, thành viên) | M | Workflow | | P2 |
| M1-06 | Project | Lưu trữ | Đóng dự án (chuyển ARCHIVES, giao việc chắt lọc) | M | Workflow | | P2 |
| M1-07 | Resource | Lưu trữ | Duyệt cây Resources trên Portal | S | Basic | WebDAV listing | P1 |
| M1-08 | NamingViolation | Lưu trữ | Kiểm tra quy ước đặt tên hằng đêm, báo cáo vi phạm | M | Other | 2 regex | P2 |
| M1-09 | Portal | Cổng thông tin | Xem bảng tin, nút tác vụ theo vai trò | S | Basic | news.md | P1 |
| M1-10 | Handbook | Cổng thông tin | Xem Sổ tay nghiệp vụ số (markdown từ Resources) | S | Basic | | P2 |
| M1-11 | Notification | Giao tiếp | Gửi thông báo tới kênh (Telegram/Mattermost) | M | Other | adapter | P1 |
| M1-12 | Notification | Giao tiếp | Nhận callback nút bấm (duyệt/từ chối) | M | Advanced | Dùng cho M2/M4 | P2 |
| M1-13 | Offboarding | Định danh | Thu hồi truy cập 5 bước, đo thời gian | M | Workflow | | P2 |
| M1-14 | Organization | LOD | Xuất tổ chức và phòng ban dạng JSON-LD | S | Other | schema.org | P2 |
| M1-15 | Account | Định danh | Tạo tài khoản dịch vụ không OIDC (Appsmith/Metabase/Mattermost) | M | Other | Gửi mật khẩu một lần | P2 |

## M2 — Quy trình [P] (DX-Ticket)

| Trace | Data object | Module | Function | Size | Type | Description | Phase |
|---|---|---|---|---|---|---|---|
| M2-01 | Customer | Danh mục | Thêm/sửa/tìm/xem khách hàng | M | Basic | Appsmith | P2 |
| M2-02 | Ticket | Nghiệp vụ | Gửi yêu cầu qua biểu mẫu công khai (xác thực SĐT/Email) | M | Workflow | Poka-yoke lớp 1 | P2 |
| M2-03 | Ticket | Nghiệp vụ | Tạo ticket nội bộ | S | Workflow | | P2 |
| M2-04 | Ticket | Nghiệp vụ | Bắt đầu xử lý (tự gán nhân sự) | S | Workflow | | P2 |
| M2-05 | Ticket | Nghiệp vụ | Kết thúc xử lý (bắt buộc Hướng_Xử_Lý) | S | Workflow | Poka-yoke lớp 2 | P2 |
| M2-06 | Ticket | Nghiệp vụ | Xem danh sách theo lát cắt trạng thái, lọc theo người phụ trách | M | Basic | Security filter | P2 |
| M2-07 | Ticket | Nghiệp vụ | Đổi mức ưu tiên, gán lại nhân sự (quản lý) | S | Basic | | P2 |
| M2-08 | Event | Tự động hoá | Gửi email xác nhận/đóng + CSAT (n8n) | M | Other | Cột cờ hiệu chống trùng | P2 |
| M2-09 | Event | Tự động hoá | Cảnh báo khiếu nại tới kênh dx-ticket | S | Other | | P2 |
| M2-10 | Csat | Nghiệp vụ | Ghi nhận đánh giá CSAT qua link công khai | S | Workflow | | P2 |
| M2-11 | Event | Tự động hoá | Phát/nhận sự kiện chuẩn hoá `core.events` | M | Advanced | ack từ n8n | P2 |

## M3 — Dữ liệu [D]

| Trace | Data object | Module | Function | Size | Type | Description | Phase |
|---|---|---|---|---|---|---|---|
| M3-01 | Dashboard | Báo cáo | Xem dashboard DX-Ticket (Metabase nhúng, lọc theo vai trò) | M | Advanced | Chỉ số dẫn dắt/kết quả | P2 |
| M3-02 | Snapshot | Báo cáo | Kết xuất CSV + JSON-LD cuối tháng vào 41. Structured_Data | M | Other | n8n cron | P2 |
| M3-03 | Report | Báo cáo | Lập lịch gửi PDF định kỳ | S | Other | Metabase subscription | P2 |
| M3-04 | LodEntity | LOD | Xuất thực thể JSON-LD, catalog | M | Advanced | content negotiation | P2 |
| M3-05 | Dashboard | Trang chủ | Nhúng dashboard vào Portal | S | Basic | | P2 |

## M4 — Trí tuệ [I]

| Trace | Data object | Module | Function | Size | Type | Description | Phase |
|---|---|---|---|---|---|---|---|
| M4-01 | Embedding | AI | Nạp Resources vào Qdrant (ingest, tái nạp khi đổi) | M | Advanced | | P2 |
| M4-02 | Answer | AI | Hỏi đáp có trích nguồn trên Resources (RAG) | M | Advanced | | P2 |
| M4-03 | AiCommand | AI | Ra lệnh ngôn ngữ tự nhiên → DSL → duyệt → thực thi | L | Advanced | HITL | P2 |
| M4-04 | AiCommand | AI | Xem nhật ký lệnh AI và audit | S | Basic | | P2 |
| M4-05 | Alert | AI | Tác tử giám sát ticket quá hạn, báo nguyên nhân | M | Advanced | Chỉ báo, không thực thi | P2 |
