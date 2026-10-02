# CH Hair — Web

Sản phẩm đang phát triển là **Web app** tại <https://app.chhaircutsalon.cc>.
Khách dùng Firebase Phone Auth; chủ salon và nhân viên dùng tài khoản quản lý trên Web.
Phạm vi này được chủ dự án xác nhận ngày 28/09/2026.

## Nhánh làm việc

| Nhánh                                    | Vai trò                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| `codex/web-primary`                      | Nhánh phát triển Web hiện tại, tạo từ release đã PASS CI tại `06e7e1a` |
| `codex/zalo-archive`                     | Lưu bản Zalo Version 24 tại `5ae0ff2`; không nằm trong roadmap Web     |
| `release/web-customer-platform-20260921` | Giữ lịch sử triển khai Web đã kiểm thử để đối chiếu/khôi phục          |

Xem [AGENTS.md](AGENTS.md) trước khi tiếp tục công việc. Tài liệu xét duyệt Zalo và các script release
Zalo cũ là tài liệu lịch sử. Web không cần Testing Version, tài khoản tester hay xét duyệt Mini App.

## Luồng sử dụng

1. Khách quét QR Web của chi nhánh. QR xác định đúng salon và chi nhánh trên server.
2. Lần đầu khách xác thực số điện thoại bằng OTP; cùng trình duyệt còn phiên hợp lệ sẽ nhớ đăng nhập.
3. Khách bấm **Yêu cầu tích điểm**. Nhân viên đúng chi nhánh kiểm tra và xác nhận, có thể lưu ảnh của
   lần cắt theo consent.
4. Điểm và lịch sử được cập nhật đúng một lần. Trong hai giờ sau khi cộng điểm, Web ẩn nút yêu cầu
   mới và không hiển thị đếm ngược; khách vẫn xem điểm, lịch sử và quà.
5. Nhiều khách có thể quét cùng QR đồng thời. Yêu cầu, số điểm và cooldown tách theo khách/salon.
6. Khách đủ điểm có thể quay và nhận quà. Nhân viên kiểm tra mã hoặc QR quà và xác nhận sử dụng.

Identity là Firebase UID đã xác thực. Backend không tự gộp tài khoản theo số điện thoại; profile,
điểm, lịch sử và quà luôn thuộc đúng salon. Firestore client không được ghi dữ liệu nghiệp vụ trực tiếp.

## Các trang dùng tại salon

- Khách: <https://app.chhaircutsalon.cc/>
- Chủ salon: <https://app.chhaircutsalon.cc/owner>
- Nhân viên: <https://app.chhaircutsalon.cc/staff>
- Quyền riêng tư: <https://app.chhaircutsalon.cc/privacy>
- Điều khoản: <https://app.chhaircutsalon.cc/terms>

QR khách phải do backend ký cho đúng chi nhánh. Không thêm `env=TESTING` hay Zalo version vào QR Web.

## Source và môi trường

- `customer-web/`: workspace **Customer Web** và UI vận hành, đổi tên từ `zalo-mini-app/`.
  Manager dùng adapter cho các dịch vụ Firebase; kiểu dữ liệu và tiện ích thuần nằm ở package chung.
- `firebase/functions/`: API có Firebase Auth, phân quyền, ký QR và transaction nghiệp vụ.
- `apps/manager-mobile/`: source Manager dùng chung; CI hiện kiểm tra web bundle.
- `apps/admin-web/`: cổng quản trị Web.
- `packages/contracts/`: contracts chung; `firebase/`: Rules, indexes và cấu hình Hosting.
- `packages/client-domain/`: kiểu dữ liệu, quy tắc vòng quay và tiện ích lưu trữ dùng chung.

Dùng Node.js 22, Java 21 cho Firebase Emulator và Firebase CLI cho deployment. Cài bằng `npm ci`
trong từng workspace có thay đổi; giữ lockfile đã commit.

## Kiểm tra

Customer Web (build mặc định không gọi ZMP hay gate review):

```powershell
npm --prefix customer-web ci
npm --prefix customer-web run check
npm --prefix customer-web run test:e2e
```

Backend và Rules:

```powershell
npm --prefix firebase/functions ci
npm --prefix firebase/functions run check
npm --prefix firebase/functions run build
npm --prefix firebase/functions run test:rules
npm --prefix firebase/functions run test:integration
```

Các test emulator dùng project `demo-haircut`. Trên Windows, Java 21 có thể cần thư mục socket tạm
ngắn; hướng dẫn kiểm thử thực tế nằm trong [release evidence](docs/WEB_CUSTOMER_RELEASE_READINESS.md).

GitHub workflow **Build Web** chạy trên push `codex/web-primary`, PR vào main hoặc manual dispatch.
Nó kiểm tra Customer Web, Functions/Rules, Manager Web, Admin, browser và repository/secret scan.
Các test tương thích cũ vẫn được giữ để phát hiện tác dụng phụ của module dùng chung.

## Build và triển khai Web

`npm --prefix customer-web run build` xuất bản Web vào `customer-web/www/`; test build dùng
`www-test/`. Không còn yêu cầu Mini App ID hay đồng bộ `app-config.json` cho Web.

Frontend production lấy cấu hình Firebase từ file local bị ignore
`customer-web/.env.production.local` hoặc biến môi trường. Bắt buộc
`VITE_APP_ENV=production`, `VITE_FUNCTION_WRITE_MODE=required` và cấu hình Firebase đúng project.
Các biến hỗ trợ là `VITE_SUPPORT_EMAIL`, `VITE_SUPPORT_PHONE`; không ghi secret vào build.

Sau khi kiểm tra đúng commit và có quyền triển khai, đóng gói output vào `firebase/public`, chụp
Hosting version trước deployment và deploy riêng Hosting nếu chỉ frontend thay đổi:

```powershell
firebase deploy --project haircut-c7d12 --config firebase/firebase.json --only hosting
```

Nếu backend thay đổi, xác định đúng danh sách Functions cần triển khai. Giữ runtime env/secret
bindings và kế hoạch rollback. Các script tổng hợp có gate Zalo cũ không phải lệnh release mặc định
của nhánh Web. Không tự merge main, xoay secret hoặc xóa dịch vụ production khi dọn source.

App Check đang đăng ký nhưng enforcement OFF; frontend production hiện chưa khởi tạo provider
sau lỗi attestation/throttle đã quan sát. Đây là hạng mục Web riêng cần xác minh token thực trước khi
bật enforcement, không phải điều kiện để quay lại làm Mini App.

## Bằng chứng và vận hành

- [Trạng thái phát hành hiện tại](docs/RELEASE_STATUS.md)
- [Web release readiness](docs/WEB_CUSTOMER_RELEASE_READINESS.md)
- [Checklist luồng Web](docs/WEB_CUSTOMER_COMPLETION_CHECKLIST.md)
- [Bằng chứng kiểm thử](docs/testing/web-customer-platform.tdd.md)
- [Xử lý sự cố](docs/incident-runbook.md)

Token, OTP, số điện thoại đầy đủ, mật khẩu và QR signing secret không được đưa vào Git, log,
screenshot hoặc monitoring. Generated output cũng không được commit.
