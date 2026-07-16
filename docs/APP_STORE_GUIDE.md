# Hướng dẫn App Store cho HAIRCUT Manager

> Đây là trang chuyển tiếp để giữ các liên kết tài liệu cũ. Checklist phát hành hiện hành nằm tại [`MANAGER_STORE_SUBMISSION.md`](MANAGER_STORE_SUBMISSION.md).

## Phạm vi bản native

Ứng dụng App Store/Google Play chỉ dành cho chủ salon và nhân viên. Khách hàng tiếp tục dùng QR và Zalo Mini App để giảm thao tác cài đặt.

Source hiện hành nằm trong `apps/manager-mobile/` và dùng React, TypeScript, Capacitor, Firebase Auth, Cloud Functions, App Check và Firebase Cloud Messaging. Thư mục `ios-app/` là mã tham khảo cũ, không phải gói phát hành production.

## Điều kiện bắt buộc trước TestFlight

- Có tài khoản Apple Developer và máy Mac/Xcode tương thích Capacitor 8.
- Tạo Firebase iOS app đúng bundle ID và thêm `GoogleService-Info.plist` cục bộ.
- Bật Push Notifications, Background Modes và App Attest/DeviceCheck theo checklist.
- Cấu hình APNs trong Firebase Cloud Messaging.
- App Check native đã đăng ký và được theo dõi trước khi enforce.
- Backend, Rules và migration tenant đã qua kiểm tra trên staging.
- Có tài khoản owner/staff review, dữ liệu mẫu hợp lệ, Privacy URL và Support URL công khai.
- Kiểm thử đăng nhập, hàng chờ, duyệt điểm, đổi quà, mất mạng và push trên iPhone thật.
- Không commit file Firebase native, certificate, provisioning profile hoặc secret.

## Lệnh chuẩn bị source

```powershell
cd "C:\tantrong\haircut-mvp\apps\manager-mobile"
npm ci
npm run check
npm run sync
```

Sau đó mở dự án iOS trên Mac theo hướng dẫn trong `docs/MANAGER_STORE_SUBMISSION.md`. Việc archive, ký và tải lên App Store Connect là bước thủ công; không thực hiện từ máy Windows này.

## Tài liệu liên quan

- Phát hành Manager: [`MANAGER_STORE_SUBMISSION.md`](MANAGER_STORE_SUBMISSION.md)
- Kiến trúc: [`architecture.md`](architecture.md)
- Triển khai backend: [`deployment.md`](deployment.md)
- Vận hành production: [`PRODUCTION_OPERATIONS.md`](PRODUCTION_OPERATIONS.md)
- Chính sách dữ liệu: `/privacy` và `/terms`
