# HAIRCUT iOS App

Thư mục này chứa mã SwiftUI cho app iOS chủ salon/nhân viên.

## Phạm vi App Store v1.0

Bản iOS đầu tiên chỉ nên dành cho chủ salon và nhân viên:

- Chủ salon xem tổng quan, duyệt điểm, cấu hình vòng quay, quản lý nhân viên.
- Nhân viên xem hàng chờ, ghi chú kiểu tóc, gửi yêu cầu cộng điểm, đổi mã quà.
- Khách hàng vẫn dùng QR, Zalo Mini App hoặc web, không bắt buộc cài app iOS.

Không submit App Store khi Cloud Functions chưa deploy, Firestore rules còn mở, hoặc thiếu demo account cho Apple Review.

## Thiết lập trên Mac

1. Mở Xcode.
2. Tạo iOS App project mới tên `Haircut`.
3. Chọn giao diện SwiftUI.
4. Thêm Firebase packages:
   - FirebaseAuth
   - FirebaseCore
   - FirebaseFirestore
   - FirebaseFunctions
   - FirebaseStorage
5. Chép thư mục nguồn `Haircut/` vào Xcode project.
6. Thêm `GoogleService-Info.plist` vào `Haircut/Resources`.
7. Build và chạy.

Bundle ID đề xuất:

```text
com.tantrong.haircut
```

## Đăng nhập MVP

Mã hiện tại có đăng nhập email/mật khẩu để test. Trước khi đưa lên App Store, hãy chọn phương thức đăng nhập production phù hợp, ví dụ Sign in with Apple và đăng nhập bằng số điện thoại.

Checklist App Store chi tiết nằm ở `docs/APP_STORE_GUIDE.md`.
