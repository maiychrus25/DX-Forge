# 12. Use scenario — DX-Forge

## 12.1 Anh Tùng, tư vấn viên, dựng hệ thống cho công ty nội thất trong một buổi chiều
Sáng thứ hai anh Tùng gửi ba đường link khảo sát cho giám đốc, hai trưởng phòng và nhóm nhân viên của công ty nội thất 40 người. Chiều thứ tư đủ phản hồi, anh bấm chốt. Màn hình hiện hình sao lệch về "Con người", mức 2, và bảng chỉ ra giám đốc chấm vận hành 3.5 còn nhân viên chấm 1.8. Anh bấm "Sang phỏng vấn". Trợ lý mở lời: "Kết quả cho thấy nên bắt đầu từ kho tài liệu và một quy trình lõi. Quy trình nào đang làm mất khách nhất?" Anh trả lời "xử lý khiếu nại", chọn gói DX-Ticket, sửa SLA thành 24 giờ, xác nhận ai duyệt. Mười phút sau có intent. Bấm "Sinh plan": cây bốn lớp hiện ra, lớp Trí tuệ bị khoá với dòng "Quy trình chưa đủ, chưa bật AI"; mỗi mục có một câu lý do. Anh xem dry-run, bấm Apply, uống cà phê. Bảy phút sau verify toàn xanh. Anh đăng nhập vào hệ thống vừa sinh bằng tài khoản trưởng phòng: thấy kho tài liệu đã phân quyền, biểu mẫu khiếu nại có chặn số điện thoại sai, nhóm Telegram có sẵn các topic. Anh bấm "Sinh sổ tay" và gửi link cho giám đốc.

## 12.2 Chị Hoa, giám đốc, hiểu vì sao chưa được mua AI
Chị Hoa mở link plan trên điện thoại. Chị thấy mục "Trợ lý AI" bị gạch mờ, bấm "Vì sao": "Nhân viên báo phải nhập lại đơn hai lần; dữ liệu chưa sạch nên AI sẽ học sai. Bật lại sau khi quy trình chạy 1 quý và đo lại." Chị bấm Phê duyệt. Ba tháng sau chị đo lại, hình sao đã tròn hơn, lần này mục AI mở khoá.

## 12.3 Cô Lan, giảng viên, dạy bằng cách đọc plan
Cô Lan không cài gì ngoài CLI. Cô chạy `dxforge plan -f intent-mau.yaml --no-ai` trên lớp, mở `plan.yaml` cho sinh viên đọc từng tài nguyên: vì sao có nhóm này, vì sao Resources chỉ đọc, vì sao form chỉ có bốn trường bắt buộc. Rồi cô đổi `target` sang `gws`, chạy apply với tài khoản Google của lớp: Drive có cây thư mục, Sheets có bảng và kiểm dữ liệu, Forms có biểu mẫu; riêng AppSheet cô mở hướng dẫn sinh ra và làm tay cùng sinh viên trong 15 phút. Cùng một intent, hai hệ thống.

## 12.4 Trình diễn sản phẩm trong 15 phút
Mở đầu bằng radar của một doanh nghiệp thật. Sinh plan trực tiếp trước người xem, chỉ vào mục bị khoá. Apply lên máy demo, verify xanh, đăng nhập vào hệ thống vừa sinh, gửi một khiếu nại, xem thông báo Telegram, bấm duyệt đề xuất AI. Cuối cùng chạy `dxforge apply --target manifest` và mở thư mục kết quả: một gói đúng định dạng plugin của nền tảng đích. Câu kết: "Chúng tôi không làm nền tảng thứ hai. Chúng tôi làm thứ sinh ra nền tảng."
