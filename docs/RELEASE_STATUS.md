# Trạng thái CH Hair Web

Cập nhật ngày 11/10/2026 (Asia/Saigon). Nhánh chính là `main`; sản phẩm là Web trên Firebase tại
<https://app.chhaircutsalon.cc>. Nhánh Zalo và các quy trình xét duyệt không còn là luồng phát hành.

## Production hiện tại — đã phát hành

- Source: `7e5fd7d85151c533f90ef261a7286b1d844ba166` (merge PR #62).
- Chỉ deploy Firebase Hosting site `haircut-c7d12`; hoàn tất 11/10/2026 lúc 13:00:17 giờ Việt Nam.
- Hosting version: `9f05728017a1be5c`; release `1791698417659000`.
- Entry: `assets/index.D9r3NTEB.module.js`.
- HTML custom domain khớp SHA-256 của artifact đã upload:
  `B82081880F1AAAA0410073BD01B3964D817630068484F775C85019DF8A070AF1`.
- Header live: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.
- [CI main: 6/6 PASS](https://github.com/tantrong1706/haircut-mvp/actions/runs/38116239348).
- [CodeQL main: PASS](https://github.com/tantrong1706/haircut-mvp/actions/runs/38116239347).
- [Lighthouse PR: PASS](https://github.com/tantrong1706/haircut-mvp/actions/runs/38116012430).

Không deploy Functions, Firestore/Storage Rules hoặc indexes; không đổi Auth, App Check enforcement,
Gateway, Cloudflared hoặc dữ liệu khách. Commit ghi báo cáo sau release không thay source đang chạy.

## Hậu kiểm live

- Chromium desktop: 10 route mở đúng giao diện/cổng đăng nhập, HTTP 200, không tràn ngang;
  không ghi nhận lỗi page, console hoặc asset trong lượt kiểm tra.
- WebKit mobile: 10 route mở đúng giao diện/cổng đăng nhập, không tràn ngang và không page/asset error.
  Console vẫn có cảnh báo CSP Report-Only (76 trong lượt lặp cuối), nên **không đạt zero-warning**.
- Lượt WebKit trước đó có hai console error chưa phân loại; không tái hiện ở lần chạy chẩn đoán lặp.
  Không che giấu lần thất bại này hoặc khẳng định mọi console/network error đã được loại bỏ.
- Các route được kiểm tra: `/checkin`, `/`, `/history`, `/wheel`, `/rewards`, `/account`,
  `/privacy`, `/terms`, `/owner`, `/staff`.
- Browser kiểm tra mới, chưa đăng nhập: không gửi OTP, không gọi check-in/quay/đổi quà thật.
  Hiển thị cổng đăng nhập không phải bằng chứng đã xem lịch sử riêng của khách trên production.

## Rollback

Giữ version cũ `77764f53106be56a` và release `1790851288216000` trên Firebase.
Artifact cũ đã đối chiếu entry và được lưu local ở `.tmp/hosting-before-session-hardening-20261011/`;
metadata riêng ở `.tmp/hosting-before-session-hardening-20261011.json`. Không chứa credential.
Khi có sự cố, có thể phát hành lại version cũ từ lịch sử Firebase Hosting hoặc dùng artifact đã lưu;
không cần hoàn tác Functions/dữ liệu. Chưa thực hiện rollback vì không có lỗi render/asset phải hoàn tác.

## Bản live trước đợt phát hành này

- HTML được kiểm tra ngày 11/10 vẫn dùng `assets/index.Deo2WmWZ.module.js`.
- Source ghi nhận của bản này: `a39e3e4e39ecf232ab7fbea2bf6e4b50bcc2036f`.
- Hosting version ghi nhận: `77764f53106be56a`; release `1790851288216000` (01/10/2026).
- HTTPS `/`, `/history`, `/wheel`, `/rewards`, `/account`, `/owner`, `/staff`, `/health.json`: 200.
- Kiểm tra trên là đọc HTML, không gửi OTP và không tạo dữ liệu khách.

## Bản vá đã phát hành

- Chặn kết quả đồng bộ/check-in/tải tài khoản cũ sau logout, đổi UID hoặc rời trang.
- Dọn timer vòng quay; không cho callback cũ ghi lại phiên khách.
- Dừng phát hành nếu build hoặc đóng gói Hosting thất bại.
- Giữ source Web dùng LF trên Windows để không tái xuất hiện lỗi định dạng sau đổi nhánh.
- Giới hạn Dependabot: một PR cập nhật phiên bản cho mỗi phần; nhóm minor/patch.
  Cảnh báo và PR cập nhật bảo mật không bị tắt hoặc tính vào hạn mức này.
- Web local: 209 unit tests và 51 browser tests PASS; build/lint/typecheck PASS.
- Coverage phần vá: 89.76% lines/statements, 80.57% branches, 91.89% functions.

Chủ dự án đã cho phép nhập main và deploy **chỉ Hosting** khi kiểm thử/CI PASS; đã thực hiện đúng phạm vi.

## Dọn GitHub

- Đã đóng đúng 16 PR nâng cấp lớn được chủ dự án duyệt: #9, #41, #42, #45, #46, #47, #49,
  #50, #51, #52, #53, #55, #57, #59, #60, #61; các nhánh tương ứng đã được xác minh không còn.
- Có bản sao lưu Git đầy đủ `.tmp/dependabot-before-prune-20261011.bundle` và danh sách SHA
  `.tmp/dependabot-prune-20261011.json` để phục hồi.
- Nhánh sửa `codex/web-session-hardening` đã merge và được xóa cả remote/local.
- Snapshot sau dọn: 13 nhánh GitHub gồm `main` và 12 nhánh đề xuất cập nhật được giữ lại.
  Bot có thể thay thế các nhánh này theo lịch; hạn mức mới áp dụng PR phiên bản mới, không xóa
  cảnh báo bảo mật và không tự merge bất kỳ nâng cấp nào.

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
