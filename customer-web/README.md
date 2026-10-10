# CH Hair — Customer Web

Web/PWA tại https://app.chhaircutsalon.cc, chạy trong Safari/Chrome, không cần Zalo.
Workspace được đổi tên từ `zalo-mini-app/`; hướng dẫn tổng thể nằm ở [README gốc](../README.md).

## Phát triển và kiểm thử

Dùng Node.js 22, giữ nguyên lockfile:

```powershell
npm ci
npm run dev -- --host 127.0.0.1
npm run check
npm run test:e2e
```

Production dùng Firebase Phone Auth, phiên trình duyệt và QR chi nhánh có chữ ký.
`VITE_APP_ENV=production` và `VITE_FUNCTION_WRITE_MODE=required` là bắt buộc.
Cấu hình local ở `.env.production.local`, không commit; không đưa secret vào biến `VITE_`.
Build xuất vào `www/`, test build vào `www-test/`. Chỉ deploy Hosting theo quy trình README gốc.

## Ranh giới mã nguồn

- `src/`: giao diện và dịch vụ Web; Manager sử dụng các adapter được chỉ định.
- `../packages/client-domain/`: kiểu dữ liệu, vòng quay và storage dùng chung; không phụ thuộc SDK.
- Frontend chỉ dùng Firebase Web Auth và Web callables. SDK, màn hình đăng nhập, cache phiên,
  công cụ build/review và QR Testing Zalo đã được gỡ. Không khôi phục chúng vào luồng Web.
- Các tên trường legacy còn trong kiểu dữ liệu dùng chung không phải cơ chế xác thực.
  Backend đã triển khai và dữ liệu live không bị xóa trong lần dọn frontend này.

Điểm, lịch sử, quyền truy cập và cooldown do server quyết định. Không đổi ID khách hoặc gộp dữ liệu
khi dọn source. Xem [phạm vi cleanup](../docs/WEB_SOURCE_CLEANUP.md).
