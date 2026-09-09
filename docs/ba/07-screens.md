# 7. Mô tả màn hình (screen spec)

Mỗi màn hình một bảng: STT | Tên trường | Kiểu dữ liệu | Bắt buộc | Giá trị khởi tạo | Mô tả ràng buộc. Tối đa 5 trường bắt buộc/màn hình. Tên trường là nhãn tiếng Việt hiển thị; mã kỹ thuật ghi trong ngoặc.

## SC-01 Đăng nhập (Keycloak, không tự viết)
Chuyển hướng tới trang đăng nhập realm `dxlab`. Không có trường tự thiết kế. Sau đăng nhập về `/`. Nút "Quên mật khẩu" là của Keycloak.

## SC-02 Portal / Launchpad (`/`)
| STT | Tên trường | Kiểu | Bắt buộc | Khởi tạo | Ràng buộc |
|---|---|---|---|---|---|
| 1 | Bảng tin | Khối markdown | – | `00. Portal/news.md` | Chỉ đọc; sửa trên Nextcloud |
| 2 | Gợi ý bước tiếp theo | Thẻ (card) | – | "Chưa đo: hãy mở đợt đo" | Đọc `pulse/latest`; spear → chỉ thẻ [H]; kite → thêm [P]; diamond → tất cả |
| 3 | Nút tác vụ | Nhóm button | – | Theo vai trò | staff: Tạo yêu cầu, Tệp của tôi; manager: + Dashboard; dx-admin: + Đo lường, Quản trị |
| 4 | Cây Resources | Cây 3 cấp | – | Mở `3. [R] RESOURCES` | Nhấn tệp mở tab Nextcloud; ẩn nhánh không có quyền |
| 5 | Dashboard nhúng | iframe | – | Ẩn khi M3 chưa bật | Chỉ manager/dx-admin |

## SC-03 Đo lường – danh sách đợt đo (`/pulse`)
| STT | Tên trường | Kiểu | Bắt buộc | Khởi tạo | Ràng buộc |
|---|---|---|---|---|---|
| 1 | Radar chồng các vòng | Biểu đồ | – | Tối đa 3 vòng gần nhất | Bật/tắt từng vòng bằng chú giải |
| 2 | Bảng đợt đo | Bảng | – | Sắp xếp round giảm dần | Cột: Vòng, Trạng thái, Phản hồi (E/M/S), H/P/D/I, Hình dạng, Ngày chốt |
| 3 | Mở đợt đo | Button | – | – | Chỉ dx-admin/manager; mở SC-04 |

## SC-04 Mở đợt đo (popover)
| STT | Tên trường | Kiểu | Bắt buộc | Khởi tạo | Ràng buộc |
|---|---|---|---|---|---|
| 1 | Vòng (round) | Số, hệ thống sinh | – | round cuối + 1 | Không sửa |
| 2 | Bộ câu hỏi | Dropdown fix cứng | Có | `v1` | Từ tệp JSON có sẵn |
| 3 | Quy trình lõi (coreProcess) | Free text ≤ 120 ký tự | Không | trống | Dùng cho 5 RÕ; có thể nhập sau |
| 4 | Hạn link khảo sát | Date | Có | +14 ngày | ≥ hôm nay |
| 5 | Tạo | Button | – | – | Tạo Assessment Draft → Open, sinh 3 token, chuyển SC-05 |

## SC-05 Dashboard đợt đo (`/pulse/a/[id]`)
| STT | Tên trường | Kiểu | Bắt buộc | Khởi tạo | Ràng buộc |
|---|---|---|---|---|---|
| 1 | Link khảo sát 3 tầng | 3 ô sao chép + QR | – | token | Hiện khi Open; nút Gửi qua kênh Thông báo |
| 2 | Phản hồi theo tầng | 3 thẻ số | – | 0/0/0 | Cảnh báo vàng nếu executive hoặc staff = 0 |
| 3 | Radar HPDI | Biểu đồ 4 trục | – | ẩn khi Open | Lớp Hợp nhất + 3 lớp tầng bật/tắt; H thang 0–100, P/D/I thang 0–30 |
| 4 | Hình dạng, mức DTI | 2 badge | – | – | spear/kite/illusion/diamond/transitional; mức 1–5 |
| 5 | Bảng trụ cột | Bảng 6 dòng | – | – | Cột: Trụ cột, Executive, Manager, Staff, Hợp nhất, Độ vênh (đỏ nếu > 0.3) |
| 6 | Hệ số thực chứng | 3 chip P/D/I | – | – | Tooltip giải thích lấy min giữa tầng |
| 7 | Chốt đợt đo | Button | – | – | Vô hiệu kèm lý do khi thiếu tầng; xác nhận 2 bước; sau chốt ẩn |
| 8 | Huỷ đợt đo | Button phụ | – | – | Chỉ khi chưa có phản hồi |

