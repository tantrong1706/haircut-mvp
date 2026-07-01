# Checklist Chạy Thử Salon Thật

Mục tiêu giai đoạn này là dùng ổn trên web/PWA trước khi mua Apple Developer.

## Trạng Thái Có Thể Dùng Ngay

- Khách quét QR bằng Zalo để tạo lượt cắt.
- Khách xác nhận tên hiển thị tại salon và tự chọn có cho lưu ảnh kiểu tóc hay không.
- Nhân viên đăng nhập web, thấy khách đang chờ, ghi chú nhanh và gửi yêu cầu cộng 1 điểm.
- Chủ salon đăng nhập web, xem tổng quan, duyệt/từ chối điểm, quản lý QR, nhân viên, khách và vòng quay.
- Staff/owner có quyền có thể kiểm tra và đổi mã quà.
- Khách có thể xem điểm, lịch sử, vòng quay và mã quà.
- Owner có công cụ xóa dữ liệu khách khi có yêu cầu riêng tư.

## Bắt Buộc Trước Khi Cho Salon Dùng Thật

- Bật Firebase Blaze để deploy Cloud Functions.
- Đặt `ZALO_APP_SECRET` cho Functions để xác minh Zalo access token ở server.
- Deploy Functions thành công.
- Đặt `VITE_FUNCTION_WRITE_MODE=required` cho web app production.
- Test full flow ở chế độ `required`.
- Deploy Firestore rules production, không để `allow read, write: if true`.
- Deploy Storage rules nếu dùng ảnh; Storage chỉ cho ảnh dưới 5MB và chỉ khi `customers/{customerId}.allowPhoto=true`.
- Tạo Firebase Auth account cho owner/staff.
- Tạo `users/{uid}` đúng `salonId`, `role`, `isActive`, `canRedeemRewards`.
- Tạo mirror thật với `qrToken` riêng cho từng gương/ghế.
- In QR theo link có `salonId`, `mirrorId`, `qrToken`.

## Luồng Test 15 Phút

1. Mở QR khách trong Zalo.
2. Xác nhận tên hiển thị, chọn lưu ảnh hoặc không, rồi tạo lượt cắt.
3. Reload trang khách, kiểm tra hồ sơ vẫn được giữ.
4. Mở staff, chọn khách, bấm ghi chú nhanh và gửi yêu cầu cộng điểm.
5. Mở owner, xem dashboard và duyệt điểm.
6. Quay lại khách, kiểm tra điểm/lịch sử.
7. Nếu đủ điểm, quay vòng quay và kiểm tra animation dừng đúng ô.
8. Mở tab quà của khách, lấy mã quà.
9. Staff hoặc owner nhập mã quà ở panel đổi quà.
10. Kiểm tra mã chuyển sang trạng thái đã sử dụng.
11. Owner tìm khách và kiểm tra nút xóa dữ liệu chỉ dùng khi thật sự có yêu cầu.

## Chưa Nên Làm

- Chưa mua Apple Developer khi web/backend chưa khóa production.
- Chưa submit App Store khi chưa có demo account thật cho Apple.
- Chưa chạy khách thật nếu Functions chưa xác minh Zalo token.
- Chưa lưu ảnh thật nếu Storage chưa deploy rules theo `allowPhoto`.
