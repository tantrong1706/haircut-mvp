# CH Haircut Salon — Zalo Review Testing Version 24

## Thông tin phiên bản

- Mini App: `CH Haircut Salon`
- Mini App ID: `2038116772828167300`
- Phiên bản trên Mini App Center: `Testing Version 24`
- Website: <https://app.chhaircutsalon.cc/>
- Chính sách quyền riêng tư: <https://app.chhaircutsalon.cc/privacy>
- Điều khoản sử dụng: <https://app.chhaircutsalon.cc/terms>

## QR chi nhánh dành cho kiểm duyệt

Mở một trong các ảnh HTTPS sau trên máy tính hoặc màn hình thứ hai, sau đó dùng chức năng quét QR
trong Zalo của kiểm duyệt viên:

- Chi nhánh chính — QR đề xuất: <https://app.chhaircutsalon.cc/review-branch-v24-chi-nhanh-chinh.png>
- Chi nhánh Trung tâm: <https://app.chhaircutsalon.cc/review-branch-v24.png>

Hai QR đều mở thẳng đúng chi nhánh, không yêu cầu khách chọn chi nhánh. QR chỉ nhận diện chi nhánh;
điểm chỉ được cộng sau khi nhân viên của đúng chi nhánh xác nhận.

## Luồng kiểm duyệt đề xuất

1. Quét QR Chi nhánh chính bằng Zalo và kiểm tra tên, địa chỉ chi nhánh.
2. Cho phép ứng dụng đọc hồ sơ Zalo cơ bản khi hộp thoại Zalo xuất hiện.
3. Nhập số điện thoại kiểm thử ở lần đầu; các lần sau ứng dụng dùng lại số đã lưu cho cùng khách.
4. Nhấn **Yêu cầu tích điểm**. Yêu cầu có hiệu lực 30 phút và chưa cộng điểm ngay.
5. Mở trang nhân viên tại <https://app.chhaircutsalon.cc/staff>, đăng nhập bằng tài khoản kiểm thử
   được cung cấp trong trường **Thông tin đăng nhập** của hồ sơ xét duyệt.
6. Nhân viên có thể chụp tối đa ba ảnh của lần cắt, sau đó xác nhận hoặc từ chối yêu cầu.
7. Trở lại Mini App để kiểm tra điểm, lịch sử, ảnh, vòng quay và mã quà. Sau khi được cộng điểm,
   khách phải chờ hai giờ mới có thể gửi yêu cầu tích điểm tiếp theo trong cùng salon.

## Ghi chú bảo mật

- Không có tài khoản đăng nhập riêng cho khách; danh tính khách được xác minh qua Zalo.
- QR không tự cộng điểm và không thay thế bước xác nhận của nhân viên.
- Hồ sơ này không chứa access token, App Secret, mật khẩu, QR token hoặc thông tin khách thật.
