# Kiểm Tra Sẵn Sàng Production

Tài liệu này dùng trước khi đưa HAIRCUT cho salon thật dùng.

## Lệnh kiểm tra

Chạy từ thư mục `haircut-mvp`:

```powershell
.\scripts\check-production-readiness.ps1 -RunBuild -CheckLiveUrls
```

Script sẽ kiểm tra:

- Node/npm/Firebase CLI/GitHub CLI.
- Git worktree có sạch không.
- Firebase project hiện tại.
- `zalo-mini-app/.env` và `VITE_FUNCTION_WRITE_MODE`.
- Firestore rules live trong repo có còn mở không.
- Rules production mẫu có khóa ghi client không.
- Build local cho Functions và web.
- Các URL live chính.
- Trạng thái GitHub Actions mới nhất.

## Điều kiện nên đạt trước production

- `VITE_FUNCTION_WRITE_MODE=required`.
- Cloud Functions đã deploy.
- Firestore rules production đã khóa, không còn `allow read, write: if true`.
- GitHub Actions chạy xanh.
- Owner/staff đăng nhập bằng Firebase Auth và có `users/{uid}` đúng role.
- QR gương được tạo bằng `mirrors/{mirrorId}` có `qrToken` riêng.
- Privacy Policy có kênh liên hệ thật.

## Không tự động làm được

Các việc sau cần chủ dự án thao tác hoặc cung cấp thông tin:

- Bật/nâng Firebase Blaze.
- Sửa GitHub billing hoặc spending limit.
- Tạo Zalo Mini App production nếu cần OTP/tài khoản cá nhân.
- Đăng ký Apple Developer Program.
- Cung cấp thông tin pháp lý/liên hệ trong chính sách quyền riêng tư.

## Thứ tự chuyển production an toàn

1. Deploy Functions.
2. Đặt `VITE_FUNCTION_WRITE_MODE=auto`.
3. Test full flow với owner/staff thật.
4. Đặt `VITE_FUNCTION_WRITE_MODE=required`.
5. Deploy Hosting.
6. Deploy Firestore rules production.
7. Test staff không vào được `/owner`.
8. Test khách vẫn xem được lịch sử/quà qua Functions.
9. Pilot với 1 salon thật trong 7-14 ngày.
