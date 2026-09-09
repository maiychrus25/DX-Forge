# 1. Sơ đồ BPMN — DX-Forge

## 1.1 Đường ống DX-Forge

Đầu vào: tổ chức thật (người trả lời khảo sát, kiến trúc sư, lãnh đạo). Đầu ra: DX-Lab chạy trên đích, báo cáo verify, sổ tay trong Resources.

![bpmn-01-duong-ong](diagrams/bpmn-01-duong-ong.png)

*Nguồn chỉnh sửa: [`diagrams/bpmn-01-duong-ong.excalidraw`](diagrams/bpmn-01-duong-ong.excalidraw)*

Nghiệp vụ cần lưu ý: Forge không vận hành nghiệp vụ, mọi thứ chạy thật nằm ở lane Hệ thống đích; validator và cổng trưởng thành đứng sau AI; plan phải được phê duyệt trước apply; apply có dry-run và state; lớp [I] chỉ được cấp phát khi cổng cho phép.

## 1.2 Quy trình mẫu mà Forge sinh ra: gói dx-ticket trên đích

Đây là quy trình nghiệp vụ của **hệ thống sinh ra**, dùng để kiểm chứng gói mẫu; thay đổi theo đề chính thức tháng 11 chỉ ảnh hưởng gói, không ảnh hưởng Forge.

![bpmn-02-dx-ticket](diagrams/bpmn-02-dx-ticket.png)

*Nguồn chỉnh sửa: [`diagrams/bpmn-02-dx-ticket.excalidraw`](diagrams/bpmn-02-dx-ticket.excalidraw)*

Nghiệp vụ cần lưu ý: hai rào chắn Poka-yoke được Forge sinh ở cả Appsmith (lớp 1) và trigger Postgres (lớp 2); tác tử AI chỉ đề xuất, hành động ghi phải qua nút duyệt do `intel.agent_policy` quy định.
