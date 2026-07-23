# Kế Hoạch Triển Khai HAIRCUT

## Giai Đoạn 1: MVP Nội Bộ

- Hoàn thiện luồng khách quét QR tại gương.
- Nhân viên thấy khách đang chờ, ghi chú kiểu tóc và gửi yêu cầu cộng 1 điểm.
- Chủ salon duyệt/từ chối điểm.
- Khách xem điểm, lịch sử, vòng quay và mã quà.

## Giai Đoạn 2: Bảo Mật Nền Tảng

- Firestore rules mặc định deny.
- Ghi nghiệp vụ qua Cloud Functions, không để client tự ghi database production.
- Owner/staff đăng nhập Firebase Auth và phân quyền bằng `users/{uid}`.
- Staff không tự nhập tên để ghi lịch sử; server lấy tên từ hồ sơ nhân viên.
- Luồng khách Zalo gửi `zaloAccessToken`; server xác minh token rồi mới suy ra `zaloUserId`.
- Không fallback im lặng sang một user mock cố định khi mở ngoài Zalo.

## Giai Đoạn 3: Công Cụ Cho Salon Thật

- Owner quản lý danh sách gương/ghế QR.
- Owner quản lý nhân viên, trạng thái hoạt động và quyền đổi mã quà.
- Owner/staff tìm khách theo tên hoặc 4 số cuối SĐT.
- Owner có công cụ xóa dữ liệu khách khi khách yêu cầu.
- Storage rules chỉ cho lưu ảnh khi khách bật `allowPhoto`.

## Giai Đoạn 4: Zalo Mini App Production

- Tạo Mini App trong Zalo developer console.
- Cấu hình quyền cần thiết.
- Dùng `getAccessToken` để server xác minh khách.
- Dùng `getUserInfo` chỉ để gợi ý tên/avatar cho khách sửa trước khi check-in.
- Chỉ xin số điện thoại khi đã giải thích lý do.
- Cấu hình URL QR thật cho từng gương/ghế.

## Giai Đoạn 5: Chuẩn Bị iOS Sau

- iOS v1 nên dành cho owner/staff trước.
- Khách vẫn dùng QR/Zalo/web để giảm rào cản cài app.
- Chưa mua Apple Developer cho tới khi backend, demo account, privacy/support và web pilot đã ổn.
