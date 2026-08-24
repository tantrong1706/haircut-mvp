# Triển khai production

## Bí mật và môi trường

- Firebase public config và Zalo Mini App ID được cấp bằng biến CI hoặc file local
  bị ignore `zalo-mini-app/.env.production.local`. File mẫu duy nhất được commit
  là `.env.production.example`.
- Firebase Auth phải bật Email/Password; domain Hosting phải nằm trong Authorized domains và mẫu email đặt lại mật khẩu phải dùng thương hiệu HAIRCUT.
- Web khách ưu tiên `https://app.chhaircutsalon.cc` sau khi Firebase Hosting báo
  `Connected`. Hai domain mặc định `haircut-c7d12.web.app` và
  `haircut-c7d12.firebaseapp.com` phải tiếp tục hoạt động; không redirect hoặc xóa.
- Checklist custom domain, DNS Cloudflare, Authorized Domains và SSL nằm tại
  [`CUSTOM_DOMAIN_APP_CLOUDFLARE.md`](CUSTOM_DOMAIN_APP_CLOUDFLARE.md).
- `ZALO_APP_SECRET` phải nằm trong Firebase Secret Manager.
- `ZALO_APP_ID` là App ID của ứng dụng Zalo liên kết với OA và được đặt trong `firebase/functions/.env`; đây không phải Mini App ID.
- `ZALO_MINI_APP_ID` là Mini App ID và được đặt trong `firebase/functions/.env`.
- `ZALO_OPEN_API_KEY` là API Key trong phần Open APIs của Zalo Mini App, phải nằm trong Firebase Secret Manager và không được ghi vào `.env`, log hoặc repository.
- `QR_SIGNING_SECRET` phải nằm trong Firebase Secret Manager, dài tối thiểu 32 ký tự và không được dùng lại `ZALO_APP_SECRET`.
- Chỉ đặt `REQUIRE_ZALO_APP_CHECK=true` sau khi App Check đã chạy ổn trong cả Zalo Android và iPhone; để trống trong giai đoạn tương thích.
- Chỉ đặt `ENFORCE_APP_CHECK=true` sau khi web/Zalo và Manager native đều gửi token hợp lệ. Manager dùng Play Integrity và App Attest/DeviceCheck; không dùng reCAPTCHA web trong native runtime.
- Admin Web cần `VITE_FIREBASE_APP_CHECK_SITE_KEY` của reCAPTCHA Enterprise. `VITE_APP_CHECK_DEBUG_TOKEN` chỉ dùng local và tuyệt đối không đặt trong production.
- `ADMIN_WRITE_OPERATIONS_ENABLED` mặc định tắt. Không bật trong bản Admin read-only; mọi callable ghi Admin sẽ trả `ADMIN_WRITE_DISABLED` dù được gọi trực tiếp.
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` chỉ đặt ở môi trường deploy/GitHub Secrets.
- Khi đủ ba biến Sentry, Vite tạo source map ẩn, upload rồi xóa file map khỏi `dist`.

## Webhook quyền dữ liệu Zalo

- URL cấu hình trên Zalo sau khi deploy: `https://asia-southeast1-haircut-c7d12.cloudfunctions.net/zaloPrivacyWebhook`.
- Function nhận sự kiện `user.revoke.consent`, xác thực header `X-ZEvent-Signature` bằng SHA-256 trên các giá trị payload đã sắp xếp theo tên field và Open API Key theo tài liệu Zalo.
- Function không ghi log payload, chữ ký, access token, Open API Key hoặc mã định danh người dùng. Mỗi sự kiện tạo một job định danh trong `customer_deletion_jobs`, dùng lại luồng xóa khách hiện có và có thể tiếp tục an toàn khi Zalo gửi lại.
- Trước lần deploy đầu tiên, đặt `ZALO_MINI_APP_ID=2038116772828167300` trong `firebase/functions/.env`, lấy API Key tại trang Open APIs của Zalo Mini App rồi chạy:

```powershell
cd C:\tantrong\haircut-mvp\firebase
firebase functions:secrets:set ZALO_OPEN_API_KEY
firebase deploy --only functions:zaloPrivacyWebhook
cd ..
.\scripts\deploy-firebase.ps1 -OnlyHosting
```

- Sau deploy, nhập URL webhook trên vào cấu hình ứng dụng Zalo và gửi một sự kiện kiểm thử từ cổng Zalo. Trang Điều khoản sử dụng công khai tại `https://haircut-c7d12.web.app/terms`.

## Thứ tự deploy

1. Trên commit sạch thuộc `main` hoặc `release/*`, chạy
   `.\scripts\check.ps1 -Full`; sau đó chạy
   `.\scripts\check-production-readiness.ps1 -StrictRelease -CheckLiveUrls`
   (thêm `-ReleaseIncludesIos` nếu phát hành iOS), xác minh evidence đúng SHA rồi
   mới tạo release tag.
2. Dry-run audit tenant, export Firestore bằng `scripts/backup-firestore.ps1`, ghi URL backup vào biên bản.
3. Deploy Functions tương thích ngược theo nhóm nhỏ.
4. Chạy migration đã phê duyệt; không tự suy đoán document thiếu `salonId`.
5. Deploy indexes và chờ tạo xong, sau đó Firestore Rules và Storage Rules.
6. Build/deploy Hosting khách; kiểm tra Privacy, Terms, deletion và webhook.
7. Chạy `npm run deploy:zmp:test`, kiểm tra Zalo Android/iPhone rồi mới phát hành.
8. Manager đi qua Internal Testing/TestFlight; Admin dùng Hosting site riêng, không ghi đè site khách.

