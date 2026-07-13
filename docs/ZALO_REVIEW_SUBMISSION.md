# Hồ sơ xét duyệt Zalo Mini App - HAIRCUT

## Thông tin ứng dụng

- **Tên:** HAIRCUT
- **Zalo Mini App ID:** `2038116772828167300`
- **Mô tả:** HAIRCUT giúp khách check-in tại salon tóc, theo dõi điểm, lịch sử cắt, vòng quay và mã quà. Chủ salon quản lý toàn hệ thống; nhân viên vận hành đúng chi nhánh được phân công.
- **Mục đích:** Kết nối khách, nhân viên và chủ salon trong quy trình tạo lượt cắt, xác nhận dịch vụ, duyệt điểm và chăm sóc khách hàng minh bạch.
- **Chính sách quyền riêng tư:** <https://haircut-c7d12.web.app/privacy>
- **Email hỗ trợ:** `[ĐIỀN EMAIL HỖ TRỢ THẬT]`
- **Điện thoại hỗ trợ:** `[ĐIỀN SỐ ĐIỆN THOẠI HỖ TRỢ THẬT]`

## Nội dung ngắn cho Zalo Portal

HAIRCUT là Mini App chăm sóc khách hàng cho salon tóc. Khách mở ứng dụng từ QR chung của salon để chọn chi nhánh, hoặc từ QR riêng của chi nhánh để check-in trực tiếp. Ứng dụng dùng hồ sơ Zalo cơ bản để xác minh đúng khách, sau đó hỗ trợ theo dõi lượt cắt, điểm, lịch sử, vòng quay và mã quà. Nhân viên chỉ vận hành chi nhánh được phân công; chủ salon quản lý toàn salon hoặc lọc theo chi nhánh.

## Tài khoản và dữ liệu kiểm thử

| Mục | Giá trị cần điền |
| --- | --- |
| Trang owner | `https://haircut-c7d12.web.app/owner` |
| Email owner test | `[ĐIỀN EMAIL OWNER TEST]` |
| Mật khẩu owner test | `[ĐIỀN MẬT KHẨU OWNER TEST]` |
| Trang staff | `https://haircut-c7d12.web.app/staff` |
| Email staff test | `[ĐIỀN EMAIL STAFF TEST]` |
| Mật khẩu staff test | `[ĐIỀN MẬT KHẨU STAFF TEST]` |
| QR salon/chi nhánh còn hiệu lực | `[ĐÍNH KÈM ẢNH QR TESTING - KHÔNG GHI TOKEN RA TÀI LIỆU]` |
| Bộ ảnh giao diện | `[ĐÍNH KÈM ẢNH CHỤP MÀN HÌNH]` |

Tài khoản owner phải xác minh email. Owner, staff, salon, chi nhánh và QR kiểm thử phải thuộc cùng bộ dữ liệu.

## Hướng dẫn người xét duyệt

1. Dùng Zalo quét QR salon. Nếu có nhiều chi nhánh, chọn một chi nhánh; nếu chỉ có một chi nhánh hoạt động, ứng dụng tự chọn.
2. Quét thêm QR chi nhánh và xác nhận ứng dụng mở thẳng đúng tên, địa chỉ chi nhánh.
3. Cho phép đọc hồ sơ Zalo cơ bản, kiểm tra hoặc sửa tên hiển thị, tùy chọn thông tin liên hệ và bấm **Xác nhận và tạo lượt cắt**.
4. Đăng nhập trang staff bằng tài khoản test, xác nhận chỉ thấy hàng chờ của chi nhánh được phân công, nhận khách, nhập ghi chú và gửi yêu cầu cộng điểm.
5. Đăng nhập trang owner, lọc đúng chi nhánh, duyệt yêu cầu và kiểm tra dashboard cập nhật không cần tải lại trang.
6. Trở lại Mini App để kiểm tra trạng thái hoàn tất, điểm, lịch sử; nếu đủ điểm, quay vòng quay và kiểm tra quà hoặc kết quả không trúng.

## Luồng theo vai trò

