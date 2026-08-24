# HAIRCUT

HAIRCUT là nền tảng chăm sóc và giữ chân khách hàng dành cho salon tóc. Hệ thống kết nối trải nghiệm khách trên Zalo Mini App với quy trình vận hành của nhân viên và chủ salon: check-in bằng QR, quản lý hàng chờ, duyệt điểm, lưu lịch sử cắt tóc, quay thưởng và đổi mã quà.

Zalo Mini App dành cho khách được phát hành chính thức với tên **CH Haircut Salon**, Mini App ID `2038116772828167300`. Tên HAIRCUT trong repository tiếp tục chỉ nền tảng kỹ thuật, Manager và Admin; không phải tên Mini App gửi Zalo xét duyệt.

## Vai trò

- **Khách hàng:** quét QR, xác nhận thông tin Zalo, tạo lượt cắt, theo dõi trạng thái, xem điểm và lịch sử, quay thưởng và quản lý mã quà.
- **Nhân viên:** đăng nhập bằng Firebase Auth, chỉ xem hàng chờ tại chi nhánh được phân công, nhận khách, ghi chú kiểu tóc, lưu ảnh khi khách đồng ý và gửi yêu cầu cộng điểm.
- **Chủ salon:** quản lý toàn salon và các chi nhánh, nhân viên, QR, khách hàng, ảnh, yêu cầu điểm, cấu hình vòng quay, mã quà và số liệu vận hành.

## Luồng nghiệp vụ

1. Mỗi salon có đúng **một QR chung**; mỗi chi nhánh có đúng **một QR riêng**.
2. QR salon mở màn hình chọn chi nhánh. Nếu chỉ có một chi nhánh đang hoạt động, hệ thống tự chọn; QR chi nhánh mở trực tiếp đúng tên và địa chỉ chi nhánh.
3. Khách xác nhận thông tin và tạo lượt. Khách hàng, điểm và quà dùng chung trong toàn salon; hàng chờ và lượt phục vụ gắn với `branchId`.
4. Nhân viên của đúng chi nhánh nhận khách, ghi chú và gửi một yêu cầu cộng điểm sau khi phục vụ.
5. Chủ salon duyệt hoặc từ chối yêu cầu. Khi được duyệt, điểm và lịch sử cắt tóc của khách được cập nhật.
6. Khách dùng điểm để quay vòng quay. Kết quả có quà tạo mã đổi quà; kết quả `no_prize` chỉ ghi nhận lượt quay và không tạo mã.

Trạng thái lượt cắt đi theo chuỗi `waiting → serving → pending_approval → completed/cancelled`. Cloud Functions kiểm tra quyền, chi nhánh, trạng thái và tính idempotent trước mọi thao tác ghi quan trọng.

## Kiến trúc

| Thành phần | Công nghệ                                  | Trách nhiệm                                               |
| ---------- | ------------------------------------------ | --------------------------------------------------------- |
| Khách hàng | React, TypeScript, Vite, Zalo Mini App SDK | QR, check-in, điểm, lịch sử, vòng quay và quà             |
| Manager    | React, TypeScript, Capacitor               | Ứng dụng iOS/Android chung cho owner và staff              |
| Admin      | React, TypeScript, Vite                    | Cổng riêng cho quản trị viên hệ thống                      |
| Hosting    | Firebase Hosting                           | Phục vụ web app, Privacy, Terms và fallback SPA           |
| Backend    | Cloud Functions for Firebase               | Xác minh Zalo, phân quyền và xử lý transaction nghiệp vụ  |
| Dữ liệu    | Cloud Firestore                            | Salon, chi nhánh, khách, hàng chờ, điểm, lịch sử và quà   |
| Tệp        | Firebase Storage                           | Avatar và ảnh kiểu tóc theo Rules                         |
| Đăng nhập  | Firebase Auth                              | Email/Password cho chủ salon và nhân viên                 |

Khách không ghi dữ liệu nghiệp vụ trực tiếp vào Firestore. Owner/staff lấy `salonId` và quyền từ hồ sơ `users/{uid}`, không tin cậy tham số URL. QR dùng token ký ở backend; Firestore chỉ lưu phiên bản QR, không lưu token thô. Ba client dùng contract chung và cùng backend nhiều tenant.

