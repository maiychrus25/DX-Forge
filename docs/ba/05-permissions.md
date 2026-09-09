# 5. Ma trận phân quyền

## Bảng 1 — Actor

| STT | Actor | Description |
|---|---|---|
| 1 | Quản trị viên DX (`dx-admin`) | Người vận hành hệ điều hành số của doanh nghiệp: cấu hình, đo lường, cấp phát, thu hồi truy cập |
| 2 | Quản lý (`manager`) | Trưởng bộ phận: xem kết quả đo, duyệt đề xuất AI, điều phối ticket, ra lệnh AI |
| 3 | Nhân viên (`staff`) | Người dùng nội bộ: dùng Portal, Resources, xử lý ticket được giao |
| 4 | Người trả lời khảo sát | Bất kỳ ai có token, ẩn danh, không đăng nhập (gồm cả ban giám đốc khi điền) |
| 5 | Khách hàng | Người ngoài gửi yêu cầu qua biểu mẫu công khai và đánh giá CSAT |
| 6 | Hệ thống tự động (n8n, tác tử AI) | Gọi API bằng client credentials; không có quyền duyệt |

## Bảng 2 — Ma trận

| Function | dx-admin | manager | staff | Người trả lời | Khách hàng | Hệ thống |
|---|---|---|---|---|---|---|
| Đăng nhập / hồ sơ cá nhân (M5-01..04) | O | O | O | X | X | X |
| Cấu hình tổ chức, notifier, LLM (M5-06..08) | O | X | X | X | X | X |
| Mở / chốt / huỷ đợt đo (M0-01,05,15) | O | O | X | X | X | X |
| Điền khảo sát (M0-03) | O* | O* | O* | O | X | X |
| Xem dashboard đợt đo, lịch sử (M0-07,14) | O | O | X | X | X | X |
| Sinh kê đơn, đối chất, 5 RÕ, hỏi báo cáo (M0-08..11) | O | O | X | X | X | X |
| Tải kit / cấp phát P.A.R.A (M0-12,13) | O | X | X | X | X | X |
| Xem thống kê lời gọi AI (M0-17) | O | X | X | X | X | X |
| Quản lý người dùng, phòng ban (M1-02,03) | O | X | X | X | X | X |
| Tạo / đóng dự án (M1-05,06) | O | O* | X | X | X | X |
| Duyệt Resources, Portal, Handbook (M1-07,09,10) | O | O | O | X | X | X |
| Gửi thông báo (M1-11) | O | X | X | X | X | O |
| Thu hồi truy cập (M1-13) | O | X | X | X | X | X |
| Gửi yêu cầu qua biểu mẫu công khai (M2-02) | O | O | O | X | O | X |
| Tạo ticket nội bộ (M2-03) | O | O | O | X | X | X |
| Bắt đầu / kết thúc xử lý ticket (M2-04,05) | O | O | O* | X | X | X |
| Xem danh sách ticket (M2-06) | O | O | O* | X | X | X |
| Đổi ưu tiên, gán lại nhân sự (M2-07) | O | O | X | X | X | X |
| Đánh giá CSAT (M2-10) | X | X | X | X | O | X |
| Phát / ack sự kiện (M2-11) | O | X | X | X | X | O |
| Xem dashboard nghiệp vụ (M3-01) | O | O | O* | X | X | X |
| Kết xuất snapshot (M3-02) | O | X | X | X | X | O |
| Hỏi đáp RAG (M4-02) | O | O | O | X | X | X |
| Ra lệnh AI (M4-03) | O | O | X | X | X | X |
| Duyệt / từ chối lệnh AI (M1-12, M4-03) | O | O* | X | X | X | X |
| Xem nhật ký lệnh AI (M4-04) | O | O | X | X | X | X |

Ghi chú `O*`:
- Điền khảo sát: người đăng nhập vẫn điền qua token của tầng mình, phản hồi vẫn ẩn danh.
- Tạo/đóng dự án (manager): chỉ dự án thuộc phòng ban mình.
- Bắt đầu/kết thúc xử lý (staff): chỉ ticket Chờ xử lý hoặc ticket đang gán cho chính mình (`Nhân_Sự_Phụ_Trách = USEREMAIL()`).
- Xem danh sách ticket (staff): lọc theo biểu thức `OR([Trạng_Thái]="Chờ xử lý", [Nhân_Sự_Phụ_Trách]=USEREMAIL())`.
- Dashboard nghiệp vụ (staff): chỉ khung nhìn phòng ban mình, dữ liệu định danh khách hàng đã che.
- Duyệt lệnh AI (manager): chỉ lệnh thuộc phạm vi phòng ban mình và mức rủi ro không phải tài chính; lệnh tài chính cần dx-admin.
