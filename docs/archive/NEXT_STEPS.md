# Việc Cần Làm Tiếp

> Lộ trình lịch sử, không phản ánh đầy đủ code hiện tại. Dùng `docs/FULL_APP_AUDIT.md` và `docs/ZALO_REVIEW_SUBMISSION.md` để theo dõi các cổng phát hành còn lại.

## Đã có

- Đặc tả sản phẩm.
- Thiết kế dữ liệu Firestore.
- Checklist quyền riêng tư.
- Firebase Hosting.
- Cloud Functions nền tảng.
- Web/Zalo Mini App bằng React.
- Mã nguồn SwiftUI cho app iOS chủ salon/nhân viên sau này.
- Đăng nhập và chặn quyền cho `/staff` và `/owner`.
- Chủ salon cấu hình vòng quay trong Firestore.

## Bạn cần cấu hình

1. Firebase web app config cho `zalo-mini-app`.
2. Firebase Auth email/mật khẩu.
3. Document `users/{uid}` cho chủ salon/nhân viên.
4. Firebase iOS config `GoogleService-Info.plist` nếu build iOS.
5. Zalo Mini App ID thật.
6. Endpoint xác minh phone/token Zalo khi lên production.
7. Chính sách quyền riêng tư production.

## Test web MVP

1. Khách mở `/`.
2. Khách nhập số điện thoại nếu muốn.
3. Kiểm tra Firestore có `customers` và `chair_sessions`.
4. Nhân viên mở `/staff?salonId=demo-salon` và đăng nhập.
5. Nhân viên thấy khách đang chờ.
6. Nhân viên nhập tên/ghi chú kiểu tóc.
7. Nhân viên gửi yêu cầu cộng điểm.
8. Kiểm tra Firestore có `point_requests`.
9. Chủ salon mở `/owner?salonId=demo-salon` và đăng nhập.
10. Chủ salon duyệt điểm.
11. Kiểm tra `customers.points` tăng.
12. Kiểm tra `haircut_records` có lịch sử.
13. Khách quay lại xem lịch sử và vòng quay.

## Demo local

1. Mở terminal 1.
2. Chạy `.\scripts\start-emulators.ps1`.
3. Mở terminal 2.
4. Chạy `.\scripts\seed-demo.ps1`.
5. Chạy `.\scripts\start-miniapp.ps1`.
6. Mở `http://127.0.0.1:5173/?salonId=demo-salon&mirrorId=demo-mirror-1&qrToken=demo-token`.

## Ưu tiên sản phẩm

1. Test full flow hiện có.
2. Tạo Auth user cho chủ salon/nhân viên và `users/{uid}`.
3. Test cấu hình vòng quay trong `/owner`.
4. Deploy Cloud Functions và thử `VITE_FUNCTION_WRITE_MODE=auto`.
5. Khi Functions ổn, đổi sang `VITE_FUNCTION_WRITE_MODE=required`.
6. Hoàn thiện xác thực khách/Zalo.
7. Khóa Firestore rules.
8. Tạo chính sách quyền riêng tư production.
9. Sau đó mới làm Zalo production và App Store.

## Chế độ ghi dữ liệu

`zalo-mini-app` đang hỗ trợ 3 mức:

- `direct`: test nội bộ, client ghi Firestore trực tiếp.
- `auto`: gọi Cloud Functions trước, lỗi thì fallback về direct.
- `required`: production, chỉ dùng Cloud Functions.

Không dùng `required` nếu Functions chưa deploy.

## Đăng nhập

Xem [AUTH_SETUP.md](../AUTH_SETUP.md).
