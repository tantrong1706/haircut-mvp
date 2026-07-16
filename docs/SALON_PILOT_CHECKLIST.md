# Checklist pilot salon

Mục tiêu của pilot là xác nhận toàn bộ luồng thật trên một salon và một đến hai chi nhánh trước khi mở rộng người dùng.

## Cổng kỹ thuật trước pilot

- Cloud Functions, Firestore indexes, Firestore Rules, Storage Rules và Hosting đã deploy cùng một release đã ghi nhận.
- Zalo Mini App Testing dùng đúng App ID và build từ thư mục `www`.
- Các secret bắt buộc đã cấu hình trong Secret Manager; không lưu trong Git hoặc ảnh chụp.
- App Check đang ở chế độ theo dõi, tỷ lệ request hợp lệ ổn định trước khi enforce.
- Owner/staff có Firebase Auth và `users/{uid}` đúng `role`, `salonId`, `branchId/branchIds`, `isActive`.
- Salon có một QR chung; mỗi chi nhánh hoạt động có một QR riêng.
- QR cũ theo gương chỉ dùng để kiểm tra tương thích migration, không in mới.
- Ảnh khách chỉ bật sau khi Storage Rules đã deploy và consent mặc định là tắt.
- Có backup trước release, release tag và người chịu trách nhiệm rollback.

## Luồng kiểm thử tại salon

1. Quét QR salon; chọn chi nhánh hoặc xác nhận hệ thống tự chọn khi chỉ có một chi nhánh.
2. Quét QR chi nhánh và kiểm tra đúng tên, địa chỉ trước khi xác nhận.
3. Khách xác nhận hồ sơ Zalo, tạo lượt và thấy điểm/vòng quay ngay trên trang chính.
4. Nhân viên đúng chi nhánh thấy lượt; nhân viên chi nhánh khác không thấy và không nhận được.
5. Hai nhân viên thử nhận cùng một lượt; chỉ một người thành công.
6. Nhân viên ghi chú, xin consent trước khi chụp ảnh và gửi yêu cầu điểm.
7. Chủ salon duyệt; điểm, lịch sử và trạng thái khách cập nhật không cần tải lại trang.
8. Gửi lặp request duyệt; điểm không được cộng hai lần.
9. Khách quay khi đủ điểm; kết quả bánh xe khớp backend và chỉ quà thắng mới có mã.
10. Đổi mã quà; thử gửi lặp và xác nhận chỉ một lần thành công.
11. Khóa chi nhánh/nhân viên trên môi trường thử và xác nhận quyền bị thu hồi.
12. Mất mạng giữa thao tác; giao diện báo rõ chưa hoàn tất và cho phép thử lại an toàn.

## Theo dõi trong pilot

- Kiểm tra health, Functions error, App Check, quota và Sentry mỗi ngày.
- Đối soát lượt hoàn tất, điểm được cộng và mã quà bằng audit server-side.
- Không nhập hoặc sửa điểm trực tiếp trong Firestore Console.
- Ghi nhận thiết bị, phiên bản Zalo/Manager và request ID đã làm sạch khi báo lỗi.

## Chưa được mở rộng production khi

- Migration tenant chưa được audit hoặc còn document thiếu `salonId`/`branchId` bắt buộc.
- Chưa thử backup/restore trên staging.
- Chưa kiểm thử Zalo trên Android và iPhone thật.
- Manager Mobile chưa có native Firebase config, APNs/App Check hoặc chưa test thiết bị thật.
- Privacy, Terms, Support URL, tài khoản review hoặc quy trình xóa dữ liệu chưa hoạt động.
