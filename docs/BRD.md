# TÀI LIỆU YÊU CẦU NGHIỆP VỤ (BRD) — DX-Pulse

| Mục | Nội dung |
|---|---|
| Tên dự án | DX-Pulse — Hệ điều hành Doanh nghiệp số (DX-OS) kiến trúc Open-Core |
| Phiên bản tài liệu | 1.0, ngày 09/09/2026 |
| Đơn vị | Đội sinh viên ICTU (3 thành viên đứng tên) |
| Cuộc thi | Vòng ICTU "Phát triển PMNM tích hợp AI 2026" (nộp 30/09/2026); OLP PMNM 2026 chủ đề DX-OS (chấm 07–09/12/2026) |
| Giấy phép | GNU AGPL-3.0-or-later; phương pháp luận DX-OS của TS. Tạ Tuấn Anh (FDS) theo CC BY 4.0 |
| Tài liệu liên quan | [SRS.md](SRS.md), [ba/](ba/00-README.md), [superpowers/specs/](superpowers/specs/) |

## 1. Bối cảnh

Hơn 900.000 doanh nghiệp vừa và nhỏ (SME) Việt Nam đang chịu áp lực chuyển đổi số từ ba tầng: pháp lý (Đề án 06, Luật Giao dịch điện tử, Luật Dữ liệu, hoá đơn điện tử), thị trường (chuỗi cung ứng FDI, ESG, hành vi khách hàng) và nội tại (tri thức nằm trong đầu cá nhân, ốc đảo dữ liệu). Phần lớn chương trình chuyển đổi số rơi vào "ảo tưởng công nghệ": mua phần mềm trước, kỷ luật vận hành sau, dẫn tới rác đầu vào sinh rác đầu ra.

Sách "Xây dựng Hệ điều hành Doanh nghiệp số: Từ Tư duy đến Hành động" đề xuất mô hình HPDI (Human, Process, Data, Intelligence): chuyển đổi số là chuyển giao quyền điều khiển từ con người sang quy trình, dữ liệu rồi trí tuệ nhân tạo, theo trật tự bắt buộc P → D → I, và phải đo được tổ chức đang ở đâu trước khi đầu tư. Ban tổ chức OLP 2026 lấy mô hình này làm chủ đề và yêu cầu đội thi dựng "Trạm thực hành số DX-Lab" mô phỏng đủ 4 không gian bằng phần mềm nguồn mở, kế thừa ba trục low-code (2024), dữ liệu mở liên kết LOD (2025), LLM + RAG (2023).

Sản phẩm tham chiếu cùng trường, ICTU_Proteus-os, đã ghép Keycloak, n8n, Appsmith, Metabase, Qdrant, Mattermost thành nền tảng có marketplace và tác tử AI, nhưng bỏ trống phần đo lường (Phần I của sách), P.A.R.A và LOD chỉ nằm trên tài liệu.

## 2. Vấn đề nghiệp vụ cần giải quyết

| # | Vấn đề | Hệ quả hiện nay |
|---|---|---|
| P1 | Lãnh đạo SME không biết tổ chức đang ở mức trưởng thành số nào, và giám đốc chấm khác nhân viên | Đầu tư sai thứ tự: mua AI/BI khi quy trình chưa có, tỷ lệ thất bại cao |
| P2 | Tài liệu, quy trình, tri thức nằm rải rác trên Zalo, máy cá nhân; người nghỉ việc mang theo tri thức | Không kế thừa được, không có "nguồn sự thật duy nhất", AI không có dữ liệu sạch để học |
| P3 | Quy trình lõi (ví dụ chăm sóc khách hàng) chạy bằng trí nhớ, không có rào chắn; báo cáo thủ công, trễ | Sai sót, trễ SLA, lãnh đạo "mù" số liệu |
| P4 | AI chỉ là chatbot hỏi đáp rời rạc, không đọc được dữ liệu vận hành, hoặc ngược lại được tự ý hành động | Ảo giác, rủi ro tài chính, không kiểm toán được |
| P5 | Thu hồi truy cập khi nhân viên nghỉ việc phải làm tay ở nhiều hệ thống | Rò rỉ dữ liệu khách hàng |

## 3. Mục tiêu nghiệp vụ và tiêu chí thành công

