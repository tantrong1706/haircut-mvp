# Trạng thái CH Hair Web

Cập nhật ngày 01/10/2026 (Asia/Saigon). Sản phẩm đang vận hành là Web tại
<https://app.chhaircutsalon.cc>.

## Production hiện tại

- Source đã triển khai: `a39e3e4e39ecf232ab7fbea2bf6e4b50bcc2036f`.
- Giữ giao diện khách từ `3fd0f0f`; thêm trang hỗ trợ App Check độc lập.
- Phát hành: 01/10/2026, 17:41 giờ Việt Nam; App Check ở chế độ theo dõi.
- Hosting version: `projects/haircut-c7d12/sites/haircut-c7d12/versions/77764f53106be56a`.
- Hosting release: `projects/haircut-c7d12/sites/haircut-c7d12/channels/live/releases/1790851288216000`.
- Entry: `assets/index.Deo2WmWZ.module.js`; CSS: `assets/index.BVCeo_Y_.css`.
- Phiên bản trước: `62ea2e1fdaf44d42`, release `1790850685253000`.
- Bản đóng gói local trước được giữ tại
  `.tmp/hosting-before-appcheck-monitor-20261001-a39e3e4` để phục hồi khi cần.

Lượt này chỉ deploy Firebase Hosting. Functions, Rules, Auth configuration và Gateway giữ nguyên.

## Kiểm tra App Check ngày 01/10

- [CI bản theo dõi hiện tại: 6/6 PASS](https://github.com/tantrong1706/haircut-mvp/actions/runs/36850286343).
- Chủ dự án xác nhận điện thoại thật hiển thị "Kiểm tra thành công" trên trang hỗ trợ.
- Sau đó chỉ deploy Hosting với site key cho traffic Web; không đổi policy backend.
- Firestore, Storage, Authentication được xác minh `UNENFORCED` trước lượt triển khai này.
- Kiểm thử khởi tạo App Check và customer Auth: 27/27 PASS; secret scan 572 file PASS.
- Live bản theo dõi: Phone entry render được, không tràn ngang. Browser tự động nhận hai
  `requestStorageAccess: Permission denied`, hai exchange HTTP 403 và hai cảnh báo App Check.
  Vì vậy smoke **không đạt tiêu chí zero-console-error**, không tính attestation tự động là PASS.
- Chưa xác nhận khôi phục phiên và lịch sử trên điện thoại thật sau bản theo dõi;
  chưa bật enforcement. Đây là gate còn mở, không tuyên bố App Check hoàn tất.

### Bằng chứng bản diagnostic trước khi bật theo dõi

- [CI source triển khai: 6/6 PASS](https://github.com/tantrong1706/haircut-mvp/actions/runs/36849128252).
- 21 unit/component checks và 3 browser checks của trang hỗ trợ PASS;
  18 browser regression checks PASS. Lint, build production và secret scan 571 file PASS.
- Live `/app-check`: HTTPS 200, nút kiểm tra sẵn sàng, không tự attestation.
- Phone entry và các route `/`, `/history`, `/wheel`, `/rewards`, `/account`, `/owner`, `/staff`
  render được trong browser chưa đăng nhập; không page/console/asset error.
- Tại bản diagnostic, site key công khai chỉ có trong chunk trang hỗ trợ; traffic thường chưa bật.
- Xem [rollout và các gate](APPCHECK_ROLLOUT.md) để phân biệt các giai đoạn.

## Bằng chứng giao diện khách ngày 30/09

- [CI source triển khai: 6/6 PASS](https://github.com/tantrong1706/haircut-mvp/actions/runs/36719982588).
- Browser: 48 PASS, 3 bài chụp ảnh lịch sử skipped, không có failure.
- Home, Account và Rewards: 15/15 component checks PASS.
- Coverage riêng Home/Account: lines/statements 98.88%, branches 92.03%, functions 100%.
- 14 bản render mobile/desktop: không tràn ngang hoặc lỗi axe nghiêm trọng.
- HTML live khớp entry/CSS của build production; cả hai font Light Latin/Vietnamese tải được.
- HTTPS `/`, `/history`, `/wheel`, `/rewards`, `/account`, `/owner`, `/staff`,
  `/health.json` đều trả về 200.
- Browser live mới: Phone entry render được, heading 300 Light được nạp; các route khách
  hiển thị cổng khách, owner/staff hiển thị cổng quản lý; không có page error, console error
  hoặc request asset cùng origin thất bại trong lượt kiểm tra.
- Source sạch, không có secret trong thay đổi; build test/production, lint, format và CSP sync PASS.

Kiểm tra live ở lượt này dùng browser chưa đăng nhập và không gửi OTP hoặc tạo yêu cầu điểm thật.
Luồng có dữ liệu được kiểm tra trong automation. Bằng chứng Phone OTP thật, points, history và
cooldown từ lượt Web trước vẫn được giữ trong
[Web release readiness](WEB_CUSTOMER_RELEASE_READINESS.md).

## Giao diện đang dùng

Trang khách dùng nét chữ Light/Regular, icon mảnh, thẻ điểm gọn hơn và bố cục Home hai cột
trên desktop. Account nhóm lại điểm, thông tin thiết bị và đăng xuất. Đây là thay đổi trình bày;
không bổ sung API, data-loading hoặc nghiệp vụ mới.

Khách dùng Firebase Phone Auth; QR chọn đúng chi nhánh; khách gửi yêu cầu và nhân viên xác nhận.
Cooldown hai giờ theo khách/salon được giữ ngầm. Điểm, identity và tenant isolation do server quyết định.
Xem [bằng chứng giao diện](testing/web-barber.tdd.md).

## Nhánh

- `codex/web-primary`: nhánh Web đang phát triển và lưu source production.
- `codex/zalo-archive`: lưu Zalo Version 24 tại `5ae0ff21200ae4d32b07e9f588ee6b7797c35d0e`.
- `release/web-customer-platform-20260921`: giữ lịch sử release Web trước.
- Main chưa được merge. Lượt này không deploy, submit review hoặc Publish Zalo.

## Giới hạn cần ghi đúng

App Check chưa enforcement; frontend provider chưa bật lại sau lỗi attestation/throttle
đã ghi nhận. Coverage service chung vẫn dưới ngưỡng: lines/statements 68.53%, functions 69.38%,
branches 77.65%; không hạ ngưỡng và không trình bày coverage hai page như coverage toàn app.

Các dependency advisories trong readiness cần được xử lý theo phạm vi riêng. Automation và
kiểm tra browser khách mới không thay thế việc kiểm tra phiên đã đăng nhập trên điện thoại của chủ dự án.
