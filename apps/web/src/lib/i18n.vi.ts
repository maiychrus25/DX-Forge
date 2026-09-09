// SPDX-License-Identifier: AGPL-3.0-or-later
/** All user-facing strings of the wizard. Keys are English, values are Vietnamese. */
export const vi = {
  app: { name: "DX-Forge", tagline: "Bộ biên dịch Hệ điều hành Doanh nghiệp số", nav: { pulse: "Đo lường", about: "Về DX-Forge", logout: "Đăng xuất" } },
  login: { title: "Đăng nhập quản trị", password: "Mật khẩu quản trị", submit: "Đăng nhập", wrong: "Mật khẩu không đúng." },
  common: { save: "Lưu", cancel: "Huỷ", back: "Quay lại", next: "Tiếp", previous: "Trước", copy: "Sao chép", copied: "Đã sao chép", loading: "Đang tải…", error: "Có lỗi xảy ra. Thử lại.", download: "Tải về" },
  org: { title: "Hồ sơ tổ chức", name: "Tên tổ chức", shortCode: "Mã ngắn (2–12 ký tự thường)", sector: "Ngành", sizeBand: "Quy mô", departments: "Phòng ban (mỗi dòng: mã, tên)", saved: "Đã lưu hồ sơ tổ chức." },
  pulse: {
    title: "Đo lường DTI/HPDI", empty: "Chưa có đợt đo nào. Mở đợt đo đầu tiên để nhận ba link khảo sát.", open: "Mở đợt đo", round: "Đợt", status: { open: "Đang mở", closed: "Đã chốt" },
    history: "Radar theo vòng", coreProcess: "Quy trình lõi muốn chuẩn hoá (tuỳ chọn)",
  },
  round: {
    title: "Đợt đo", links: "Link khảo sát (ẩn danh, mỗi tầng một link)", tier: { executive: "Lãnh đạo", manager: "Quản lý", staff: "Nhân viên" },
    responses: "Phản hồi", close: "Chốt đợt đo", closeConfirm: "Chốt đợt đo sẽ khoá link khảo sát và tính kết quả. Tiếp tục?",
    notEnough: "Chưa đủ phản hồi: cần ít nhất một lãnh đạo và một nhân viên.", closed: "Đã chốt đợt đo.",
    radar: "Radar HPDI", pillars: "Sáu trụ cột", pillar: "Trụ cột", merged: "Hợp nhất", discrepancy: "Độ vênh", warn: "Vênh lớn",
    shape: { spear: "Mũi giáo", kite: "Cánh diều lệch", illusion: "Ảo giác công nghệ", diamond: "Kim cương", transitional: "Chuyển tiếp" },
    level: "Mức DTI", prescription: "Kê đơn", kit: "Bộ kỷ luật P.A.R.A", expires: "Hết hạn",
  },
  pillars: { strategy: "Chiến lược", culture: "Văn hoá", customer: "Khách hàng", operations: "Vận hành", technology: "Công nghệ", data: "Dữ liệu" },
  axes: { H: "Hạ tầng", P: "Quy trình", D: "Dữ liệu", I: "Trí tuệ" },
  survey: {
    title: "Khảo sát chuyển đổi số", intro: "Ẩn danh, khoảng 6–8 phút. Chọn mức đúng nhất với thực tế, không phải mong muốn.", start: "Bắt đầu", progress: "Câu {n}/{total}",
    scale: ["Không có", "Rất ít", "Một phần", "Phần lớn", "Hoàn toàn"], freeText: "Điều gì cản trở anh/chị nhất khi làm việc số? (tuỳ chọn)", submit: "Gửi khảo sát",
    thanks: "Cảm ơn anh/chị. Phản hồi đã được ghi nhận ẩn danh.", expired: "Link khảo sát đã hết hạn hoặc đợt đo đã chốt.", draft: "Đã khôi phục bản nháp.",
  },
  prescription: {
    title: "Kê đơn", roadmap: "Lộ trình P → D → I", focus: "Trục ưu tiên", discrepancy: "Câu hỏi đối chất khi vênh tầng", fiveRo: "Ma trận 5 RÕ", pokaYoke: "Poka-yoke", source: "Nguồn: luật của sách (chưa bật AI)",
  },
  kit: { title: "Bộ kỷ luật P.A.R.A", projects: "Dự án đang chạy (mỗi dòng một tên)", preview: "Xem trước cây thư mục", build: "Tạo bộ kỷ luật", download: "Tải para-kit.zip", built: "Đã tạo bộ kỷ luật." },
  about: { title: "Về DX-Forge", method: "Phương pháp luận lấy từ sách \"Xây dựng Hệ điều hành Doanh nghiệp số\" của Tạ Tuấn Anh, giấy phép CC BY 4.0.", license: "Mã nguồn theo giấy phép AGPL-3.0-or-later.", source: "Mã nguồn" },
} as const;
export type Vi = typeof vi;
