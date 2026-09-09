# 11. Đặc tả use case

Mỗi use case gồm Summary và Business information.

## UC-01 Mở đợt đo
| Trường | Nội dung |
|---|---|
| Use case ID | UC-01 |
| Description | Quản trị viên khởi tạo một vòng đo mới, hệ thống sinh 3 link khảo sát theo tầng |
| Actor | Quản trị viên DX, Quản lý |
| Priority | Cao (P1) |
| Trigger | Bấm "Mở đợt đo" trên `/pulse` |
| Pre-condition | Đã đăng nhập vai trò dx-admin/manager; không có đợt đo Open |
| Post-condition | Assessment ở Open, round = round cuối + 1, 3 survey_links có token và hạn |

Business rule: một thời điểm chỉ một đợt Open; round tăng liên tục, không tái dùng; hạn link mặc định 14 ngày. NFR riêng: tạo xong dưới 1 giây.

## UC-02 Điền khảo sát
| Trường | Nội dung |
|---|---|
| Use case ID | UC-02 |
| Description | Người có token trả lời bộ câu hỏi của tầng mình, gửi ẩn danh |
| Actor | Người trả lời |
| Priority | Cao (P1) |
| Trigger | Mở `/pulse/s/[token]` |
| Pre-condition | Token còn hạn, đợt đo Open |
| Post-condition | Một Response được lưu với answers đủ câu bắt buộc; đếm tầng tăng 1 |

Business rule: không lưu IP, user-agent hay danh tính; câu bắt buộc phải trả lời hết mới gửi; một thiết bị có thể gửi nhiều lần (không chặn, vì ẩn danh) nhưng nháp cục bộ bị xoá sau khi gửi; freeText cắt 2000 ký tự. NFR: hoàn thành ≤ 8 phút trên điện thoại 375px.

## UC-03 Chốt đợt đo
| Trường | Nội dung |
|---|---|
| Use case ID | UC-03 |
| Description | Khoá khảo sát, tính HPDI, phân loại, kê đơn, thông báo |
| Actor | Quản trị viên DX, Quản lý |
| Priority | Cao (P1) |
| Trigger | Bấm "Chốt đợt đo" và xác nhận |
| Pre-condition | ≥ 1 phản hồi executive và ≥ 1 staff |
| Post-condition | Assessment Closed; Result và Prescription tồn tại; sự kiện `pulse.assessment.closed` đã phát; thông báo đã gửi kênh announce |

Business rule: Supp lấy min giữa tầng; P/D/I mỗi trục ≤ 30; H = 100 − tổng; kê đơn luôn theo trật tự P→D→I; AI lỗi hai lần thì dùng rule-based và gắn nhãn. NFR: toàn bộ ≤ 30 giây với AI, ≤ 2 giây không AI.

## UC-04 Sinh câu hỏi đối chất
| Trường | Nội dung |
|---|---|
| Use case ID | UC-04 |
| Description | Với trụ cột có độ vênh > 0.3, AI sinh câu hỏi để lãnh đạo và nhân viên đối chiếu |
| Actor | Quản lý |
| Priority | Trung bình |
| Trigger | Bấm "Sinh câu đối chất" trên trang kê đơn |
| Pre-condition | Đợt Closed, có ít nhất một trụ cột vênh |
| Post-condition | Prescription kind=discrepancy lưu; có thể gửi vào kênh announce |

Business rule: mỗi trụ cột vênh ≥ 2 câu, mỗi câu ghi rõ hỏi tầng nào; không nêu tên cá nhân.

## UC-05 Sinh ma trận 5 RÕ và Poka-yoke
| Trường | Nội dung |
|---|---|
| Use case ID | UC-05 |
| Description | Từ tên quy trình lõi và kết quả đo, AI sinh bảng RACI, tiêu chuẩn, công cụ và danh sách rào chắn |
| Actor | Quản lý, Quản trị viên DX |
| Priority | Cao (P1) |
| Trigger | Nhập quy trình lõi, bấm "Sinh 5 RÕ" |
| Pre-condition | Đợt Closed; coreProcess không rỗng |
| Post-condition | Prescription kind=fiveRo; nội dung xuất hiện trong kit (5RO_*.md, POKA_YOKE.md) |