## Cấu trúc repository

```text
.github/          CI, CodeQL, Lighthouse và Dependabot
apps/             HAIRCUT Admin Web và HAIRCUT Manager
docs/             Kiến trúc, dữ liệu, API, migration, vận hành và xét duyệt
firebase/         Firestore Rules/indexes, Storage Rules và Cloud Functions
ios-app/          Source iOS cũ được giữ làm tài liệu tham khảo
packages/         Contract runtime/TypeScript dùng chung
scripts/          Thiết lập, kiểm tra, emulator và triển khai có kiểm soát
zalo-mini-app/    Ứng dụng khách trên web/Zalo và UI vận hành được Manager tái sử dụng
```

## Yêu cầu môi trường

- **Node.js 22** và npm đi kèm. Đây là runtime của Functions và GitHub Actions.
- **Java 21** khi chạy Firebase Emulator cho Firestore/Storage.
- **Firebase CLI** để chạy emulator và deploy Firebase.
- **Zalo Mini App CLI (`zmp`)** đã đăng nhập khi deploy bản Testing.
- Git; PowerShell 7 được khuyến nghị trên Windows. Android Studio dùng cho AAB; Mac/Xcode bắt buộc cho iOS/TestFlight.

## Cài dependency

Repository có bốn workspace npm độc lập; luôn dùng lockfile đã commit.

```powershell
cd zalo-mini-app
npm ci

cd ..\firebase\functions
npm ci

cd ..\..\apps\admin-web
npm ci

cd ..\manager-mobile
npm ci
```

Không chạy `npm audit fix --force` hoặc tự nâng major dependency nếu chưa kiểm tra tương thích Firebase/Zalo.

## Phát triển và kiểm tra

### Frontend/Zalo Mini App

```powershell
cd zalo-mini-app
npx tsc --noEmit       # typecheck
npm run lint           # ESLint
npm run test:run       # unit test
npm run build:zmp      # build web, đồng bộ và kiểm tra app-config.json
```

### Cloud Functions

```powershell
cd firebase\functions
npm run typecheck
npm run lint
npm run test:unit
npm run build
```

### Firestore và Storage Rules

Rules test chạy hoàn toàn trên project emulator `demo-haircut`, không truy cập dữ liệu production:

```powershell
cd firebase\functions
npm run test:rules
npm run test:integration
```

Hai lệnh trên tự khởi động emulator và fail nếu thiếu host/project test. Script hậu tố
`:emulator` chỉ dành cho CI hoặc khi đã chạy bên trong `firebase emulators:exec`.

Kiểm tra nhanh toàn repository:

```powershell
.\scripts\check.ps1
```

Kiểm tra đầy đủ gồm emulator, browser E2E, Zalo review readiness và Capacitor sync:

```powershell
.\scripts\check.ps1 -Full
```

Kết quả đầy đủ tạo `.tmp/release-readiness.json` bị Git bỏ qua và gắn với đúng
commit SHA. Mục `BLOCKED`/`NOT RUN` không được tính là `PASSED`.

### Admin Web và Manager

```powershell
cd apps\admin-web
npm run check

cd ..\manager-mobile
npm run check       # typecheck, lint, format baseline, unit và build
npm run sync        # build và cap sync Android/iOS
```

Manager production không được dùng đồng thời `@capacitor/push-notifications` và Firebase Messaging. Source hiện dùng FCM token cho cả Android/iOS và bridge App Check native vào Firebase JS SDK.
CI có job riêng cho web bundle, Android Gradle và iOS Simulator không ký. Manager dùng `.env` riêng trong `apps/manager-mobile`; xem [ranh giới tách Manager](docs/MANAGER_EXTRACTION.md).

## Biến môi trường và secrets

Chỉ ghi **tên biến** trong tài liệu/repository. Giá trị thật phải nằm trong file local bị Git bỏ qua, Firebase Secret Manager hoặc GitHub Secrets.

### Frontend (`zalo-mini-app`)

