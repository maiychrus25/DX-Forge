# Copyright (c) 2026 DX-Pulse Team
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Declarative diagram specs for build_diagrams.py (Vietnamese labels are user-facing content)."""

def N(i, lane, col, kind, label, row=0): return dict(id=i, lane=lane, col=col, row=row, kind=kind, label=label)
def E(f, t, label=None, **kw): return dict(list({"from": f, "to": t, "label": label}.items()) + list(kw.items()))

ADM, RESP, SYS, CUS, STAFF, MGR = ("Quản trị viên DX", "Người trả lời (3 tầng)", "Hệ thống DX-Core",
                                   "Khách hàng", "Nhân viên vận hành", "Quản lý")
DIAGRAMS = {}

# ---------- 01 BPMN ----------
DIAGRAMS["bpmn-01-do-luong"] = dict(
 title="BPMN 1.1 — Đo lường và kích hoạt DX-Lab",
 subtitle="Đầu vào: hồ sơ tổ chức. Đầu ra: ResultV1, lộ trình kê đơn, cây P.A.R.A trên Nextcloud, thông báo announce.",
 lanes=[ADM, RESP, SYS],
 nodes=[
  N("s",ADM,0,"start","Bắt đầu"), N("a2",ADM,1,"task","Khai báo\nhồ sơ tổ chức"), N("a3",ADM,2,"task","Mở đợt đo"),
  N("a4",ADM,3,"task","Gửi link khảo sát\n3 tầng"), N("a9",ADM,5,"decision","Đủ executive\n+ staff?"),
  N("a11",ADM,6,"task","Chốt đợt đo"), N("a14",ADM,9,"task","Xem radar\nvà kê đơn"), N("a15",ADM,10,"decision","Chấp nhận\nlộ trình?"),
  N("a17",ADM,11,"task","Cấp phát P.A.R.A\nlên Nextcloud"), N("end",ADM,12,"end","Kết thúc"),
  N("a10",ADM,4,"task","Nhắc qua notifier",row=1),
  N("b1",RESP,3,"task","Mở link khảo sát"), N("b2",RESP,4,"task","Trả lời câu hỏi\ntheo tầng"), N("b3",RESP,5,"task","Gửi phản hồi\nẩn danh"),
  N("c1",SYS,2,"system","Sinh 3 token\nkhảo sát"), N("c2",SYS,5,"system","Lưu phản hồi,\nđếm theo tầng"),
  N("c3",SYS,6,"system","Tính điểm trụ cột,\nđộ vênh, HPDI"), N("c4",SYS,7,"system","Phân loại hình dạng,\nmức DTI"),
  N("c5",SYS,8,"ai","Gọi AI kê đơn"), N("c6",SYS,9,"decision","JSON\nhợp lệ?"), N("c7",SYS,9,"system","Đơn rule-based",row=1),
  N("c8",SYS,10,"system","Lưu Prescription,\nghi llm_calls"), N("c10",SYS,11,"system","Phát sự kiện,\nbáo kênh announce"),
  N("c9",SYS,12,"system","Tạo nhóm, thư mục,\nACL"),
 ],
 edges=[E("s","a2"),E("a2","a3"),E("a3","c1"),E("c1","a4"),E("a4","b1"),E("b1","b2"),E("b2","b3"),E("b3","c2"),E("c2","a9"),
  E("a9","a10","chưa",back=True),E("a10","a4"),E("a9","a11","đủ"),E("a11","c3"),E("c3","c4"),E("c4","c5"),E("c5","c6"),
  E("c6","c8","có"),E("c6","c7","không, sau 1 lần thử lại"),E("c7","c8"),E("c8","c10"),E("c10","a14"),E("a14","a15"),
  E("a15","a14","không: sửa quy trình lõi, sinh lại",back=True),E("a15","a17","có"),E("a17","c9"),E("c9","end")],
 legend="Lưu ý: phản hồi ẩn danh, không lưu IP; Supp lấy min giữa tầng; kê đơn luôn theo trật tự P → D → I; cấp phát idempotent.")

DIAGRAMS["bpmn-02-dx-ticket"] = dict(
 title="BPMN 1.2 — Xử lý yêu cầu khách hàng (DX-Ticket)",
 subtitle="Đầu vào: biểu mẫu công khai hoặc nhập nội bộ. Đầu ra: ticket Đóng có Hướng_Xử_Lý, email CSAT, snapshot cuối tháng.",
 lanes=[CUS, STAFF, MGR, "Hệ thống (Core + n8n + AI)"],
 nodes=[
  N("k1",CUS,0,"start","Có sự cố"), N("k2",CUS,1,"task","Gửi biểu mẫu\nyêu cầu"), N("k8",CUS,11,"task","Nhận email\nhoàn tất"),
  N("k9",CUS,12,"task","Đánh giá CSAT"), N("k10",CUS,13,"end","Kết thúc"),
  N("n1",STAFF,4,"task","Bắt đầu xử lý"), N("n2",STAFF,8,"task","Xử lý, nhập\nHướng_Xử_Lý"), N("n3",STAFF,9,"task","Kết thúc xử lý"),
  N("q1",MGR,6,"task","Nhận cảnh báo\nkhiếu nại"), N("q2",MGR,7,"decision","Duyệt đề\nxuất AI?"),
  N("s1","Hệ thống (Core + n8n + AI)",1,"system","Xác thực định dạng\nSĐT / Email"), N("s2","Hệ thống (Core + n8n + AI)",2,"system","Khớp hoặc tạo\nkhách hàng"),
  N("s3","Hệ thống (Core + n8n + AI)",3,"system","Tạo ticket Chờ xử lý,\ngửi email xác nhận"),
  N("s4","Hệ thống (Core + n8n + AI)",4,"decision","Rào chắn:\ncó nhân sự\nphụ trách?"), N("s5","Hệ thống (Core + n8n + AI)",5,"decision","Loại =\nKhiếu nại?"),
  N("s6","Hệ thống (Core + n8n + AI)",6,"ai","Tác tử AI đọc ticket,\ntra chính sách,\nđề xuất"), N("s7","Hệ thống (Core + n8n + AI)",7,"system","Gửi thẻ duyệt\nkênh approvals"),
  N("s8","Hệ thống (Core + n8n + AI)",8,"system","Thực thi hành động\nđã duyệt"), N("s9","Hệ thống (Core + n8n + AI)",9,"decision","Rào chắn:\ncó Hướng_Xử_Lý?"),
  N("s10","Hệ thống (Core + n8n + AI)",4,"error","Từ chối, hoàn tác\ntrạng thái",row=1), N("s11","Hệ thống (Core + n8n + AI)",10,"system","Đóng ticket, tính SLA,\ngửi email CSAT"),
 ],
 edges=[E("k1","k2"),E("k2","s1"),E("s1","s2"),E("s2","s3"),E("s3","n1"),E("n1","s4"),E("s4","s10","không"),E("s10","n1",back=True,offset=40),
  E("s4","s5","có"),E("s5","q1","có"),E("q1","s6"),E("s6","s7"),E("s7","q2"),E("q2","s8","duyệt"),E("s8","n2"),E("q2","n2","từ chối"),
  E("s5","n2","không"),E("n2","n3"),E("n3","s9"),E("s9","s10","không"),E("s9","s11","có"),E("s11","k8"),E("k8","k9"),E("k9","k10")],
 legend="Hai rào chắn Poka-yoke chạy ở cả Appsmith và tầng máy chủ. AI chỉ đề xuất; hành động thay đổi tài chính hoặc phát ngôn ra ngoài phải qua nút duyệt (Human-in-the-loop).")

# ---------- 02 Swimlane ----------
DIAGRAMS["swimlane-01-dot-do"] = dict(
 title="Swimlane 2.1 — Đối tượng: Đợt đo (Assessment)",
 lanes=[ADM, "Người trả lời", "Hệ thống"],
 nodes=[N("a1",ADM,0,"task","Mở đợt đo"),N("a2",ADM,2,"task","Chia sẻ link\n3 tầng"),N("a3",ADM,5,"task","Chốt đợt đo"),
  N("a4",ADM,7,"task","Sinh lại kê đơn\n(quy trình lõi khác)"),N("a5",ADM,8,"task","Lưu trữ đợt đo"),
  N("r1","Người trả lời",3,"task","Điền khảo sát\nkhi Open"),
  N("s1","Hệ thống",1,"system","Draft → Open:\nsinh token"),N("s2","Hệ thống",4,"system","Đếm phản hồi\ntheo tầng"),
  N("s3","Hệ thống",6,"system","Open → Closed:\ntính HPDI, kê đơn,\nphát sự kiện"),N("s4","Hệ thống",9,"system","Closed → Archived:\nkhoá sửa, giữ so sánh")],
 edges=[E("a1","s1"),E("s1","a2"),E("a2","r1"),E("r1","s2"),E("s2","a3"),E("a3","s3"),E("s3","a4"),E("s3","a5"),E("a5","s4")],
 legend="Chỉ chốt khi ≥ 1 executive và ≥ 1 staff; sau Closed token hết hiệu lực, không nhận thêm phản hồi.")

DIAGRAMS["swimlane-02-ticket"] = dict(
 title="Swimlane 2.2 — Đối tượng: Ticket (DX-Ticket)",
 lanes=[CUS, STAFF, MGR, "Hệ thống"],
 nodes=[N("k1",CUS,0,"task","Tạo ticket qua\nbiểu mẫu"),N("k2",CUS,8,"task","Đánh giá CSAT\nkhi Đóng"),
  N("n1",STAFF,0,"task","Tạo ticket\nnội bộ",row=1),N("n2",STAFF,2,"task","Bắt đầu xử lý:\nChờ → Đang xử lý"),N("n3",STAFF,4,"task","Cập nhật\nHướng_Xử_Lý"),N("n4",STAFF,5,"task","Kết thúc xử lý:\nĐang → Đóng"),
  N("q1",MGR,1,"task","Đổi Mức_Độ_Ưu_Tiên\n(trừ Đóng)"),N("q2",MGR,3,"task","Gán lại nhân sự\nkhi Đang xử lý"),N("q3",MGR,4,"task","Duyệt đề xuất AI",row=1),
  N("s1","Hệ thống",1,"system","Sinh Ticket_ID,\nThời_Gian_Nhận"),N("s2","Hệ thống",3,"system","Gán USEREMAIL vào\nNhân_Sự_Phụ_Trách"),
  N("s3","Hệ thống",6,"system","Chặn Đóng nếu\nthiếu Hướng_Xử_Lý"),N("s4","Hệ thống",7,"system","Tính SLA, gửi CSAT,\ncắm cờ Log_Email"),N("s5","Hệ thống",2,"system","Chuyển ticket khi\nnhân sự bị offboard",row=1)],
 edges=[E("k1","s1"),E("n1","s1"),E("s1","n2"),E("q1","n2"),E("n2","s2"),E("s2","n3"),E("q2","n3"),E("q3","n3"),E("s5","q2"),E("n3","n4"),E("n4","s3"),E("s3","s4"),E("s4","k2")])

DIAGRAMS["swimlane-03-du-an-para"] = dict(
 title="Swimlane 2.3 — Đối tượng: Dự án trong P.A.R.A",
 lanes=["Quản trị viên DX / Chủ dự án", "Hệ thống"],
 nodes=[N("a1","Quản trị viên DX / Chủ dự án",0,"task","Tạo dự án,\nchọn thành viên"),N("a2","Quản trị viên DX / Chủ dự án",2,"task","Làm việc trong\nthư mục PROJECTS"),
  N("a3","Quản trị viên DX / Chủ dự án",4,"task","Đóng dự án"),N("a4","Quản trị viên DX / Chủ dự án",7,"task","Chắt lọc template về\n14. Templates_Forms"),
  N("s1","Hệ thống",1,"system","Tạo nhóm projects/slug,\nthư mục, ACL ghi"),N("s2","Hệ thống",3,"system","Kiểm quy ước tên\nhằng đêm, báo vi phạm"),
  N("s3","Hệ thống",5,"system","Chuyển sang ARCHIVES,\nthu quyền ghi"),N("s4","Hệ thống",6,"system","Gửi tác vụ chắt lọc\ntới chủ dự án")],
 edges=[E("a1","s1"),E("s1","a2"),E("a2","s2"),E("s2","a3"),E("a3","s3"),E("s3","s4"),E("s4","a4")])

DIAGRAMS["swimlane-04-lenh-ai"] = dict(
 title="Swimlane 2.4 — Đối tượng: Lệnh AI (M4)",
 lanes=[MGR, "Hệ thống"],
 nodes=[N("u1",MGR,0,"task","Ra lệnh bằng\nngôn ngữ tự nhiên"),N("u2",MGR,2,"task","Bấm Duyệt / Từ chối\ntrên kênh approvals"),
  N("s1","Hệ thống",1,"ai","Dịch thành DSL,\nkiểm whitelist"),N("s2","Hệ thống",3,"system","Pending → Approved\n/ Rejected"),N("s3","Hệ thống",4,"system","Approved → Executed:\ngọi n8n, ghi audit"),
  N("s4","Hệ thống",2,"system","Quá 24h → Expired",row=1)],
 edges=[E("u1","s1"),E("s1","u2"),E("u2","s2"),E("s2","s3"),E("s1","s4")])

# ---------- 03 State ----------
def ST(i,col,row,label,kind="state"): return N(i,None,col,kind,label,row)
DIAGRAMS["state-01-dot-do"] = dict(title="Trạng thái 3.1 — Đợt đo (Assessment)",
 nodes=[ST("s",1,0,"Bắt đầu","start"),ST("draft",1,1,"Draft"),ST("open",1,2,"Open"),ST("closed",1,3,"Closed"),ST("arch",1,4,"Archived"),ST("e",1,5,"Kết thúc","end"),
  ST("cancel",2,2,"Cancelled")],
 edges=[E("s","draft","Mở đợt đo"),E("draft","open","Sinh token khảo sát"),E("open","closed","Chốt (đủ executive + staff)"),E("closed","arch","Lưu trữ đợt đo"),E("arch","e"),
  E("draft","cancel"),E("open","cancel","Huỷ (Open: chỉ khi chưa có phản hồi)",below=True)],
 legend="Trục giữa: luồng cơ bản. Cánh phải: luồng thay thế.")

DIAGRAMS["state-02-ticket"] = dict(title="Trạng thái 3.2 — Ticket (DX-Ticket)",
 nodes=[ST("s",1,0,"Bắt đầu","start"),ST("cho",1,1,"Chờ xử lý"),ST("dang",1,2,"Đang xử lý"),ST("dong",1,3,"Đóng"),ST("e",1,4,"Kết thúc","end"),
  ST("huy",2,1,"Huỷ"),ST("hoan",0,2,"Hoàn tác (thiếu\nHướng_Xử_Lý)","error")],
 edges=[E("s","cho","Tạo ticket"),E("cho","dang","Bắt đầu xử lý (tự gán nhân sự)"),E("dang","dong","Kết thúc xử lý (có Hướng_Xử_Lý)"),E("dong","e"),
  E("cho","huy","Huỷ trùng/spam (quản lý)"),E("dang","hoan","Từ chối đóng"),E("hoan","dang","Giữ Đang xử lý"),E("dang","cho","Offboard",back=True)])

DIAGRAMS["state-03-du-an"] = dict(title="Trạng thái 3.3 — Thư mục dự án (P.A.R.A Project)",
 nodes=[ST("s",1,0,"Bắt đầu","start"),ST("act",1,1,"Active"),ST("clo",1,2,"Closing"),ST("arc",1,3,"Archived"),ST("e",1,4,"Kết thúc","end"),
  ST("viol",2,1,"Báo vi phạm\nquy ước tên","system")],
 edges=[E("s","act","Tạo dự án"),E("act","clo","Đóng dự án"),E("clo","arc","Hoàn tất chắt lọc template"),E("arc","e"),
  E("act","viol","Quét đêm"),E("viol","act","Không đổi trạng thái"),E("arc","act","Mở lại (dx-admin)",back=True)])

DIAGRAMS["state-04-lenh-ai"] = dict(title="Trạng thái 3.4 — Lệnh AI (AiCommand)",
 nodes=[ST("s",1,0,"Bắt đầu","start"),ST("pend",1,1,"Pending"),ST("appr",1,2,"Approved"),ST("exec",1,3,"Executed"),ST("e",1,4,"Kết thúc","end"),
  ST("blk",0,1,"Blocked","error"),ST("rej",2,1,"Rejected"),ST("exp",2,2,"Expired"),ST("fail",0,3,"Failed","error")],
 edges=[E("s","pend","DSL hợp lệ"),E("pend","appr","Quản lý bấm Duyệt"),E("appr","exec","n8n thực thi OK"),E("exec","e"),
  E("s","blk","Ngoài whitelist / sai bất biến"),E("pend","rej","Bấm Từ chối"),E("pend","exp","Quá 24 giờ"),E("appr","fail","n8n báo lỗi")])

DIAGRAMS["state-05-offboarding"] = dict(title="Trạng thái 3.5 — Thu hồi truy cập (Offboarding)",
 nodes=[ST("s",1,0,"Bắt đầu","start"),ST("run",1,1,"Running"),ST("done",1,2,"Done"),ST("e",1,3,"Kết thúc","end"),ST("fail",2,1,"Failed","error")],
 edges=[E("s","run","Bấm Thu hồi truy cập"),E("run","done","5 bước thành công"),E("done","e"),E("run","fail","Một bước lỗi"),E("fail","run","Chạy lại từ bước lỗi")],
 legend="Không vẽ cho đối tượng < 3 trạng thái: Link khảo sát, Thông báo, Vi phạm quy ước tên.")

# ---------- 09 Use case ----------
def AC(i,row,label,col=0): return N(i,None,col,"actor",label,row)
def UC(i,col,row,label): return N(i,None,col,"usecase",label,row)
LN=dict(style="line"); INC=dict(style="include")
DIAGRAMS["usecase-01-do-luong"] = dict(title="Use case 9.1 — Đo lường và kê đơn (M0)",
 nodes=[AC("adm",2,"Quản trị viên\nDX"),AC("resp",6,"Người trả lời"),AC("mgr",2,"Quản lý",col=3),
  UC("u1",1,0,"Mở đợt đo"),UC("u2",1,1,"Chia sẻ link\nkhảo sát"),UC("u4",1,2,"Chốt đợt đo"),UC("u9",1,3,"Tải bộ\nP.A.R.A kit"),UC("u10",1,4,"So sánh các\nvòng đo"),UC("u3",1,6,"Điền khảo sát"),
  UC("u5",2,2,"Xem radar HPDI"),UC("u6",2,3,"Sinh lộ trình\nkê đơn"),UC("u7",2,4,"Sinh câu\nđối chất"),UC("u8",3,4,"Sinh 5 RÕ và\nPoka-yoke")],
 edges=[E("adm","u1",**LN),E("adm","u2",**LN),E("adm","u4",**LN),E("adm","u9",**LN),E("adm","u10",**LN),E("resp","u3",**LN),
  E("mgr","u5",**LN),E("mgr","u6",**LN),E("mgr","u7",**LN),E("mgr","u8",**LN),
  E("u4","u5","include",**INC),E("u6","u7","extend: vênh > 0.3",**INC),E("u8","u6","extend: cần quy trình lõi",**INC)],
 legend="Actor tô cam (trái: vận hành đo; phải: khai thác kết quả); use case tô xanh; nét đứt = include / extend.")

DIAGRAMS["usecase-02-khong-gian-h"] = dict(title="Use case 9.2 — Không gian làm việc [H] (M1)",
 nodes=[AC("adm",2,"Quản trị viên\nDX"),AC("sys",6,"Hệ thống\ntự động",col=3),AC("mgr",1,"Quản lý",col=3),AC("stf",3,"Nhân viên",col=3),
  UC("u2",1,0,"Cấp phát cây\nP.A.R.A"),UC("u3",1,1,"Quản lý\nphòng ban"),UC("u8",1,2,"Thu hồi\ntruy cập"),UC("u4",1,3,"Tạo dự án"),UC("u5",1,4,"Đóng dự án"),
  UC("u10",2,5,"Gửi thông báo\nkênh"),UC("u9",2,7,"Kiểm quy ước\nđặt tên"),
  UC("u1",2,1,"Đăng nhập\nmột lần"),UC("u6",2,3,"Duyệt Resources\ntrên Portal"),UC("u7",2,4,"Đọc Sổ tay\nnghiệp vụ số")],
 edges=[E("adm","u2",**LN),E("adm","u3",**LN),E("adm","u8",**LN),E("adm","u4",**LN),E("adm","u5",**LN),E("sys","u9",**LN),E("sys","u10",**LN),
  E("mgr","u1",**LN),E("mgr","u4",**LN),E("mgr","u6",**LN),E("stf","u1",**LN),E("stf","u6",**LN),E("stf","u7",**LN),
  E("u2","u3","include",**INC),E("u5","u10","include",**INC),E("u8","u10","include",**INC)])

DIAGRAMS["usecase-03-ticket-ai"] = dict(title="Use case 9.3 — Nghiệp vụ DX-Ticket và AI (M2–M4)",
 nodes=[AC("cus",0,"Khách hàng"),AC("stf",3,"Nhân viên"),AC("mgr",3,"Quản lý",col=3),AC("ai",7,"Tác tử AI",col=3),
  UC("u1",1,0,"Gửi yêu cầu\nqua biểu mẫu"),UC("u4",1,1,"Đánh giá CSAT"),UC("u2",1,2,"Bắt đầu xử lý\nticket"),UC("u3",1,3,"Kết thúc xử lý\nticket"),UC("u6",1,4,"Hỏi đáp trên\nResources"),
  UC("u5",2,2,"Xem dashboard\nnghiệp vụ"),UC("u7",2,4,"Ra lệnh AI"),UC("u8",2,5,"Duyệt lệnh AI"),UC("u9",2,7,"Giám sát ticket\nquá hạn")],
 edges=[E("cus","u1",**LN),E("cus","u4",**LN),E("stf","u2",**LN),E("stf","u3",**LN),E("stf","u6",**LN),
  E("mgr","u5",**LN),E("mgr","u6",**LN),E("mgr","u7",**LN),E("mgr","u8",**LN),E("ai","u9",**LN),
  E("u7","u8","include",**INC),E("u9","u7","extend: đề xuất hành động",**INC)],
 legend="Kết thúc xử lý ticket luôn kèm rào chắn Hướng_Xử_Lý.")

# ---------- 10 Activity ----------
L="Luồng"
DIAGRAMS["activity-01-chot-dot-do"] = dict(title="Activity 10.1 — Chốt đợt đo và kê đơn",
 nodes=[N("s",None,0,"start","Bấm Chốt\nđợt đo"),N("c1",None,1,"decision","executive ≥ 1\nvà staff ≥ 1?"),N("e1",None,1,"error","Hiện lý do,\ngợi ý nhắc tầng",row=1),
  N("c2",None,2,"task","Xác nhận lần 2"),N("a1",None,3,"system","Khoá token"),N("a2",None,4,"system","Điểm trụ cột\ntheo tầng"),N("a3",None,5,"system","Độ vênh,\nSupp = min tầng"),
  N("a4",None,6,"system","P, D, I ≤ 30;\nH = phần dư"),N("a5",None,7,"system","Hình dạng,\nmức DTI"),N("a7",None,8,"decision","Provider\n≠ none?"),
  N("r1",None,8,"system","Đơn rule-based",row=1),N("a8",None,9,"ai","Gọi AI roadmap"),N("v",None,10,"decision","zod\nhợp lệ?"),N("rt",None,10,"decision","Đã thử lại?",row=1),
  N("a9",None,11,"system","Lưu Prescription,\nghi llm_calls"),N("a10",None,12,"system","Phát sự kiện,\nbáo announce"),N("d",None,13,"end","Dashboard\nClosed")],
 edges=[E("s","c1"),E("c1","e1","không"),E("c1","c2","có"),E("c2","a1"),E("a1","a2"),E("a2","a3"),E("a3","a4"),E("a4","a5"),E("a5","a7"),E("a7","r1","không"),E("a7","a8","có"),
  E("a8","v"),E("v","rt","không"),E("rt","a8","chưa",back=True),E("rt","r1","rồi"),E("v","a9","có"),E("r1","a9"),E("a9","a10"),E("a10","d")])

DIAGRAMS["activity-02-thu-hoi-truy-cap"] = dict(title="Activity 10.2 — Thu hồi truy cập (5 bước)",
 nodes=[N("s",None,0,"start","Bấm Bắt đầu\nthu hồi"),N("b1",None,1,"system","1. Keycloak:\ndisable + logout all"),N("b2",None,2,"system","2. Nextcloud: disable,\nchuyển sở hữu tệp"),
  N("b3",None,3,"system","3. Telegram ban /\nMattermost deactivate"),N("b4",None,4,"system","4. Dịch vụ không OIDC:\nvô hiệu hoặc it-support"),N("b5",None,5,"system","5. Phát sự kiện\nuser.offboarded"),
  N("b6",None,6,"system","M2 chuyển ticket\nsang người thay thế"),N("e",None,7,"end","Done, hiện\ntổng thời gian"),N("f",None,3,"error","Ghi bước lỗi, dừng,\ncho chạy lại từ bước đó",row=1)],
 edges=[E("s","b1"),E("b1","b2","OK"),E("b2","b3","OK"),E("b3","b4","OK"),E("b4","b5"),E("b5","b6"),E("b6","e"),E("b1","f","lỗi"),E("b2","f","lỗi"),E("b3","f","lỗi")],
 legend="Mỗi bước ghi thời gian; mục tiêu < 5 phút, kỳ vọng < 30 giây.")

DIAGRAMS["activity-03-xu-ly-ticket"] = dict(title="Activity 10.3 — Xử lý ticket với rào chắn Poka-yoke",
 nodes=[N("s",None,0,"start","Bấm Bắt đầu\nxử lý"),N("a1",None,1,"system","Gán USEREMAIL vào\nNhân_Sự_Phụ_Trách"),N("a2",None,2,"system","→ Đang xử lý"),
  N("a3",None,3,"decision","Khiếu nại và\nchưa báo?"),N("a4",None,3,"system","Cảnh báo dx-ticket,\ncắm cờ",row=1),N("a5",None,4,"task","Nhân viên xử lý"),
  N("a6",None,5,"task","Bấm Kết thúc\nxử lý"),N("a7",None,6,"task","Hộp thoại INPUT\nHướng_Xử_Lý"),N("c1",None,7,"decision","≥ 50\nký tự?"),N("e1",None,7,"error","Chặn, giữ\nĐang xử lý",row=1),
  N("a8",None,8,"system","→ Đóng,\nThời_Gian_Đóng"),N("a9",None,9,"system","Máy chủ kiểm\nlại rào chắn"),N("c2",None,10,"decision","Hợp lệ?"),N("e2",None,10,"error","Hoàn tác,\nbáo lỗi tuân thủ",row=1),
  N("a10",None,11,"system","Tính SLA, gửi CSAT,\ncắm cờ Log_Email"),N("d",None,12,"end","Xong")],
 edges=[E("s","a1"),E("a1","a2"),E("a2","a3"),E("a3","a4","có"),E("a4","a5"),E("a3","a5","không"),E("a5","a6"),E("a6","a7"),E("a7","c1"),E("c1","e1","không"),E("e1","a7",back=True),
  E("c1","a8","có"),E("a8","a9"),E("a9","c2"),E("c2","e2","không"),E("c2","a10","có"),E("a10","d")],
 legend="Rào chắn lớp 1 (Appsmith) và lớp 2 (máy chủ) đều chạy; sửa thẳng DB cũng bị hoàn tác.")

DIAGRAMS["activity-04-lenh-ai-hitl"] = dict(title="Activity 10.4 — Lệnh AI có người duyệt (HITL)",
 nodes=[N("s",None,0,"start","Quản lý gõ\nlệnh tự nhiên"),N("a1",None,1,"system","Truy xuất ngữ cảnh:\nLOD + RAG"),N("a2",None,2,"ai","LLM sinh\nDSL JSON"),
  N("c1",None,3,"decision","Whitelist và\nbất biến đúng?"),N("b",None,3,"error","Blocked,\ngiải thích",row=1),N("c2",None,4,"decision","effect =\nwrite?"),N("r",None,4,"system","Thực thi đọc,\ntrả kết quả",row=2),
  N("a3",None,5,"system","Tạo AiCommand\nPending"),N("a4",None,6,"system","Gửi thẻ duyệt\nkênh approvals"),N("w",None,7,"decision","Nút bấm\ntrong 24h?"),
  N("x",None,7,"error","Rejected",row=1),N("t",None,8,"error","Expired",row=1),N("a5",None,8,"system","Gọi n8n\nwebhook"),N("c3",None,9,"decision","Thành\ncông?"),
  N("f",None,9,"error","Failed,\nbáo alerts",row=1),N("a6",None,10,"system","Ghi audit,\nbáo kết quả"),N("e",None,11,"end","Xong")],
 edges=[E("s","a1"),E("a1","a2"),E("a2","c1"),E("c1","b","không"),E("c1","c2","có"),E("c2","r","không"),E("r","e"),E("c2","a3","có"),E("a3","a4"),E("a4","w"),
  E("w","x","từ chối"),E("w","t","hết giờ"),E("w","a5","duyệt"),E("a5","c3"),E("c3","f","không"),E("c3","a6","có"),E("a6","e")],
 legend="AI không bao giờ tự thực thi effect = write; lệnh tài chính cần dx-admin duyệt.")
