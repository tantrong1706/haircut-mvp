# Trạng thái CH Hair Web

Cập nhật ngày 11/10/2026 (Asia/Saigon). Nhánh chính là `main`; sản phẩm là Web trên Firebase tại
<https://app.chhaircutsalon.cc>. Nhánh Zalo và các quy trình xét duyệt không còn là luồng phát hành.

## Bản live đã xác minh trước đợt phát hành này

- HTML được kiểm tra ngày 11/10 vẫn dùng `assets/index.Deo2WmWZ.module.js`.
- Source ghi nhận của bản này: `a39e3e4e39ecf232ab7fbea2bf6e4b50bcc2036f`.
- Hosting version ghi nhận: `77764f53106be56a`; release `1790851288216000` (01/10/2026).
- HTTPS `/`, `/history`, `/wheel`, `/rewards`, `/account`, `/owner`, `/staff`, `/health.json`: 200.
- Kiểm tra trên là đọc HTML, không gửi OTP và không tạo dữ liệu khách.

## Bản vá đang chuẩn bị

- Chặn kết quả đồng bộ/check-in/tải tài khoản cũ sau logout, đổi UID hoặc rời trang.
- Dọn timer vòng quay; không cho callback cũ ghi lại phiên khách.
- Dừng phát hành nếu build hoặc đóng gói Hosting thất bại.
- Giữ source Web dùng LF trên Windows để không tái xuất hiện lỗi định dạng sau đổi nhánh.
- Giới hạn Dependabot: một PR cập nhật phiên bản cho mỗi phần; nhóm minor/patch.
  Cảnh báo và PR cập nhật bảo mật không bị tắt hoặc tính vào hạn mức này.
- Web local: 209 unit tests và 51 browser tests PASS; build/lint/typecheck PASS.
- Coverage phần vá: 89.76% lines/statements, 80.57% branches, 91.89% functions.

Chủ dự án đã cho phép nhập main và deploy **chỉ Hosting** khi kiểm thử/CI PASS.
Tại thời điểm ghi phần chuẩn bị này, chưa deploy bản vá; metadata release mới sẽ được bổ sung
sau khi deploy và hậu kiểm thực tế. Không thay Functions, Rules, Storage, dữ liệu hoặc policy App Check.

## Bằng chứng và giới hạn

- [Bản vá phiên khách và Hosting](testing/web-session-hardening.tdd.md).
- [Dọn Zalo/Botkeep](testing/web-only-retirement.tdd.md).
- [Bằng chứng OTP, tenant, điểm và cooldown trước đây](WEB_CUSTOMER_RELEASE_READINESS.md).
- [Checklist hiện tại](WEB_CUSTOMER_COMPLETION_CHECKLIST.md).

Người dùng đã xác nhận điện thoại kiểm tra App Check thành công và mở lại không cần OTP trong
chat sau đợt 01/10. Đó là bằng chứng thiết bị thật trước đây, không phải lần test mới của bản vá.
Browser tự động từng bị attestation 403/requestStorageAccess; không coi đó là OTP hoặc Auth PASS.
App Check provider ở chế độ theo dõi; enforcement chưa được xác nhận bật và không đổi trong đợt này.

Dependency audit Customer Web gần nhất: 0 Critical, 4 High trong chuỗi Firebase/Firestore/gRPC.
Không nâng major hoặc tuyên bố hết mọi lỗ hổng. CI xanh không thay thế kiểm tra luồng đăng nhập
thật và không có nghĩa source đã được deploy.