- Firebase: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID`, `VITE_FIREBASE_REGION`.
- Zalo và runtime: `VITE_ZALO_MINI_APP_ID`, `VITE_FUNCTION_WRITE_MODE`, `VITE_APP_ENV`, `VITE_FIREBASE_APP_CHECK_SITE_KEY`, `VITE_ADMIN_URL`, `VITE_APP_VERSION`.
- Hỗ trợ và giám sát: `VITE_SUPPORT_EMAIL`, `VITE_SUPPORT_PHONE`, `VITE_MONITORING_DISABLED`, `VITE_SENTRY_DSN`, `VITE_SENTRY_TRACES_SAMPLE_RATE`, `VITE_SENTRY_REPLAY_SAMPLE_RATE`, `VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE`.
- Source map khi deploy: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` trong môi trường deploy, không dùng tiền tố `VITE_`.

Production bắt buộc `VITE_FUNCTION_WRITE_MODE=required`. Cấu hình bằng biến môi
trường CI hoặc file local `zalo-mini-app/.env.production.local`; không commit
`.env.production`. Tham khảo
[`zalo-mini-app/.env.production.example`](zalo-mini-app/.env.production.example).

### Cloud Functions

- Biến cấu hình: `ZALO_MINI_APP_ID`, `ZALO_APP_ID`, `REQUIRE_ZALO_APP_CHECK`, `ENFORCE_APP_CHECK`, `ADMIN_WRITE_OPERATIONS_ENABLED`.
- Firebase Secret Manager: `ZALO_APP_SECRET`, `ZALO_OPEN_API_KEY`, `QR_SIGNING_SECRET`.

Admin Web dùng `VITE_FIREBASE_APP_CHECK_SITE_KEY`; `VITE_APP_CHECK_DEBUG_TOKEN` chỉ được dùng local. Bản Admin đầu tiên là read-only và `ADMIN_WRITE_OPERATIONS_ENABLED` phải để trống/`false`.

Không đặt App Secret, Open API Key, QR signing secret, access token, mật khẩu, tài khoản kiểm thử hoặc dữ liệu khách hàng trong Git, log hay ảnh chụp màn hình.

## URL công khai

- Khách hàng (sau khi Firebase báo `Connected`): <https://app.chhaircutsalon.cc>
- Firebase URL mặc định, luôn được giữ làm fallback: <https://haircut-c7d12.web.app>
- Chủ salon: <https://app.chhaircutsalon.cc/owner>
- Nhân viên: <https://app.chhaircutsalon.cc/staff>
- Chính sách quyền riêng tư: <https://app.chhaircutsalon.cc/privacy>
- Điều khoản sử dụng: <https://app.chhaircutsalon.cc/terms>
- Zalo Mini App: <https://zalo.me/s/2038116772828167300>
- HAIRCUT Admin: URL riêng được điền sau khi tạo Firebase Hosting site và đặt `VITE_ADMIN_URL`.

Custom domain khách dùng chung Firebase Hosting site `haircut-c7d12`; không thay thế
hai domain mặc định `web.app`/`firebaseapp.com`. Xem checklist DNS, Auth và SSL tại
[`docs/CUSTOM_DOMAIN_APP_CLOUDFLARE.md`](docs/CUSTOM_DOMAIN_APP_CLOUDFLARE.md).

## Triển khai

Không deploy trực tiếp từ working tree chưa kiểm tra. Trước thay đổi schema hoặc Rules, phải tạo Firestore export và đọc hướng dẫn migration/rollback.

### Firebase

```powershell
cd C:\tantrong\haircut-mvp
.\scripts\check.ps1 -Full
node .\scripts\check-secrets.mjs --include-working-tree
.\scripts\check-production-readiness.ps1 -StrictRelease -CheckLiveUrls
.\scripts\deploy-firebase.ps1 -IncludeFunctions -IncludeFirestore -IncludeStorage
```

Deploy script mặc định yêu cầu worktree sạch, branch `main`/`release/*` và
full-suite evidence đúng `HEAD`, sau đó tự chạy strict readiness. Thứ tự Functions tương thích, migration đã phê
duyệt, indexes/Rules, Storage Rules rồi Hosting vẫn là bắt buộc khi có thay đổi
dữ liệu. Các flag override cần break-glass có lý do và xác nhận tương tác ngoài CI;
không dùng để thay thế review phát hành.

