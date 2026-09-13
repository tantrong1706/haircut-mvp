# Checklist xét duyệt Zalo Mini App - CH Haircut Salon Version 24

Version 24 đã được gửi xét duyệt. Không Publish trước khi Zalo duyệt phiên bản.

## 1. Metadata

- [x] Tên Mini App trong source và Mini App Center: `CH Haircut Salon`.
- [x] Mini App ID trong production: `2038116772828167300`.
- [x] Tên Portal chính thức hiện tại là `CH Haircut Salon`; logo, danh mục, mô tả và hỗ trợ giữ nguyên.
- [x] Nội dung phiên bản dùng đúng hướng dẫn 14 bước trong `docs/ZALO_VERSION_8_SUBMISSION.md`.

## 2. Quyền Zalo

- [x] Source dùng `getAccessToken` để backend xác minh danh tính.
- [x] Source chỉ gọi `getUserInfo` sau hành động cho phép của khách.
- [x] Source không gọi `getPhoneNumber`, `scanQRCode`, location, notification, `followOA` hoặc share.
- [x] Có trạng thái từ chối quyền, thử lại, timeout, lỗi mạng và SDK không khả dụng.
- [x] Portal không chọn quyền SDK bổ sung; source chỉ dùng access token và hồ sơ cơ bản sau hành động của khách.
- [ ] Ảnh minh họa quyền cho thấy đúng màn giải thích và popup Zalo.

`PORTAL_PERMISSION_SOURCE_AUDIT=PASS`

`PORTAL_PERMISSION_MANUAL_CHECK=REQUIRED`

## 3. Privacy, Terms và xóa dữ liệu

- [x] Source có route công khai `/privacy` và `/terms` với branding hiện hành.
- [x] Privacy nêu dữ liệu Zalo, số điện thoại tùy chọn, ảnh có đồng ý, mục đích, thời gian lưu, xóa dữ liệu và hỗ trợ.
- [x] Terms liên kết Privacy và mô tả đúng chức năng hiện có.
- [x] Source có webhook rút đồng ý/xóa dữ liệu và test liên quan.
- [ ] Xác minh Privacy và Terms live trong Zalo trên Android/iPhone.
- [x] Webhook HTTPS thật hiển thị trên Portal và Mini App đã được xác thực.

## 4. QR và reviewer flow

- [x] Link chung không QR không crash và không lộ owner/staff/admin.
- [x] Frontend Version 24 chỉ chấp nhận QR chi nhánh; QR salon chung và QR `legacy-mirror` bị từ chối.
- [x] QR chi nhánh mở thẳng đúng chi nhánh, không hiển thị bước chọn chi nhánh.
- [x] QR token bị loại khỏi URL sau khi parse và không được lưu trong localStorage.
- [x] Test bao phủ token sai, payload bị đổi, token đã rotate và chi nhánh không hoạt động.
- [x] Tạo QR salon/chi nhánh Testing cuối sau Vietnam gateway; QR salon cũ đã rotate.
- [ ] Kiểm tra QR bằng tài khoản Zalo thường ngoài nhóm Developer/Admin.
- [x] Hai QR chi nhánh Version 24 được tạo ở chế độ `env=TESTING`, giải mã độc lập và được backend production xác nhận HTTP 200.
- [x] Hồ sơ chỉ cung cấp URL ảnh HTTPS versioned; không ghi token vào mô tả Portal.

`QR_SOURCE_READY=true`

`QR_DEVICE_TESTED=false`

## 5. Dữ liệu reviewer

- [x] Tạo salon reviewer và hai chi nhánh theo spec.
- [x] Tạo owner/staff reviewer riêng trong HAIRCUT Manager; email đã xác minh.
- [x] Chuẩn bị điểm, bốn phiên dịch vụ, hai yêu cầu điểm và hai phần thưởng để kiểm thử.
- [x] Chỉ dùng khách và số điện thoại giả dành cho review, không dùng dữ liệu khách thật.
- [x] Mật khẩu owner/staff và QR token chỉ nằm trong file local bị Git bỏ qua.

