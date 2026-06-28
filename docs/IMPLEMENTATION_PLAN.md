# Kế Hoạch Triển Khai

## Giai đoạn 1: Nền tảng

- Tạo Firebase project.
- Bật Authentication.
- Bật Firestore.
- Cấu hình Hosting.
- Triển khai web MVP.
- Tạo tài khoản chủ salon/nhân viên.
- Tạo salon demo.

## Giai đoạn 2: Web MVP

- Khách quét QR và tạo phiên phục vụ.
- Nhân viên xem khách đang chờ.
- Nhân viên gửi yêu cầu cộng điểm.
- Chủ salon duyệt/từ chối.
- Khách xem lịch sử và quà.
- Chủ salon cấu hình vòng quay.

## Giai đoạn 3: Bảo mật

- Hoàn thiện đăng nhập chủ salon/nhân viên.
- Dùng `users/{uid}` để phân quyền.
- Chuyển `VITE_FUNCTION_WRITE_MODE` từ `direct` sang `auto`, rồi sang `required`.
- Hoàn thiện xác thực khách từ Zalo.
- Chuyển các thao tác nhạy cảm sang Cloud Functions.
- Khóa Firestore rules.
- Bật App Check.

## Giai đoạn 4: Zalo Mini App production

- Tạo Mini App trong Zalo developer console.
- Cấu hình quyền cần thiết.
- Dùng `getUserInfo` để nhận diện khách.
- Chỉ xin số điện thoại khi đã giải thích lý do.
- Xác minh Zalo token ở server.
- Cấu hình URL QR thật.

## Giai đoạn 5: Ảnh, điểm và quà

- Upload ảnh kiểu tóc khi khách đồng ý.
- Giới hạn quyền xem ảnh.
- Cho chủ salon cấu hình số điểm mỗi lần cắt.
- Xác nhận mã quà bằng chủ salon/nhân viên được cấp quyền.
- Ghi lịch sử sử dụng mã quà.

## Giai đoạn 6: iOS

- Tạo Xcode project.
- Thêm Firebase SDK.
- Chép mã SwiftUI từ `ios-app/Haircut`.
- Thêm `GoogleService-Info.plist`.
- Test phân quyền chủ salon/nhân viên.
- Chuẩn bị TestFlight sau khi web MVP ổn định.
