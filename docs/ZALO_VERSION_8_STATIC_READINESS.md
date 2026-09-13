# CH Haircut Salon Version 8 - Static Readiness

Tài liệu này chỉ ghi bằng chứng source tĩnh và kế hoạch reviewer. Nó không phải bằng chứng deploy, kiểm thử thiết bị
thật hoặc phê duyệt production.

## Trạng thái

```text
MINI_APP_NAME=CH Haircut Salon
MINI_APP_ID=2038116772828167300
ZALO_IP_POLICY_CONFIRMED=true
VIETNAM_GATEWAY_REQUIRED=true
ZALO_IDENTITY_VERIFICATION_BLOCKED_BY_IP_POLICY=true
REVIEW_DATA_SETUP_REQUIRED=true
GATEWAY_LOCAL_READY=false
GATEWAY_DEPLOY_READY=false
APP_CHECK_DEVICE_VERIFIED=false
APP_CHECK_PRODUCTION_ENFORCED=false
DEVICE_TESTING_READY=false
SUBMISSION_READY=false
```

## Audit quyền Zalo

Source hiện hành chỉ dùng `getAccessToken` và `getUserInfo`. Source không gọi `getPhoneNumber`, `scanQRCode`,
location, notification, `followOA` hoặc share. UX phân biệt từ chối quyền, timeout, lỗi mạng và SDK không khả dụng;
không biến mọi lỗi thành từ chối quyền.

```text
PORTAL_PERMISSION_SOURCE_AUDIT=PASS
PORTAL_PERMISSION_MANUAL_CHECK=REQUIRED
```

## Privacy và Terms

Source `/privacy` và `/terms` dùng branding CH Haircut Salon và mô tả dữ liệu hồ sơ Zalo, số điện thoại tùy chọn,
ảnh theo đồng ý, mục đích xử lý, thời gian lưu, xóa dữ liệu và kênh hỗ trợ. Kiểm tra URL live không được thực hiện
trong tác vụ này vì không được phép truy cập production; phải kiểm tra thủ công trên Android/iPhone trước khi gửi.

## QR Version 8

Luồng chính thức chỉ chấp nhận QR salon hoặc QR chi nhánh có chữ ký, version và token được backend xác minh. Token
được loại khỏi URL ngay sau khi parse, không lưu localStorage và không được đưa vào telemetry. Frontend reviewer từ
chối `legacy-mirror`; backend legacy tồn tại để tương thích dữ liệu cũ nhưng không thuộc reviewer flow Version 8.

Test tĩnh bao phủ QR hợp lệ, payload salon/branch/kind bị thay đổi, token sai, token đã rotate, chi nhánh bị khóa và
legacy raw context bị từ chối. Việc quét thật vẫn bị chặn cho tới khi gateway Việt Nam hoạt động.

## Spec dữ liệu reviewer

Không tạo dữ liệu production trong tác vụ này. Sau gateway và Testing cuối, chủ dự án cần tạo:

- Một salon reviewer, tên dễ nhận biết và không chứa dữ liệu pháp lý giả.
- Tối thiểu hai chi nhánh hoạt động, mỗi chi nhánh có tên và địa chỉ reviewer rõ ràng.
- Một owner và một staff dùng tài khoản HAIRCUT Manager riêng; credential không ghi vào Git.
- Staff được gán đúng một chi nhánh để chứng minh tenant/branch isolation.
- Cấu hình điểm, vòng quay có ít nhất một ô không trúng và một phần thưởng có thể tạo mã quà.
- Một khách test không chứa dữ liệu khách thật; số điện thoại để trống hoặc dùng số test do chủ dự án kiểm soát.
- Không tải ảnh người thật nếu chưa có đồng ý; ảnh reviewer có thể bỏ trống nếu không cần chứng minh luồng ảnh.

```text
REVIEW_DATA_SETUP_REQUIRED=true
```

## Artifact và bằng chứng lịch sử

- Zalo Testing Version 16 là artifact lịch sử, đã bị thay thế và không dùng để gửi Version 8.
- Version 17 là bằng chứng blocker chính sách IP của Zalo, không phải artifact cuối để reviewer kiểm thử.
- Artifact cuối chỉ được tạo sau khi gateway Việt Nam và Testing cuối vượt qua kiểm tra thiết bị.
- `artifacts/zalo-review.local/` là dữ liệu local bị Git ignore; không commit deeplink, QR token hoặc credential.

## App Check

Source có cấu hình reCAPTCHA Enterprise cho web và provider native cho Manager. Trước production phải cung cấp site
key đúng môi trường, xác minh Android/iPhone thật, theo dõi lỗi rồi mới bật enforcement. Lỗi App Check phải hiển thị
thông báo an toàn, không để ứng dụng fail-open và không log token/debug token.

## Thiết kế Vietnam gateway (thực hiện ở PR sau)

PR #30 chỉ ghi contract; chưa triển khai hoặc deploy gateway. Branch dự kiến: `feat/zalo-verification-vn-gateway`.

### API

- `POST /v1/zalo/verify`: nhận payload xác minh tối thiểu từ Firebase Function, gọi Zalo API từ outbound IP Việt Nam
  và trả profile đã chuẩn hóa.
- `GET /health`: trả trạng thái tiến trình, version và khả năng kết nối phụ thuộc không nhạy cảm.

### Xác thực nội bộ

Canonical string gồm method, path, timestamp, nonce, SHA-256 request body và request ID. Firebase Function ký HMAC;
gateway kiểm tra timestamp lệch tối đa 60 giây, nonce chưa dùng, body tối đa 8 KB và so sánh chữ ký constant-time.
Không log HMAC, access token, profile, số điện thoại hoặc raw body.

### Retry và lỗi

- Timeout ngắn, exponential backoff có jitter và số lần thử hữu hạn.
- Chỉ retry lỗi mạng/timeout/5xx phù hợp; không retry mù lỗi xác thực hoặc payload.
- Fail closed: gateway không xác minh được thì không tạo customer/session.
- Frontend chỉ nhận thông báo chung kèm requestId an toàn; chi tiết IP/policy chỉ nằm trong log backend đã scrub.

### Nhiều salon và nhiều instance

Gateway stateless theo salon; không lưu Zalo token dài hạn. Phase 1 có thể dùng SQLite cho nonce/replay khi chỉ một
instance. Phase 2 phải chuyển replay protection và rate-limit state sang Redis trước khi scale ngang; không dùng
SQLite chia sẻ giữa nhiều instance.

### Test fixture dự kiến

Mock gateway phải kiểm tra chữ ký đúng/sai, timestamp hết hạn, nonce replay, body vượt 8 KB, timeout, 429, 5xx,
profile thiếu field và log scrub. Đây chỉ là thiết kế; không tạo branch, không mua VPS và không deploy trong PR #30.

## Quyết định hiện tại

```text
SOURCE_CANDIDATE_READY=true
REVIEW_PACKAGE_STATIC_READY=true
QR_SOURCE_READY=true
GATEWAY_LOCAL_READY=false
VPS_PURCHASE_READY=false
GATEWAY_DEPLOY_READY=false
APP_CHECK_DEVICE_VERIFIED=false
DEVICE_TESTING_READY=false
SUBMISSION_READY=false
```
