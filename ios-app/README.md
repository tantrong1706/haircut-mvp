# HAIRCUT iOS App

Thư mục này chứa mã SwiftUI cho app iOS chủ salon/nhân viên.

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

## Đăng nhập MVP

Mã hiện tại có đăng nhập email/mật khẩu để test. Trước khi đưa lên App Store, hãy chọn phương thức đăng nhập production phù hợp, ví dụ Sign in with Apple và đăng nhập bằng số điện thoại.
