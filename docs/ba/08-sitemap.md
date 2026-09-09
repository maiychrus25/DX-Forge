# 8. Sitemap (web, tối đa cấp 2)

```
/                         Launchpad + Portal (bảng tin, nút tác vụ, cây Resources, dashboard nhúng)
├── /pulse                Đo lường
│   ├── /pulse/a/[id]             Dashboard đợt đo
│   ├── /pulse/a/[id]/prescription  Kê đơn, đối chất, 5 RÕ, hỏi báo cáo
│   ├── /pulse/a/[id]/kit         Bộ kỷ luật P.A.R.A
│   └── /pulse/s/[token]          Khảo sát (công khai, không menu)
├── /portal
│   ├── /portal/handbook/[slug]   Sổ tay nghiệp vụ số
│   └── /portal/admin             Người dùng, phòng ban, dự án, thu hồi truy cập (dx-admin)
├── /apps                 Ứng dụng nghiệp vụ (Appsmith nhúng: DX-Ticket)
├── /analytics            Dashboard nghiệp vụ (Metabase nhúng)
├── /ai
│   ├── /ai/ask                   Hỏi đáp trên Resources
│   └── /ai/commands              Lệnh AI và nhật ký
├── /settings
│   ├── /settings/organization
│   ├── /settings/notifier
│   ├── /settings/llm
│   └── /settings/profile
└── /about                Ghi công, giấy phép, phiên bản
Ngoài menu: /public/ticket (biểu mẫu khách hàng), /public/csat/[ticketId] (đánh giá), /auth/* (Keycloak)
```

Dịch vụ ngoài mở tab mới từ nút trên Portal: Nextcloud `/files/`, n8n `/workflow/` (dx-admin), Keycloak `/auth/admin` (dx-admin).