- **Khách:** quét QR salon/chi nhánh, xác minh Zalo, xem địa điểm, tạo lượt, theo dõi trạng thái, điểm, lịch sử, vòng quay và mã quà.
- **Nhân viên:** đăng nhập web, chỉ xem hàng chờ chi nhánh được phân công, nhận/hủy lượt đúng quyền, ghi chú, tải ảnh khi khách đồng ý và gửi yêu cầu điểm.
- **Chủ salon:** đăng nhập web, quản lý chi nhánh và hai loại QR, phân công nhân viên, lọc dashboard/hàng duyệt, duyệt điểm, tìm khách, cấu hình vòng quay và đổi mã quà.

Mỗi salon có đúng một QR chung đang hoạt động; mỗi chi nhánh có đúng một QR riêng. Khách và điểm dùng chung toàn salon, còn hàng chờ, lượt cắt, nhân viên và báo cáo có `branchId`.

## Quyền Zalo và dữ liệu

- **Hồ sơ người dùng:** tên và mã định danh Zalo dùng để liên kết đúng hồ sơ khách; ảnh đại diện có thể được xử lý tạm thời khi Zalo trả hồ sơ nhưng không được lưu vào hồ sơ phục vụ salon.
- **Access token:** chỉ gửi tới Firebase Function để xác minh với Zalo; không hiển thị, lưu lâu dài hoặc đưa vào log/Analytics/Sentry.
- **Số điện thoại:** khách tự nhập và không bắt buộc; phiên bản hiện tại không yêu cầu quyền lấy số điện thoại Zalo trong luồng check-in.
- **Ảnh kiểu tóc:** không phải quyền Zalo, mặc định không đồng ý; chỉ được tải lên khi khách bật đồng ý và nhân viên đã nhận lượt.
- **QR token:** được loại khỏi URL sau khi đọc, không lưu trong `localStorage`, telemetry hoặc tài liệu xét duyệt.

Dữ liệu được dùng để vận hành lượt cắt, tích điểm, lịch sử, vòng quay và quà. Điểm dùng chung trong salon; dữ liệu vận hành được giới hạn theo chi nhánh. Khách có thể yêu cầu salon xem, sửa, rút đồng ý ảnh hoặc xóa dữ liệu theo trang quyền riêng tư.

## Ảnh màn hình cần chụp

- QR salon mở màn chọn chi nhánh và trường hợp tự chọn một chi nhánh.
- QR chi nhánh hiển thị đúng tên, địa chỉ trước khi xác nhận.
- Hộp thoại quyền hồ sơ Zalo và màn xác nhận khách.
- Trạng thái khách đang chờ, đang phục vụ và hoàn tất.
- Staff hiển thị tên chi nhánh, hàng chờ và màn gửi yêu cầu điểm.
- Owner dashboard có bộ lọc chi nhánh, màn duyệt và quản lý chi nhánh/QR.
- Điểm, lịch sử, vòng quay, kết quả có quà và không trúng, danh sách mã quà.
- Trang chính sách quyền riêng tư trên điện thoại.

## Checklist trước khi gửi

- [x] App ID trong source/tài liệu là `2038116772828167300`.
- [x] `build:zmp` tạo gói Zalo trong thư mục `www`.
- [x] Access token được xác minh ở backend trước nghiệp vụ khách.
- [x] QR salon/chi nhánh dùng token ký, có phiên bản xoay và không lộ token qua telemetry.
- [x] Firestore/Storage mặc định từ chối ngoài quyền; staff bị giới hạn theo salon/chi nhánh.
- [x] Bản production không tự dùng salon hoặc QR demo khi thiếu ngữ cảnh hợp lệ.
- [ ] Điền email, điện thoại hỗ trợ thật trên Privacy và hồ sơ.
- [ ] Xác nhận App ID và quyền hồ sơ trên Zalo Developer Portal.
- [ ] Deploy Functions, indexes, Rules, Storage Rules và Hosting đúng thứ tự sau migration.
- [ ] Tạo/xác minh owner test, staff test, salon và ít nhất hai chi nhánh có dữ liệu phù hợp.
- [ ] Điền tài khoản test và đính kèm QR testing còn hiệu lực.
- [ ] Quét QR thật và kiểm thử trọn luồng trên Android lẫn iPhone.
- [ ] Chụp, kiểm tra và tải đủ ảnh màn hình lên hồ sơ.
- [ ] Xác nhận URL Privacy công khai hiển thị thông tin hỗ trợ thật.
- [ ] Bấm gửi xét duyệt trên Zalo Portal.
