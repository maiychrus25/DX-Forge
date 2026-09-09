# 5. Ma trận phân quyền — DX-Forge

## Bảng 1 — Actor

| STT | Actor | Description |
|---|---|---|
| 1 | Kiến trúc sư DX (`architect`) | Người chạy đường ống trên wizard/CLI: tư vấn viên, IT nội bộ, sinh viên. Chủ thư mục làm việc |
| 2 | Lãnh đạo (`sponsor`) | Trả lời khảo sát tầng executive; xem plan và phê duyệt trên wizard (không sửa, không apply) |
| 3 | Người trả lời khảo sát | Ẩn danh, có token, không đăng nhập |
| 4 | Hệ thống đích | Keycloak, Nextcloud, n8n… nhận lệnh apply/verify; không phải người |
| 5 | Người dùng hệ thống sinh ra | Ngoài Forge; quyền do plan (gói ngành) quy định trên đích |

## Bảng 2 — Ma trận

| Function | architect | sponsor | Người trả lời | Hệ thống đích |
|---|---|---|---|---|
| Đăng nhập wizard, thư mục làm việc (W-01..03) | O | O | X | X |
| Thiết lập LLM, đích, notifier (W-04..06) | O | X | X | X |
| Thư viện gói, thêm gói (W-09) | O | O* | X | X |
| Mở / chốt / huỷ đợt đo (M0-01, 05, 14) | O | X | X | X |
| Điền khảo sát (M0-03) | O* | O* | O | X |
| Xem dashboard đợt đo, so sánh vòng (M0-07, 13) | O | O | X | X |
| Kê đơn, đối chất, 5 RÕ, hỏi báo cáo (M0-08..11) | O | O | X | X |
| Tải kit (M0-12) | O | O | X | X |
| Phỏng vấn / form / sửa intent (I-01..04) | O | O* | X | X |
| Sinh plan, kiểm plan (P-01..04, 08) | O | X | X | X |
| Xem plan, "Vì sao" (P-05, 07) | O | O | X | X |
| Sửa spec, đánh dấu bỏ (P-06) | O | X | X | X |
| Phê duyệt plan trước apply | O | O | X | X |
| Dry-run, apply, destroy (A-01, 02, 04) | O | X | X | X |
| Verify, xem báo cáo (A-03, 11, W-08) | O | O | X | X |
| Nhận lệnh cấp phát/kiểm chứng (A-05..10) | X | X | X | O |
| Sinh sổ tay, architecture.md (H-01, 02) | O | X | X | X |
| CLI (C-01) | O | X | X | X |

`O*`: sponsor chỉ xem thư viện gói; điền khảo sát qua token tầng của mình, vẫn ẩn danh; sponsor sửa intent chỉ ở phần "quy trình lõi" (tên, SLA), không đổi đích và kênh.

Quyền trên hệ thống sinh ra (dx-admin, manager, staff, khách hàng) được ghi trong từng gói ngành (`packs/<id>/handbook/permissions.md`) và sinh ra thành role/ACL/security filter trên đích; ví dụ gói dx-ticket giữ ma trận của bản BA 1.0.
