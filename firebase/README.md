# Firebase — backend của CH Hair Web

Firebase phục vụ Customer Web tại https://app.chhaircutsalon.cc và cổng Admin riêng.
Khách đăng nhập bằng Firebase Phone Auth (OTP); chủ salon và nhân viên dùng tài khoản
Email/Password được phân quyền. Không cần cấu hình nhà cung cấp danh tính cũ để phát triển Web.

## Cài đặt và kiểm thử

Dùng Node.js 22 và Java 21 cho Emulator. Từ thư mục gốc repository:

    npm --prefix firebase/functions ci
    npm --prefix firebase/functions run check
    npm --prefix firebase/functions run build
    npm --prefix firebase/functions run test:rules
    npm --prefix firebase/functions run test:integration

Rules/integration chỉ dùng project demo-haircut. Giữ nguyên lockfile, không nâng dependency
để khắc phục lỗi cài đặt. Nếu contracts chưa đồng bộ, đối chiếu packages/contracts trước
khi chạy script sync:contracts; không bỏ qua check:contracts.

## Cấu hình

- Client Web dùng các file mẫu trong customer-web; cấu hình riêng không commit.
- Biến VITE_* là công khai trong bundle, tuyệt đối không chứa secret/token/mật khẩu.
- CUSTOMER_WEB_CHECKIN_URL trỏ tới https://app.chhaircutsalon.cc/checkin.
- QR_SIGNING_SECRET nằm trong Secret Manager; không sao chép vào frontend.
- Giữ nguyên biến và secret của endpoint đã triển khai nếu không có kế hoạch chuyển đổi riêng.
- Không bật App Check enforcement chỉ để chạy test; chỉ thay khi có phê duyệt và bằng chứng tương thích.
- Backend còn các adapter cũ: xem [ranh giới tương thích](../docs/LEGACY_COMPATIBILITY.md).

## Phát hành

Xem [quy trình Web](../docs/deployment.md) và [trạng thái đang chạy](../docs/RELEASE_STATUS.md).
CI xanh hoặc merge main không tự cho phép deploy.

Chỉ phát hành đúng API/Hosting/Rules được duyệt. Khi thay đổi luồng ảnh: API tương thích trước,
Web tương thích sau, Rules hạn chế đọc sau cùng. Không dùng deploy toàn bộ Functions để
phát hành một thay đổi giao diện. Admin Hosting là site riêng.

## Bảo vệ dữ liệu

Điểm, vòng quay và đổi quà do server quyết định; UID và salon không lấy từ thông tin khách tự khai.
Ảnh kiểu tóc dùng operation upload riêng, JPEG tối đa 3 MiB và sự đồng ý hiện hành của khách.
Backend kiểm tra ảnh trước khi chấp nhận; link xem ảnh có chữ ký hết hạn tối đa 15 phút.
Không mở quyền Storage công khai để sửa lỗi ảnh. Ảnh/ghi chú được lưu trước xác nhận cộng điểm.

Không xóa dữ liệu, reset Auth, thu hồi ảnh khách cũ hoặc deploy để dọn tên trong repository.
