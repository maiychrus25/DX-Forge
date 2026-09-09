# TÀI LIỆU YÊU CẦU NGHIỆP VỤ (BRD) — DX-Forge

| Mục | Nội dung |
|---|---|
| Tên dự án | DX-Forge — Bộ biên dịch Hệ điều hành Doanh nghiệp số (DX-OS) |
| Phiên bản tài liệu | 2.0, ngày 09/09/2026 (thay bản 1.0 sau khi đổi ý tưởng lõi) |
| Đơn vị | Đội sinh viên ICTU (3 thành viên đứng tên) |
| Cuộc thi | Vòng ICTU "Phát triển PMNM tích hợp AI 2026" (nộp 30/09/2026); OLP PMNM 2026 chủ đề DX-OS (chấm 07–09/12/2026) |
| Giấy phép | GNU AGPL-3.0-or-later; phương pháp luận DX-OS của TS. Tạ Tuấn Anh (FDS) theo CC BY 4.0 |
| Tài liệu liên quan | [SRS.md](SRS.md), [ba/](ba/00-README.md), [superpowers/specs/](superpowers/specs/) |

## 1. Bối cảnh

Hơn 900.000 SME Việt Nam chịu áp lực chuyển đổi số nhưng phần lớn đi sai thứ tự: mua phần mềm trước, kỷ luật vận hành sau. Sách "Xây dựng Hệ điều hành Doanh nghiệp số" đưa ra mô hình HPDI và một "Trạm thực hành DX-Lab" mà doanh nghiệp tự lắp ráp bằng công cụ phổ thông: cây thư mục P.A.R.A, biểu mẫu có rào chắn, bảng tính phẳng, kịch bản tự động, dashboard, trợ lý AI. Sách hướng dẫn từng bước bằng tay; ban tổ chức OLP 2026 yêu cầu sinh viên dựng DX-Lab bằng phần mềm nguồn mở.

Cả hai đường đều gặp một nút thắt: **lắp ráp thủ công**. Doanh nghiệp phải tự tạo hàng chục thư mục, phân quyền, biểu mẫu, quy tắc, workflow; làm sai thứ tự (bật AI khi chưa có quy trình) không ai chặn; đổi công cụ là làm lại từ đầu. Các nền tảng nguồn mở tích hợp giải quyết bằng cách cho doanh nghiệp một nền tảng cài sẵn, nhưng vẫn là "cài rồi tự cấu hình", không đo trước, không sinh theo tổ chức.

## 2. Vấn đề nghiệp vụ

| # | Vấn đề | Hệ quả |
|---|---|---|
| P1 | Không đo được tổ chức đang ở đâu trên trục HPDI; lãnh đạo và nhân viên nhìn khác nhau | Đầu tư sai thứ tự, tỷ lệ thất bại cao |
| P2 | Từ "biết mình ở đâu" tới "có hệ thống chạy" là hàng chục thao tác tay trên nhiều công cụ, dễ sai, không lặp lại được | Chuyển đổi số dừng ở bài giảng; tư vấn viên phải làm tay cho từng khách |
| P3 | Không có gì chặn việc bật AI/BI khi quy trình chưa chuẩn | Rác đầu vào sinh rác đầu ra |
| P4 | Bị khoá vào một bộ công cụ: chọn Google thì không sang nguồn mở được và ngược lại | Mất chủ quyền, làm lại khi đổi nền tảng |
| P5 | Tri thức về "vì sao cấu hình thế này" nằm trong đầu người dựng | Người sau không hiểu, không bảo trì được |

## 3. Giải pháp nghiệp vụ

DX-Forge là bộ biên dịch: **đo → phỏng vấn → lập kế hoạch → cấp phát → kiểm chứng → viết sổ tay**. Đầu vào là tổ chức thật; đầu ra là một DX-Lab chạy trên đích doanh nghiệp chọn (bộ nguồn mở tự host, hoặc Google Workspace theo đúng sách), kèm lý do cho từng thứ được sinh ra và sổ tay vận hành. Cổng trưởng thành trong bộ kiểm tra không cho sinh lớp Trí tuệ khi lớp Quy trình chưa đủ. Gói ngành do cộng đồng đóng góp mở rộng bài toán theo lĩnh vực. Forge không có nền tảng vận hành riêng; nó sinh ra và kiểm chứng nền tảng của người khác.

## 4. Mục tiêu và tiêu chí thành công

