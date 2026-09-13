# Zalo Gateway - Hồ sơ trước khi mua VPS

## Phạm vi

Gateway phục vụ CH Haircut Salon Mini App ID `2038116772828167300` và chỉ làm một việc: xác minh danh tính Zalo từ Firebase Functions thông qua IP Việt Nam. Gateway không đọc Firestore, không biết `salonId`/`branchId`, không giữ access token và không thực hiện nghiệp vụ khách hàng.

## Kiến trúc

```text
Firebase Functions
  -> tạo appsecret_proof bằng ZALO_APP_SECRET trong Secret Manager
  -> ký raw request bằng service HMAC
  -> HTTPS đến gateway Việt Nam
  -> gateway kiểm tra keyId/timestamp/nonce/body hash/HMAC/rate limit
  -> GET https://graph.zalo.me/v2.0/me?fields=id
  -> trả zaloUserId hoặc mã lỗi chuẩn hóa
```

Production chưa được chuyển sang gateway trong PR này. `DirectZaloVerifier` được giữ làm rollback và test; khi `ZALO_VERIFIER_MODE=gateway`, thiếu bất kỳ cấu hình gateway nào đều fail closed, không fallback direct.

## Bảo mật

- HMAC-SHA256 với khóa tối thiểu 32 byte và `keyId`.
- Raw body SHA-256 nằm trong canonical request, so sánh constant-time.
- Timestamp cửa sổ ±60 giây; nonce 128-bit; replay TTL 120 giây.
- SQLite WAL và unique `(key_id, nonce)` bảo vệ race trên một instance.
- Giới hạn 20 request/giây mỗi service key, burst 50, tối đa 100 request upstream đồng thời.
- Body tối đa 8 KB, JSON schema đóng, không có URL/host/endpoint do caller cung cấp.
- Upstream production cố định HTTPS `graph.zalo.me/v2.0/me`; redirect bị từ chối.
- Logger xóa token, proof, secret, authorization và signature kể cả trong object lồng nhau.
- Gateway không biết Zalo App Secret. App Secret tiếp tục ở Firebase Secret Manager.

## Key rotation

`GATEWAY_HMAC_KEYS` là JSON map và có thể chứa khóa hiện tại cùng khóa trước trong thời gian chuyển tiếp.

1. Sinh khóa mới tối thiểu 32 byte bằng CSPRNG và thêm `new-key-id` vào gateway.
2. Deploy/restart gateway, xác minh health và request ký bằng cả key cũ/mới.
3. Cập nhật Firebase signer sang `new-key-id` và secret mới.
4. Theo dõi lỗi xác minh và replay trong grace period.
5. Gỡ khóa cũ khỏi gateway rồi restart.

Không gửi khóa qua Git, log, ticket hoặc ảnh chụp màn hình.

## Release layout

```text
/opt/zalo-gateway/releases/<commit-or-version>
/opt/zalo-gateway/current -> release đang chạy
/etc/zalo-gateway/gateway.env
/var/lib/zalo-gateway/replay.db
```

Code/config/state tách riêng. `gateway.env` thuộc `root:zalo-gateway`, mode `0640`; SQLite thuộc user `zalo-gateway`, mode thư mục `0700`.

## Bootstrap và deploy

Trên Ubuntu 22.04, kiểm tra script trước khi chạy:

```bash
sudo scripts/zalo-gateway/bootstrap-ubuntu.sh
sudo install -o root -g zalo-gateway -m 0640 deploy/zalo-gateway/gateway.env.example /etc/zalo-gateway/gateway.env
# Điền secret trực tiếp trên VPS, thay GATEWAY_FQDN và chạy caddy validate.
sudo scripts/zalo-gateway/deploy-release.sh services/zalo-verification-gateway <commit-sha>
```

Deploy build/check trước, tạo checksum, đổi symlink nguyên tử, restart và kiểm tra health. Nếu health fail, script đưa symlink về release trước rồi restart. Không tự động xóa release cũ.

## Caddy, firewall và SSH

- Caddy public 443; gateway chỉ listen `127.0.0.1:3000`.
- Access log Caddy xóa toàn bộ request/response headers; app log là nguồn theo dõi chính.
- UFW: `default deny incoming`, `default allow outgoing`, cho SSH trước, sau đó 80/443. Không bật UFW hoặc khóa SSH trước khi xác minh phiên SSH thứ hai hoạt động.
- Tạo admin user và SSH key, test login, rồi mới tắt password login/root SSH. `fail2ban` là tùy chọn.

## Multi-salon và mở rộng

Một gateway dùng chung cho mọi salon vì request xác minh không có tenant/business data. Firebase Functions tiếp tục chịu trách nhiệm tenant isolation.

- Phase 1: một VPS + SQLite WAL.
- Phase 2: load balancer + nhiều gateway + `RedisReplayStore` dùng chung.

Không chạy nhiều instance với SQLite riêng vì replay protection sẽ không chia sẻ giữa các instance.

## Biến môi trường

