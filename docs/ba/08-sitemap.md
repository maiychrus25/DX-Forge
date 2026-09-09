# 8. Sitemap wizard DX-Forge (web, tối đa cấp 2) và CLI

```
/                         Trang chủ đường ống: 6 bước, trạng thái, nút chạy, thư mục làm việc
├── /measure              Đo lường (module DX-Pulse)
│   ├── /measure/a/[id]           Dashboard đợt đo
│   ├── /measure/a/[id]/prescription  Kê đơn, đối chất, 5 RÕ, hỏi báo cáo
│   ├── /measure/a/[id]/kit       Bộ P.A.R.A kit (đường tắt)
│   └── /measure/s/[token]        Khảo sát (công khai, không menu)
├── /interview            Phỏng vấn AI hoặc form; xem/sửa intent
├── /plan                 Cây plan theo lớp, lý do, cổng, sửa, kiểm, phê duyệt
├── /apply                Dry-run, tiến trình apply, destroy
├── /verify               Báo cáo kiểm chứng theo lớp/tài nguyên, lịch sử chạy
├── /handbook             Sổ tay sinh ra, architecture.md
├── /packs                Thư viện gói ngành
│   └── /packs/[id]               Chi tiết gói
├── /settings
│   ├── /settings/llm
│   ├── /settings/target
│   └── /settings/notifier
└── /about                Ghi công, giấy phép, phiên bản
Ngoài menu: /login
```

CLI tương ứng: `dxforge measure | interview | plan | apply | verify | handbook | destroy | packs | explain`; mọi lệnh có `--help`, `--json`, `--workdir <dir>`.