## SC-06 Khảo sát (`/pulse/s/[token]`, mobile-first)
| STT | Tên trường | Kiểu | Bắt buộc | Khởi tạo | Ràng buộc |
|---|---|---|---|---|---|
| 1 | Màn chào | Văn bản + button | – | – | Nêu tầng, số câu, thời gian, "ẩn danh, không lưu IP"; nút Bắt đầu |
| 2 | Câu hỏi thang | Radio 5 mức 0–4 | Có | không chọn | Một câu mỗi màn; nhãn mức bằng câu tình huống |
| 3 | Câu hỏi chọn một | Radio có trọng số | Có | không chọn | Câu supp: value là hệ số 0/0.33/0.5/0.66/1 |
| 4 | Ý kiến tự do (freeText) | Textarea ≤ 2000 ký tự | Không | trống | Cuối bài; gửi cho AI đã cắt |
| 5 | Tiến trình | Thanh + "câu x/y" | – | – | Lưu nháp localStorage theo token |
| 6 | Gửi | Button | – | – | Token hết hạn/đợt Closed → màn "Đợt đo đã đóng"; gửi xong khoá lại, không gửi 2 lần từ cùng nháp |

## SC-07 Kê đơn (`/pulse/a/[id]/prescription`)
| STT | Tên trường | Kiểu | Bắt buộc | Khởi tạo | Ràng buộc |
|---|---|---|---|---|---|
| 1 | Nguồn | Badge | – | – | "AI (gemini)" hoặc "Rule-based" khi fallback |
| 2 | Chẩn đoán + lộ trình | 3 khối P/D/I | – | – | Thứ tự cố định P→D→I; mỗi khối: hành động, KPI |
| 3 | Câu hỏi đối chất | Danh sách | – | ẩn nếu không vênh | Nút "Gửi vào kênh Thông báo" |
| 4 | Quy trình lõi | Free text ≤ 120 | Không | coreProcess | Sửa rồi bấm "Sinh 5 RÕ" |
| 5 | Ma trận 5 RÕ | Bảng | – | – | Cột: Bước, R, A, C, I, Tiêu chuẩn, Công cụ |
| 6 | Poka-yoke | Danh sách | – | – | Cột: Điểm chạm, Luật, Lớp (1/2/3) |
| 7 | Hỏi báo cáo | Ô chat | Không | trống | Trả lời chỉ dựa JSON kết quả; ẩn khi provider `none` |
| 8 | Sinh lại | Button | – | – | Ghi bản ghi Prescription mới, giữ bản cũ |

## SC-08 Bộ kỷ luật (`/pulse/a/[id]/kit`)
| STT | Tên trường | Kiểu | Bắt buộc | Khởi tạo | Ràng buộc |
|---|---|---|---|---|---|
| 1 | Tên viết tắt tổ chức | Free text 2–10 ký tự in hoa | Có | từ cấu hình | Dùng cho tiền tố thư mục gốc |
| 2 | Phòng ban | Bảng thêm/xoá dòng (Mã, Tên) | Có ≥ 1 | từ nhóm Keycloak | Mã 2–5 chữ in hoa, duy nhất |
| 3 | Dự án đang chạy | Bảng thêm/xoá dòng (Slug, Tên) | Không | trống | Slug chữ thường, gạch nối |
| 4 | Xem trước cây | Cây | – | – | Cập nhật tức thì |
| 5 | Tải zip | Button | – | – | Sinh artifact, lưu lịch sử |
| 6 | Cấp phát lên Nextcloud | Button | – | ẩn khi M1 chưa cấu hình | Chỉ dx-admin; hiện tiến trình từng bước |

