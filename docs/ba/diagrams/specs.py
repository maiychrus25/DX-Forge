# Copyright (c) 2026 DX-Forge Team
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Declarative diagram specs for build_diagrams.py — DX-Forge (v2). Kept v1 diagrams are re-exported from specs_v1."""
from specs_v1 import DIAGRAMS as V1, N, E, ST, AC, UC, LN, INC

KEEP = ["bpmn-02-dx-ticket", "swimlane-01-dot-do", "state-01-dot-do", "state-02-ticket", "state-04-lenh-ai",
        "usecase-01-do-luong", "activity-01-chot-dot-do"]
DIAGRAMS = {k: V1[k] for k in KEEP}
DIAGRAMS["bpmn-02-dx-ticket"] = dict(V1["bpmn-02-dx-ticket"], title="BPMN 1.2 — Quy trình mẫu gói dx-ticket (Forge sinh ra trên đích)")
DIAGRAMS["state-02-ticket"] = dict(V1["state-02-ticket"], title="Trạng thái 3.5 — Ticket (gói dx-ticket, trên đích)")
DIAGRAMS["state-04-lenh-ai"] = dict(V1["state-04-lenh-ai"], title="Trạng thái 3.4 — Lệnh AI theo agent_policy (trên đích)")

ARC, SPO, RESP, FORGE, TGT = "Kiến trúc sư DX", "Lãnh đạo", "Người trả lời (3 tầng)", "Forge (engine + AI)", "Hệ thống đích"

DIAGRAMS["bpmn-01-duong-ong"] = dict(
 title="BPMN 1.1 — Đường ống DX-Forge: measure → interview → plan → apply → verify → handbook",
 subtitle="Đầu vào: tổ chức thật. Đầu ra: DX-Lab chạy trên đích, sổ tay, báo cáo kiểm chứng.",
 lanes=[ARC, SPO, RESP, FORGE, TGT],
 nodes=[
  N("s",ARC,0,"start","Bắt đầu"),N("a1",ARC,1,"task","Mở đợt đo,\ngửi link 3 tầng"),N("a2",ARC,4,"task","Chốt đợt đo"),
  N("a3",ARC,6,"task","Phỏng vấn / điền\nform intent"),N("a4",ARC,8,"task","Xem cây plan,\nsửa tài nguyên"),
  N("a5",ARC,10,"task","Xem dry-run,\nbấm Apply"),N("a6",ARC,13,"task","Sinh sổ tay,\nđẩy lên đích"),N("e",ARC,14,"end","Kết thúc"),
  N("b1",SPO,3,"task","Trả lời tầng\nexecutive"),N("b2",SPO,9,"decision","Phê duyệt\nplan?"),N("b3",SPO,12,"task","Xem báo cáo\nverify"),
  N("r1",RESP,3,"task","Trả lời khảo sát\nẩn danh"),
  N("f1",FORGE,2,"system","Sinh token,\nđếm phản hồi"),N("f2",FORGE,5,"system","Tính HPDI,\nhình dạng, kê đơn"),
  N("f3",FORGE,7,"ai","AI hỏi ≤ 12 lượt\n→ intent.yaml"),N("f4",FORGE,8,"system","Template gói + luật\n+ AI đề xuất → plan",row=1),
  N("f5",FORGE,9,"decision","Validator +\ncổng trưởng thành\nđạt?",row=1),N("f6",FORGE,10,"system","Dry-run diff,\napply theo topo,\nghi state",row=1),
  N("f7",FORGE,11,"system","Verify từng\ntài nguyên",row=1),N("f8",FORGE,13,"ai","AI viết sổ tay\ntừ plan + state",row=1),
  N("t1",TGT,10,"system","Tạo realm, nhóm,\ncây P.A.R.A, ACL,\nDDL, workflow…"),N("t2",TGT,11,"system","Trả bằng chứng\n(HTTP, PROPFIND)"),N("t3",TGT,13,"system","Nhận sổ tay vào\nResources"),
 ],
 edges=[E("s","a1"),E("a1","f1"),E("f1","b1"),E("f1","r1"),E("b1","a2"),E("r1","a2"),E("a2","f2"),E("f2","a3"),E("a3","f3"),E("f3","f4"),
  E("f4","f5"),E("f5","a4","đạt"),E("f5","f4","lỗi: sửa, sinh lại",back=True),E("a4","b2"),E("b2","a4","không",back=True),E("b2","a5","có"),
  E("a5","f6"),E("f6","t1"),E("t1","f7"),E("f7","t2"),E("t2","b3"),E("b3","a6"),E("a6","f8"),E("f8","t3"),E("t3","e")],
 legend="Forge không vận hành nghiệp vụ; mọi thứ chạy thật nằm ở lane Hệ thống đích. Lớp [I] chỉ được apply khi cổng trưởng thành cho phép.")

DIAGRAMS["swimlane-02-intent"] = dict(
 title="Swimlane 2.2 — Đối tượng: Intent (intent.yaml)",
 lanes=[ARC, SPO, FORGE],
 nodes=[N("a1",ARC,0,"task","Bắt đầu phỏng vấn\n(hoặc mở form)"),N("a2",ARC,2,"task","Trả lời / điền\n5 phần"),N("a3",ARC,4,"task","Sửa YAML hoặc form"),N("a4",ARC,6,"task","Lưu, sang Plan"),
  N("s1",SPO,5,"task","Sửa tên quy trình,\nSLA (chỉ phần này)"),
  N("f1",FORGE,1,"ai","Nạp ResultV1,\nhỏi câu tiếp theo"),N("f2",FORGE,3,"system","Hợp nhất thành\nintent, kiểm zod"),N("f3",FORGE,5,"system","Kiểm lỗi trực tiếp,\nchặn lưu khi sai")],
 edges=[E("a1","f1"),E("f1","a2"),E("a2","f2"),E("f2","a3"),E("a3","f3"),E("s1","f3"),E("f3","a4")],
 legend="Intent ≤ 80 dòng; maturity lấy từ measure, không hỏi lại.")

DIAGRAMS["swimlane-03-plan"] = dict(
 title="Swimlane 2.3 — Đối tượng: Plan (plan.yaml)",
 lanes=[ARC, SPO, FORGE],
 nodes=[N("a1",ARC,0,"task","Bấm Sinh plan\n(± AI)"),N("a2",ARC,3,"task","Xem cây, đọc lý do,\nsửa / bỏ tài nguyên"),N("a3",ARC,5,"task","Kiểm lại (--check)"),
  N("s1",SPO,4,"task","Hỏi Vì sao"),N("s2",SPO,6,"task","Phê duyệt"),
  N("f1",FORGE,1,"system","Template gói + luật\nlớp H/D/I"),N("f2",FORGE,2,"ai","AI đề xuất patch\n(qua zod)"),N("f3",FORGE,3,"system","Validator + cổng\ntrưởng thành",row=1),
  N("f4",FORGE,5,"system","Validator chạy lại,\nhuỷ phê duyệt cũ",row=1),N("f5",FORGE,7,"system","Ghi approvals,\nmở Apply")],
 edges=[E("a1","f1"),E("f1","f2"),E("f2","f3"),E("f3","a2"),E("a2","s1"),E("a2","a3"),E("a3","f4"),E("f4","s2"),E("s2","f5")],
 legend="Tài nguyên bị cổng khoá vẫn nằm trong plan với gate.allowed=false và why.")

DIAGRAMS["swimlane-04-tai-nguyen"] = dict(
 title="Swimlane 2.4 — Đối tượng: Tài nguyên trên đích (state.json)",
 lanes=[ARC, FORGE, TGT],
 nodes=[N("a1",ARC,0,"task","Dry-run"),N("a2",ARC,2,"task","Apply"),N("a3",ARC,5,"task","Verify"),N("a4",ARC,7,"task","Destroy\n(--prune)"),
  N("f1",FORGE,1,"system","So checksum với state\n→ create/update/skip"),N("f2",FORGE,3,"system","Gọi adapter theo topo,\nghi state từng cái"),N("f3",FORGE,4,"system","Ngắt → giữ state,\nchạy tiếp từ chỗ dở",row=1),
  N("f4",FORGE,6,"system","Gom checks,\nbáo cáo xanh/đỏ"),N("f5",FORGE,8,"system","Xoá theo thứ tự ngược,\nxoá khỏi state"),
  N("t1",TGT,3,"system","Tạo / cập nhật\ntài nguyên"),N("t2",TGT,6,"system","Trả bằng chứng"),N("t3",TGT,8,"system","Xoá tài nguyên")],
 edges=[E("a1","f1"),E("f1","a2"),E("a2","f2"),E("f2","t1"),E("f2","f3"),E("f3","f2",back=True),E("t1","a3"),E("a3","f4"),E("f4","t2"),E("t2","a4"),E("a4","f5"),E("f5","t3")])

DIAGRAMS["state-02-lan-chay"] = dict(title="Trạng thái 3.2 — Lần chạy (Run) của một giai đoạn",
 nodes=[ST("s",1,0,"Bắt đầu","start"),ST("pend",1,1,"Pending"),ST("run",1,2,"Running"),ST("ok",1,3,"Succeeded"),ST("e",1,4,"Kết thúc","end"),
  ST("stop",2,2,"Interrupted"),ST("fail",0,2,"Failed","error")],
 edges=[E("s","pend","Bấm chạy / CLI"),E("pend","run","Bắt đầu giai đoạn"),E("run","ok","Xong, có sản phẩm",shift=(0,26)),E("ok","e"),
  E("run","stop","Người ngắt"),E("stop","run","Chạy tiếp"),E("run","fail","Lỗi tài nguyên / đích"),E("fail","run","Sửa rồi chạy lại")],
 legend="Run của apply giữ state đã ghi khi Interrupted/Failed; chạy tiếp từ tài nguyên dở.")

DIAGRAMS["state-03-tai-nguyen"] = dict(title="Trạng thái 3.3 — Tài nguyên trong plan/state",
 nodes=[ST("s",1,0,"Bắt đầu","start"),ST("pl",1,1,"Planned"),ST("ap",1,2,"Applied"),ST("ve",1,3,"Verified"),ST("e",1,4,"Kết thúc","end"),
  ST("ga",0,0,"Gated (khoá\nbởi cổng)","error"),ST("sk",2,1,"Skipped\n(người bỏ)"),ST("fa",0,1,"Apply failed","error"),ST("dr",2,3,"Drifted\n(verify đỏ)","error"),ST("de",0,4,"Destroyed")],
 edges=[E("s","pl","Planner sinh"),E("pl","ap","apply create/update"),E("ap","ve","verify xanh"),E("ve","e"),
  E("s","ga","gate.allowed=false"),E("pl","sk","skip: true"),E("pl","fa","adapter lỗi"),E("fa","pl","chạy lại"),E("ve","dr","verify đỏ"),E("dr","ap","apply lại (update)",via="top"),E("ve","de","destroy"),E("de","e")],
 legend="Gated và Skipped không bao giờ được apply; checksum trùng → apply là skip nhưng trạng thái vẫn Applied.")

DIAGRAMS["usecase-02-interview-plan"] = dict(title="Use case 9.2 — Phỏng vấn và lập kế hoạch",
 nodes=[AC("arc",2,"Kiến trúc sư\nDX"),AC("spo",3,"Lãnh đạo",col=3),
  UC("u1",1,0,"Tạo intent bằng\nphỏng vấn"),UC("u2",1,1,"Điền form\nintent"),UC("u3",2,0,"Gắn gói ngành"),UC("u4",1,3,"Sửa intent"),UC("u5",1,4,"Sinh plan"),
  UC("u6",2,4,"Kiểm plan"),UC("u7",2,2,"Xem cây plan"),UC("u8",2,5,"Hỏi Vì sao"),UC("u9",2,1,"Phê duyệt plan"),UC("u10",1,5,"Sửa tài nguyên")],
 edges=[E("arc","u1",**LN),E("arc","u2",**LN),E("arc","u4",**LN),E("arc","u5",**LN),E("arc","u10",**LN),
  E("spo","u4",**LN),E("spo","u7",**LN),E("spo","u8",**LN),E("spo","u9",**LN),
  E("u5","u6","include",**INC),E("u10","u6",**INC),E("u1","u3","extend: có ngành phù hợp",**INC)],
 legend="Lãnh đạo chỉ sửa phần quy trình lõi của intent; validator và cổng trưởng thành nằm trong Kiểm plan.")

DIAGRAMS["usecase-03-apply-verify"] = dict(title="Use case 9.3 — Cấp phát, kiểm chứng, sổ tay, gói",
 nodes=[AC("arc",2,"Kiến trúc sư\nDX"),AC("spo",3,"Lãnh đạo",col=3),AC("tgt",1,"Hệ thống\nđích",col=3),
  UC("u1",1,0,"Xem dry-run"),UC("u2",1,1,"Apply lên đích"),UC("u3",1,2,"Verify"),UC("u4",1,3,"Destroy"),UC("u5",1,4,"Sinh sổ tay"),UC("u6",1,5,"Quản lý gói ngành"),
  UC("u7",2,1,"Cấp phát tài nguyên\n(adapter)"),UC("u8",2,2,"Trả bằng chứng"),UC("u9",2,0,"Sinh chính sách AI"),UC("u10",2,3,"Xem báo cáo")],
 edges=[E("arc","u1",**LN),E("arc","u2",**LN),E("arc","u3",**LN),E("arc","u4",**LN),E("arc","u5",**LN),E("arc","u6",**LN),
  E("tgt","u7",**LN),E("tgt","u8",**LN),E("spo","u10",**LN),
  E("u2","u7","include",below=True,**INC),E("u3","u8","include",below=True,shift=(-90,0),**INC),E("u2","u9","extend: lớp I được mở",**INC),E("u3","u10","include",shift=(20,0),**INC)])

DIAGRAMS["activity-02-sinh-plan"] = dict(title="Activity 10.2 — Sinh plan với validator và cổng trưởng thành",
 nodes=[N("s",None,0,"start","Bấm Sinh plan"),N("a1",None,1,"system","Đọc intent,\nnạp gói"),N("a2",None,2,"system","Template gói\n→ tài nguyên P"),N("a3",None,3,"system","Luật → tài nguyên\nH, D, I"),
  N("c1",None,4,"decision","AI bật?"),N("a4",None,5,"ai","AI đề xuất patch\n(zod)"),N("a5",None,6,"system","Áp patch hợp lệ,\nghi notes"),
  N("a6",None,7,"system","Cổng trưởng thành:\nđánh dấu gate\ntheo shape"),N("c2",None,8,"decision","Validator\nluật đạt?"),N("e1",None,8,"error","Liệt kê lỗi theo\ntài nguyên",row=1),
  N("a7",None,9,"system","Sinh reason\ncho từng tài nguyên"),N("a8",None,10,"system","Ghi plan.yaml,\nintent_hash"),N("d",None,11,"end","Hiện cây plan")],
 edges=[E("s","a1"),E("a1","a2"),E("a2","a3"),E("a3","c1"),E("c1","a4","có"),E("a4","a5"),E("a5","a6"),E("c1","a6","không"),E("a6","c2"),E("c2","e1","không"),E("e1","d",back=True),E("c2","a7","có"),E("a7","a8"),E("a8","d")],
 legend="Plan có lỗi vẫn hiện để sửa nhưng không phê duyệt được; không AI thì plan deterministic.")

DIAGRAMS["activity-03-apply"] = dict(title="Activity 10.3 — Apply với state và chạy tiếp sau ngắt",
 nodes=[N("s",None,0,"start","Bấm Apply\n(đã xem dry-run)"),N("a1",None,1,"system","Sắp topo theo\ndepends_on, lớp"),N("a2",None,2,"system","Lấy tài nguyên\nkế tiếp"),
  N("c1",None,3,"decision","gate.allowed\nvà không skip?"),N("c2",None,4,"decision","checksum\ntrùng state?"),N("a3",None,5,"system","Gọi adapter\ncreate/update"),
  N("c3",None,6,"decision","Thành\ncông?"),N("a4",None,7,"system","Ghi state,\ncập nhật tiến trình"),N("c4",None,8,"decision","Còn tài\nnguyên?"),
  N("e1",None,6,"error","Ghi lỗi, dừng,\ngiữ state",row=1),N("i",None,2,"error","Người ngắt → dừng\nsau tài nguyên hiện tại",row=1),N("d",None,9,"end","Xong, mở Verify")],
 edges=[E("s","a1"),E("a1","a2"),E("a2","c1"),E("c1","a4","không: bỏ qua",back=True,offset=150),E("c1","c2","có"),E("c2","a4","trùng: skip",back=True,offset=125),E("c2","a3","khác"),E("a3","c3"),E("c3","e1","không"),E("c3","a4","có"),E("a4","c4"),E("c4","a2","còn",back=True),E("c4","d","hết"),E("a2","i")],
 legend="Chạy tiếp = chạy lại apply: tài nguyên đã có state và checksum trùng sẽ skip.")

DIAGRAMS["activity-04-verify-handbook"] = dict(title="Activity 10.4 — Verify và sinh sổ tay",
 nodes=[N("s",None,0,"start","Bấm Verify"),N("a1",None,1,"system","Với mỗi tài nguyên\ncó state: adapter.verify"),N("a2",None,2,"system","Tạo dữ liệu thử\n_forge_probe_ (nếu cần)"),
  N("a3",None,3,"system","Gom checks,\ntính theo lớp"),N("c1",None,4,"decision","Tất cả\nxanh?"),N("e1",None,4,"error","Đánh dấu Drifted,\ngợi ý apply lại",row=1),
  N("a4",None,5,"task","Bấm Sinh sổ tay"),N("c2",None,6,"decision","AI bật?"),N("a5",None,7,"ai","AI viết theo plan\n+ state + gói"),N("a6",None,7,"system","Template\nsổ tay",row=1),
  N("a7",None,8,"system","Xem trước,\nđẩy lên Resources"),N("a8",None,9,"system","Sinh architecture.md"),N("d",None,10,"end","Xong")],
 edges=[E("s","a1"),E("a1","a2"),E("a2","a3"),E("a3","c1"),E("c1","e1","không"),E("c1","a4","có"),E("a4","c2"),E("c2","a5","có"),E("c2","a6","không"),E("a5","a7"),E("a6","a7"),E("a7","a8"),E("a8","d")])
