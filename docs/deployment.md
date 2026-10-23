# Triển khai CH Hair Web trên Firebase

Xem [trạng thái phát hành](RELEASE_STATUS.md) trước khi chạy bất kỳ lệnh deploy nào.
Merge/push source không tự cho phép phát hành production.

## Cấu hình đúng sản phẩm

- Customer Web dùng cấu hình mẫu trong customer-web/.env.production.example; file local bị ignore.
- VITE_* là công khai: không đặt password, HMAC key, token hoặc service-account key trong đó.
- Khách dùng Firebase Phone Auth. Owner/staff dùng Email/Password; domain app.chhaircutsalon.cc
  phải nằm trong Auth Authorized Domains.
- CUSTOMER_WEB_CHECKIN_URL trỏ tới https://app.chhaircutsalon.cc/checkin.
- QR_SIGNING_SECRET giữ trong Secret Manager. Các binding của endpoint cũ giữ nguyên.
- App Check enforcement chỉ thay đổi sau phê duyệt riêng và kiểm tra khách/owner/staff/Admin.
- Admin dùng Hosting site riêng; không ghi đè Customer Web.
- Không chạy quy trình Testing/review/native trong lần phát hành Web.
- Bản tương thích cũ được mô tả tại [Legacy compatibility](LEGACY_COMPATIBILITY.md).

## Chuẩn bị

1. Chọn commit sạch, kiểm tra đúng remote/main và scope được chủ dự án cho phép.
2. Chạy lint/types/tests/build cho các workspace liên quan và kiểm tra CI đúng SHA.
3. Quét secret, kiểm tra CSP đồng bộ; không nâng dependency lớn trong lúc release.
4. Lưu Hosting version hiện tại, source/config Functions liên quan và Rules cũ ngoài Git ở vị trí
   hạn chế quyền. Chỉ export/di chuyển dữ liệu khi có thay đổi dữ liệu được phê duyệt.
5. Ghi rõ mục tiêu deploy. Không dùng deploy toàn bộ Functions cho thay đổi một API hoặc giao diện.

## Thứ tự tương thích

Phát hành API backend cần thiết trước, client tương thích sau, rồi Rules mới phụ thuộc client/API đó.
Đặc biệt luồng ảnh riêng tư cần begin/finalize/private-read API trước khi chặn client đọc ảnh trực tiếp.
Không triển khai Rules yêu cầu grant mới khi API cấp grant chưa hoạt động.

Nếu có indexes/schema migration, chuẩn bị kế hoạch riêng; không suy ra quyền migration từ quyền deploy.
Giữ khả năng khôi phục, không hạ Rules để mở ảnh công khai khi gặp lỗi.

## Customer Hosting

Sau khi được phép deploy Hosting, từ repo root:

    .\scripts\deploy-hosting.ps1

Script build Customer Web và chỉ phát hành site haircut-c7d12. Không deploy Functions hoặc Admin.
Source output là customer-web/www/, được đóng gói vào firebase/public/. Build lỗi phải dừng deploy.
Không sửa trực tiếp output build rồi bỏ qua source.

## API, Rules và Admin

Dùng Firebase CLI với project haircut-c7d12, config firebase/firebase.json và danh sách --only
đúng tên Functions đã được duyệt. Kiểm tra từng function ACTIVE sau phát hành.
Storage Rules, Firestore Rules và indexes là các mục tiêu riêng; không tự deploy kèm.

Admin có [quy trình riêng](ADMIN_OPERATIONS.md) và [trạng thái riêng](ADMIN_RELEASE_STATUS.md).
Không đổi quyền Admin hoặc bật callable quản trị cũ trong một đợt sửa customer Web.

## Hậu kiểm

- HTTPS và HTML/assets trùng artifact mới trên domain chính.
- /checkin, /history, /wheel, /rewards, /account, /owner, /staff, /privacy và /terms tải được.
  HTTP 200 chỉ xác nhận trang tải được, không chứng minh luồng đã đăng nhập.
- Kiểm tra phiên khách, phiên quản lý và phân quyền tenant/branch.
- Kiểm tra ghi chú/ảnh trước duyệt, đúng một điểm, cooldown và retry idempotent.
- Dùng dữ liệu giả riêng được cho phép; dọn đúng account/document/object sau test.
- Ghi lỗi console/network và giới hạn chưa kiểm tra; không gửi OTP hoặc sửa điểm khách thật
  chỉ để có một báo cáo PASS.

## CSP và khôi phục

Nguồn policy ở config/content-security-policy.txt; chạy node scripts/sync-csp.mjs --check.
Baseline đang enforce base-uri, object-src và frame-ancestors. Đây không phải script/XSS
allowlist đầy đủ. Không tự siết mạng/script của Firebase OTP trong lần dọn tên.

Hosting có thể chọn release cũ đã lưu. Functions chỉ rollback nhóm liên quan, tương thích dữ liệu.
Không phục hồi Rules theo cách mở quyền. Không import Firestore production hoặc thu hồi hàng loạt
link ảnh khách cũ nếu chưa có phê duyệt và kế hoạch riêng.

Xem [runbook](incident-runbook.md), [vận hành](PRODUCTION_OPERATIONS.md) và
[custom domain](CUSTOM_DOMAIN_APP_CLOUDFLARE.md).
