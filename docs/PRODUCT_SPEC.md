# Đặc tả sản phẩm HAIRCUT

> Tài liệu này mô tả phạm vi sản phẩm hiện hành. Kiến trúc kỹ thuật và mô hình dữ liệu chi tiết nằm tại `docs/architecture.md` và `docs/DATABASE.md`.

## Định vị

HAIRCUT giúp salon tiếp nhận khách qua Zalo, vận hành hàng chờ theo chi nhánh, lưu lịch sử cắt tóc, tích điểm và phát hành quà. Khách dùng Zalo Mini App; chủ salon và nhân viên dùng Manager Mobile hoặc cổng quản lý web phù hợp với vai trò.

## Vai trò

### Khách hàng

- Quét QR salon hoặc QR chi nhánh.
- Xác nhận hồ sơ Zalo và chi nhánh trước khi tạo lượt.
- Xem trạng thái phục vụ, điểm, lịch sử, vòng quay và mã quà.
- Đồng ý riêng trước khi salon chụp và lưu ảnh kiểu tóc.
- Yêu cầu xóa dữ liệu cá nhân theo chính sách công khai.

### Nhân viên

- Chỉ xem hàng chờ của chi nhánh được phân công.
- Nhận khách, ghi chú kiểu tóc và chụp ảnh khi đã có sự đồng ý.
- Gửi yêu cầu cộng điểm; không tự cộng điểm cho khách.
- Đổi mã quà khi được chủ salon cấp quyền.

### Chủ salon

- Quản lý hồ sơ salon, chi nhánh, nhân viên và quyền vận hành.
- Xem hàng chờ và báo cáo của toàn salon hoặc từng chi nhánh.
- Duyệt hoặc từ chối yêu cầu điểm.
- Cấu hình vòng quay, quản lý mã quà và QR.
- Theo dõi các thao tác quan trọng qua nhật ký kiểm toán.

### Quản trị hệ thống

- Dùng Admin Web tách biệt với giao diện salon.
- Xem tổng quan hệ thống và khóa/mở salon khi có quyền `system_admin`.
- Không dùng tham số URL để tự cấp quyền hoặc truy cập chéo tenant.

## Mô hình QR

- Mỗi salon có đúng một QR chung đang hoạt động.
- Mỗi chi nhánh có đúng một QR riêng đang hoạt động.
- QR salon mở bước chọn chi nhánh; nếu chỉ có một chi nhánh hoạt động thì hệ thống tự chọn.
- QR chi nhánh mở trực tiếp chi nhánh đó và hiển thị tên, địa chỉ trước khi khách xác nhận.
- QR cũ theo gương chỉ được hỗ trợ trong giai đoạn chuyển đổi; không tạo QR theo từng khách.
- Token QR được xác minh ở backend, không hiển thị trên giao diện và được loại khỏi URL sau khi đọc.

## Luồng nghiệp vụ chính

1. Khách quét QR hợp lệ và xác nhận thông tin Zalo.
2. Backend xác minh Zalo, salon, chi nhánh và QR trước khi tạo `chair_sessions`.
3. Nhân viên đúng chi nhánh nhận lượt; giao dịch chỉ cho một người nhận thành công.
4. Nhân viên hoàn tất dịch vụ và gửi `point_requests` theo lượt cắt.
5. Chủ salon duyệt hoặc từ chối; thao tác được xử lý idempotent và ghi audit.
6. Khi duyệt, hệ thống cộng điểm, tạo `haircut_records` và đóng lượt trong một giao dịch.
7. Khách dùng điểm để quay; kết quả và mã quà do backend quyết định.
8. Mã quà chỉ được đổi một lần tại đúng salon, có trạng thái hết hạn/đã dùng/thu hồi rõ ràng.

## Ràng buộc dữ liệu và bảo mật

- Dữ liệu nghiệp vụ luôn mang `salonId`; dữ liệu theo cơ sở còn có `branchId`.
- Firebase Auth và `users/{uid}` quyết định vai trò, trạng thái và phạm vi chi nhánh.
- Owner/staff không được tin cậy `salonId`, `branchId`, tên nhân viên hoặc số điểm do client tự khai.
- Điểm, vòng quay, đổi quà và chuyển trạng thái lượt chỉ ghi qua Cloud Functions.
- Firestore/Storage mặc định từ chối truy cập không phù hợp tenant và vai trò.
- Ảnh khách chỉ lưu khi có consent, đúng đường dẫn salon/khách và loại tệp được phép.
- Các thao tác nhạy cảm có request ID, audit event và cơ chế chống gửi lặp.
- Log, Analytics và Sentry không được chứa token, QR token, số điện thoại đầy đủ, email hoặc ghi chú khách.

## Ứng dụng

- `zalo-mini-app/`: trải nghiệm khách hàng trong Zalo và các trang công khai.
- `apps/manager-mobile/`: ứng dụng iOS/Android cho owner/staff bằng Capacitor.
- `apps/admin-web/`: cổng quản trị hệ thống.
- `firebase/functions/`: nghiệp vụ tin cậy, phân quyền và tác vụ nền.

## Ngoài phạm vi hiện tại

- HAIRCUT không phải hệ thống chấm công, tính lương hoặc kế toán.
- Khách không phải cài ứng dụng native để tích điểm.
- Không cam kết phát hành App Store/Google Play cho đến khi hoàn tất cấu hình native, kiểm thử thiết bị thật và checklist tại `docs/MANAGER_STORE_SUBMISSION.md`.
