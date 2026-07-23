# Kiến trúc HAIRCUT

```text
Khách -> Zalo Mini App -> Callable Functions xác minh Zalo
Owner/Staff -> HAIRCUT Manager -> Firebase Auth + App Check -> Callable Functions
System admin -> HAIRCUT Admin Web -> Firebase Auth + App Check -> Admin callables
                                          |
                     Firestore + Storage + FCM + audit/monitoring
```

## Phân tách ứng dụng

- `zalo-mini-app`: trải nghiệm khách. QR salon chọn chi nhánh; QR chi nhánh mở trực tiếp. `mirrors` chỉ giữ tương thích QR Gương 1.
- `apps/manager-mobile`: một app Capacitor chung cho mọi salon. Role từ `users/{uid}` quyết định owner/staff; native gồm FCM, App Check, camera, biometric, secure storage, deep link, share và network state.
- `apps/admin-web`: cổng riêng chỉ cho `system_admin`; không dùng route owner để giả lập quyền hệ thống.
- `packages/contracts`: role, status, schema, error code, tên callable và public QR contract dùng chung. Functions giữ mirror nội bộ được CI kiểm tra để Cloud Build không phụ thuộc đường dẫn ngoài source.

## Tenant isolation

Mỗi document nghiệp vụ có `salonId`; dữ liệu hàng chờ, lượt cắt, point request, lịch sử và quà còn có `branchId` khi phù hợp. Callable owner/staff luôn:

1. Xác minh Firebase Auth và đọc `users/{uid}`.
2. Lấy salon thật từ hồ sơ, so với request và kiểm tra role/isActive.
3. Kiểm tra salon `active`; staff phải có branch trong `branchIds`.
4. Query theo `salonId`, hoặc đọc document rồi xác minh tenant trước khi ghi.

Cross-tenant và branch denial tạo audit không chứa dữ liệu khách. Firestore/Storage Rules chặn business write từ client và chặn salon/tài khoản bị khóa.

## Tính nhất quán

- `active_service_sessions` dùng ID xác định theo salon + customer để check-in gửi lại nhận phiên cũ.
- Claim session, submit/approve/reject point, spin và redeem chạy transaction.
- Spin/redeem có `idempotencyKey`; point request dùng session ID xác định. Retry trả kết quả cũ và không cộng điểm/đổi quà lần hai.
- Audit chuẩn gồm salon, branch, actor UID/role, action, target, request ID, before/after và metadata an toàn.

## Khả năng cô lập sự cố

`system_config/features` và `salons/{salonId}/settings/features` điều khiển check-in, wheel, reward, photo và point approval. Maintenance mode và minimum app version cho phép dừng phạm vi nhỏ; rate limit theo token/IP băm hoặc UID/salon ngăn một tenant gây tải bất thường.

## Bảo mật runtime

- Zalo access token được xác minh ở Functions và không lưu/log.
- Web dùng reCAPTCHA Enterprise App Check. Manager dùng Play Integrity/App Attest/DeviceCheck qua native custom provider.
- FCM token được băm làm document ID, hỗ trợ nhiều thiết bị và vô hiệu hóa token lỗi mà không log token.
- Monitoring chỉ nhận allowlist vận hành; tên, phone/email, ghi chú, ảnh, mã quà và token bị loại.

## Vòng đời dữ liệu

Staff có thể xóa tài khoản cá nhân sau recent login. Owner yêu cầu xóa salon, nhập lại tên/mật khẩu và có 14 ngày hủy; scheduled worker dùng lease/idempotency để xóa theo batch. Zalo privacy webhook dùng chung deletion jobs cho khách.

Xem [DATABASE](DATABASE.md), [API contracts](API_CONTRACTS.md), [deployment](deployment.md) và [production operations](PRODUCTION_OPERATIONS.md).