`REVIEW_DATA_SETUP_REQUIRED=false`

## 6. Ảnh reviewer

Giá trị trạng thái hợp lệ: `READY_TO_CAPTURE`, `BLOCKED_BY_VN_GATEWAY`, `NOT_REQUIRED`, `CAPTURED`.

| Tên ảnh                  | Trạng thái hiện tại | Nội dung                     |
| ------------------------ | ------------------- | ---------------------------- |
| `01-open`                | `CAPTURED`          | Mở Mini App không QR an toàn |
| `02-salon-qr`            | `CAPTURED`          | QR salon hợp lệ              |
| `03-branch-selector`     | `CAPTURED`          | Chọn chi nhánh từ QR salon   |
| `04-branch`              | `CAPTURED`          | QR chi nhánh và địa chỉ      |
| `05-profile-explanation` | `CAPTURED`          | Giải thích quyền hồ sơ       |
| `06-zalo-permission`     | `READY_TO_CAPTURE`  | Popup quyền Zalo thật        |
| `07-checkin`             | `CAPTURED`          | Xác nhận check-in            |
| `08-waiting`             | `CAPTURED`          | Trạng thái Waiting           |
| `09-serving`             | `CAPTURED`          | Trạng thái Serving           |
| `10-points`              | `CAPTURED`          | Điểm sau khi owner duyệt     |
| `11-history`             | `CAPTURED`          | Lịch sử lượt cắt             |
| `12-wheel-before`        | `CAPTURED`          | Vòng quay trước khi quay     |
| `13-wheel-result`        | `CAPTURED`          | Kết quả vòng quay            |
| `14-reward`              | `CAPTURED`          | Mã quà nếu trúng             |
| `15-privacy`             | `CAPTURED`          | Chính sách quyền riêng tư    |
| `16-terms`               | `CAPTURED`          | Điều khoản sử dụng           |

Đã có 15 ảnh artifact được kiểm tra trực quan. `06-zalo-permission.png` vẫn bắt buộc chụp thủ công từ popup Zalo thật.

## 7. App Check và bảo mật runtime

- [x] Source có cấu hình App Check và không commit debug token.
- [x] Production callable có cờ enforcement riêng.
- [ ] App Check được kiểm tra trên Android thật.
- [ ] App Check được kiểm tra trên iPhone thật.
- [ ] Enforcement production chỉ bật sau khi metric thiết bị thật đạt.

`APP_CHECK_DEVICE_VERIFIED=false`

`APP_CHECK_PRODUCTION_ENFORCED=false`

## 8. Build, artifact và submission

- [x] Production không bật preview/debug fallback.
- [x] `build:zmp` dùng thư mục `www` và app-config tham chiếu asset tồn tại.
- [x] Bundle không chứa localhost/HTTP do ứng dụng sở hữu, secret hoặc QR test giả.
- [x] Artifact reviewer local nằm trong đường dẫn bị Git ignore.
- [x] Vietnam gateway được triển khai, bind loopback và local/public `/health` đạt 200.
- [ ] Identity verification hoạt động từ bản Testing cuối.
- [x] CI/readiness xanh trên candidate; Draft PR `#36` không merge.
- [x] Artifact Version 24 có SHA-256 trong evidence local và Portal hiển thị trạng thái Testing.
- [ ] Hoàn tất ảnh thiết bị thật và review độc lập.
- [x] Chủ tài khoản đã gửi xét duyệt Testing Version 24 lúc `21:58:42 13/09/2026`; chưa Publish.

`ZALO_IDENTITY_VERIFICATION_BLOCKED_BY_IP_POLICY=false`

`VIETNAM_GATEWAY_REQUIRED=false`

`SUBMISSION_READY=false`

`SUBMISSION_STATUS=IN_REVIEW`
