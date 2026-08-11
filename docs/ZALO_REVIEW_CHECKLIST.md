# Checklist xét duyệt Zalo Mini App - CH Haircut Salon Version 8

Không tải Version 8 hoặc gửi xét duyệt khi còn mục bắt buộc `[ ]`.

## 1. Metadata

- [x] Tên Mini App trong source: `CH Haircut Salon`.
- [x] Mini App ID trong production: `2038116772828167300`.
- [ ] Tên, logo, danh mục, mô tả và hỗ trợ trên Portal khớp source hiện hành.
- [ ] Nội dung phiên bản dùng đúng hướng dẫn 14 bước trong `docs/ZALO_VERSION_8_SUBMISSION.md`.

## 2. Quyền Zalo

- [x] Source dùng `getAccessToken` để backend xác minh danh tính.
- [x] Source chỉ gọi `getUserInfo` sau hành động cho phép của khách.
- [x] Source không gọi `getPhoneNumber`, `scanQRCode`, location, notification, `followOA` hoặc share.
- [x] Có trạng thái từ chối quyền, thử lại, timeout, lỗi mạng và SDK không khả dụng.
- [ ] Portal chỉ yêu cầu quyền hồ sơ Zalo thực sự cần.
- [ ] Ảnh minh họa quyền cho thấy đúng màn giải thích và popup Zalo.

`PORTAL_PERMISSION_SOURCE_AUDIT=PASS`

`PORTAL_PERMISSION_MANUAL_CHECK=REQUIRED`

## 3. Privacy, Terms và xóa dữ liệu

- [x] Source có route công khai `/privacy` và `/terms` với branding hiện hành.
- [x] Privacy nêu dữ liệu Zalo, số điện thoại tùy chọn, ảnh có đồng ý, mục đích, thời gian lưu, xóa dữ liệu và hỗ trợ.
- [x] Terms liên kết Privacy và mô tả đúng chức năng hiện có.
- [x] Source có webhook rút đồng ý/xóa dữ liệu và test liên quan.
- [ ] Xác minh Privacy và Terms live trong Zalo trên Android/iPhone.
- [ ] Xác minh webhook HTTPS thật trên Portal.

## 4. QR và reviewer flow

- [x] Link chung không QR không crash và không lộ owner/staff/admin.
- [x] Frontend Version 8 chỉ chấp nhận QR salon/chi nhánh; QR `legacy-mirror` bị từ chối.
- [x] QR salon hỗ trợ chọn chi nhánh; QR chi nhánh mở đúng chi nhánh theo source/test.
- [x] QR token bị loại khỏi URL sau khi parse và không được lưu trong localStorage.
- [x] Test bao phủ token sai, payload bị đổi, token đã rotate và chi nhánh không hoạt động.
- [ ] Tạo QR salon/chi nhánh Testing cuối sau Vietnam gateway.
- [ ] Kiểm tra QR bằng tài khoản Zalo thường ngoài nhóm Developer/Admin.
- [ ] Đính kèm QR/deeplink thật trong hồ sơ reviewer mà không commit token vào Git.

`QR_SOURCE_READY=true`

`QR_DEVICE_TESTED=false`

## 5. Dữ liệu reviewer

- [ ] Tạo salon reviewer và tối thiểu hai chi nhánh theo spec.
- [ ] Tạo owner/staff reviewer riêng trong HAIRCUT Manager.
- [ ] Chuẩn bị cấu hình điểm, vòng quay và quà có thể kiểm thử trọn luồng.
- [ ] Dùng khách test, không dùng dữ liệu khách thật; số điện thoại có thể để trống.
- [ ] Không đặt mật khẩu owner/staff hoặc token vào Git/tài liệu công khai.

`REVIEW_DATA_SETUP_REQUIRED=true`

## 6. Ảnh reviewer

Giá trị trạng thái hợp lệ: `READY_TO_CAPTURE`, `BLOCKED_BY_VN_GATEWAY`, `NOT_REQUIRED`, `CAPTURED`.

| Tên ảnh                  | Trạng thái hiện tại     | Nội dung                     |
| ------------------------ | ----------------------- | ---------------------------- |
| `01-open`                | `READY_TO_CAPTURE`      | Mở Mini App không QR an toàn |
| `02-salon-qr`            | `BLOCKED_BY_VN_GATEWAY` | QR salon hợp lệ              |
| `03-branch-selector`     | `BLOCKED_BY_VN_GATEWAY` | Chọn chi nhánh từ QR salon   |
| `04-branch`              | `BLOCKED_BY_VN_GATEWAY` | QR chi nhánh và địa chỉ      |
| `05-profile-explanation` | `BLOCKED_BY_VN_GATEWAY` | Giải thích quyền hồ sơ       |
| `06-zalo-permission`     | `BLOCKED_BY_VN_GATEWAY` | Popup quyền Zalo             |
| `07-checkin`             | `BLOCKED_BY_VN_GATEWAY` | Xác nhận check-in            |
| `08-waiting`             | `BLOCKED_BY_VN_GATEWAY` | Trạng thái Waiting           |
| `09-serving`             | `BLOCKED_BY_VN_GATEWAY` | Trạng thái Serving           |
| `10-points`              | `BLOCKED_BY_VN_GATEWAY` | Điểm sau khi owner duyệt     |
| `11-history`             | `BLOCKED_BY_VN_GATEWAY` | Lịch sử lượt cắt             |
| `12-wheel-before`        | `BLOCKED_BY_VN_GATEWAY` | Vòng quay trước khi quay     |
| `13-wheel-result`        | `BLOCKED_BY_VN_GATEWAY` | Kết quả vòng quay            |
| `14-reward`              | `BLOCKED_BY_VN_GATEWAY` | Mã quà nếu trúng             |
| `15-privacy`             | `READY_TO_CAPTURE`      | Chính sách quyền riêng tư    |
| `16-terms`               | `READY_TO_CAPTURE`      | Điều khoản sử dụng           |

Chưa có ảnh nào được đánh dấu `CAPTURED`. `NOT_REQUIRED` chỉ dùng khi reviewer xác nhận một ảnh không còn cần.

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
- [ ] Vietnam gateway được triển khai và `/health` đạt.
- [ ] Identity verification hoạt động từ bản Testing cuối.
- [ ] CI/readiness xanh trên đúng commit được tải.
- [ ] Ghi checksum artifact và phiên bản Testing cuối.
- [ ] Hoàn tất ảnh thiết bị thật và review độc lập.
- [ ] Chủ tài khoản tải Version 8 và gửi xét duyệt thủ công.

`ZALO_IDENTITY_VERIFICATION_BLOCKED_BY_IP_POLICY=true`

`VIETNAM_GATEWAY_REQUIRED=true`

`SUBMISSION_READY=false`