Business rule: mỗi bước đúng một A; công cụ chỉ chọn trong danh mục hệ thống có (Appsmith, n8n, Nextcloud, Telegram, Metabase); rào chắn ghi rõ lớp 1/2/3 theo chương 6.1.2.

## UC-06 Cấp phát cây P.A.R.A
| Trường | Nội dung |
|---|---|
| Use case ID | UC-06 |
| Description | Tạo group folder, cây thư mục chuẩn, thư mục phòng ban, ACL trên Nextcloud |
| Actor | Quản trị viên DX |
| Priority | Cao (P1 cho zip, P2 cho Nextcloud) |
| Trigger | Bấm "Cấp phát lên Nextcloud" hoặc `POST /api/workspace/provision` |
| Pre-condition | Nextcloud và Keycloak đã cấu hình; có ≥ 1 phòng ban |
| Post-condition | Cây tồn tại đủ nhánh; ACL đúng bảng 4.2 spec M1; README từng nhánh |

Business rule: idempotent, không xoá thư mục có sẵn; RESOURCES chỉ đọc với all-staff; chia sẻ bằng link công khai bị tắt. NFR: ≤ 60 giây cho 20 phòng ban.

## UC-07 Thu hồi truy cập
| Trường | Nội dung |
|---|---|
| Use case ID | UC-07 |
| Description | Vô hiệu một người dùng trên toàn hệ sinh thái trong một chuỗi 5 bước, đo thời gian |
| Actor | Quản trị viên DX |
| Priority | Cao (P2) |
| Trigger | Bấm "Thu hồi truy cập" và xác nhận |
| Pre-condition | Người dùng đang active; có người thay thế |
| Post-condition | Không đăng nhập được ở mọi dịch vụ; tệp cá nhân đã chuyển sở hữu; bị gỡ khỏi kênh chat; ticket đang gán chuyển người thay thế; bản ghi offboardings ghi thời gian từng bước |

Business rule: dừng ở bước lỗi và cho chạy lại, không bỏ qua; không xoá tài khoản (chỉ vô hiệu) để giữ audit. NFR: mục tiêu < 5 phút, kỳ vọng < 30 giây.

## UC-08 Kết thúc xử lý ticket
| Trường | Nội dung |
|---|---|
| Use case ID | UC-08 |
| Description | Nhân viên đóng ticket đang xử lý, hệ thống ép nhập hướng xử lý, tính SLA, gửi CSAT |
| Actor | Nhân viên |
| Priority | Cao (P2) |
| Trigger | Bấm "Kết thúc xử lý" trên Appsmith |
| Pre-condition | Ticket Đang xử lý và gán cho chính người bấm |
| Post-condition | Ticket Đóng, Thời_Gian_Đóng, Thời_Gian_SLA; email CSAT gửi một lần; cờ Log_Email cập nhật |

Business rule: Hướng_Xử_Lý ≥ 50 ký tự; rào chắn chạy ở giao diện và máy chủ; ticket Đóng không sửa nội dung, chỉ nhận CSAT.

## UC-09 Ra lệnh AI có người duyệt
| Trường | Nội dung |
|---|---|
| Use case ID | UC-09 |
| Description | Quản lý ra lệnh tự nhiên; AI dịch thành DSL; lệnh ghi phải được duyệt trên kênh chat trước khi thực thi |
| Actor | Quản lý, Tác tử AI, Hệ thống |
| Priority | Trung bình (P2) |
| Trigger | Gửi lệnh tại `/ai/commands` |
| Pre-condition | LLM provider ≠ none; whitelist action đã khai; kênh approvals cấu hình |
| Post-condition | AiCommand ở Executed/Rejected/Expired/Blocked với audit đầy đủ |

Business rule: AI không bao giờ tự thực thi lệnh effect=write; lệnh tài chính cần dx-admin duyệt; hết 24 giờ tự Expired; mọi lệnh lưu prompt, DSL, người duyệt, kết quả.