## SC-09 Quản trị người dùng (`/portal/admin/users`)
| STT | Tên trường | Kiểu | Bắt buộc | Khởi tạo | Ràng buộc |
|---|---|---|---|---|---|
| 1 | Danh sách | Bảng | – | từ Keycloak | Cột: Tên, Email, Vai trò, Phòng ban, Trạng thái, Lần cuối đăng nhập |
| 2 | Thêm người dùng: Email | Email | Có | trống | Duy nhất; gửi lời mời đặt mật khẩu |
| 3 | Họ tên | Free text | Có | trống | |
| 4 | Vai trò | Dropdown fix cứng | Có | `staff` | dx-admin / manager / staff |
| 5 | Phòng ban | Dropdown từ danh mục phòng ban | Có | trống | Nhiều lựa chọn |
| 6 | Thu hồi truy cập | Button đỏ trên dòng | – | – | Mở SC-10 |

## SC-10 Thu hồi truy cập (`/portal/admin/users/[sub]/offboard`)
| STT | Tên trường | Kiểu | Bắt buộc | Khởi tạo | Ràng buộc |
|---|---|---|---|---|---|
| 1 | Người thay thế | Dropdown người dùng cùng phòng ban | Có | trống | Nhận ticket và email chuyển tiếp |
| 2 | Xác nhận | Checkbox "Tôi hiểu thao tác không hoàn tác" | Có | không tích | Nút Bắt đầu chỉ bật khi tích |
| 3 | Tiến trình 5 bước | Danh sách trạng thái | – | – | Mỗi bước: đang chạy/xong/lỗi + thời gian; nút Chạy lại tại bước lỗi |
| 4 | Tổng thời gian | Đồng hồ | – | – | Hiện sau khi xong |

## SC-11 Thiết lập notifier (`/settings/notifier`)
| STT | Tên trường | Kiểu | Bắt buộc | Khởi tạo | Ràng buộc |
|---|---|---|---|---|---|
| 1 | Telegram bot token | Password text | Không | trống | Kiểm bằng nút "Gửi thử" |
| 2 | Mattermost URL + token | Password text | Không | trống | Chỉ khi profile chat |
| 3 | Bảng định tuyến kênh | Bảng 5 dòng (announce, alerts, dx-ticket, approvals, it-support) | Có | trống | Mỗi dòng: provider (dropdown), target (chat_id/thread hoặc channel id); dòng chưa cấu hình → notifier trả lỗi rõ |
| 4 | Gửi thử | Button từng dòng | – | – | Ghi `core.notifications` |

## SC-12 Thiết lập LLM (`/settings/llm`)
| STT | Tên trường | Kiểu | Bắt buộc | Khởi tạo | Ràng buộc |
|---|---|---|---|---|---|
| 1 | Provider | Dropdown fix cứng | Có | `none` | none / gemini / anthropic / ollama; đổi provider hiện trường tương ứng |
| 2 | API key | Password text | Có khi gemini/anthropic | trống | Không hiển thị lại sau lưu |
| 3 | Ollama URL, model | Free text | Có khi ollama | `http://ollama:11434`, `qwen2.5:7b` | |
| 4 | Kiểm tra kết nối | Button | – | – | Gọi 1 prompt ngắn, hiện độ trễ |

## SC-13 Biểu mẫu yêu cầu khách hàng (`/public/ticket`, Appsmith hoặc Core)
| STT | Tên trường | Kiểu | Bắt buộc | Khởi tạo | Ràng buộc |
|---|---|---|---|---|---|
| 1 | Số điện thoại | Free text | Có | trống | Regex `^[0-9]{10}$`; khoá định danh khách hàng |
| 2 | Họ và tên | Free text ≤ 100 | Có | trống | |
| 3 | Email | Email | Có | trống | Định dạng email; nhận xác nhận và CSAT |
| 4 | Loại yêu cầu | Dropdown fix cứng | Có | `Tư vấn` | Bảo hành / Khiếu nại / Tư vấn; Khiếu nại kích cảnh báo |
| 5 | Nội dung | Textarea ≤ 2000 | Có | trống | |
| 6 | Hình ảnh lỗi | Upload ≤ 5MB, jpg/png | Không | trống | Lưu Nextcloud `42. Unstructured_Data` |
| 7 | Đồng ý chính sách dữ liệu | Checkbox | Có | không tích | Không tích sẵn (Privacy by Design); lưu timestamp + phiên bản chính sách |

Màn hình cập nhật ticket (Appsmith): khác thêm mới ở chỗ Ticket_ID, Thời_Gian_Nhận, Số_Điện_Thoại, Tên, Email là chỉ đọc; `Hướng_Xử_Lý` chỉ hiện khi khác Chờ xử lý và bắt buộc khi Đóng; `Trạng_Thái` không sửa bằng tay, chỉ qua hai nút.
