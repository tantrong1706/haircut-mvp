# Quản lý và giám sát HAIRCUT

Tài liệu này dành cho giai đoạn chạy thật. Mục tiêu là biết app còn sống không,
khách/nhân viên/chủ salon đang dùng luồng nào, thao tác nào lỗi, và khi nào cần xử lý.

## Bộ công cụ nên dùng

### 1. Firebase Console

Dùng để quản lý hạ tầng chính:

- Hosting: kiểm tra bản deploy web.
- Firestore: kiểm tra dữ liệu salon, khách, điểm, mã quà.
- Authentication: quản lý tài khoản chủ salon/nhân viên.
- Analytics: xem số lượt mở app, check-in, quay vòng, duyệt điểm.
- Performance Monitoring: xem tốc độ tải app và các trace quan trọng.

App đã bật sẵn Firebase Analytics/Performance khi có:

```text
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 2. Sentry

Dùng để bắt lỗi frontend:

- lỗi trắng màn hình;
- lỗi đăng nhập;
- lỗi check-in;
- lỗi gửi yêu cầu cộng điểm;
- lỗi quay vòng;
- lỗi đổi mã quà.

App đã chuẩn bị sẵn Sentry. Khi có DSN, điền:

```text
VITE_SENTRY_DSN=https://...
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
VITE_SENTRY_REPLAY_SAMPLE_RATE=0
VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE=0
```

Mặc định không bật Session Replay để tránh ghi lại dữ liệu nhạy cảm của khách.

### 3. Better Stack hoặc UptimeRobot

Dùng để kiểm tra app còn online hay không.

Monitor URL nên dùng:

```text
https://haircut-c7d12.web.app/health.json
```

Điều kiện pass:

- HTTP status: `200`
- Body có: `"status": "ok"`

Nếu monitor báo down, kiểm tra theo thứ tự:

1. Firebase Hosting có lỗi deploy không.
2. Firebase project có bị quota/billing không.
3. Firestore/Auth có sự cố không.
4. Sentry có lỗi frontend mới không.

## Event đã được gắn trong app

### Khách hàng

- `page_view`
- `customer_checkin_started`
- `customer_checkin`
- `customer_checkin_created`
- `customer_tab_opened`
- `customer_session_reset`
- `lucky_wheel_spin_started`
- `lucky_wheel_spin`
- `lucky_wheel_spin_completed`

### Nhân viên

- `ops_user_authenticated`
- `staff_point_request_started`
- `staff_point_request`
- `staff_point_request_submitted`
- `reward_code_lookup`
- `reward_code_lookup_completed`
- `reward_code_redeem`
- `reward_code_redeemed`

### Chủ salon

- `owner_signup_started`
- `owner_signup_completed`
- `ops_signin_started`
- `ops_signin_completed`
- `ops_signout`
- `owner_tab_opened`
- `owner_save_salon_profile`
- `owner_salon_profile_saved`
- `owner_save_avatar`
- `owner_avatar_saved`
- `owner_approve_point_request`
- `owner_point_request_approved`
- `owner_reject_point_request`
- `owner_point_request_rejected`
- `owner_save_wheel_config`
- `owner_wheel_config_saved`

## Quy tắc dữ liệu nhạy cảm

Không gửi các dữ liệu này vào Analytics/Sentry:

- số điện thoại đầy đủ;
- tên khách;
- nội dung ghi chú kiểu tóc;
- mã quà đầy đủ;
- email người dùng;
- URL avatar.

Chỉ gửi dữ liệu vận hành:

- `salon_id`;
- `role`;
- `tab`;
- trạng thái phiên;
- số điểm;
- thao tác thành công/thất bại.

## Việc cần bạn làm để bật giám sát đầy đủ

1. Vào Firebase Console, kiểm tra Analytics và Performance đã có dữ liệu.
2. Tạo project Sentry cho React/Vite.
3. Gửi `VITE_SENTRY_DSN` cho Codex để điền vào `.env`.
4. Tạo monitor trong Better Stack hoặc UptimeRobot với URL `/health.json`.
5. Bật email cảnh báo cho uptime monitor.
6. Mỗi ngày khi chạy pilot, kiểm tra:
   - số lượt check-in;
   - số yêu cầu cộng điểm;
   - lỗi mới trong Sentry;
   - app có downtime không.