| Mục tiêu | Chỉ số đo | Mức đạt |
|---|---|---|
| G1. Tổ chức tự "bắt mạch" được vị trí trên trục HPDI và nhận lộ trình hành động đúng thứ tự | Thời gian từ mở đợt đo đến có radar và kê đơn; số tổ chức đo thử | ≤ 1 tuần thu thập, ≤ 30 giây tính và kê đơn; ≥ 3 tổ chức/lớp học đo thử trước 12/2026 |
| G2. Tri thức tổ chức tập trung, phân quyền và có kỷ luật đặt tên | Cây P.A.R.A cấp phát tự động; tỷ lệ tệp sai quy ước | Một nút cấp phát ≤ 60 giây; báo cáo vi phạm hằng đêm |
| G3. Quy trình lõi chạy có rào chắn, không copy-paste, có dữ liệu sạch cho báo cáo | Số bước thủ công trong luồng DX-Ticket; tỷ lệ ticket đóng thiếu hướng xử lý | 0 bước copy/paste; 0 % ticket đóng thiếu Hướng_Xử_Lý |
| G4. AI hữu ích và an toàn | Tỷ lệ trả lời có trích nguồn; tỷ lệ lệnh ghi có người duyệt | 100 % trích nguồn từ Resources; 100 % lệnh ghi qua nút duyệt |
| G5. Thu hồi truy cập nhanh và trọn vẹn | Thời gian từ bấm đến ngắt hết | < 5 phút (kỳ vọng < 30 giây) |
| G6. Đạt điểm cuộc thi | 50/50 PoF; phần sản phẩm | Tự chấm đủ 50 PoF trước mỗi lần nộp; demo chạy trên máy công khai |

## 4. Phạm vi

### 4.1 Trong phạm vi
- M0 Đo lường: khảo sát DTI 360° ba tầng, ánh xạ HPDI, radar, hình dạng bệnh lý, kê đơn AI có fallback, câu đối chất, ma trận 5 RÕ và Poka-yoke, bộ kỷ luật P.A.R.A tải về, so sánh nhiều vòng đo.
- M1 Không gian [H]: định danh tập trung Keycloak, cây P.A.R.A và phân quyền trên Nextcloud, cổng thông tin nội bộ, kênh giao tiếp Telegram (mặc định) hoặc Mattermost, kiểm quy ước tên, thu hồi truy cập 5 bước.
- M2 Không gian [P]: bài toán mẫu DX-Ticket trên Appsmith, workflow n8n, hai lớp rào chắn, sự kiện chuẩn hoá.
- M3 Không gian [D]: dashboard Metabase, snapshot định kỳ về Resources, thực thể JSON-LD và catalog LOD.
- M4 Không gian [I]: hỏi đáp RAG trên Resources (Qdrant), lệnh AI theo DSL có whitelist và người duyệt, tác tử giám sát chỉ báo.
- M5 Vỏ nền tảng: Launchpad gợi ý module theo kết quả đo, cài đặt một lệnh, tài liệu PoF.

### 4.2 Ngoài phạm vi
- Đa thuê (multi-tenant): một bản cài phục vụ một doanh nghiệp.
- Marketplace plugin tổng quát; chỉ đóng gói một bài mẫu DX-Ticket (thay được khi có đề tháng 11).
- Wiki/LMS/CMS riêng, MDM, DLP nâng cao, SIEM (chương "vượt ngưỡng" của sách).
- Tích hợp phần mềm kế toán nội địa, hoá đơn điện tử.
- Ứng dụng di động gốc; chỉ web responsive và app Appsmith.

## 5. Các bên liên quan

| Bên | Vai trò | Mối quan tâm |
|---|---|---|
| Ban giám khảo ICTU / OLP | Chấm điểm | PoF, nguyên gốc, hoàn thiện, thân thiện, tích hợp AI, trình diễn |
| Giảng viên hướng dẫn | Bảo trợ đội | Đúng thể lệ, đúng tên đội |
| Đội phát triển (3 người + 6 AI agent) | Xây dựng | Kế hoạch rõ, PR có người duyệt, lịch 13 tuần |
| Lãnh đạo SME thử nghiệm | Người dùng đích | Đo nhanh, kết quả dễ hiểu, biết làm gì trước |
| Nhân viên SME | Người dùng hằng ngày | Điền khảo sát ≤ 8 phút, xử lý ticket trên điện thoại, tìm tài liệu một chỗ |
| Tác giả sách / FDS / VFOSSA | Chủ phương pháp luận, nhà tài trợ | Được ghi công đúng, phương pháp được áp dụng đúng trật tự |
| Cộng đồng nguồn mở | Người dùng lại | Giấy phép rõ, build từ nguồn, tài liệu đủ |

## 6. Yêu cầu nghiệp vụ cấp cao