| Mục tiêu | Chỉ số | Mức đạt |
|---|---|---|
| G1. Đo và kê đơn đúng thứ tự | Thời gian từ mở đợt đo tới radar + lộ trình | ≤ 30 giây sau khi chốt; ≥ 3 tổ chức đo thử trước 12/2026 |
| G2. Từ đo tới hệ thống chạy trong một buổi | Thời gian `plan` + `apply` + `verify` gói mẫu trên đích oss | ≤ 10 phút, verify 100 % xanh |
| G3. Một đặc tả, hai đích | Cùng intent sinh và cấp phát được lên oss và gws | Drive/Sheets/Forms/Apps Script tự động; AppSheet theo hướng dẫn sinh ra |
| G4. Không bao giờ sinh sai thứ tự | Số plan có lớp I được bật khi shape là spear/illusion | 0, có kiểm thử |
| G5. Mọi tài nguyên có lý do và sổ tay | Tỷ lệ tài nguyên trong plan có `reason`; sổ tay sinh tự động | 100 %; sổ tay có mặt trong Resources của đích |
| G6. Có thể tái lập và huỷ sạch | `apply` lần 2 không đổi gì; `destroy --prune` để lại 0 tài nguyên | Kiểm thử tích hợp |
| G7. Điểm cuộc thi | PoF; nguyên gốc; hoàn thiện; tích hợp AI | 50/50 PoF tự chấm; demo đăng nhập vào hệ thống vừa sinh |

## 5. Phạm vi

### 5.1 Trong phạm vi
- Giai đoạn `measure` (module DX-Pulse): khảo sát DTI 360° ba tầng, ánh xạ HPDI, radar, hình dạng, kê đơn AI có fallback, câu đối chất, so sánh vòng đo.
- `interview`: AI hỏi đáp ra `intent.yaml`; có form thay thế khi không có AI.
- `plan`: engine luật + gói ngành + AI đề xuất → `plan.yaml` bốn lớp H-P-D-I với lý do, cổng trưởng thành, validator.
- `apply`/`verify`/`destroy`: provider oss (Keycloak, Nextcloud, Postgres, n8n, Appsmith, Metabase, Qdrant, Telegram/Mattermost), provider gws (Drive, Sheets, Forms, Apps Script, Looker Studio, AppSheet hướng dẫn, Telegram), đích phụ xuất manifest plugin; state và diff; dry-run.
- `handbook`: sổ tay nghiệp vụ số sinh từ plan, đẩy vào Resources.
- Sinh chính sách tác tử AI (whitelist, kênh duyệt, hạn duyệt) và workflow HITL trên đích.
- Gói ngành: `packs/core` (offboarding, audit tên), `packs/dx-ticket` (mẫu), khung đóng góp gói.
- CLI `dxforge` và web wizard.

### 5.2 Ngoài phạm vi
- Forge không vận hành nghiệp vụ, không lưu dữ liệu nghiệp vụ, không có marketplace, không có tác tử thường trực.
- Không tự viết lại các công cụ đích; không sửa mã bên thứ ba.
- Không đa thuê: một thư mục làm việc `.dxforge/` cho một tổ chức.
- Đích gws: không tự động tạo AppSheet (không có API); không tích hợp Gmail gửi thư ngoài Apps Script sinh ra.

## 6. Các bên liên quan

| Bên | Vai trò | Mối quan tâm |
|---|---|---|
| Giám khảo ICTU / OLP | Chấm | Nguyên gốc, chạy thật, PoF, AI có kiểm soát |
| Tư vấn viên chuyển đổi số | Người dùng chính của CLI/wizard | Làm cho nhiều khách nhanh, lặp lại được, giải thích được |
| Lãnh đạo SME | Người trả lời khảo sát, người duyệt plan | Hiểu vì sao, không bị bán thứ chưa cần |
| Nhân viên SME | Người dùng hệ thống sinh ra | Hệ thống sinh ra dễ dùng, có sổ tay |
| Sinh viên, giảng viên | Học bằng cách đọc plan và sổ tay | Minh bạch từng bước |
| Cộng đồng nguồn mở | Đóng góp gói ngành, adapter đích | Giao diện gói và provider ổn định |
| Tác giả sách / FDS / VFOSSA | Chủ phương pháp | Ghi công đúng; sinh đúng trật tự P → D → I |

## 7. Yêu cầu nghiệp vụ cấp cao

