# Hồ sơ HAIRCUT Manager cho App Store và Google Play

## Thông tin ứng dụng

- Tên: **HAIRCUT Manager**
- Bundle/Application ID: `vn.haircut.manager`
- Đối tượng: chủ salon và nhân viên được mời vào salon.
- Privacy Policy: <https://haircut-c7d12.web.app/privacy>
- Terms of Service: <https://haircut-c7d12.web.app/terms>
- Account deletion: <https://haircut-c7d12.web.app/delete-account>
- Support: `tantrong1706@gmail.com` / `0838098761`

Mô tả ngắn đề xuất: “Quản lý hàng chờ, chi nhánh, nhân viên, điểm và quà cho salon trên một ứng dụng bảo mật.”

## Luồng người xét duyệt

1. Đăng nhập bằng tài khoản owner hoặc staff demo.
2. Staff chọn chi nhánh được phân công, nhận khách, ghi chú, chụp ảnh khi khách đồng ý và gửi điểm.
3. Owner duyệt điểm, quản lý nhân viên/chi nhánh, QR, vòng quay và ảnh salon.
4. Dùng camera quét mã quà; xác nhận sử dụng và kiểm tra audit.
5. Mở Cài đặt để xem Privacy, Terms và luồng xóa tài khoản/salon.

## Tài khoản demo cần điền thủ công

```text
Owner email: ______________________________
Owner password: ___________________________
Staff email: ______________________________
Staff password: ___________________________
Salon demo: _______________________________
Chi nhánh demo: ___________________________
```

Không commit các giá trị này. Chỉ điền vào cổng xét duyệt store.

## Cấu hình native bắt buộc

- Tạo Android app và iOS app `vn.haircut.manager` trong Firebase project.
- Đặt `google-services.json` tại `apps/manager-mobile/android/app/`.
- Đặt `GoogleService-Info.plist` tại `apps/manager-mobile/ios/App/App/`.
- Firebase App Check: Android dùng Play Integrity; iOS dùng App Attest/DeviceCheck.
- Firebase Cloud Messaging: tải APNs Auth Key lên Firebase, bật Push Notifications và Background Modes > Remote notifications trong Xcode.
- Chọn signing team, provisioning profile và version/build number trong Xcode/Play Console.
- Hai file Firebase native đã nằm trong `.gitignore`, không commit chúng.

## Dữ liệu và quyền

### App Store App Privacy

- Contact Info: email/phone của owner hoặc staff, dùng cho tài khoản và vận hành.
- User Content: ghi chú và ảnh kiểu tóc khi khách đã đồng ý.
- Identifiers: Firebase UID và device token cho đăng nhập/thông báo.
- Diagnostics/Usage Data: lỗi và hiệu năng đã loại dữ liệu nhạy cảm.
- Tracking: **Không** dùng dữ liệu để theo dõi người dùng qua ứng dụng/công ty khác.

### Google Play Data Safety

- Dữ liệu được mã hóa khi truyền bằng HTTPS/TLS.
- Người dùng có thể yêu cầu xóa tài khoản trong app và tại URL công khai.
- Không bán dữ liệu; không chia sẻ dữ liệu khách cho quảng cáo.
- Ảnh chỉ được lưu khi khách đồng ý và bị giới hạn theo tenant/Storage Rules.

Khai báo cuối cùng phải được đối chiếu lại với SDK thực tế trong bản AAB/IPA trước khi gửi.

## Ảnh cần chụp

- iPhone 6.7 inch: đăng nhập, owner tổng quan, hàng chờ, duyệt điểm, chi nhánh/QR, nhân viên, vòng quay, cài đặt/xóa tài khoản.
- Android phone: cùng các màn trên, thêm camera quét mã quà và trạng thái offline.
- Không để lộ email thật, UID, token, số điện thoại khách hoặc mã quà production.

## Build thử nghiệm

```powershell
cd apps\manager-mobile
npm ci
npm run sync

# Android
npx cap open android

# iOS, chỉ trên Mac
npx cap open ios
```

Phân phối Android qua Internal Testing rồi Closed Testing. Phân phối iOS qua TestFlight internal trước khi gửi review.

## Checklist gửi duyệt

- [ ] Firebase native config đúng bundle ID và không nằm trong Git.
- [ ] FCM nhận được thông báo trên Android và iPhone; bấm thông báo mở đúng màn.
- [ ] App Check token hợp lệ trước khi bật `ENFORCE_APP_CHECK=true`.
- [ ] Camera, biometric, secure storage, deep link, offline và xóa tài khoản đã test trên thiết bị thật.
- [ ] Privacy/Terms/Support/Account deletion đều truy cập công khai.
- [ ] Demo owner/staff có dữ liệu vừa đủ và không chứa dữ liệu khách thật.
- [ ] Screenshot, mô tả, App Privacy và Data Safety đã điền.
- [ ] Backup, release tag, CI và rollback gate đều đạt.
