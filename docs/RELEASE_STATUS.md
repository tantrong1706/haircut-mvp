# Trạng thái CH Hair Web

Cập nhật ngày 12/10/2026 (Asia/Saigon). Nhánh chính là `main`; sản phẩm là Web trên Firebase tại
<https://app.chhaircutsalon.cc>. Nhánh Zalo và các quy trình xét duyệt không còn là luồng phát hành.

## Production hiện tại — đã phát hành

- Source: `9ccdbb7df2bfd0e1f725ef4c97961f49e09a6bf5` (merge [PR #67](https://github.com/tantrong1706/haircut-mvp/pull/67)).
- Chỉ deploy Firebase Hosting site `haircut-c7d12`; hoàn tất 12/10/2026 lúc 13:10:39 giờ Việt Nam.
- Hosting version: `eab0acb4bfd1081a`; release `1791785439224000`.
- Entry: `assets/index.Ch33bEA4.module.js`.
- HTML custom domain khớp SHA-256 của artifact đã upload:
  `4E322C32051BE2361FA7151E93835172499188142D55DBF85608033DF0BE4D0F`.
- Header live: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.
- CSP live được enforce: `base-uri 'self'; object-src 'none'; frame-ancestors 'none'`;
  không còn header Report-Only. Đây là baseline hẹp, không phải script/XSS allowlist đầy đủ.
- [CI main: 6/6 PASS](https://github.com/tantrong1706/haircut-mvp/actions/runs/38210839753).
- [CodeQL main: PASS](https://github.com/tantrong1706/haircut-mvp/actions/runs/38210839779).
- [CI PR: 6/6 PASS](https://github.com/tantrong1706/haircut-mvp/actions/runs/38210458610).
- [Lighthouse PR: PASS](https://github.com/tantrong1706/haircut-mvp/actions/runs/38210458770).

Không deploy Functions, Firestore/Storage Rules hoặc indexes; không đổi Auth, App Check enforcement,
Gateway, Cloudflared hoặc dữ liệu khách. Commit ghi báo cáo sau release không thay source đang chạy.

## Hậu kiểm live

- Chromium desktop và WebKit mobile: mỗi engine kiểm tra 10 route, HTTP 200, đúng giao diện/cổng
  đăng nhập, HTML khớp artifact, không tràn ngang; header CSP/XFO/nosniff đúng trên mọi route.
- Lượt cuối chờ mạng ổn định giữa các lần chuyển trang: không page/console/asset error hoặc CSP
  violation, không console warning trên cả hai engine. Không tắt App Check hoặc bỏ lọc lỗi để PASS.
- Lượt WebKit đầu chuyển trang ngay sau render có `Load failed` và lỗi access-control tới Firebase
  Installations. Không tái hiện khi chờ `networkidle` giữa các route. Chưa đủ bằng chứng kết luận
  nguyên nhân duy nhất; không tuyên bố mọi lỗi mạng đã hết. Các bundle Firebase core/Auth/Firestore/
  monitoring có cùng SHA-256 với bản trước; policy mới không hạn chế `connect-src`.
- Bộ thu thập network vẫn ghi 19 request Google Analytics bị hủy trên Chromium; WebKit có hai
  request Firelog và một Analytics bị hủy. Đây là telemetry, không phải request OTP/điểm/quà;
  không gọi lượt này là zero-network-error hoặc giấu các sự kiện cancel.
- Firebase reCAPTCHA SDK render thực dưới CSP ứng viên PASS trên Chromium và WebKit, không gửi
  SMS, không tải probe lên Hosting. Đây là kiểm tra khởi tạo, không phải xác minh OTP thật.
- Các route được kiểm tra: `/checkin`, `/`, `/history`, `/wheel`, `/rewards`, `/account`,
  `/privacy`, `/terms`, `/owner`, `/staff`.
- Browser kiểm tra mới, chưa đăng nhập: không gửi OTP, không gọi check-in/quay/đổi quà thật.
  Hiển thị cổng đăng nhập không phải bằng chứng đã xem lịch sử riêng của khách trên production.

## Rollback

Giữ version trước `9f05728017a1be5c` và release `1791698417659000` trên Firebase.
Artifact trước đã đối chiếu entry/SHA-256 và lưu local ở `.tmp/hosting-before-security-baseline-20261012/`;
metadata ở `.tmp/hosting-before-security-baseline-20261012.json`. Không chứa credential.
Khi có sự cố, có thể phát hành lại version cũ từ lịch sử Firebase Hosting hoặc dùng artifact đã lưu;
không cần hoàn tác Functions/dữ liệu. Chưa thực hiện rollback; không ghi nhận lỗi render/asset hay
CSP chặn nghiệp vụ. Các sự kiện mạng WebKit ở trên được giữ nguyên trong báo cáo.

## Bản live trước đợt phát hành này

- Source `7e5fd7d85151c533f90ef261a7286b1d844ba166` (PR #62), phát hành 11/10/2026.
- Hosting version `9f05728017a1be5c`, release `1791698417659000`;
  entry `assets/index.D9r3NTEB.module.js`, HTML SHA-256
  `B82081880F1AAAA0410073BD01B3964D817630068484F775C85019DF8A070AF1`.
- Bản cũ hơn `77764f53106be56a` cùng backup `.tmp/hosting-before-session-hardening-20261011/`
  vẫn được giữ lại; không xóa lịch sử release hoặc bản sao lưu.

## Bản vá đã phát hành

- Customer Web giữ Firebase 11.10.0/Firestore 4.8.0; override gRPC 1.14.6 hẹp trong Firestore.
  Đây là giải pháp tạm ngoài range upstream, đã kiểm thử Node transport qua emulator và đưa vào CI;
  không coi là upstream Firebase đã phát hành bản sửa. Browser Firestore vẫn dùng WebChannel.
- CSP enforce baseline chống nhúng trang, base URL ngoài origin và plugin object; không mới chặn
  script/network của Phone Auth, App Check hoặc telemetry.
- Chặn kết quả đồng bộ/check-in/tải tài khoản cũ sau logout, đổi UID hoặc rời trang.
- Dọn timer vòng quay; không cho callback cũ ghi lại phiên khách.
- Dừng phát hành nếu build hoặc đóng gói Hosting thất bại.
- Giữ source Web dùng LF trên Windows để không tái xuất hiện lỗi định dạng sau đổi nhánh.
- Giới hạn Dependabot: một PR cập nhật phiên bản cho mỗi phần; nhóm minor/patch.
  Cảnh báo và PR cập nhật bảo mật không bị tắt hoặc tính vào hạn mức này.
- Web local: 209 unit tests và 57 browser tests PASS; build/lint/typecheck/format PASS.
- CI main browser: 57 PASS, không flaky/skip được báo trong summary.
- Repository/security tests: 29 PASS; Firestore gRPC emulator: 1 PASS; secret scan PASS.
- Shared domain: 17 tests PASS, coverage 100% lines/functions và 98.07% branches.
- Coverage phần vá: 89.76% lines/statements, 80.57% branches, 91.89% functions.

Chủ dự án đã cho phép nhập main và deploy **chỉ Hosting** khi kiểm thử/CI PASS; đã thực hiện đúng phạm vi.

## Dọn GitHub

- Đã đóng đúng 16 PR nâng cấp lớn được chủ dự án duyệt: #9, #41, #42, #45, #46, #47, #49,
  #50, #51, #52, #53, #55, #57, #59, #60, #61; các nhánh tương ứng đã được xác minh không còn.
- Có bản sao lưu Git đầy đủ `.tmp/dependabot-before-prune-20261011.bundle` và danh sách SHA
  `.tmp/dependabot-prune-20261011.json` để phục hồi.
- Nhánh sửa `codex/web-session-hardening` đã merge và được xóa cả remote/local.
- Nhánh `codex/web-security-baseline` đã merge PR #67 và được xóa remote/local sau khi đối chiếu SHA;
  commit/bản vá vẫn được giữ đầy đủ trong lịch sử `main`.
- Snapshot sau dọn: 13 nhánh GitHub gồm `main` và 12 nhánh đề xuất cập nhật được giữ lại.
  Bot có thể thay thế các nhánh này theo lịch; hạn mức mới áp dụng PR phiên bản mới, không xóa
  cảnh báo bảo mật và không tự merge bất kỳ nâng cấp nào.

## Bằng chứng và giới hạn

- [Bản vá phiên khách và Hosting](testing/web-session-hardening.tdd.md).
- [gRPC và CSP baseline: RED/GREEN, phạm vi và giới hạn](testing/web-security-baseline.tdd.md).
- [Dọn Zalo/Botkeep](testing/web-only-retirement.tdd.md).
- [Bằng chứng OTP, tenant, điểm và cooldown trước đây](WEB_CUSTOMER_RELEASE_READINESS.md).
- [Checklist hiện tại](WEB_CUSTOMER_COMPLETION_CHECKLIST.md).

Người dùng đã xác nhận điện thoại kiểm tra App Check thành công và mở lại không cần OTP trong
chat sau đợt 01/10. Đó là bằng chứng thiết bị thật trước đây, không phải lần test mới của bản vá.
Browser tự động từng bị attestation 403/requestStorageAccess; không coi đó là OTP hoặc Auth PASS.
App Check provider ở chế độ theo dõi; enforcement chưa được xác nhận bật và không đổi trong đợt này.

Dependency audit **production Customer Web** ngày 12/10: 0 Critical, 0 High, 0 Moderate, 0 Low.
Không suy rộng kết quả này cho mọi workspace hoặc mọi lỗ hổng chưa được công bố. Không nâng major
Firebase. Chưa chạy lại OTP thật/giao dịch khách trên điện thoại cho release này; CI và bootstrap
reCAPTCHA không thay thế bằng chứng đó.