| Mã | Yêu cầu | Vấn đề | Ưu tiên |
|---|---|---|---|
| BR-01 | Đo HPDI ba tầng theo công thức sách, phơi độ vênh, kê đơn theo trật tự P → D → I | P1 | Bắt buộc |
| BR-02 | Từ kết quả đo và hội thoại, tạo được đặc tả ngắn (intent) mà người không kỹ thuật đọc hiểu và sửa được | P2 | Bắt buộc |
| BR-03 | Sinh kế hoạch chi tiết bốn lớp từ intent, mỗi tài nguyên có lý do; người sửa được trước khi cấp phát | P2, P5 | Bắt buộc |
| BR-04 | Bộ kiểm tra chặn kế hoạch sai trật tự trưởng thành hoặc vi phạm luật (một A, ≤ 5 trường bắt buộc, Resources chỉ đọc, PII che, HITL) | P3 | Bắt buộc |
| BR-05 | Cấp phát tự động lên đích nguồn mở, kiểm chứng được, chạy lại không tạo trùng, huỷ sạch | P2 | Bắt buộc |
| BR-06 | Cùng intent cấp phát được lên Google Workspace (phần có API), phần không có API sinh hướng dẫn | P4 | Cao |
| BR-07 | Xuất được gói cho nền tảng khác (manifest plugin) để chứng minh Forge độc lập với đích | P4 | Trung bình |
| BR-08 | Sổ tay nghiệp vụ số sinh tự động cho hệ thống vừa cấp phát, nằm trong Resources của đích | P5 | Cao |
| BR-09 | AI chỉ đề xuất và giải thích; bộ kiểm tra luật đứng sau AI; không có AI vẫn chạy trọn đường ống | P3 | Bắt buộc |
| BR-10 | Hệ thống sinh ra có chính sách tác tử: hành động trong whitelist, lệnh ghi phải có người duyệt trên kênh chat | P3 | Cao |
| BR-11 | Gói ngành là đơn vị mở rộng: thêm ngành không sửa engine; DX-Ticket là gói mẫu, thay được theo đề tháng 11 | Bền vững | Cao |
| BR-12 | Phần mềm nguồn mở đúng PoF; CLI cài bằng npm, wizard bằng một lệnh compose; cấu hình qua biến môi trường | G7 | Bắt buộc |
| BR-13 | Ghi công phương pháp luận DX-OS (CC BY 4.0) và nêu rõ quan hệ với các đích | Đạo đức | Bắt buộc |

## 8. Ràng buộc
- Thời gian: v0.1.0 nộp 30/09/2026 (measure + plan bằng luật + apply oss lớp H + verify + wizard tối thiểu); v1.0.0 trước 06/12/2026; đề chính thức OLP có từ tháng 11.
- Nhân lực: 3 sinh viên đứng tên, 6 AI coding agent; mọi PR do người thật duyệt và giải thích được.
- Hạ tầng demo: VPS riêng 8 vCPU/16 GB cho **đích** oss; Forge tự thân chạy trên laptop. Không dùng hạ tầng hay mã nguồn của công ty AHV.
- Công nghệ: Node/TypeScript; Next.js cho wizard; SQLite cho phiên wizard; không sửa mã bên thứ ba.
- Ngôn ngữ: giao diện tiếng Việt; mã, chú thích, commit tiếng Anh.

## 9. Giả định và phụ thuộc
- API của các đích ổn định ở phiên bản ghim trong tài liệu (Keycloak 26, Nextcloud 30, n8n 1.x, Appsmith CE 1.x, Metabase OSS, Google Workspace API v3/v4).
- Bộ câu hỏi DTI v1 tự soạn theo cấu trúc QĐ 1567; thay bằng tệp JSON khi có bản gốc.
- Tài khoản Google Workspace thử nghiệm có quyền bật API Drive, Sheets, Forms, Apps Script; AppSheet làm tay theo hướng dẫn sinh ra.
- Telegram là dịch vụ ngoài; bot phải là admin của supergroup có Topics.

## 10. Rủi ro nghiệp vụ
| Rủi ro | Ảnh hưởng | Giảm thiểu |
|---|---|---|
| Giám khảo hỏi "sản phẩm chạy gì ngoài sinh cấu hình" | Điểm hoàn thiện | Demo luôn đăng nhập vào hệ thống vừa sinh, chạy quy trình mẫu, bấm duyệt AI, xem verify |
| Provider quá rộng | Trễ | oss đủ trước; gws tối thiểu Drive/Sheets/Forms/Apps Script; AppSheet chỉ hướng dẫn |
| AI sinh plan sai | Cấp phát sai | Validator luật không tắt được; dry-run diff; người duyệt plan |
| Đề tháng 11 đổi bài | Làm lại gói | Gói ngành tách khỏi engine |
| Trùng công cụ với sản phẩm cùng trường | Điểm nguyên gốc | Sản phẩm khác loại: Forge sinh ra nền tảng, có đích xuất manifest cho chính nền tảng kia |

## 11. Lộ trình cấp cao
| Mốc | Nội dung |
|---|---|
| 30/09/2026 | v0.1.0: measure, plan (luật), apply oss lớp H (Keycloak, Nextcloud P.A.R.A, Telegram), verify, wizard 4 màn; nộp ICTU |
| 10/10/2026 | Chung kết ICTU |
| 14/10/2026 | provider oss lớp P + D với gói dx-ticket; AI interview/plan; handbook |
| 11/11/2026 | provider gws; lớp I (RAG, agent_policy); đích manifest |
| 25/11/2026 | Điều chỉnh theo đề chính thức; gói ngành thứ hai; wizard hoàn thiện |
| 02/12/2026 | v1.0.0, PoF, video, demo công khai |
| 07–10/12/2026 | Chấm kho mã và chung kết OLP |

## 12. Phê duyệt
| Vai trò | Họ tên | Ngày | Ký |
|---|---|---|---|
| Trưởng nhóm | | | |
| Giảng viên hướng dẫn | | | |
