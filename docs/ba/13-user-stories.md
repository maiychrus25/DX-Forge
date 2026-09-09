# 13. User story và AC — DX-Forge

US-01 đến US-14 (measure) giữ nguyên bản 1.0 với thay đổi: US-13 "Tải bộ P.A.R.A" là đường tắt, thêm US-13b "Sang phỏng vấn". Bỏ US-15..22 của bản cũ (thuộc hệ thống sinh ra, nay là AC của gói dx-ticket trong `packs/dx-ticket/handbook/acceptance.md`). Story mới:

| # | Title | User story | Priority | AC (when / who / how / then) | Note |
|---|---|---|---|---|---|
| US-23 | Phỏng vấn ra intent | Là kiến trúc sư, tôi muốn được hỏi vài câu để ra đặc tả thay vì viết YAML | P2 | When: có kết quả đo, provider ≠ none. Who: architect. How: trả lời ≤ 12 lượt, bấm "Tạo intent". Then: intent.yaml hợp lệ, có maturity, ≥ 1 quy trình có đúng 1 A | I-01 |
| US-24 | Form khi không có AI | Là kiến trúc sư, tôi muốn vẫn tạo được intent khi không có khoá AI | P1 | When: provider none. Who: architect. How: điền 5 phần form. Then: intent.yaml hợp lệ, ≤ 5 bắt buộc/phần | I-02 |
| US-25 | Sửa intent an toàn | Là lãnh đạo, tôi muốn sửa tên quy trình và SLA mà không làm hỏng đặc tả | P2 | When: intent tồn tại. Who: sponsor. How: sửa trong bản xem form. Then: chỉ phần quy trình lõi sửa được, lưu khi hợp lệ | I-04 |
| US-26 | Sinh plan có lý do | Là kiến trúc sư, tôi muốn thấy vì sao có từng thứ trong kế hoạch | P1 | When: intent hợp lệ. Who: architect. How: bấm Sinh plan. Then: cây 4 lớp, 100 % tài nguyên có reason, nguồn pack/rule/ai | P-01/02 |
| US-27 | Không được bật AI khi chưa đủ quy trình | Là lãnh đạo, tôi muốn hệ thống chặn việc bật AI sớm thay vì tin lời tư vấn | P1 | When: shape spear/illusion. Who: engine. How: sinh plan. Then: lớp I `gate.allowed=false` kèm why, không apply được | P-03 |
| US-28 | Sửa và kiểm plan | Là kiến trúc sư, tôi muốn sửa một trường trong form trước khi cấp phát | P2 | When: plan có. Who: architect. How: sửa inline. Then: lỗi schema chặn tại chỗ; validator chạy lại; phê duyệt cũ bị huỷ | P-06/08 |
| US-29 | Hỏi "Vì sao" | Là lãnh đạo, tôi muốn hỏi vì sao có một tài nguyên bằng ngôn ngữ thường | P2 | When: có plan. Who: sponsor. How: bấm Vì sao. Then: câu trả lời dựa reason + intent + sách; không AI thì hiện reason | P-07 |
| US-30 | Dry-run trước khi chạm đích | Là kiến trúc sư, tôi muốn thấy sẽ tạo/sửa/xoá gì trước khi apply | P1 | When: plan phê duyệt. Who: architect. How: bấm Dry-run. Then: bảng hành động + diff; không gọi API ghi | A-01 |
| US-31 | Apply lặp lại an toàn | Là kiến trúc sư, tôi muốn chạy apply lần hai mà không tạo trùng | P1 | When: đã apply. Who: architect. How: apply lại. Then: toàn skip; sửa 1 tài nguyên thì chỉ nó update | A-02 |
| US-32 | Chạy tiếp sau ngắt | Là kiến trúc sư, tôi muốn ngắt giữa chừng rồi chạy tiếp | P1 | When: đang apply. Who: architect. How: Ngắt, rồi Chạy tiếp. Then: tiếp từ tài nguyên dở, state không hỏng | A-02 |
| US-33 | Verify có bằng chứng | Là lãnh đạo, tôi muốn thấy chứng cứ hệ thống đúng như kế hoạch | P1 | When: đã apply. Who: sponsor. How: mở Verify. Then: mỗi check có kết quả và bằng chứng; staff không ghi được Resources là một check | A-03/05 |
| US-34 | AI trên hệ thống sinh ra phải có người duyệt | Là lãnh đạo, tôi muốn mọi lệnh ghi của AI qua tay tôi | P2 | When: lớp I được bật và apply. Who: manager trên đích. How: ra lệnh, nhận thẻ, bấm Duyệt. Then: chỉ sau khi bấm mới thực thi; ngoài whitelist bị chặn; 24h hết hạn | A-08 |
| US-35 | Cùng intent lên Google Workspace | Là giảng viên, tôi muốn dùng tài khoản Google của lớp để dựng hệ thống | P2 | When: target gws, OAuth xong. Who: architect. How: apply. Then: Drive, Sheets, Forms, Apps Script tạo được; AppSheet có hướng dẫn; verify đọc lại được | A-09 |
| US-36 | Xuất gói cho nền tảng khác | Là kiến trúc sư, tôi muốn xuất kế hoạch thành gói plugin của nền tảng khác | P2 | When: target manifest. Who: architect. How: apply. Then: thư mục out/ có manifest.yaml, SQL, workflows, dashboards đúng schema | A-10 |
| US-37 | Sổ tay tự sinh | Là nhân viên của hệ thống sinh ra, tôi muốn có hướng dẫn ngay trong kho tài liệu | P2 | When: verify xanh. Who: architect. How: bấm Sinh sổ tay, Đẩy lên đích. Then: mỗi quy trình 1 trang, trang lỗi rào chắn, nằm ở 00. Portal/handbook | H-01 |
| US-38 | Thêm gói ngành | Là người đóng góp, tôi muốn thêm gói ngành mà không sửa engine | P2 | When: có thư mục gói. Who: architect. How: packs add. Then: gói hợp lệ hiện trong thư viện và chọn được ở interview; sai schema bị từ chối rõ lý do | K-01 |
| US-39 | Dùng bằng CLI | Là kiến trúc sư, tôi muốn chạy trọn đường ống bằng dòng lệnh để tự động hoá | P1 | When: có Node. Who: architect. How: measure → plan → apply → verify. Then: mã thoát đúng, `--json` đọc được, `--help` mọi lệnh | C-01 |
