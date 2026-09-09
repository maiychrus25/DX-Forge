# Bộ tài liệu phân tích nghiệp vụ (BA) — DX-Pulse

Dự án: DX-Pulse, nền tảng Hệ điều hành Doanh nghiệp số (DX-OS) dự thi OLP PMNM 2026 và vòng ICTU 30/09/2026.
Nguồn thiết kế: `docs/superpowers/specs/` (spec tổng, M0 Đo lường, M1 Không gian làm việc). Phương pháp luận: sách "DX-OS in Action" (TS. Tạ Tuấn Anh, CC BY 4.0).

| # | Sản phẩm | Tệp | Phạm vi chi tiết |
|---|---|---|---|
| 1 | Sơ đồ BPMN | [01-bpmn.md](01-bpmn.md) | Đo lường & kích hoạt DX-Lab; Xử lý yêu cầu DX-Ticket |
| 2 | Swimlane workflow | [02-swimlane.md](02-swimlane.md) | Đợt đo, Ticket, Dự án P.A.R.A, Lệnh AI |
| 3 | Biểu đồ trạng thái | [03-state.md](03-state.md) | 5 đối tượng có ≥ 3 trạng thái |
| 4 | Danh sách chức năng | [04-functions.md](04-functions.md) | Toàn nền tảng, có trace code và phase |
| 5 | Ma trận phân quyền | [05-permissions.md](05-permissions.md) | 6 actor |
| 6 | Tiêu chí UX + phân tích thiết kế | [06-ux.md](06-ux.md) | |
| 7 | Mô tả màn hình | [07-screens.md](07-screens.md) | 12 màn hình M0/M1 + form DX-Ticket |
| 8 | Sitemap | [08-sitemap.md](08-sitemap.md) | Web ≤ cấp 2 |
| 9 | Sơ đồ use case | [09-usecase-diagram.md](09-usecase-diagram.md) | 3 biểu đồ |
| 10 | Sơ đồ luồng chức năng | [10-activity.md](10-activity.md) | 4 luồng |
| 11 | Đặc tả use case | [11-usecase-spec.md](11-usecase-spec.md) | 8 use case |
| 12 | Use scenario | [12-scenarios.md](12-scenarios.md) | 4 kịch bản |
| 13 | User story + AC | [13-user-stories.md](13-user-stories.md) | 22 story |
| 14 | Yêu cầu phi chức năng | [14-nfr.md](14-nfr.md) | |
| 15 | Quy tắc triển khai + bộ tài liệu dự án | [15-project-rules.md](15-project-rules.md) | |

Quy ước: use case và chức năng đặt tên "Động từ + Đối tượng"; actor là danh từ nhóm người; mã trace `Mx-yy` với x = module (0 Đo lường, 1 Không gian [H], 2 Quy trình [P], 3 Dữ liệu [D], 4 Trí tuệ [I], 5 Vỏ nền tảng).

## Sơ đồ

Toàn bộ sơ đồ vẽ bằng Excalidraw (theo quy ước dự án, không dùng mermaid). Nguồn `.excalidraw` và ảnh `.png` nằm trong [diagrams/](diagrams/). Sơ đồ được sinh từ đặc tả khai báo `diagrams/specs.py` bằng `diagrams/build_diagrams.py`; chạy `diagrams/render_all.sh` để dựng lại và xuất ảnh sau khi sửa đặc tả (cần skill `excalidraw-diagram` với renderer Playwright). Có thể mở tệp `.excalidraw` trực tiếp tại excalidraw.com để chỉnh tay.