| Mã | Yêu cầu | Giải quyết vấn đề | Ưu tiên |
|---|---|---|---|
| BR-01 | Đo được mức trưởng thành số qua khảo sát ba tầng và ánh xạ HPDI đúng công thức sách (P, D, I ≤ 30 %, H là phần dư, Supp lấy min tầng) | P1 | Bắt buộc |
| BR-02 | Kê đơn theo trật tự P → D → I; không bao giờ khuyên đầu tư AI khi quy trình chưa có; luôn có đơn khi mất AI | P1 | Bắt buộc |
| BR-03 | Phơi bày độ vênh giữa lãnh đạo và nhân viên, sinh câu hỏi đối chất | P1 | Bắt buộc |
| BR-04 | Một định danh cho mọi công cụ; vô hiệu một chỗ là ngắt mọi nơi | P5 | Bắt buộc |
| BR-05 | Kho tài liệu theo P.A.R.A được cấp phát và phân quyền tự động; Resources chỉ đọc với toàn thể | P2 | Bắt buộc |
| BR-06 | Quy trình lõi có rào chắn ở giao diện và máy chủ; không đóng ticket thiếu hướng xử lý; không nhập lại dữ liệu | P3 | Bắt buộc |
| BR-07 | Lãnh đạo xem chỉ số dẫn dắt và kết quả theo thời gian thực; báo cáo định kỳ và snapshot bất biến | P3 | Cao |
| BR-08 | Thực thể lõi có định danh và ngữ nghĩa mở (JSON-LD) để liên kết dữ liệu | P2, P3 | Cao |
| BR-09 | AI trả lời có trích nguồn nội bộ; lệnh ghi phải qua người duyệt; mọi lời gọi được ghi vết | P4 | Bắt buộc |
| BR-10 | Sản phẩm là phần mềm nguồn mở đúng chuẩn PoF, cài từ nguồn bằng một lệnh, cấu hình chỉ qua biến môi trường | G6 | Bắt buộc |
| BR-11 | Ghi công phương pháp luận DX-OS theo CC BY 4.0 ở README, LICENSE_NOTICE và giao diện | Đạo đức, pháp lý | Bắt buộc |
| BR-12 | Bài mẫu nghiệp vụ tách rời lõi để đổi theo đề chính thức tháng 11 mà không sửa lõi | G6 | Cao |

## 7. Ràng buộc

- Thời gian: ảnh chụp v0.1.0 nộp 30/09/2026 (M0 + một phần M1); v1.0.0 đầy đủ trước 06/12/2026; đề chính thức OLP chỉ có từ tháng 11.
- Nhân lực: 3 sinh viên đứng tên, 6 AI coding agent; mọi PR do người thật duyệt.
- Hạ tầng: VPS riêng 8 vCPU/16 GB cho demo; không dùng hạ tầng hay mã nguồn của công ty AHV.
- Công nghệ: ghép tối đa phần mềm nguồn mở (Keycloak, Nextcloud, n8n, Appsmith, Metabase, Qdrant, Mattermost tuỳ chọn, Postgres, Traefik); lõi tự viết bằng Next.js/TypeScript; không sửa mã bên thứ ba.
- Pháp lý: AGPL-3.0; dữ liệu cá nhân xử lý theo nguyên tắc đồng ý chủ động, tối thiểu hoá, che PII, xoá mềm.
- Ngôn ngữ: giao diện tiếng Việt; mã, chú thích, commit tiếng Anh.

## 8. Giả định và phụ thuộc

- Chưa có bộ câu hỏi gốc theo QĐ 1567/QĐ-BKHCN; bản v1 tự soạn theo 6 trụ cột và 3 câu thực chứng của sách, thay được bằng tệp JSON.
- Các bản cộng đồng Appsmith, Metabase, Mattermost không hỗ trợ OIDC; chấp nhận tài khoản riêng do hệ thống cấp và nhúng iframe.
- LLM thương mại (Gemini/Anthropic) dùng cho demo chính; Ollama là phương án nguồn mở, tiếng Việt yếu hơn.
- Telegram là dịch vụ ngoài; khi mất kết nối, thông báo ghi hàng chờ và gửi lại.

## 9. Rủi ro nghiệp vụ

| Rủi ro | Ảnh hưởng | Giảm thiểu |
|---|---|---|
| Giám khảo coi sản phẩm là bản sao Proteus | Mất điểm nguyên gốc | Mở đầu demo bằng đo lường, kết bằng P.A.R.A và LOD chạy thật; bảng đối chiếu trong bài trình bày |
| Đề tháng 11 đổi bài mẫu | Phải làm lại M2/M3 | Bài mẫu đóng gói ở `plugins/dx-ticket`, contracts cố định |
| Quỹ giờ người duyệt không theo kịp AI agent | Mã không hiểu, trình bày yếu | Mỗi PR có mô tả kiến trúc; người trình bày phải giải thích được từng module |
| Bộ ghép nặng, demo lỗi | Mất điểm hoàn thiện | Profile compose, healthcheck, DX-Core chạy được khi dịch vụ phụ tắt, diễn tập trình diễn 2 lần |

## 10. Lộ trình cấp cao

| Mốc | Nội dung |
|---|---|
| 30/09/2026 | v0.1.0: M0 đầy đủ, M1 định danh + P.A.R.A + Portal v1; nộp ICTU |
| 10/10/2026 | Chung kết ICTU (hackathon, trình bày, hỏi đáp) |
| 28/10/2026 | M2 DX-Ticket chạy trọn vòng với rào chắn và thông báo |
| 11/11/2026 | M3 dashboard, snapshot, LOD |
| 25/11/2026 | M4 RAG, lệnh AI có người duyệt; điều chỉnh theo đề chính thức |
| 02/12/2026 | v1.0.0, tài liệu PoF, video, VPS công khai |
| 07–10/12/2026 | Chấm kho mã và chung kết OLP |

## 11. Phê duyệt

| Vai trò | Họ tên | Ngày | Ký |
|---|---|---|---|
| Trưởng nhóm | | | |
| Giảng viên hướng dẫn | | | |
