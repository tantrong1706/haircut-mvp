# HAIRCUT

HAIRCUT là app chăm sóc và giữ chân khách hàng cho salon tóc. Bản hiện tại đã chuyển sang hướng production: khách check-in bằng QR, nhân viên xác nhận lượt cắt, chủ salon duyệt điểm, quản lý QR/gương, nhân viên, khách, vòng quay và mã quà.

## Luồng sản phẩm

1. Chủ salon đăng ký tài khoản tại `/owner`.
2. Hệ thống tạo salon thật và gắn `users/{uid}.salonId` cho chủ.
3. Chủ tạo QR riêng cho từng gương/ghế.
4. Khách quét QR, xác nhận tên hiển thị tại salon và tạo lượt cắt.
5. Nhân viên đăng nhập `/staff`, thấy khách đang chờ, ghi chú kiểu tóc và gửi yêu cầu cộng điểm.
6. Chủ salon duyệt hoặc từ chối yêu cầu.
7. Điểm, lịch sử cắt tóc, vòng quay và mã quà được cập nhật cho khách.

`/owner` và `/staff` không nhận `salonId` từ URL trong bản production. Salon luôn lấy từ tài khoản đăng nhập để tránh truy cập nhầm hoặc vượt quyền.

## URL đang dùng

```text
Khách:        https://haircut-c7d12.web.app
Chủ salon:    https://haircut-c7d12.web.app/owner
Nhân viên:    https://haircut-c7d12.web.app/staff
Quyền riêng tư: https://haircut-c7d12.web.app/privacy
```

## Cấu trúc repo

```text
haircut-mvp/
  firebase/          Firebase Hosting, Firestore rules/indexes, Storage rules, Cloud Functions
  zalo-mini-app/     React + TypeScript app cho khách, chủ salon và nhân viên
  scripts/           Script build, deploy và kiểm tra production readiness
  docs/              Tài liệu phụ trợ
  ios-app/           Source iOS chuẩn bị cho giai đoạn sau
```

## Môi trường production

Web app cần `zalo-mini-app/.env` có Firebase config và:

```env
VITE_FUNCTION_WRITE_MODE=required
VITE_ZALO_MINI_APP_ID=2038116772828167300
```

Cloud Functions dùng Secret Manager cho Zalo:

```powershell
firebase functions:secrets:set ZALO_APP_SECRET
```

Firestore rules hiện khóa ghi trực tiếp các collection nghiệp vụ. Các thao tác quan trọng phải đi qua Cloud Functions.

## Lệnh kiểm tra

```powershell
cd C:\tantrong\haircut-mvp
.\scripts\check-production-readiness.ps1 -RunBuild -CheckLiveUrls
```

## Lệnh deploy

Deploy web:

```powershell
.\scripts\deploy-hosting.ps1
```

Deploy Functions:

```powershell
cd C:\tantrong\haircut-mvp\firebase
$env:FUNCTIONS_DISCOVERY_TIMEOUT='60000'
firebase deploy --only functions
```

Deploy rules và indexes:

```powershell
cd C:\tantrong\haircut-mvp\firebase
firebase deploy --only firestore,storage
```

## Trạng thái hiện tại

Đã có:

- Đăng ký/đăng nhập chủ salon và nhân viên.
- Tạo salon thật qua Cloud Functions.
- Quản lý avatar chủ salon bằng upload ảnh lên Firebase Storage.
- Quản lý QR/gương, nhân viên, khách, vòng quay và mã quà.
- Duyệt điểm, từ chối điểm, lịch sử cắt tóc, tìm khách và đổi mã quà.
- Firestore rules, Storage rules và Firestore indexes theo hướng production.

Cần kiểm tra kỹ trước khi mở cho salon thật:

- Tạo ít nhất 1 salon thật, 2 nhân viên thật và vài QR gương thật.
- Test đủ luồng khách → nhân viên → chủ duyệt → khách nhận điểm.
- Kiểm tra logo, ảnh salon, nội dung hỗ trợ và Privacy Policy.
- Theo dõi Cloud Functions log trong Firebase Console sau khi có người dùng thật.
