# 11. Đặc tả use case — DX-Forge

UC-01 đến UC-05 (measure) giữ nguyên bản 1.0: Mở đợt đo, Điền khảo sát, Chốt đợt đo, Sinh câu đối chất, Sinh 5 RÕ. Dưới đây là các use case mới.

## UC-10 Tạo intent bằng phỏng vấn
| Trường | Nội dung |
|---|---|
| Description | Kiến trúc sư trò chuyện với AI (hoặc điền form) để ra `intent.yaml` hợp lệ |
| Actor | Kiến trúc sư DX; Lãnh đạo (sửa phần quy trình lõi) |
| Priority | Cao (P1 form, P2 AI) |
| Trigger | Bấm "Sang phỏng vấn" từ kê đơn hoặc mở `/interview` |
| Pre-condition | Có ResultV1 của đợt Closed; đã cấu hình đích |
| Post-condition | `intent.yaml` hợp lệ theo IntentV1, có `maturity` từ ResultV1, ≥ 1 quy trình lõi có đúng một A |

Business rule: AI tối đa 12 lượt; không hỏi lại điều đã có từ measure; không có AI thì form; intent ≤ 80 dòng; đích và kênh chỉ architect sửa. NFR: mỗi lượt AI ≤ 10 giây.

## UC-11 Sinh và phê duyệt plan
| Trường | Nội dung |
|---|---|
| Description | Engine sinh plan bốn lớp từ intent và gói, AI đề xuất, validator kiểm, người xem/sửa/phê duyệt |
| Actor | Kiến trúc sư DX; Lãnh đạo (phê duyệt) |
| Priority | Bắt buộc (P1) |
| Trigger | Bấm "Sinh plan" hoặc `dxforge plan` |
| Pre-condition | intent hợp lệ; gói được tham chiếu tồn tại |
| Post-condition | `plan.yaml` không lỗi validator, mọi tài nguyên có reason và gate, `approvals` có người và giờ |

Business rule: không AI thì plan deterministic; cổng trưởng thành không thể tắt; tài nguyên bị khoá vẫn hiện; plan có lỗi không được phê duyệt; sửa plan sau phê duyệt làm mất phê duyệt. NFR: ≤ 5 giây không AI, ≤ 60 giây có AI.

## UC-12 Cấp phát lên đích
| Trường | Nội dung |
|---|---|
| Description | Apply plan đã phê duyệt lên đích, có dry-run, state, tiếp tục sau ngắt |
| Actor | Kiến trúc sư DX; Hệ thống đích |
| Priority | Bắt buộc (P1 oss lớp H; P2 phần còn lại, gws, proteus-manifest) |
| Trigger | Bấm Apply sau khi xem dry-run, hoặc `dxforge apply` |
| Pre-condition | plan phê duyệt; thông tin xác thực đích có trong biến môi trường; kết nối đích kiểm tra được |
| Post-condition | Tài nguyên `gate.allowed` và không `skip` tồn tại trên đích; `state.json` đầy đủ; `runs` ghi kết quả |

Business rule: thứ tự topo và H→P→D→I; idempotent theo checksum; lỗi một tài nguyên dừng và giữ state; không ghi bí mật vào state; gws phần AppSheet chỉ sinh hướng dẫn. NFR: gói dx-ticket trên oss ≤ 10 phút.

## UC-13 Kiểm chứng và huỷ
| Trường | Nội dung |
|---|---|
| Description | Chạy verify để chứng minh từng tài nguyên đúng như plan; destroy để gỡ sạch |
| Actor | Kiến trúc sư DX; Lãnh đạo (xem báo cáo); Hệ thống đích |
| Priority | Bắt buộc (P1) |
| Trigger | Bấm Verify / Destroy hoặc CLI |
| Pre-condition | Có state |
| Post-condition | Báo cáo `reports/verify-*.md|json`; sau destroy `--prune`, verify báo không tồn tại |

Business rule: verify không thay đổi đích (trừ tạo và xoá dữ liệu thử có tiền tố `_forge_probe_`); destroy xác nhận hai bước.

## UC-14 Sinh chính sách tác tử và luồng duyệt
| Trường | Nội dung |
|---|---|
| Description | Từ quy trình có A, plan sinh `intel.agent_policy`; provider dựng workflow HITL trên đích |
| Actor | Kiến trúc sư DX; Hệ thống đích; (người dùng hệ thống sinh ra dùng sau) |
| Priority | Cao (P2) |
| Trigger | plan với shape cho phép lớp I |
| Pre-condition | Lớp P đã apply; kênh approvals cấu hình |
| Post-condition | Workflow nhận lệnh, kiểm whitelist, gửi thẻ duyệt, thực thi khi duyệt, hết hạn 24h; verify chứng minh lệnh ngoài whitelist bị chặn |

Business rule: Forge không chạy tác tử; lệnh ghi luôn cần duyệt; whitelist lấy từ gói.

## UC-15 Sinh sổ tay nghiệp vụ số
| Trường | Nội dung |
|---|---|
| Description | AI viết sổ tay từ plan và state, đẩy vào Resources của đích |
| Actor | Kiến trúc sư DX |
| Priority | Cao (P2) |
| Trigger | Bấm "Sinh sổ tay" sau verify xanh |
| Pre-condition | state và verify gần nhất |
| Post-condition | Mỗi quy trình lõi một trang, một trang xử lý lỗi rào chắn, `architecture.md`; tệp có trên đích |

Business rule: nội dung chỉ dựa plan/state/gói (ngữ cảnh đóng); fallback template khi không AI.

## UC-16 Quản lý gói ngành
| Trường | Nội dung |
|---|---|
| Description | Xem, thêm, kiểm gói ngành từ thư mục hoặc URL git |
| Actor | Kiến trúc sư DX |
| Priority | Trung bình (P2) |
| Trigger | `/packs` hoặc `dxforge packs add` |
| Pre-condition | Gói có `pack.yaml` |
| Post-condition | Gói dùng được trong interview và plan; gói sai schema bị từ chối kèm lý do |
