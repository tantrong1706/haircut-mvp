# CH Hair — Web quản lý khách và tích điểm salon

[Mở ứng dụng](https://app.chhaircutsalon.cc/) · [Chủ salon](https://app.chhaircutsalon.cc/owner) · [Nhân viên](https://app.chhaircutsalon.cc/staff)

CH Hair chạy trên trình duyệt điện thoại và máy tính, dùng **Firebase** cho Hosting, đăng nhập,
API, dữ liệu và ảnh. Không cần Zalo Mini App, tài khoản tester, VPS hay Botkeep.

Nhánh chính: **[`main`](https://github.com/tantrong1706/haircut-mvp/tree/main)** — bản Web/Firebase hiện tại.
Thay đổi mới dùng nhánh ngắn hạn `codex/<noi-dung>`, kiểm tra CI rồi nhập vào `main` và xóa nhánh đã xong.
Push `main` chạy GitHub Actions **Build Web** và **CodeQL**, không tự deploy production.

## Luồng tại salon

1. Khách quét QR **của chi nhánh**. Không có bước chọn lại chi nhánh.
2. Lần đầu xác thực số điện thoại bằng OTP. Lần sau, cùng trình duyệt còn phiên hợp lệ sẽ nhớ đăng nhập.
3. Khách bấm **Yêu cầu tích điểm**; nhân viên đúng chi nhánh xác nhận và có thể chụp/lưu ảnh theo sự đồng ý của khách.
4. Điểm được cộng một lần. Trong hai giờ sau khi cộng điểm, nút yêu cầu mới được ẩn; không hiện đồng hồ đếm ngược.
5. Khách xem điểm, lịch sử, ảnh và quà. Khi đủ điều kiện, khách quay thưởng; nhân viên xác nhận dùng quà.

Nhiều khách quét cùng QR vẫn có yêu cầu riêng. Điểm, lịch sử và quà tách theo khách/salon;
backend quyết định danh tính, quyền truy cập, cooldown và kết quả vòng quay.
Không tự gộp hồ sơ hoặc đổi ID khách khi dọn mã nguồn.

Đăng nhập không chuyển theo giữa Safari, Chrome và trình duyệt trong Messenger.
Đăng xuất, xóa dữ liệu trình duyệt, đổi thiết bị hoặc phiên hết hiệu lực có thể yêu cầu OTP lại.
QR phải do hệ thống ký; **không thêm `env=TESTING` hoặc số version Zalo** vào QR Web.

## Cấu trúc

| Thư mục                   | Vai trò                                                   |
| ------------------------- | --------------------------------------------------------- |
| `customer-web/`           | Web/PWA khách, trang chủ salon và nhân viên               |
| `firebase/functions/`     | API xác thực, QR, giao dịch điểm, ảnh, vòng quay và quà   |
| `firebase/`               | Firestore/Storage Rules, indexes và Hosting               |
| `apps/admin-web/`         | Cổng quản trị hệ thống                                    |
| `apps/manager-mobile/`    | Source Manager dùng chung; phạm vi hiện tại là Web bundle |
| `packages/client-domain/` | Kiểu dữ liệu và tiện ích dùng chung                       |
| `packages/contracts/`     | Hợp đồng API dùng chung client/backend                    |

Frontend không còn SDK, đăng nhập, build hoặc công cụ review Zalo. Một số kiểu dữ liệu cũ,
endpoint/backend và mã Gateway được giữ để bảo toàn tương thích với dịch vụ đã triển khai;
chúng không phải luồng đăng nhập của khách Web. Không xóa Functions, secrets hay dữ liệu live
chỉ vì tên chứa “Zalo”. Mã và tài liệu đã gỡ có thể phục hồi từ lịch sử Git.

## Chạy local

Dùng **Node.js 22**, npm và **Java 21** khi chạy Firebase Emulator. Không cần nâng dependency
để cài dự án; dùng lockfile đã commit.

```powershell
cd customer-web
npm ci
npm run dev -- --host 127.0.0.1
```

Tham khảo `.env.example` và `.env.production.example`; cấu hình riêng ở `.env.local` hoặc
`.env.production.local` được Git ignore. Mọi biến `VITE_*` đều công khai trong bundle:
**không đặt mật khẩu, service-account key, HMAC secret hoặc token bí mật vào đó**.

Production bắt buộc `VITE_APP_ENV=production`, `VITE_FUNCTION_WRITE_MODE=required` và cấu hình
Firebase đúng project. Build production xuất `customer-web/www/`; build test xuất `www-test/`.
Fixture OTP/dữ liệu tự động chỉ hoạt động trong môi trường test được bật rõ ràng.

## Kiểm tra trước khi push

```powershell
# Trong customer-web/
npm run check
npm run test:domain
npm run test:e2e

# Từ thư mục gốc
node --test test/*.test.mjs
node scripts/check-secrets.mjs
node scripts/sync-csp.mjs --check

npm --prefix firebase/functions run check
npm --prefix firebase/functions run test:rules
npm --prefix firebase/functions run test:integration
npm --prefix apps/admin-web run check
npm --prefix apps/manager-mobile run check
```

Rules/integration chạy bằng Emulator project `demo-haircut`, không dùng dữ liệu thật.
GitHub Actions kiểm tra Customer Web, Firebase Functions/Rules, Admin, Manager Web,
luồng trình duyệt và an toàn repository. Test xanh không thay thế kiểm tra thiết bị thật.

## Firebase và triển khai

Project hiện tại: `haircut-c7d12`. Domain khách: `app.chhaircutsalon.cc`.
Firebase vẫn là nền tảng vận hành; không chuyển DNS hoặc tải source lên Botkeep.

**Source trên GitHub và phiên bản đang phục vụ có thể khác nhau.** Dọn source/push không đồng
nghĩa đã deploy. Xem [trạng thái phát hành](docs/RELEASE_STATUS.md) và kiểm tra Hosting version
trước từng lần phát hành. Thay đổi frontend chỉ triển khai Hosting sau khi được phép;
không triển khai Functions kèm theo nếu không cần.

App Check Web đã có provider và được bật ở chế độ giám sát trong lần kiểm tra vận hành gần nhất;
enforcement chưa được xác nhận bật. Không tự bật enforcement trong một lần dọn repository.

## Tài liệu

- [Hướng dẫn làm việc và giới hạn an toàn](AGENTS.md)
- [Customer Web](customer-web/README.md)
- [Checklist vận hành Web](docs/WEB_CUSTOMER_COMPLETION_CHECKLIST.md)
- [Bằng chứng và điều kiện phát hành](docs/WEB_CUSTOMER_RELEASE_READINESS.md)
- [Xử lý sự cố](docs/incident-runbook.md)

Không commit OTP, token, mật khẩu, QR signing secret, dữ liệu khách hoặc output build.
Tài liệu kiểm thử cũ phản ánh thời điểm ghi nhận, không phải cam kết rằng mọi gate hiện tại đã PASS.
