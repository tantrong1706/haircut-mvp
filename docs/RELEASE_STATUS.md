# Trạng thái phát hành HAIRCUT

Cập nhật: 27/07/2026

## Ba sản phẩm

| Sản phẩm | Đối tượng | Trạng thái source | Trạng thái phát hành |
| --- | --- | --- | --- |
| HAIRCUT Zalo Mini App | Khách hàng | Luồng QR, check-in, điểm, lịch sử, vòng quay và quà đã có | Đã gửi Zalo xét duyệt; phiên bản thực tế xem trên Zalo Portal |
| HAIRCUT Manager | Owner và staff | React/Capacitor, Android/iOS, FCM, App Check, camera, biometric, secure storage và deep link đã có | Chưa đưa lên TestFlight/Google Play Internal Testing |
| HAIRCUT Admin | Quản trị hệ thống | Web riêng, chỉ role `system_admin`, tổng quan, salon, feature flags và audit dạng chỉ đọc | Chưa tạo Firebase Hosting site riêng; thao tác ghi bị khóa mặc định |

Mini App ID được giữ nguyên: `2038116772828167300`. Bundle ID Manager: `vn.haircut.manager`.

## Trạng thái theo lớp

- **Source:** nhánh remediation bắt đầu từ `origin/main`
  `0d4fbf996f6a0f30f1e8bfa6fd2c106167622bbf`; thay đổi chưa được merge.
- **GitHub:** CI chỉ được xem là đạt sau khi Draft PR chạy xanh trên HEAD cuối.
- **Firebase:** chưa xác minh SHA đang deploy; không suy ra từ nhánh hoặc Hosting URL.
- **Zalo:** trạng thái Testing/Production phải xem trực tiếp trên Zalo Portal.
- **Manager/Admin:** chưa xác minh phát hành store hoặc Hosting riêng.
- Tạo tag `vX.Y.Z` chỉ sau khi CI, backup và smoke test đều đạt.

## Đã triển khai trong source

- Tenant isolation lấy salon từ `users/{uid}`; staff bị giới hạn theo `branchIds`.
- Transaction/idempotency cho check-in, nhận khách, gửi/duyệt điểm, quay và đổi quà.
- Feature flags toàn hệ thống và theo salon, maintenance mode và minimum app version.
- Error code dùng chung, audit bảo mật, rate limit, App Check và monitoring allowlist.
- Avatar salon, ảnh kiểu tóc có consent, xóa tài khoản cá nhân và xóa salon có thời gian chờ.
- Device token nhiều thiết bị, FCM cho Manager và push theo tenant/chi nhánh.
- Contracts dùng chung tại `packages/contracts`; bản mirror deploy Functions được kiểm tra tự động.

## Đang phát triển

- Cổng emulator fail-fast, readiness evidence theo SHA và deploy gate.
- Lint/format gate Manager; còn baseline 68 file định dạng cũ cần xử lý dần.
- CSP vẫn ở Report-Only chờ kiểm tra Zalo Testing và thiết bị thật.
- Kiểm thử Manager trên thiết bị thật sau khi thêm file cấu hình Firebase native.
- Xác minh hai job CI `Manager Android` và `Manager iOS Simulator` trên SHA phát hành cuối cùng.
- Local Windows đã `cap sync android` thành công; Gradle bị chặn vì máy chưa có
  Android SDK. iOS Simulator vẫn phải chạy trên macOS/Xcode hoặc GitHub Actions.
- Cấu hình APNs, Play Integrity, App Attest/DeviceCheck và bật enforcement theo rollout.
- Tạo Hosting site riêng cho Admin và điền `VITE_ADMIN_URL`.
- Chụp screenshot store, tạo tài khoản demo và hoàn thiện biểu mẫu App Privacy/Data Safety.
- Diễn tập backup/restore và ghi RTO/RPO thực tế.

## Chưa thực hiện trong giai đoạn này

- Growth/marketing automation, giới thiệu bạn bè, VIP, thanh toán hoặc AI tư vấn tóc.
- App khách hàng riêng trên App Store/Google Play.
- Backend staging riêng.

## Cổng phát hành

1. Chạy các lệnh kiểm tra trong [README](../README.md).
2. Audit tenant ở chế độ dry-run và tạo Firestore export.
3. Tạo release tag, deploy theo [deployment](deployment.md), rồi smoke test salon demo.
4. Zalo dùng Testing trước Production; Manager dùng TestFlight và Google Play Internal Testing.
5. Có lỗi thì dùng feature flag để cô lập tính năng và làm theo [incident runbook](incident-runbook.md).
