# Đặc tả sản phẩm CH Hair Web

Phạm vi hiện tại: dùng trên trình duyệt điện thoại/máy tính cho salon. Firebase tiếp tục là nền tảng
Hosting, Auth, Functions, Firestore và Storage. Không yêu cầu khách cài ứng dụng riêng.

## Khách hàng

1. Quét QR của chi nhánh; không chọn lại chi nhánh.
2. Lần đầu xác thực số điện thoại bằng OTP. Cùng trình duyệt còn phiên hợp lệ thì không nhập lại.
3. Nhấn Yêu cầu tích điểm; nhân viên đúng chi nhánh xác nhận.
4. Xem điểm, lịch sử, ảnh, vòng quay và mã quà.
5. Sau một lần cộng điểm, chờ hai giờ trước lượt mới. Quy tắc chạy ngầm, không có đồng hồ đếm ngược.

Mỗi khách có yêu cầu và dữ liệu riêng dù nhiều người quét cùng QR. Không dùng 4 số cuối điện thoại
làm thông tin đăng nhập. Quyền chụp/lưu ảnh phải được thông báo và có sự đồng ý của khách.

## Nhân viên

- Đăng nhập tài khoản được phân quyền, chỉ xử lý chi nhánh được giao.
- Với yêu cầu Web đang chờ: có thể chụp ảnh, lưu ghi chú rồi xác nhận cộng điểm.
- Ảnh/ghi chú chỉ lưu trước xác nhận, không bắt buộc để cộng điểm.
- Với khách quen: tìm bằng tên/4 số cuối, chọn đúng hồ sơ; chỉ cộng trực tiếp khi được chủ salon
  cấp quyền. Không tự tạo điểm hoặc bỏ qua cooldown/hạn mức.
- Kiểm tra và đổi quà khi có quyền đổi quà.

Luồng chính không bắt khách phải qua cả nhân viên và chủ salon cho cùng một lần tích điểm.
Nút tích điểm nhanh không thay thế luồng yêu cầu có ảnh/ghi chú.

## Chủ salon

- Xem tổng quan và yêu cầu chờ theo chi nhánh trên điện thoại hoặc máy tính.
- Quản lý chi nhánh, QR, nhân viên và quyền.
- Mở danh bạ có tổng số khách, phân trang, tìm kiếm, hồ sơ và nút tích điểm rõ ràng.
- Cấu hình vòng quay và quản lý quà theo quy tắc server.
- Giữ đăng nhập trên cùng trình duyệt; dùng máy chung thì đăng xuất sau khi sử dụng.

## Quản trị hệ thống

Admin Web là cổng riêng. Quyền quản trị không được suy ra từ role chủ salon hoặc URL.
Chỉ các thao tác hỗ trợ đã được mở, giới hạn và có audit mới được thực hiện;
xem [Admin Operations](ADMIN_OPERATIONS.md).

## Ràng buộc không thay đổi

Danh tính, quyền salon/chi nhánh, số điểm, kết quả vòng quay và trạng thái quà do backend xác minh.
Mỗi thao tác ghi có cơ chế chống trùng phù hợp. Không gộp khách khi trùng số cuối.
Không đưa token, mật khẩu, QR ký đầy đủ, ảnh hoặc thông tin khách thật vào Git/log.

## Workspace

Customer Web ở customer-web/, backend ở firebase/, Admin ở apps/admin-web/.
Manager ở apps/manager-mobile/ vẫn có adapter dùng chung và Web build; không phát hành native
trong phạm vi hiện tại. [Mã tương thích cũ](LEGACY_COMPATIBILITY.md) được giữ có chủ đích,
không phải chức năng cần bật cho khách Web.

Thanh toán/bán gói dịch vụ, chấm công, lương, kế toán và native release không thuộc phạm vi này.
Xem [trạng thái phát hành](RELEASE_STATUS.md) để phân biệt code trên GitHub và website đang chạy.
