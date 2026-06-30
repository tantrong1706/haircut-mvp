# Hướng Dẫn Đưa HAIRCUT Lên App Store

Bản v4 này dùng làm checklist thật trước TestFlight và App Store. Không submit App Store khi backend chưa live, Firestore rules còn mở, thiếu demo account, hoặc app vẫn là beta/demo.

## Phạm Vi V1.0

App Store v1.0 nên là app iOS native cho chủ salon và nhân viên.

Khách hàng vẫn dùng QR, Zalo Mini App hoặc web:

- Giảm phạm vi review.
- Tránh bắt khách cài app chỉ để tích điểm.
- Giữ iOS app tập trung vào nghiệp vụ salon: hàng chờ, ghi chú, duyệt điểm, đổi quà.

## Trạng Thái Hiện Tại

Cập nhật ngày 2026-06-29:

- Hosting live: `https://haircut-c7d12.web.app`.
- Firestore indexes đã deploy.
- Web đã build/deploy ở chế độ chuyển tiếp `VITE_FUNCTION_WRITE_MODE=auto`.
- Cloud Functions chưa deploy được vì Firebase project cần nâng Blaze để bật `artifactregistry.googleapis.com` và `cloudbuild.googleapis.com`.
- Firestore rules trong repo đã là bản production; chỉ deploy lên live sau khi Functions chạy ổn và web dùng `VITE_FUNCTION_WRITE_MODE=required`.
- GitHub Actions vẫn bị GitHub billing/spending limit chặn, job chưa chạy thật.

Kết luận: chưa đủ điều kiện submit TestFlight/App Store.

## Cổng Kiểm Tra Bắt Buộc

Chỉ chuyển sang production khi tất cả mục này đạt:

- Firebase Blaze đã bật.
- Cloud Functions deploy thành công.
- Web production dùng `VITE_FUNCTION_WRITE_MODE=required`.
- Firestore rules production đã deploy, không còn `allow read, write: if true`.
- Owner/staff đăng nhập bằng Firebase Auth và có `users/{uid}` đúng role.
- Staff không vào được owner screen.
- User inactive bị chặn.
- User salon khác không đọc/ghi được dữ liệu salon này.
- QR sai `qrToken` hoặc mirror inactive không tạo được session.
- Privacy Policy URL mở public.
- Support URL/email có thật.
- GitHub Actions build xanh.

## Lệnh Chuyển Production

Chạy từ PowerShell:

```powershell
cd "C:\tantrong\haircut-mvp"
git pull --ff-only
.\scripts\check-production-readiness.ps1 -RunBuild -CheckLiveUrls

cd "C:\tantrong\haircut-mvp\firebase"
firebase deploy --only firestore:indexes
firebase deploy --only functions
```

Sau khi Functions deploy và test ổn:

```powershell
cd "C:\tantrong\haircut-mvp\zalo-mini-app"
notepad .\.env
```

Đặt:

```text
VITE_FUNCTION_WRITE_MODE=required
```

Build và deploy Hosting:

```powershell
cd "C:\tantrong\haircut-mvp"
.\scripts\deploy-hosting.ps1
```

Chỉ sau khi flow ở `required` đã pass, mới khóa rules:

```powershell
cd "C:\tantrong\haircut-mvp\firebase"
Copy-Item .\firestore.rules.production.example .\firestore.rules -Force
firebase deploy --only firestore:rules
```

## QA Trước TestFlight

- Web khách mở link QR, nhập số điện thoại, tạo lượt cắt thành công.
- Staff đăng nhập, thấy khách đang chờ, dùng ghi chú nhanh, gửi yêu cầu cộng điểm.
- Owner đăng nhập, thấy dashboard, duyệt/từ chối điểm, số liệu cập nhật đúng.
- Vòng quay cho khách đủ điểm chạy được, animation khớp kết quả, mã quà hiện đúng.
- Staff/owner nhập mã quà, mã `unused` chuyển thành `used`; mã sai báo lỗi dễ hiểu.
- Phân quyền pass: staff không vào owner, inactive bị chặn, khác salon không đọc/ghi được.
- Required mode pass: không thao tác quan trọng nào cần direct Firestore write.
- Rules production pass: deploy xong vẫn test được toàn bộ flow.
- iPhone Safari/PWA và iOS native không crash trong test cơ bản.

## App Store Connect

Cần chuẩn bị trên Mac hoặc Mac cloud:

- Xcode mới.
- Apple Developer Program hợp lệ.
- Bundle ID, đề xuất: `com.tantrong.haircut`.
- Firebase iOS app trong project `haircut-c7d12`.
- File `GoogleService-Info.plist` cho iOS.
- Firebase packages: FirebaseCore, FirebaseAuth, FirebaseFirestore, FirebaseFunctions.
- App Store Connect app record: name, bundle ID, SKU, primary language.
- App icon 1024x1024.
- Screenshots đúng giao diện thật.
- Privacy Policy URL và Support URL public.
- Review Notes có demo accounts và sample QR.

Template Review Notes nằm ở [APPLE_REVIEW_NOTES_TEMPLATE.md](APPLE_REVIEW_NOTES_TEMPLATE.md).

## Thông Tin Cần Bạn Cung Cấp

- Xác nhận Firebase Blaze đã bật.
- Xác nhận GitHub Billing/spending limit đã xử lý.
- Apple Developer account đã active hay chưa.
- Bundle ID chính thức muốn dùng.
- Email support thật.
- Privacy Policy URL chính thức nếu không dùng `/privacy`.
- Demo owner email/password.
- Demo staff email/password.
- Tên salon thật hoặc salon demo muốn reviewer thấy.

## Không Được Làm Trước Khi Submit

- Không để chữ beta/demo/trial trong app hoặc metadata submit.
- Không submit khi backend chưa live.
- Không submit khi rules còn mở.
- Không để app trống dữ liệu khiến reviewer không test được.
- Không dùng screenshots giả khác giao diện thật.
- Không khai báo App Privacy lệch với dữ liệu app đang thu thập.
