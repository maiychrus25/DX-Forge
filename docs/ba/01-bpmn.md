# 1. Sơ đồ BPMN

## 1.1 Quy trình "Đo lường và kích hoạt DX-Lab" (M0 → M1)

Đầu vào: hồ sơ tổ chức (tên, ngành, quy mô, phòng ban). Đầu ra: kết quả HPDI (ResultV1), lộ trình kê đơn, cây P.A.R.A đã cấp phát trên Nextcloud, thông báo tới kênh `announce`.

![bpmn-01-do-luong](diagrams/bpmn-01-do-luong.png)

*Nguồn chỉnh sửa: [`diagrams/bpmn-01-do-luong.excalidraw`](diagrams/bpmn-01-do-luong.excalidraw)*

Nghiệp vụ cần lưu ý: phản hồi ẩn danh, không lưu IP; hệ số Supp lấy giá trị thấp nhất giữa các tầng; trật tự kê đơn bắt buộc P → D → I; cấp phát P.A.R.A là idempotent (chạy lại không xoá thư mục đã có).

## 1.2 Quy trình "Xử lý yêu cầu khách hàng" (DX-Ticket, M2, có Poka-yoke và AI)

Đầu vào: yêu cầu từ biểu mẫu công khai hoặc nhân viên nhập. Đầu ra: ticket đóng có `Hướng_Xử_Lý`, email CSAT, snapshot cuối tháng.

![bpmn-02-dx-ticket](diagrams/bpmn-02-dx-ticket.png)

*Nguồn chỉnh sửa: [`diagrams/bpmn-02-dx-ticket.excalidraw`](diagrams/bpmn-02-dx-ticket.excalidraw)*

Nghiệp vụ cần lưu ý: hai rào chắn Poka-yoke chạy ở cả giao diện Appsmith và tầng máy chủ; AI chỉ đề xuất, mọi hành động thay đổi trạng thái tài chính hoặc phát ngôn ra ngoài phải qua nút duyệt của quản lý (Human-in-the-loop).
