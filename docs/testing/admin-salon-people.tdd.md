# Admin — chủ salon và danh sách khách theo salon

Phạm vi hỗ trợ: từ danh sách salon, mở **Kiểm tra → Chủ salon và khách**. Chỉ tải sau khi quản trị viên mở mục cho salon đã chọn. Chủ salon: tên, email đăng nhập, trạng thái và xác minh email. Khách: tên, tối đa 4 số cuối đã có, điểm và lần ghé gần nhất; phân trang.

Máy chủ kiểm tra quyền quản trị đang hiệu lực trước khi đọc và ngay trước khi trả kết quả. Kiểm tra liên kết chủ salon và mốc phân trang đều thuộc đúng salon. Chỉ đọc các trường khách cần thiết; không trả mật khẩu, hash, OTP, token, số đầy đủ, ảnh hay ghi chú. Nhật ký chỉ có người xem, salon, thời điểm và số dòng; không chứa nội dung hồ sơ. Không có tải toàn bộ danh sách, đổi điểm, đặt mật khẩu thay hoặc gửi email tự động.

## Kiểm thử

- RED `b736716`: thiếu thao tác mở hồ sơ ở UI và thiếu callable `getSystemAdminSalonPeople`.
- GREEN `2a817cc`: 67 ca tích hợp Admin giả lập đạt; 100% dòng và 91,93% nhánh cho `salonPeople.ts`. Bao gồm từ chối thiếu quyền/quyền bị thu hồi, sai salon, mốc phân trang khác salon, hồ sơ giả có trường riêng tư và các trạng thái tài khoản Auth. Test Auth dùng dữ liệu giả.
- Admin Web: 98 kiểm thử, lint, TypeScript, build đạt. Thành phần hồ sơ đạt 100% dòng, 82,5% nhánh; đã kiểm tra phân trang, lỗi và phản hồi lệch salon.
- Playwright: 24 lượt đạt trên Chromium desktop/mobile và WebKit; chạy lại 3 lượt hồ sơ sau khi cho email chiếm cả dòng trên màn nhỏ. Không tràn ngang và Axe đạt trong phạm vi thử.
- Functions: lint, định dạng, TypeScript, 119 kiểm thử đơn vị và build đạt. Không đổi dependency, quyền Firebase, Rules hoặc cấu hình production.

Bản Admin còn ở nhánh cục bộ; cần phát hành Admin Hosting và đúng callable mới trong một đợt riêng. Không phát hành cùng bản Customer Hosting của PR #95.
