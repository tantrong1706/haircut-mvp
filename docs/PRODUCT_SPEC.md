# Đặc Tả Sản Phẩm HAIRCUT

> Tài liệu định hướng sản phẩm. Luồng và mô hình production hiện hành được chốt tại `docs/architecture.md`, `docs/DATABASE.md` và code Cloud Functions; khi có khác biệt, các nguồn đó được ưu tiên.

## Định vị

HAIRCUT giúp salon tóc biến khách ghé một lần thành khách quay lại bằng cách lưu lịch sử cắt tóc, cộng điểm và đổi quà qua Zalo Mini App.

Ứng dụng không phải hệ thống nhân sự. Quản lý nhân viên chỉ phục vụ luồng vận hành salon.

## Quyết định chính

Dùng QR theo từng gương/ghế, không tạo QR riêng cho từng khách.

Lý do:

- Khách không phải giữ QR cá nhân.
- Chủ salon không phải in QR cho từng khách.
- Nhân viên không phải tìm QR của khách.
- Khách mới chỉ cần quét QR tại gương là tham gia được.

## Hệ thống

### App iOS

Một app iOS cho cả chủ salon và nhân viên.

Chủ salon:

- Tạo và quản lý salon.
- Thêm hoặc tắt nhân viên.
- Cấu hình điểm.
- Cấu hình vòng quay may mắn.
- Tạo QR gương.
- Duyệt yêu cầu cộng điểm.
- Xem khách hàng và báo cáo.

Nhân viên:

- Xem khách đang phục vụ.
- Xem tên khách và 4 số cuối điện thoại.
- Xem lịch sử cắt tóc của khách được chọn.
- Chụp/lưu ảnh chỉ khi khách đồng ý.
- Ghi chú kiểu tóc.
- Gửi yêu cầu cộng điểm.
- Xác nhận mã quà nếu được chủ salon cho phép.

### Zalo Mini App

Khách không cần cài app iOS/Android. Khách dùng Zalo để:

- Quét QR tại gương.
- Xác nhận hồ sơ.
- Xem điểm.
- Xem lịch sử cắt tóc.
- Quay vòng may mắn.
- Xem mã quà.

## Luồng MVP

1. Khách quét QR gương.
2. Web/Zalo Mini App tạo `customers` và `chair_sessions`.
3. Nhân viên mở `/staff`, thấy khách đang chờ.
4. Nhân viên ghi chú và gửi `point_requests`.
5. Chủ salon mở `/owner`, duyệt hoặc từ chối.
6. Khi duyệt, hệ thống tăng điểm, tạo `haircut_records`, đóng session.
7. Khách xem lịch sử và quay vòng may mắn khi đủ điểm.

## Nguyên tắc bảo mật

- Chủ salon/nhân viên phải đăng nhập Firebase Auth.
- `users/{uid}` quyết định `salonId`, `role`, `isActive`.
- Nhân viên không được vào `/owner`.
- Firestore rules live hiện đang mở để test nội bộ, chưa dùng cho khách thật.
- Trước production phải hoàn thiện xác thực khách/Zalo và khóa rules.
