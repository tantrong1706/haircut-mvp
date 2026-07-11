# Triển khai production

## Bí mật và môi trường

- Firebase public config và Zalo Mini App ID nằm trong `.env.production`.
- `ZALO_APP_SECRET` phải nằm trong Firebase Secret Manager.
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` chỉ đặt ở môi trường deploy/GitHub Secrets.
- Khi đủ ba biến Sentry, Vite tạo source map ẩn, upload rồi xóa file map khỏi `dist`.

## Thứ tự deploy

1. Chạy readiness và toàn bộ test.
2. Deploy Functions trước khi deploy Rules có thay đổi contract.
3. Deploy Firestore/Storage Rules và indexes.
4. Build rồi deploy Hosting.
5. Chạy `npm run deploy:zmp:test`, kiểm tra trên Zalo Android/iPhone rồi mới gửi duyệt production.

## Kiểm tra sau deploy

- `/`, `/owner`, `/staff`, `/privacy` trả HTTP 200.
- Owner tạo gương và nhân viên không cần F5.
- Staff gửi một yêu cầu điểm duy nhất cho một phiên.
- Owner duyệt; khách thấy điểm/trạng thái cập nhật.
- QR sai token và tài khoản salon khác đều bị từ chối.

## Rollback

- Hosting: chọn bản phát hành trước trong Firebase Hosting release history.
- Functions: deploy lại commit ổn định trước; không hạ Rules nếu tạo lại public access.
- Zalo: giữ phiên bản test trước và chỉ phát hành production sau khi smoke test đạt.