### Zalo Testing

```powershell
cd zalo-mini-app
npm run deploy:zmp:test
```

Lệnh sẽ build `www/`, đồng bộ asset hash vào `app-config.json`, kiểm tra package rồi mới gọi ZMP CLI. Không sửa asset hash bằng tay và không ghi cố định số phiên bản Testing trong tài liệu.

## Bảo mật và quyền riêng tư

- Firestore Rules từ chối business write từ client; Storage Rules giới hạn avatar/ảnh theo salon và quyền người dùng.
- Cloud Functions xác minh Zalo ở backend, kiểm tra role/branch và dùng transaction cho điểm, lượt cắt, vòng quay và đổi quà.
- Ảnh kiểu tóc chỉ được lưu khi có sự đồng ý của khách; ứng dụng có luồng yêu cầu xóa dữ liệu và webhook rút lại đồng ý từ Zalo.
- Log, monitoring và breadcrumb không được chứa token, chữ ký QR, số điện thoại đầy đủ hoặc dữ liệu nhạy cảm.
- Xem quy trình báo cáo lỗ hổng tại [SECURITY.md](SECURITY.md).

## Tài liệu chi tiết

- [Đặc tả sản phẩm](docs/PRODUCT_SPEC.md) và [kiến trúc](docs/architecture.md)
- [Thiết kế dữ liệu](docs/DATABASE.md) và [hợp đồng API](docs/API_CONTRACTS.md)
- [Thiết lập đăng nhập](docs/AUTH_SETUP.md) và [migration QR/chi nhánh](docs/BRANCH_QR_MIGRATION.md)
- [Triển khai, rollback](docs/deployment.md) và [xử lý sự cố](docs/incident-runbook.md)
- [Trạng thái phát hành](docs/RELEASE_STATUS.md) và [vận hành production](docs/PRODUCTION_OPERATIONS.md)
- [Giám sát vận hành](docs/OPERATIONS_MONITORING.md) và [checklist quyền riêng tư](docs/PRIVACY_CHECKLIST.md)
- [Sẵn sàng production](docs/PRODUCTION_READINESS.md) và [chạy thử salon](docs/SALON_PILOT_CHECKLIST.md)
- [Hồ sơ xét duyệt Zalo](docs/ZALO_REVIEW_SUBMISSION.md) và [hồ sơ Manager cho App Store/Google Play](docs/MANAGER_STORE_SUBMISSION.md)

## Trạng thái dự án

HAIRCUT đã có source cho Zalo Mini App, Manager và Admin cùng backend nhiều salon.
Trạng thái CI, Firebase đang deploy và Zalo Portal phải được xác minh độc lập;
source hoặc build đạt không đồng nghĩa production đã phát hành. Trước khi phục vụ
khách thật vẫn phải hoàn thành các cổng thủ công sau:

- [ ] Firebase Auth, Authorized Domains, App Check và mẫu email đã được cấu hình đúng.
- [ ] Tất cả secret production đã nằm trong Secret Manager; repository và lịch sử Git không chứa secret.
- [ ] Firestore đã được export; migration chi nhánh chạy idempotent và dữ liệu cũ vẫn truy cập được.
- [ ] Functions, indexes, Firestore Rules, Storage Rules và Hosting được deploy đúng thứ tự.
- [ ] Luồng khách, staff và owner đã được kiểm thử trên salon demo bằng dữ liệu giả.
- [ ] Zalo Testing đã được kiểm tra trên Android và iPhone, gồm QR salon và QR chi nhánh.
- [ ] Manager có Firebase native config, APNs, App Check và đã qua TestFlight/Internal Testing.
- [ ] Admin có Hosting site riêng và chỉ tài khoản `system_admin` truy cập được.
- [ ] Privacy, Terms, webhook xóa dữ liệu, monitoring, cảnh báo chi phí và rollback đã được xác nhận.

Không đánh dấu production-ready chỉ dựa trên việc build thành công; sử dụng đầy đủ [checklist production](docs/PRODUCTION_READINESS.md) trước khi phát hành.
