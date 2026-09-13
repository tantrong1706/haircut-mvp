# Trạng thái phát hành HAIRCUT

Cập nhật: 29/07/2026

## Cập nhật remediation 29/07/2026

Source hiện đã bổ sung các bảo vệ sau, nhưng **chưa production-ready và chưa deploy**:

- Session `waiting`, `serving` và `pending_approval` hết hạn được đóng idempotent; yêu cầu
  điểm liên quan bị từ chối bởi hệ thống, ảnh tạm được dọn và không phát sinh điểm/lịch sử cắt.
- Lời mời staff chỉ chuyển sang `accepted` sau thao tác đồng ý rõ ràng; việc đọc hồ sơ không
  còn âm thầm chấp nhận lời mời.
- Tìm khách trả danh sách tóm tắt; chi tiết chỉ tải cho một khách qua callable có kiểm tra
  salon/chi nhánh/quyền, không còn N+1 hoặc fallback Firestore trực tiếp.
- Job xóa khách dùng phân trang Firestore và Storage, lưu cursor/progress, retry an toàn,
  xóa customer cuối cùng và không trừ `customerCount` hai lần.
- Lỗi Zalo phân biệt thiếu quyền với lỗi tạm thời; UI không lặp xin quyền vô hạn.
- Secret scanner hỗ trợ cả file tracked và working tree; strict release gate fail-closed theo SHA.

Các blocker ngoài source vẫn còn:

- GitHub Actions Billing/spending limit: **Deferred/external**, CI chưa xác minh HEAD cuối.
- Chưa build iOS trên macOS/Xcode.
- Chưa xác minh App Check trên Android và iPhone thật; chưa có App Check site key.
- Chưa có Sentry DSN production.
- Chưa deploy production hoặc chạy migration production.

Local production-readiness đạt chỉ chứng minh cấu hình/source cục bộ; **không phải production
release approval**. Strict release phải tiếp tục fail cho tới khi toàn bộ bằng chứng vận hành
khớp đúng SHA.

## Ba sản phẩm

| Sản phẩm         | Đối tượng         | Trạng thái source                                                                                  | Trạng thái phát hành                                                           |
| ---------------- | ----------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| CH Haircut Salon | Khách hàng        | Luồng QR, check-in, điểm, lịch sử, vòng quay và quà đã có                                          | Zalo Mini App ID `2038116772828167300`; phiên bản thực tế xem trên Zalo Portal |
| HAIRCUT Manager  | Owner và staff    | React/Capacitor, Android/iOS, FCM, App Check, camera, biometric, secure storage và deep link đã có | Chưa đưa lên TestFlight/Google Play Internal Testing                           |
| HAIRCUT Admin    | Quản trị hệ thống | Web riêng, chỉ role `system_admin`, tổng quan, salon, feature flags và audit dạng chỉ đọc          | Chưa tạo Firebase Hosting site riêng; thao tác ghi bị khóa mặc định            |

Mini App ID được giữ nguyên: `2038116772828167300`. Bundle ID Manager: `vn.haircut.manager`.

## Trạng thái theo lớp

- **Source:** nhánh remediation bắt đầu từ `origin/main`
  `3e55436ec2228f18f106b0b8ee3c918c18d20dfd`; thay đổi chưa được merge.
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
- Android đã `cap sync`, `assembleDebug`, unit test và lint thành công bằng SDK 36/Java 21
  trong môi trường kiểm tra cục bộ. iOS đã `cap sync`; Simulator vẫn phải chạy trên
  macOS/Xcode hoặc GitHub Actions.
- Cấu hình APNs, Play Integrity, App Attest/DeviceCheck và bật enforcement theo rollout.
- Tạo Hosting site riêng cho Admin và điền `VITE_ADMIN_URL`.
- Chụp screenshot store, tạo tài khoản demo và hoàn thiện biểu mẫu App Privacy/Data Safety.
- Diễn tập backup/restore và ghi RTO/RPO thực tế.

## Bằng chứng kiểm tra cục bộ

Các kiểm tra ngày 03/08/2026 được chạy trên source hiện tại, không deploy và không truy cập
dữ liệu Firebase production:

- Functions: typecheck/lint/build đạt; `63/63` unit test đạt.
- Firestore/Storage Rules: `19/19` test đạt.
- Functions integration với Firebase Emulator: `45/45` test đạt.
- Zalo Mini App: lint/format/build ZMP đạt; `85/85` unit test đạt; readiness Zalo `24/24`.
- Admin Web: check/build đạt; `8/8` test đạt.
- Manager: check/build đạt; `73/73` test đạt.
- Browser E2E: `15` test đạt; `9` test ảnh xét duyệt được bỏ qua có chủ đích vì chỉ chạy
  khi bật bộ tạo ảnh review.
- Android: `cap sync android` đạt; Gradle chưa được chạy lại trên HEAD cuối vì máy hiện tại không có Android SDK.
- iOS: chỉ xác minh `cap sync`; chưa có bằng chứng build Simulator trên macOS.

Readiness production hiện **chưa đạt** vì còn các bước thủ công:

- `firebase/.firebaserc` local đã trỏ `haircut-c7d12`; vẫn phải xác minh quyền và SHA deploy
  ngay trước release.
- Cấu hình Functions production, App Check và monitoring bằng secret/biến môi trường thật.
- Chạy iOS Simulator hoặc thiết bị iOS thật.
- Chạy CI trên HEAD cuối sau khi GitHub Actions không còn bị chặn bởi billing.
- `zmp-sdk` đã ghim bản stable `2.51.8`; tiếp tục theo dõi bản upstream loại dependency
  cũ, không hạ xuống `2.9.4` hoặc dùng `npm audit fix --force`.

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
