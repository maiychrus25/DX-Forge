# 7. Mô tả màn hình — wizard DX-Forge

Cột: STT | Tên trường | Kiểu | Bắt buộc | Khởi tạo | Ràng buộc. Tối đa 5 trường bắt buộc/màn. Các màn measure (SC-M0-*) giữ nguyên bản 1.0 với đường dẫn đổi `/pulse` → `/measure`.

## SC-01 Đăng nhập wizard (`/login`)
| STT | Tên trường | Kiểu | Bắt buộc | Khởi tạo | Ràng buộc |
|---|---|---|---|---|---|
| 1 | Mật khẩu quản trị | Password | Có | trống | So với băm của `FORGE_ADMIN_PASSWORD`; 5 lần sai khoá 15 phút |
| 2 | Đăng nhập bằng OIDC | Button | – | ẩn nếu chưa cấu hình | Chuyển sang Keycloak của đích |

## SC-02 Trang chủ đường ống (`/`)
| STT | Tên trường | Kiểu | Bắt buộc | Khởi tạo | Ràng buộc |
|---|---|---|---|---|---|
| 1 | Thư mục làm việc | Dropdown + nút Tạo | – | thư mục gần nhất | Đổi là đổi tổ chức; hiện tên tổ chức, đích |
| 2 | Thanh 6 bước | Stepper | – | bước đầu chưa có sản phẩm | Mỗi bước: chưa làm / đang làm / xong / lỗi; bước sau mở khi bước trước có sản phẩm; nhấn vào mở trang bước |
| 3 | Sản phẩm mỗi bước | Thẻ | – | – | ResultV1 (vòng, hình dạng), intent.yaml (mtime), plan.yaml (số tài nguyên, số bị khoá), state (số đã apply), verify (xanh/đỏ), handbook (số trang) |
| 4 | Chạy tiếp | Button chính | – | bước kế tiếp | Vô hiệu kèm lý do khi thiếu sản phẩm bước trước |
| 5 | Lịch sử chạy | Bảng | – | 10 dòng gần nhất | Cột: giai đoạn, bắt đầu, thời lượng, kết quả, báo cáo |

## SC-M0-01 … SC-M0-06 (đo lường)
Giữ nguyên SC-03 đến SC-08 của bản 1.0 (danh sách đợt đo, mở đợt đo, dashboard đợt đo, khảo sát, kê đơn, kit). Thay đổi: ở SC kê đơn thêm nút "Sang phỏng vấn" mang tổ chức, phòng ban, quy trình lõi, 5 RÕ sang intent; ở kit, nút "Tải zip" là phụ, nút chính là "Sang phỏng vấn".

## SC-03 Phỏng vấn (`/interview`)
| STT | Tên trường | Kiểu | Bắt buộc | Khởi tạo | Ràng buộc |
|---|---|---|---|---|---|
| 1 | Chế độ | Toggle AI / Form | – | AI nếu provider ≠ none | Provider none → khoá AI |
| 2 | Khung chat | Danh sách lượt + ô nhập | – | AI mở lời với tóm tắt kết quả đo | ≤ 12 lượt; mỗi câu hỏi có 2–3 gợi ý bấm nhanh; nút "Đủ rồi, tạo intent" |
| 3 | Form: Tổ chức | Tên, viết tắt (2–10 in hoa), ngành (dropdown 12), quy mô (dropdown 5) | Có (4) | từ measure | |
| 4 | Form: Phòng ban | Bảng thêm/xoá (Mã 2–5 in hoa, Tên, Email trưởng) | Có ≥ 1 | từ measure | Mã duy nhất |
| 5 | Form: Quy trình lõi | Bảng (Tên, Gói, R, A, C, I, SLA giờ, Có biểu mẫu công khai) | Có ≥ 1 | từ 5 RÕ | Đúng một A; gói từ thư viện |
| 6 | Form: Kênh | Chat (telegram/mattermost), 3 đích thông báo | Không | telegram | |
| 7 | Form: Đích | Dropdown oss/gws/proteus-manifest | Có | từ settings | |
| 8 | Xem intent | Trình soạn YAML có kiểm lỗi + bản xem form | – | – | Lưu chỉ khi hợp lệ; hiện dòng lỗi |
| 9 | Lưu và sang Plan | Button | – | – | |