`scripts/deploy-firebase.ps1` hiển thị branch/SHA và từ chối worktree bẩn, branch
không được phép hoặc evidence sai SHA. `-DryRun` chỉ kiểm tra cổng và không deploy.
Luồng bình thường luôn chạy strict readiness. Các flag override yêu cầu
`HAIRCUT_BREAK_GLASS=true`, `HAIRCUT_BREAK_GLASS_REASON` đủ rõ và xác nhận tương tác
ngoài CI; mọi ngoại lệ phải ghi vào biên bản phát hành.

Quét secret trước release:

```powershell
node .\scripts\check-secrets.mjs
node .\scripts\check-secrets.mjs --include-working-tree
```

Máy/CI release cần chạy thêm Gitleaks hoặc TruffleHog trên lịch sử Git. Không dùng
`npm audit fix --force`, không in credential và không rewrite lịch sử trong quy trình deploy.

## CSP Testing

Nguồn CSP nằm tại `config/content-security-policy.txt`; chạy
`node scripts/sync-csp.mjs --check` để bảo đảm Firebase Hosting khớp. Hiện policy
ở `Content-Security-Policy-Report-Only` vì chưa có endpoint báo cáo được vận hành
và chưa đủ bằng chứng thiết bị thật. Trước khi enforce:

1. Build/deploy vào Zalo Testing, không production.
2. Kiểm tra Firebase Auth, Functions, Firestore, Storage, Zalo runtime và Sentry.
3. Xác minh console không có CSP violation chặn luồng QR/check-in.
4. Chỉ đổi header sang `Content-Security-Policy` trong một PR riêng có rollback.

## Audit tenant và migration

```powershell
cd firebase\functions
npm run audit:tenant-data -- --project haircut-c7d12
```

Lệnh mặc định chỉ đếm document thiếu `salonId` và không in ID. Chế độ ghi bắt buộc file mapping, `--apply` và `--confirm-project haircut-c7d12`; xem `scripts/tenant-migration.example.json`. Chưa chạy trên production chỉ vì source đã có script.

## HAIRCUT Manager

```powershell
cd apps\manager-mobile
npm ci
npm run sync
```

Android cần `google-services.json`; iOS cần `GoogleService-Info.plist`, APNs key và Xcode capabilities. Hai file config không được commit. Hướng dẫn store đầy đủ ở [MANAGER_STORE_SUBMISSION.md](MANAGER_STORE_SUBMISSION.md).

## HAIRCUT Admin

Build bằng `npm run build` trong `apps/admin-web`. Trước deploy phải tạo Firebase Hosting site riêng, cấu hình URL vào `VITE_ADMIN_URL` và smoke test tài khoản `system_admin`; không dùng site `haircut-c7d12` của khách. Giao diện và API client bản đầu chỉ đọc; backend vẫn khóa callable ghi khi flag server chưa bật.

## Kiểm tra sau deploy

- `/`, `/owner`, `/staff`, `/privacy`, `/terms` trả HTTP 200.
- Webhook từ chối request sai chữ ký, chấp nhận `user.revoke.consent` hợp lệ và trả cùng kết quả an toàn khi Zalo gửi lại.
- Owner tạo/sửa/khóa chi nhánh, xoay QR và lọc dashboard mà không cần F5.
- QR salon cho chọn chi nhánh; QR chi nhánh mở thẳng đúng tên và địa chỉ; QR Gương 1 cũ vẫn hoạt động trong giai đoạn chuyển đổi.
- Staff gửi một yêu cầu điểm duy nhất cho một phiên.
- Staff phải nhận khách trước; tài khoản khác không thể gửi điểm cho lượt đã có người phụ trách.
- Lời mời nhân viên mở được trang Firebase đặt mật khẩu và nhân viên đăng nhập thành công sau khi đặt.
- Owner duyệt; khách thấy điểm/trạng thái cập nhật.
- Khi tắt mạng rồi bật lại, trang khách giữ phiên và tự đồng bộ hoặc cho bấm Thử lại.
- Tìm khách tải được trang tiếp theo, dashboard tự đổi số liệu mà không cần F5.
- QR sai token và tài khoản salon khác đều bị từ chối.
- Phiên quá hạn rời hàng chờ; owner và nhân viên đúng quyền hủy được lượt no-show.
- Ô vòng quay không trúng không xuất hiện trong danh sách mã quà chưa dùng.

## Rollback

- Trước mỗi rollout thay đổi schema, tạo Firestore managed export vào bucket backup riêng, ghi release tag, commit, thời điểm export và người thực hiện vào biên bản phát hành. Không lưu export hoặc khóa dịch vụ trong repository.
- Hosting: chọn bản phát hành trước trong Firebase Hosting release history.
- Functions: deploy lại release tag ổn định trước; chỉ rollback code tương thích ngược với dữ liệu đã ghi và không hạ Rules nếu tạo lại public access.
- Firestore: ưu tiên sửa tiến (forward fix). Chỉ import export vào project phục hồi/staging trước, kiểm đếm document và chạy smoke test rồi mới quyết định khôi phục production; import không tự xóa dữ liệu phát sinh sau thời điểm export.
- Storage: bật versioning/lifecycle trên bucket backup theo chính sách vận hành và kiểm tra riêng ảnh kiểu tóc/avatar sau phục hồi.
- Zalo: giữ phiên bản test trước và chỉ phát hành production sau khi smoke test đạt.
- Mỗi quý chạy một diễn tập restore không dùng dữ liệu khách thật, ghi lại RTO/RPO, lỗi gặp phải và người phê duyệt.

Lệnh dry-run và runbook chi tiết nằm tại [PRODUCTION_OPERATIONS.md](PRODUCTION_OPERATIONS.md). Không rollback Rules theo cách mở quyền client và không import Firestore trực tiếp khi chưa xác nhận project hai lần.
