# HAIRCUT MVP

HAIRCUT là sản phẩm chăm sóc và giữ chân khách hàng cho salon tóc. Bản hiện tại là MVP chạy trên Firebase Hosting, dùng chung cho luồng khách quét QR, nhân viên ghi nhận khách và chủ salon duyệt điểm.

## Luồng chính

1. Chủ salon tạo salon.
2. Chủ salon tạo QR cho từng gương hoặc ghế.
3. Khách quét QR bằng Zalo.
4. Ứng dụng tạo hoặc tìm hồ sơ khách.
5. Nhân viên thấy khách đang chờ.
6. Nhân viên ghi chú kiểu tóc và gửi yêu cầu cộng điểm.
7. Chủ salon duyệt điểm.
8. Khách xem lịch sử, tích điểm và quay vòng may mắn.

## Cấu trúc thư mục

```text
haircut-mvp/
  docs/                 Tài liệu sản phẩm, dữ liệu, bảo mật và lộ trình
  firebase/             Firestore rules, Hosting, Functions/Storage tùy chọn
  ios-app/              Mã SwiftUI cho app iOS chủ salon/nhân viên sau này
  zalo-mini-app/        Web app React/TypeScript cho khách, nhân viên, chủ salon
```

## Thành phần MVP

- `firebase`: cấu hình Firestore, Hosting và bản build public. Storage chưa deploy nếu dự án Firebase chưa nâng Blaze.
- `zalo-mini-app`: app web hiện tại cho khách quét QR, nhân viên gửi yêu cầu, chủ salon duyệt điểm, cấu hình vòng quay và trang quyền riêng tư.
- `ios-app`: mã nguồn SwiftUI cho app iOS tương lai. Muốn build thật cần Mac, Xcode và file `GoogleService-Info.plist`.

## Chế độ ghi dữ liệu

Web app hỗ trợ `VITE_FUNCTION_WRITE_MODE` trong `zalo-mini-app/.env`:

- `direct`: MVP test nội bộ, client ghi Firestore trực tiếp.
- `auto`: thử gọi Cloud Functions, nếu lỗi thì fallback về Firestore trực tiếp.
- `required`: production, bắt buộc gọi Cloud Functions và không fallback.

Khi chuẩn bị khóa Firestore rules, chuyển sang `required` và deploy Functions trước.

## Thứ tự làm tiếp

1. Test trọn luồng web MVP.
2. Cấu hình vòng quay trong `/owner`.
3. Tạo tài khoản Firebase Auth cho chủ salon/nhân viên và tạo document `users/{uid}`.
4. Deploy Cloud Functions và thử `VITE_FUNCTION_WRITE_MODE=auto`.
5. Khi Functions ổn, đổi sang `VITE_FUNCTION_WRITE_MODE=required`.
6. Hoàn thiện xác thực khách/Zalo rồi mới khóa Firestore rules.
7. Tạo Zalo Mini App production.
8. Build app iOS chủ salon/nhân viên trên Mac/Xcode sau.

## Chạy trên Windows

Chạy từ thư mục `haircut-mvp`:

```powershell
.\scripts\setup.ps1 -InstallFirebaseCli
.\scripts\start-miniapp.ps1
```

Chạy demo với Firebase Emulator:

```powershell
.\scripts\start-emulators.ps1
.\scripts\seed-demo.ps1
```

Triển khai Firebase sau khi đăng nhập. MVP hiện tại chỉ nên triển khai Firestore + Hosting:

```powershell
.\scripts\firebase-login.ps1
.\scripts\set-firebase-project.ps1 -ProjectId your-firebase-project-id
.\scripts\deploy-firebase.ps1
```

Không triển khai Storage nếu Firebase project chưa nâng Blaze:

```powershell
.\scripts\deploy-firebase.ps1 -IncludeStorage
```

Chỉ triển khai Functions khi chuyển lại logic nghiệp vụ sang callable backend:

```powershell
.\scripts\deploy-firebase.ps1 -IncludeFunctions
```

Triển khai riêng web app sau khi sửa giao diện:

```powershell
.\scripts\deploy-hosting.ps1
```

## URL test

```text
https://haircut-c7d12.web.app
https://haircut-c7d12.web.app/staff?salonId=demo-salon
https://haircut-c7d12.web.app/owner?salonId=demo-salon
https://haircut-c7d12.web.app/privacy
```

Trang `/staff` và `/owner` cần Firebase Auth và document phân quyền `users/{uid}`. Xem [docs/AUTH_SETUP.md](docs/AUTH_SETUP.md).

## Trạng thái hiện tại

Repo này là MVP test nội bộ. Firestore rules live vẫn đang mở để khách test tạo hồ sơ và phiên ghế. Trước khi dùng cho salon thật, bắt buộc hoàn thiện xác thực khách/Zalo và khóa rules.
