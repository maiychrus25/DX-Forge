# Bộ tài liệu phân tích nghiệp vụ (BA) — DX-Forge

Dự án: DX-Forge, bộ biên dịch sinh Hệ điều hành Doanh nghiệp số (DX-OS) từ đặc tả, dự thi OLP PMNM 2026 và vòng ICTU 30/09/2026. Bản này thay bộ BA 1.0 (DX-Pulse nền tảng) sau khi đổi ý tưởng lõi ngày 09/09/2026; module đo lường vẫn tên DX-Pulse.
Nguồn thiết kế: `docs/superpowers/specs/` (spec tổng DX-Forge, M0 measure, forge-core + provider oss). Tài liệu cấp trên: [BRD](../BRD.md) (yêu cầu nghiệp vụ) và [SRS](../SRS.md) (đặc tả phần mềm, có ma trận truy vết BR → FR → UC → US). Phương pháp luận: sách "DX-OS in Action" (TS. Tạ Tuấn Anh, CC BY 4.0).

| # | Sản phẩm | Tệp | Phạm vi chi tiết |
|---|---|---|---|
| 1 | Sơ đồ BPMN | [01-bpmn.md](01-bpmn.md) | Đường ống Forge; quy trình mẫu gói dx-ticket mà Forge sinh ra |
| 2 | Swimlane workflow | [02-swimlane.md](02-swimlane.md) | Đợt đo, Intent, Plan, Tài nguyên trên đích |
| 3 | Biểu đồ trạng thái | [03-state.md](03-state.md) | Đợt đo, Lần chạy, Tài nguyên, Lệnh AI sinh ra, Ticket (gói) |
| 4 | Danh sách chức năng | [04-functions.md](04-functions.md) | Theo giai đoạn đường ống, có trace code và phase |
| 5 | Ma trận phân quyền | [05-permissions.md](05-permissions.md) | 4 actor của Forge |
| 6 | Tiêu chí UX + phân tích thiết kế | [06-ux.md](06-ux.md) | |
| 7 | Mô tả màn hình | [07-screens.md](07-screens.md) | 10 màn wizard + 6 màn measure |
| 8 | Sitemap | [08-sitemap.md](08-sitemap.md) | Web ≤ cấp 2 |
| 9 | Sơ đồ use case | [09-usecase-diagram.md](09-usecase-diagram.md) | measure; interview + plan; apply/verify/handbook/packs |
| 10 | Sơ đồ luồng chức năng | [10-activity.md](10-activity.md) | 4 luồng |
| 11 | Đặc tả use case | [11-usecase-spec.md](11-usecase-spec.md) | UC-01..05 (measure) + UC-10..16 |
| 12 | Use scenario | [12-scenarios.md](12-scenarios.md) | 4 kịch bản |
| 13 | User story + AC | [13-user-stories.md](13-user-stories.md) | US-01..14 + US-23..39 |
| 14 | Yêu cầu phi chức năng | [14-nfr.md](14-nfr.md) | |
| 15 | Quy tắc triển khai + bộ tài liệu dự án | [15-project-rules.md](15-project-rules.md) | |

Quy ước: use case và chức năng đặt tên "Động từ + Đối tượng"; actor là danh từ nhóm người; mã trace theo giai đoạn: W (wizard/chung), M0 (measure), I (interview), P (plan), A (apply/verify/destroy), H (handbook), K (gói ngành), C (CLI).

## Sơ đồ

Toàn bộ sơ đồ vẽ bằng Excalidraw (theo quy ước dự án, không dùng mermaid). Nguồn `.excalidraw` và ảnh `.png` nằm trong [diagrams/](diagrams/). Sơ đồ được sinh từ đặc tả khai báo `diagrams/specs.py` bằng `diagrams/build_diagrams.py`; chạy `diagrams/render_all.sh` để dựng lại và xuất ảnh sau khi sửa đặc tả (cần skill `excalidraw-diagram` với renderer Playwright). Có thể mở tệp `.excalidraw` trực tiếp tại excalidraw.com để chỉnh tay.