Gateway: `PORT`, `NODE_ENV`, `GATEWAY_VERSION`, `ZALO_UPSTREAM_URL`, `GATEWAY_HMAC_KEYS`, `REPLAY_DB_PATH`, `REQUEST_MAX_BYTES`.

Firebase (chỉ tên): `ZALO_VERIFIER_MODE`, `ZALO_GATEWAY_URL`, `ZALO_GATEWAY_KEY_ID`, `ZALO_GATEWAY_HMAC_SECRET`, cùng `ZALO_APP_SECRET` hiện có trong Secret Manager.

Production phải bind service HMAC bằng secret manager/runtime secret phù hợp trước khi switch. PR này không đặt giá trị thật và không đổi production mode.

## Monitoring

Theo dõi requestId, outcome, duration và error code. Cảnh báo trên `AUTH_INVALID`, `REPLAY_DETECTED`, `RATE_LIMITED`, tỷ lệ `ZALO_UNAVAILABLE` và health failure. Không thu thập token, proof, chữ ký, tên khách, số điện thoại hoặc dữ liệu salon.

## Runbook ngày mua VPS

Thực hiện đúng thứ tự dưới đây và dừng ngay nếu một bước kiểm tra thất bại. Không gửi mật khẩu `root`, private key, HMAC secret, Zalo token hoặc Firebase credential cho AI, vào Git, log, ticket hay ảnh chụp màn hình.

1. Nhận thông tin VPS Ubuntu 22.04 từ nhà cung cấp.
2. Giữ mật khẩu `root` ngoài AI và ngoài mọi tài liệu dự án.
3. SSH vào VPS từ máy quản trị tin cậy.
4. Kiểm tra outbound IPv4 thực tế của VPS.
5. Xác minh geolocation của outbound IPv4 thuộc Việt Nam.
6. Cập nhật gói bảo mật Ubuntu và khởi động lại nếu hệ thống yêu cầu.
7. Tạo tài khoản quản trị có quyền `sudo`, không dùng `root` cho vận hành thường ngày.
8. Cài SSH public key cho tài khoản quản trị.
9. Mở phiên SSH thứ hai để xác minh đăng nhập bằng key trước khi siết cấu hình SSH.
10. Tạo system user `zalo-gateway` không có interactive shell.
11. Cấu hình firewall: giữ SSH đang dùng, mở 80/443, không public cổng gateway nội bộ.
12. Cài Node.js 22 và xác minh phiên bản.
13. Cài Caddy, thay `GATEWAY_FQDN`, chạy `caddy validate`, nhưng chưa coi HTTPS là đạt trước khi DNS hoạt động.
14. Upload source/artifact đã kiểm tra và chạy bootstrap/deploy gateway theo release layout.
15. Sinh HMAC service secret bằng CSPRNG trực tiếp trên hạ tầng tin cậy; không gửi hoặc ghi giá trị vào tài liệu.
16. Tạo `/etc/zalo-gateway/gateway.env` với owner/group/mode quy định và điền cấu hình runtime trực tiếp trên VPS.
17. Khởi động `zalo-gateway.service`, xác minh tiến trình chạy bằng user `zalo-gateway`.
18. Gọi `GET /health` qua loopback và yêu cầu HTTP 200.
19. Trỏ DNS, xác minh chứng chỉ HTTPS công khai và bảo đảm cổng 3000 không truy cập được từ Internet.
20. Gửi signed request tới gateway với mock Zalo upstream và xác minh mock identity.
21. Chuyển sang `graph.zalo.me` thật, gọi kiểm tra từ outbound IPv4 Việt Nam và quan sát response đã được làm sạch.
22. Chỉ khi Zalo trả payload có `id` hợp lệ mới bắt đầu kết nối Firebase Functions với gateway.
23. Cấu hình Firebase gateway mode, bind HMAC runtime secret và kiểm tra fail-closed; không bật fallback direct ngoài kế hoạch rollback đã duyệt.
24. Kiểm thử end-to-end trên iPhone thật.
25. Kiểm thử end-to-end trên Android thật.
26. Xác minh App Check production trên cả hai nền tảng thật.
27. Tạo và kiểm thử Zalo Testing Version cuối cùng.
28. Tạo QR salon/chi nhánh cuối cùng từ đúng Testing Version và kiểm tra toàn bộ luồng.
29. Chụp bộ screenshot xét duyệt từ thiết bị thật, không để lộ secret/token/dữ liệu khách.
30. Hoàn thiện hồ sơ và gửi Zalo xét duyệt; chưa Publish cho đến khi kết quả review và production gates đều đạt.

## Gates còn bắt buộc

- Mua VPS và xác minh IP thuộc Việt Nam.
- Deploy gateway thật và kiểm tra TLS/DNS/firewall.
- Gọi Zalo thật từ VPS và xác minh identity.
- Bind gateway HMAC trong Firebase production rồi switch có kiểm soát.
- Kiểm thử Android/iPhone và App Check trên thiết bị thật.
- Tạo Testing Version/QR cuối và gửi review.

Local/CI pass không đồng nghĩa production release approval.
