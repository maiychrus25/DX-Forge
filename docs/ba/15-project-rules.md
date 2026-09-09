# 15. Quy tắc triển khai và bộ tài liệu dự án

## 15.1 Quy tắc triển khai
1. Phân tích trước khi làm: mỗi module có spec (docs/superpowers/specs) và bộ BA này được rà trước khi lập kế hoạch; không viết mã khi chưa có use case và AC.
2. Kế hoạch từng khâu: mỗi module phân rã thành task có độ phức tạp (S/M/L), khối lượng giờ, người review; task do AI agent thực hiện phải có người thật review trước khi vào `develop`.
3. Sprint 1 tuần theo lịch 13 tuần của spec tổng; sprint đang chạy không đổi nghiệp vụ, yêu cầu mới ghi vào backlog sprint sau (trừ khi đề tháng 11 buộc đổi bài mẫu, xử lý bằng một sprint điều chỉnh riêng).
4. UAT cuối mỗi sprint theo AC trong 13-user-stories.md, chạy trên môi trường dev bằng tài khoản của từng vai trò, đi trọn hành trình bằng người khác người tạo dữ liệu; hai vòng stress desktop 1440 và mobile 375 trước mỗi release.
5. Mã, chú thích, commit tiếng Anh; chuỗi giao diện tiếng Việt; nhánh `develop` làm việc, `main` chỉ nhận merge có tag; mọi PR cập nhật CHANGELOG.
6. Không đưa mã hay dữ liệu của công ty AHV vào repo; không dùng VPS AHV.
7. Ghi công phương pháp luận DX-OS (CC BY 4.0) ở README, LICENSE_NOTICE và trang About.

## 15.2 Bộ tài liệu dự án phải duy trì
| Tài liệu | Vị trí | Trách nhiệm | Cập nhật |
|---|---|---|---|
| Biên bản họp | `docs/meetings/YYYY-MM-DD.md` | Thư ký sprint (luân phiên 3 thành viên) | Sau mỗi buổi họp; ghi quyết định và việc giao |
| URD (yêu cầu người dùng) | `docs/ba/12-scenarios.md`, `13-user-stories.md` | BA | Mỗi sprint |
| SRS (đặc tả phần mềm) | `docs/ba/04..11, 14` + `docs/superpowers/specs/*` + `docs/api/openapi.yaml` | BA + kiến trúc | Khi đổi chức năng hoặc API |
| BRD (tuỳ chọn) | `docs/BRD.md` | Trưởng nhóm | Trước 30/09 và trước 12/2026 |
| HDSD | `docs/user-guide/` (Sổ tay nghiệp vụ số cũng nằm trong Resources của bản demo) | BA + dev | Trước mỗi release |
| Sơ đồ | `docs/ba/diagrams/*.excalidraw` (+ png xuất) | BA | Cùng lúc với tài liệu chữ |
| Nhật ký quyết định (ADR) | `docs/adr/NNN-*.md` | Kiến trúc | Khi có quyết định kiến trúc |
| PoF compliance | `docs/POF_COMPLIANCE.md` | Trưởng nhóm | Trước mỗi lần nộp |
