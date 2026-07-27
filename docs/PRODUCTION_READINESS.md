# Kiểm tra sẵn sàng production

## Kiểm tra tự động

```powershell
.\scripts\check.ps1
.\scripts\check.ps1 -Full
.\scripts\check-production-readiness.ps1 -CheckLiveUrls
```

`check.ps1` hiển thị riêng Passed, Failed, Blocked và Not run. Full suite tạo
`.tmp/release-readiness.json` cho đúng SHA; deploy script từ chối evidence của
commit khác. Admin và Manager đều phải qua `npm run check`; Android Gradle và iOS
Simulator chỉ được ghi đạt khi job CI tương ứng thực sự xanh trên HEAD.

## Cổng dữ liệu và bảo mật

- [ ] Production dùng `VITE_FUNCTION_WRITE_MODE=required`; client không ghi business data trực tiếp.
- [ ] Mọi collection nghiệp vụ có `salonId`; dữ liệu chi nhánh có `branchId`.
- [ ] Tenant audit dry-run đã kiểm tra; migration mapping được duyệt nếu còn dữ liệu cũ.
- [ ] Firestore/Storage Rules test đạt và không có `allow read, write: if true`.
- [ ] Secrets nằm trong Secret Manager; Git/history/log không chứa token hoặc dữ liệu khách.
- [ ] App Check monitor trước, enforce sau khi Zalo web và Manager native đều có token hợp lệ.
- [ ] CSP Report-Only đã được kiểm tra trên Zalo Testing; chỉ chuyển sang enforce
      sau khi Auth, Functions, Firestore, Storage, Zalo runtime và Sentry không bị chặn.
- [ ] Feature flags và maintenance mode đã được thử bằng dữ liệu demo.

## Cổng nghiệp vụ

- [ ] Một QR chung mỗi salon; một QR mỗi chi nhánh; QR Gương 1 chỉ là tương thích cũ.
- [ ] Hai staff không thể nhận cùng session; staff sai branch bị chặn.
- [ ] Retry check-in, submit/approve điểm, spin và redeem không tạo dữ liệu trùng.
- [ ] Owner/staff không đọc tenant khác; system admin chỉ dùng Admin Web.
- [ ] Ảnh chỉ lưu khi consent; xóa khách/salon không báo hoàn tất khi còn residue.

## Cổng phát hành

- [ ] Firestore export, release tag, deploy SHA và rollback owner đã được ghi nhận.
- [ ] Functions -> migration -> indexes -> Rules -> Hosting được triển khai đúng thứ tự.
- [ ] Zalo Testing chạy thật trên Android/iPhone trước Production.
- [ ] Manager chạy trên thiết bị thật qua Internal Testing/TestFlight; FCM/App Check/camera/biometric/deep link đều đạt.
- [ ] Admin có Hosting site riêng; `/admin` không còn cấp quyền owner.
- [ ] Privacy, Terms, Support và Account deletion truy cập công khai.
- [ ] Uptime, error/quota/billing alerts đã gửi thử tới đúng người trực.

Không đánh dấu production-ready chỉ vì build thành công. Trạng thái hiện tại nằm ở [RELEASE_STATUS.md](RELEASE_STATUS.md).
