# Checklist Chạy Thử Salon Thật

Mục tiêu giai đoạn này là dùng ổn trên web/PWA trước khi mua Apple Developer.

## Trạng Thái Có Thể Dùng Ngay

- Khách quét QR/web để tạo lượt cắt.
- Nhân viên đăng nhập web, thấy khách đang chờ, ghi chú nhanh và gửi yêu cầu cộng điểm.
- Chủ salon đăng nhập web, xem tổng quan, duyệt/từ chối điểm, cấu hình vòng quay.
- Staff/owner có thể xác nhận mã quà đã sử dụng.
- Khách có thể xem điểm, lịch sử, vòng quay và mã quà.
- Web có manifest/service worker để thêm vào màn hình chính như PWA.

## Việc Cần Có Trước Khi Cho Salon Dùng Thật

- Bật Firebase Blaze để deploy Cloud Functions.
- Deploy Functions thành công.
- Đặt `VITE_FUNCTION_WRITE_MODE=required`.
- Test full flow ở `required`.
- Deploy Firestore rules production, không để `allow read, write: if true`.
- Tạo Firebase Auth account cho owner/staff.
- Tạo `users/{uid}` đúng `salonId`, `role`, `isActive`, `canRedeemRewards`.
- Tạo mirror thật với `qrToken` riêng cho từng gương/ghế.
- In QR theo link có `salonId`, `mirrorId`, `qrToken`.

## Luồng Test 15 Phút

1. Mở QR khách trên điện thoại.
2. Xác nhận tạo lượt cắt.
3. Reload trang khách, kiểm tra hồ sơ vẫn được giữ.
4. Mở staff, chọn khách, bấm ghi chú nhanh và gửi yêu cầu cộng điểm.
5. Mở owner, xem dashboard và duyệt điểm.
6. Quay lại khách, kiểm tra điểm/lịch sử.
7. Nếu đủ điểm, quay vòng quay.
8. Mở tab quà của khách, lấy mã quà.
9. Staff hoặc owner nhập mã quà ở panel đổi quà.
10. Kiểm tra mã chuyển sang trạng thái đã sử dụng.

## Chưa Nên Làm

- Chưa mua Apple Developer khi web/backend chưa khóa production.
- Chưa submit App Store khi chưa có demo account thật cho Apple.
- Chưa chạy khách thật nếu Firestore rules còn mở.