## SC-04 Plan (`/plan`)
| STT | Tên trường | Kiểu | Bắt buộc | Khởi tạo | Ràng buộc |
|---|---|---|---|---|---|
| 1 | Sinh plan | Button + toggle "Dùng AI đề xuất" | – | AI bật nếu có provider | Hiện thời gian sinh; lưu plan.yaml |
| 2 | Tóm tắt | 4 thẻ H/P/D/I | – | – | Số tài nguyên, số bị khoá bởi cổng, màu trục cố định |
| 3 | Cây tài nguyên | Cây 2 cấp (lớp → tài nguyên) | – | mở lớp H | Mỗi nút: icon type, id, reason rút gọn, badge gate (mở/khoá + why), nguồn (pack/rule/ai), nút Vì sao, nút Bỏ |
| 4 | Chi tiết tài nguyên | Ngăn phải: form theo schema type + YAML | – | – | Sửa inline; lỗi schema chặn tại chỗ; nút Hoàn tác |
| 5 | Lỗi validator | Danh sách | – | – | Mỗi lỗi trỏ đúng id và cách sửa; plan có lỗi không được phê duyệt |
| 6 | Phê duyệt plan | Button | – | – | sponsor hoặc architect; ghi người và giờ vào plan.approvals |
| 7 | Sang Apply | Button | – | vô hiệu khi chưa phê duyệt | |

## SC-05 Apply (`/apply`)
| STT | Tên trường | Kiểu | Bắt buộc | Khởi tạo | Ràng buộc |
|---|---|---|---|---|---|
| 1 | Đích | Hiển thị + nút kiểm tra kết nối | – | từ intent.target | Không đổi ở đây |
| 2 | Dry-run | Button → bảng | – | – | Cột: id, lớp, hành động (create/update/skip/destroy), diff; đếm theo hành động |
| 3 | Apply | Button + checkbox "Tôi đã xem dry-run" | Có | không tích | Chạy tuần tự; tiến trình theo tài nguyên với trạng thái và log rút gọn |
| 4 | Ngắt / Chạy tiếp | Button | – | – | Chạy tiếp từ tài nguyên dở |
| 5 | Destroy | Button đỏ | – | – | Xác nhận 2 bước: gõ tên tổ chức; tuỳ chọn `prune` |

## SC-06 Verify (`/verify`)
| STT | Tên trường | Kiểu | Bắt buộc | Khởi tạo | Ràng buộc |
|---|---|---|---|---|---|
| 1 | Chạy verify | Button | – | – | |
| 2 | Tổng kết | 4 thẻ theo lớp | – | – | Xanh/đỏ, số check đạt/tổng |
| 3 | Bảng check | Bảng | – | lọc "đỏ trước" | Cột: tài nguyên, check, kết quả, bằng chứng (đường dẫn, mã HTTP), nút Mở trên đích |
| 4 | Tải báo cáo | Button | – | – | markdown + JSON trong `reports/` |

## SC-07 Handbook (`/handbook`)
| STT | Tên trường | Kiểu | Bắt buộc | Khởi tạo | Ràng buộc |
|---|---|---|---|---|---|
| 1 | Sinh sổ tay | Button + toggle AI | – | – | Fallback template |
| 2 | Danh sách trang | Cây | – | – | Mỗi quy trình lõi 1 trang; trang lỗi rào chắn |
| 3 | Xem trước | Markdown | – | – | |
| 4 | Đẩy lên đích | Button | – | – | Vào `00. Portal/handbook/`; hiện đường dẫn |
| 5 | architecture.md | Liên kết | – | – | |

## SC-08 Thư viện gói (`/packs`, `/packs/[id]`)
| STT | Tên trường | Kiểu | Bắt buộc | Khởi tạo | Ràng buộc |
|---|---|---|---|---|---|
| 1 | Danh sách | Thẻ | – | core, dx-ticket | Tên, ngành, quy trình, đích hỗ trợ, phiên bản |
| 2 | Thêm gói | Đường dẫn thư mục hoặc URL git | Có | trống | Kiểm schema, hiện lỗi |
| 3 | Chi tiết gói | Tab: thực thể, form, luật, workflow, dashboard, sổ tay | – | – | Chỉ đọc |

## SC-09 Thiết lập (`/settings/*`)
| STT | Tên trường | Kiểu | Bắt buộc | Khởi tạo | Ràng buộc |
|---|---|---|---|---|---|
| 1 | LLM provider | Dropdown | Có | none | Khoá không hiện lại; nút kiểm tra |
| 2 | Đích | Dropdown + các `credentials_ref` (tên biến môi trường) | Có | oss | Hiện biến nào thiếu; nút kiểm tra kết nối từng dịch vụ |
| 3 | Notifier tạm | Token + chat id | Không | trống | Chỉ dùng cho khảo sát |

## SC-10 Trang Về (`/about`)
Ghi công sách (CC BY 4.0), AGPL, phiên bản, đường dẫn mã nguồn, danh sách đích và ghi chú "proteus-manifest là định dạng xuất tương thích".
