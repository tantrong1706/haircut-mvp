# Triển khai production

## Bí mật và môi trường

- Firebase public config và Zalo Mini App ID nằm trong `.env.production`.
- Firebase Auth phải bật Email/Password; domain Hosting phải nằm trong Authorized domains và mẫu email đặt lại mật khẩu phải dùng thương hiệu HAIRCUT.
- `ZALO_APP_SECRET` phải nằm trong Firebase Secret Manager.
- `QR_SIGNING_SECRET` phải nằm trong Firebase Secret Manager, dài tối thiểu 32 ký tự và không được dùng lại `ZALO_APP_SECRET`.
- Chỉ đặt `REQUIRE_ZALO_APP_CHECK=true` sau khi App Check đã chạy ổn trong cả Zalo Android và iPhone; để trống trong giai đoạn tương thích.
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` chỉ đặt ở môi trường deploy/GitHub Secrets.
- Khi đủ ba biến Sentry, Vite tạo source map ẩn, upload rồi xóa file map khỏi `dist`.

## Thứ tự deploy

1. Chạy readiness và toàn bộ test.
2. Export Firestore, deploy Functions có `migrateSalonBranches`, rồi chạy migration cho từng salon theo [BRANCH_QR_MIGRATION.md](BRANCH_QR_MIGRATION.md).
3. Deploy indexes và chờ tạo xong trước khi bật giao diện mới.
4. Sau khi xác nhận dữ liệu có `branchId`, deploy Firestore Rules và Storage Rules.
5. Build rồi deploy Hosting.
6. Chạy `npm run deploy:zmp:test`, kiểm tra trên Zalo Android/iPhone rồi mới gửi duyệt production.

## Kiểm tra sau deploy

- `/`, `/owner`, `/staff`, `/privacy` trả HTTP 200.
- Owner tạo/sửa/khóa chi nhánh, xoay QR và lọc dashboard mà không cần F5.
- QR salon cho chọn chi nhánh; QR chi nhánh mở thẳng đúng tên và địa chỉ; QR Gương 1 cũ vẫn hoạt động trong giai đoạn chuyển đổi.
- Staff gửi một yêu cầu điểm duy nhất cho một phiên.
- Staff phải nhận khách trước; tài khoản khác không thể gửi điểm cho lượt đã có người phụ trách.
- Lời mời nhân viên mở được trang Firebase đặt mật khẩu và nhân viên đăng nhập thành công sau khi đặt.
- Owner duyệt; khách thấy điểm/trạng thái cập nhật.
- Khi tắt mạng rồi bật lại, trang khách giữ phiên và tự đồng bộ hoặc cho bấm Thử lại.
- Tìm khách tải được trang tiếp theo, dashboard tự đổi số liệu mà không cần F5.
- QR sai token và tài khoản salon khác đều bị từ chối.
- Phiên quá hạn rời hàng chờ; owner và nhân viên đúng quyền hủy được lượt no-show.
- Ô vòng quay không trúng không xuất hiện trong danh sách mã quà chưa dùng.

## Rollback

- Trước mỗi rollout thay đổi schema, tạo Firestore managed export vào bucket backup riêng, ghi release tag, commit, thời điểm export và người thực hiện vào biên bản phát hành. Không lưu export hoặc khóa dịch vụ trong repository.
- Hosting: chọn bản phát hành trước trong Firebase Hosting release history.
- Functions: deploy lại release tag ổn định trước; chỉ rollback code tương thích ngược với dữ liệu đã ghi và không hạ Rules nếu tạo lại public access.
- Firestore: ưu tiên sửa tiến (forward fix). Chỉ import export vào project phục hồi/staging trước, kiểm đếm document và chạy smoke test rồi mới quyết định khôi phục production; import không tự xóa dữ liệu phát sinh sau thời điểm export.
- Storage: bật versioning/lifecycle trên bucket backup theo chính sách vận hành và kiểm tra riêng ảnh kiểu tóc/avatar sau phục hồi.
- Zalo: giữ phiên bản test trước và chỉ phát hành production sau khi smoke test đạt.
- Mỗi quý chạy một diễn tập restore không dùng dữ liệu khách thật, ghi lại RTO/RPO, lỗi gặp phải và người phê duyệt.
