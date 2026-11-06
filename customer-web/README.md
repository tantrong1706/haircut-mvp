# CH Hair — Customer Web

Web/PWA tại https://app.chhaircutsalon.cc, chạy trong trình duyệt điện thoại và máy tính.
Khởi động từ repo root bằng scripts/start-web.ps1; hướng dẫn tổng thể ở [README gốc](../README.md).

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

## Bản chuẩn bị quyền riêng tư

Nhánh `codex/privacy-readiness` bổ sung các trang công khai `/cookies`, `/data-rights`,
`/service-policy`, `/refund` và hướng dẫn `/delete-account`. Công cụ xóa tài khoản đã đăng nhập
vẫn ở `/delete-account/manage`; quyền chủ salon/nhân viên không đổi.

Giám sát tùy chọn chỉ khởi tạo sau khi cho phép, độc lập với Auth/App Check và quyền ảnh.
Khách có thể tích điểm không ảnh, rút quyền ảnh tại tài khoản và liên hệ yêu cầu dữ liệu.
Chỉ email hỗ trợ mặc định được chủ dự án cho phép công khai. Không hiển thị tên, điện thoại
hoặc địa chỉ cá nhân, kể cả khi còn trong cấu hình cũ. Nếu dùng email hỗ trợ khác được duyệt,
đặt `VITE_PUBLIC_SUPPORT_EMAIL`; đây là cấu hình công khai, không phải secret.
Không tự tạo email, thông tin pháp lý, địa chỉ hoặc hotline giả.

```powershell
npm run test:privacy:coverage
```

Xem [checklist và giới hạn phát hành](../docs/PRIVACY_CHECKLIST.md) cùng
[bằng chứng kiểm thử](../docs/testing/privacy-readiness.tdd.md).
Bản chuẩn bị này không tự merge, deploy hoặc xử lý yêu cầu xóa qua email.
