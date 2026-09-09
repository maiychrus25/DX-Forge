# 14. Yêu cầu phi chức năng (NFR)

## 14.1 An toàn và bảo mật
- Xác thực: OIDC qua Keycloak realm `dxlab` cho DX-Core, Nextcloud, n8n; PKCE cho client public; phiên 8 giờ, refresh 30 ngày; bắt buộc 2FA cho vai trò dx-admin (cấu hình Keycloak).
- Phân quyền: theo vai trò và nhóm Keycloak (ma trận mục 5); Appsmith dùng security filter theo email; Metabase nhúng bằng JWT có locked parameter phòng ban.
- Khảo sát ẩn danh: không lưu IP, user-agent, cookie định danh; token là chuỗi ngẫu nhiên 32 byte, hết hạn theo đợt.
- Dữ liệu cá nhân: biểu mẫu khách hàng có checkbox đồng ý không tích sẵn, lưu timestamp và phiên bản chính sách; số điện thoại/email che một phần trên dashboard cho vai trò staff; xoá mềm theo yêu cầu (ghi đè PII, giữ mã).
- AI: chỉ gửi điểm số, ngành, quy mô và văn bản tự do đã cắt; không gửi tên, email, SĐT; khoá API chỉ nằm trong `.env`, không hiện lại sau lưu; lệnh AI ghi có whitelist, bất biến kiểm trước khi thực thi, bắt buộc người duyệt.
- Truy vết: `core.events`, `core.notifications`, `core.llm_calls`, `offboardings` không xoá; log tập trung qua Loki/Promtail ở profile `full`.
- Tắt chia sẻ công khai bằng link trên Nextcloud; header bảo mật (CSP cho iframe cùng gốc qua Traefik, HSTS).

## 14.2 Hiệu suất
- Thời gian phản hồi: trang Portal và dashboard đợt đo ≤ 2 giây (P95) với 10.000 phản hồi; tính HPDI ≤ 500 ms; chốt đợt có AI ≤ 30 giây; khảo sát chuyển câu ≤ 200 ms.
- Tải trọng: một bản cài phục vụ tổ chức ≤ 500 người dùng, 50 người đồng thời; 20.000 ticket/năm; Nextcloud 200 GB.
- Nền tảng: server Ubuntu 22.04/24.04, Docker Compose v2; profile `core` ≤ 6 GB RAM, `full` ≤ 14 GB trên máy 16 GB; trình duyệt Chrome/Edge/Safari 2 phiên bản gần nhất; điện thoại từ 375 px.
- Khả dụng: khởi động toàn bộ profile `full` ≤ 5 phút; healthcheck từng container; DX-Core hoạt động khi Metabase/Appsmith/Qdrant tắt (ẩn phần nhúng, không lỗi).

## 14.3 Yêu cầu khác
- Màu sắc: 4 trục HPDI cố định (H `#6B7280`, P `#16A34A`, D `#F59E0B`, I `#7C3AED`); sáng/tối nhất quán theo DESIGN.md; tương phản ≥ 4.5:1; không dùng màu làm kênh thông tin duy nhất.
- Quốc tế hoá: giao diện tiếng Việt; mã và tài liệu kỹ thuật tiếng Anh; chuỗi UI tách tệp để thêm tiếng Anh ở giai đoạn sau; định dạng ngày `dd/MM/yyyy`, múi giờ Asia/Ho_Chi_Minh.
- Dễ sử dụng: khảo sát ≤ 8 phút, một câu mỗi màn; ≤ 5 trường bắt buộc/màn; mọi bảng có trạng thái rỗng kèm hành động; thông điệp lỗi nói rõ cách sửa; điều hướng bàn phím và nhãn ARIA cho biểu đồ.
- Sao lưu: cron hằng đêm dump Postgres và đồng bộ thư mục Nextcloud về volume sao lưu; snapshot CSV/JSON-LD cuối tháng vào Resources; hướng dẫn 3-2-1 với NAS trong docs/deployment; kịch bản khôi phục thử mỗi tháng, RPO 24 giờ, RTO 2 giờ.
- Nguồn mở và PoF: AGPL-3.0-or-later, SPDX header mọi tệp, không vendor, không sửa mã bên thứ ba, build từ nguồn chỉ qua `.env`, release tar.gz có phiên bản, CHANGELOG, bug tracker.
- Khả năng mở rộng: bài toán mẫu DX-Ticket đóng gói ở `plugins/dx-ticket`; đổi bài mẫu theo đề tháng 11 không sửa DX-Core.
