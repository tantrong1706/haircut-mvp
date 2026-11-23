# Hồ sơ HAIRCUT Manager cho App Store và Google Play

## Phạm vi bản đầu — 23/11/2026

App cho **chủ salon và nhân viên được mời**. Khách tiếp tục quét QR và dùng Web;
không đưa luồng OTP khách, Admin hệ thống hoặc mua Plus/Pro vào bản đầu.
Không dùng dữ liệu thật để thử hoặc gửi cho người xét duyệt.

Ba mức xác minh cần tách riêng:

1. **Biên dịch:** quy trình `Manager Native` kiểm tra Gradle Android debug và Xcode Simulator
   không ký. Không chứa cấu hình Firebase, không phát hành và không phải bản cài dùng được cho salon.
2. **Thử trên thiết bị:** Android APK và iOS bản thử có ký, kết nối Firebase thử nghiệm đã được
   duyệt, với chủ/thợ demo, hồ sơ và ảnh mẫu, chi nhánh riêng. Không dùng bản build cấu hình
   trống để đánh dấu đăng nhập, camera, thông báo, ảnh hoặc sử dụng quà là đạt.
3. **Gửi duyệt:** sau khi thử thiết bị đạt, xác nhận chủ thể đứng tên, thông tin công khai,
   hồ sơ quyền riêng tư và bản phát hành có ký. Cần quyết định riêng trước upload/gửi duyệt.

Không tạo Firebase app, tài khoản demo, kho ứng dụng hoặc đăng ký trả phí bằng tài liệu này.
Apple dùng tên pháp lý cá nhân làm tên người bán nếu đăng ký cá nhân; chọn loại tài khoản sau
khi chủ dự án xác nhận thông tin được công khai.
[Đăng ký Apple](https://developer.apple.com/programs/enroll/) ·
[Loại tài khoản Google Play](https://support.google.com/googleplay/android-developer/answer/13634885)

## Thông tin ứng dụng

- Tên: **HAIRCUT Manager**
- Bundle/Application ID: `vn.haircut.manager`
- Đối tượng: chủ salon và nhân viên được mời vào salon.
- Privacy Policy: <https://app.chhaircutsalon.cc/privacy>
- Terms of Service: <https://app.chhaircutsalon.cc/terms>
- Account deletion: <https://app.chhaircutsalon.cc/delete-account>
- Support: chỉ email hỗ trợ đã được chủ dự án cho phép công khai; không dùng số cá nhân.

Mô tả ngắn đề xuất: “Quản lý hàng chờ, chi nhánh, nhân viên, điểm và quà cho salon trên một ứng dụng bảo mật.”

## Luồng người xét duyệt

1. Đăng nhập bằng tài khoản owner hoặc staff demo.
2. Staff chọn chi nhánh được phân công, nhận khách, ghi chú, chụp ảnh khi khách đồng ý và gửi điểm.
3. Owner duyệt điểm, quản lý nhân viên/chi nhánh, QR, vòng quay và ảnh salon.
4. Dùng camera quét mã quà; xác nhận sử dụng và kiểm tra audit.
5. Mở Cài đặt để xem Privacy, Terms và đường dẫn xóa tài khoản. Dùng tài khoản demo phụ nếu
   thử xóa để không làm mất quyền vào app của người xét duyệt.

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

- Đăng ký Android app và iOS app `vn.haircut.manager` trong đúng Firebase project đã được duyệt.
- Bản chạy được cần cấu hình client Firebase của Manager lúc đóng gói Web bundle, cùng với
  cấu hình native cho SDK trên điện thoại. Thiếu một trong hai không được coi là kiểm thử đăng nhập.
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
npm run build
npm exec --no -- cap sync android

# Android
npm exec --no -- cap open android

# iOS, chỉ trên máy Mac có Xcode phù hợp
npm exec --no -- cap sync ios
npm exec --no -- cap open ios
```

Với SDK Android 36 và JDK 21, chạy `gradlew.bat :app:testDebugUnitTest :app:lintDebug :app:assembleDebug`
tại thư mục `android` trên Windows. APK debug không phải AAB phát hành.
[Tài liệu Android](https://developer.android.com/build/building-cmdline)

Phân phối Android qua Internal Testing, rồi Closed Testing nếu áp dụng. Tài khoản Play cá nhân
được tạo sau 13/11/2023 phải có ít nhất 12 người tham gia liên tục 14 ngày trước khi xin quyền
phát hành công khai. Phân phối iOS qua TestFlight trước khi gửi duyệt.
[Google Play testing](https://support.google.com/googleplay/android-developer/answer/14151465) ·
[Apple SDK](https://developer.apple.com/news/upcoming-requirements/)

## Checklist gửi duyệt

- [ ] GitHub Actions `Manager Android Debug` đã chạy Gradle test, lint và `assembleDebug` trên đúng release SHA.
- [ ] GitHub Actions `Manager iOS Simulator` đã build Xcode Simulator với `CODE_SIGNING_ALLOWED=NO` trên đúng release SHA.
- [ ] Firebase native config đúng bundle ID và không nằm trong Git.
- [ ] FCM nhận được thông báo trên Android và iPhone; bấm thông báo mở đúng màn.
- [ ] App Check token hợp lệ trước khi bật `ENFORCE_APP_CHECK=true`.
- [ ] Camera, biometric, secure storage, deep link, offline và xóa tài khoản đã test trên thiết bị thật.
- [ ] Samsung và iPhone đã thử nhầm chi nhánh, từ chối camera, ảnh có đồng ý, cộng điểm và sử dụng quà
      đúng một lần; không dùng khách hay quà production để thử.
- [ ] Privacy/Terms/Support/Account deletion đều truy cập công khai.
- [ ] Demo owner/staff có dữ liệu vừa đủ và không chứa dữ liệu khách thật.
- [ ] Screenshot, mô tả, App Privacy và Data Safety đã điền.
- [ ] Backup, release tag, CI và rollback gate đều đạt.
