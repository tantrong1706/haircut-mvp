# Kiến trúc HAIRCUT

```text
Khách Zalo -> Callable Functions (xác minh Zalo) -> Firestore
Owner/Staff -> Firebase Auth -> Callable Functions -> Firestore
Owner/Staff -> Firestore listeners chỉ đọc dữ liệu đúng salon
Ảnh -> Firebase Storage Rules + hồ sơ quyền trong Firestore
```

QR có hai cấp: một QR chung trên `salons` và một QR cho mỗi document `branches`. Token được ký HMAC
theo loại QR, salon, chi nhánh và phiên bản; chỉ phiên bản được lưu trong Firestore. `mirrors` là lớp
tương thích tạm thời cho QR Gương 1 cũ.

Frontend dùng chung một React app nhưng tách bundle theo route. Owner/staff đăng nhập Firebase Auth; salonId lấy từ `users/{uid}`. Khách không đọc Firestore trực tiếp: check-in, trạng thái, lịch sử, quà và vòng quay đều qua Functions xác minh Zalo.

Cloud Functions là ranh giới ghi nghiệp vụ. Firestore Rules chỉ cho thành viên đang hoạt động đọc dữ liệu salon của mình và từ chối mọi business write từ client. Admin SDK trong Functions thực hiện transaction cho check-in, duyệt điểm và quay thưởng.

## Ràng buộc production

- API khách Zalo áp dụng hạn mức theo endpoint, token và IP đã băm; collection `_public_rate_limits` không mở cho client và tự hết hạn bằng TTL. Kết quả xác minh Zalo được cache 60 giây trong instance, còn polling dùng jitter/backoff để tránh dồn tải.
- App Check có thể bắt buộc bằng `REQUIRE_ZALO_APP_CHECK=true` sau khi runtime Zalo đã được cấu hình và kiểm tra tương thích.
- Lượt phục vụ đi qua `waiting → serving → pending_approval → completed/cancelled`. `assignedStaffId` do Functions ghi và chỉ người đã nhận khách mới được gửi yêu cầu điểm.
- Staff chỉ query `chair_sessions` của `branchIds` được phân công; owner có thể xem tất cả chi nhánh.
- Nhân viên mới không nhận mật khẩu từ chủ salon. Functions tạo tài khoản, Firebase gửi email đặt mật khẩu trực tiếp tới nhân viên; UID tùy ý từ client không được chấp nhận.
- Tìm khách dùng `namePrefixes` hoặc `phoneLast4` có cursor. Backfill dữ liệu cũ chỉ chạy trong migration chi nhánh idempotent, không chạy trong request tìm kiếm; dashboard dùng count/sum aggregation và truy vấn retention có giới hạn.

`app-config.json` được sinh từ `.vite/manifest.json`; entry Zalo luôn có đuôi `.module.js`. Service worker chỉ đăng ký trên web thông thường, không chạy trong Zalo Mini App.
