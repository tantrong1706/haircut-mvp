# HAIRCUT - Zalo readiness

## 1. Trạng thái

**READY FOR MANUAL DEPLOY**

Code local đã qua lint, format, typecheck/build ZMP, 68 unit/rules tests và kiểm tra diff. Trạng thái này cho phép deploy thủ công lên Firebase và Zalo Testing; chưa được bấm gửi xét duyệt trước khi hoàn tất các mục **MANUAL ACTIONS**.

## 2. File đã sửa

- Tài liệu: `README.md`, `docs/API_CONTRACTS.md`, `docs/DATABASE.md`, `docs/architecture.md`, `docs/deployment.md`, `docs/BRANCH_QR_MIGRATION.md`, `docs/ZALO_REVIEW_SUBMISSION.md`, `docs/CODEX_ZALO_READINESS.md`.
- Firebase: `firebase/firestore.indexes.json`, `firebase/firestore.rules`, `firebase/storage.rules`, `firebase/functions/package.json`, `firebase/functions/src/index.ts`, `firebase/functions/src/security.ts`, `firebase/functions/src/businessRules.ts`.
- Test backend/rules: `firebase/functions/test/security.test.ts`, `firebase/functions/test/businessRules.test.ts`, `firebase/functions/test/zaloContract.test.ts`, `firebase/functions/test/firestore.rules.test.ts`.
- Frontend pages: `HomePage.tsx`, `ScanEntryPage.tsx`, `StaffPage.tsx`, `OwnerPage.tsx`, `WheelPage.tsx`, `PrivacyPage.tsx` và test liên quan trong `zalo-mini-app/src/pages`.
- Frontend services: `api.ts`, `auth.ts`, `customerPhotos.ts`, `monitoring.ts`, `operations.ts`, `qr.ts`, `sessionStore.ts`, `types.ts`, `wheel.ts` và test liên quan trong `zalo-mini-app/src/services`, gồm test scrub telemetry và production không sinh QR demo.
- Giao diện/cấu hình: `zalo-mini-app/src/styles/global.css`, `zalo-mini-app/app-config.json`.

Không commit, push hoặc deploy trong tác vụ này.

## 3. Tính năng đã hoàn thành

- Một QR chung cho salon và một QR riêng cho mỗi chi nhánh; QR salon chọn/tự chọn chi nhánh, QR chi nhánh mở trực tiếp, hai loại QR xoay độc lập.
- Migration tạo **Chi nhánh chính** bằng ID xác định, gán `branchId` cho dữ liệu cũ, giữ QR Gương 1 và chạy lại không tạo trùng.
- Owner quản lý chi nhánh/QR/nhân viên, xem toàn salon hoặc lọc dashboard và hàng duyệt theo chi nhánh; staff chỉ thấy hàng chờ chi nhánh được phân công.
- QR token ký HMAC, không lưu token thô trong Firestore mới/localStorage/telemetry, được loại khỏi URL sau khi parse.
- Staff chỉ nhận projection tối thiểu của khách; PII đầy đủ, lịch sử và yêu cầu điểm chỉ owner/Functions đọc.
- Owner phải xác minh email ở frontend và backend trước khi tạo salon; không còn fallback tạo salon trực tiếp.
- Ảnh bắt buộc đúng salon/chi nhánh/customer/session, consent `allowPhoto`, JPEG hợp lệ và quyền xóa theo người phụ trách/owner.
- Phiên có `expiresAt`, trạng thái mở, hủy/no-show có phân quyền và scheduled cleanup; quét lại không tạo phiên mở trùng.
- Check-in trống giữ phone/birthday cũ; `lastVisitAt` chỉ đổi khi dịch vụ được duyệt; dashboard đếm khách hoàn tất duy nhất.
- Xóa khách dùng `customer_deletion_jobs`, có trạng thái/retry/residue và chỉ hoàn tất khi Firestore lẫn Storage sạch.
- Ô `no_prize` không sinh mã quà, không vào danh sách quà chưa dùng và có kết quả riêng trên giao diện.
- Privacy, README, triển khai và hồ sơ Zalo đã khớp mô hình salon/chi nhánh.

## 4. Lỗi High

Đã sửa: **H-01, H-02, H-03, H-04, H-05, H-06, H-07, H-08, H-11**.

Còn lại:

- **H-09:** đã tăng unit/rules test nhưng chưa có integration test emulator cho toàn bộ callable transaction, race và partial failure thật.
- **H-10:** coverage frontend vẫn chưa đo toàn bộ `src`; 20 unit test hiện tại chưa thay thế kiểm thử luồng đầy đủ trên thiết bị.

Hai mục này không chặn deploy lên môi trường Testing, nhưng phải được xem là rủi ro còn lại trước khi tuyên bố production đã được kiểm thử toàn diện.

## 5. Test đã chạy

| Lệnh | Kết quả |
| --- | --- |
| `zalo-mini-app: npx --no-install tsc --noEmit` | PASS |
| `zalo-mini-app: npm run lint` | PASS |
| `zalo-mini-app: npm run format:check` | PASS |
| `zalo-mini-app: npm run test:run` | PASS - 9 file, 24 test |
| `zalo-mini-app: npm run build:zmp` | PASS - có `tsc`, 3.415 module; chunk lớn nhất 262,64 KB |
| `firebase/functions: npm run typecheck` | PASS |
| `firebase/functions: npm run lint` | PASS |
| `firebase/functions: npm run format:check` | PASS |
| `firebase/functions: npm run test:unit` | PASS - 5 file, 33 test |
| `firebase emulators:exec --project demo-haircut --only firestore,storage "npm --prefix functions run test:rules"` | PASS - 1 file, 11 test |
| `git diff --check` | PASS - chỉ có cảnh báo chuyển LF/CRLF của Git trên Windows |
| `git ls-files` + quét literal secret đã che giá trị | PASS - không có file môi trường/debug bị track; 2 kết quả đều là placeholder trong `.env.example`/README |

Tổng: **68/68 test pass**. Sáu mục `[x]` trong hồ sơ Zalo đã được đối chiếu bằng build schema, ZMP asset validation, unit test frontend/Functions và Rules emulator. Không chạy E2E, Lighthouse hoặc test trên Firebase/Zalo production.

## 6. Migration

Thứ tự:

```powershell
cd C:\tantrong\haircut-mvp\firebase
firebase deploy --only functions
```

Sau đó owner của từng salon mở **Chi nhánh** và bấm **Chuyển dữ liệu Gương 1 cũ** để gọi `migrateSalonBranches`. Chạy lại lần hai để xác nhận không tăng số document `branches`, rồi mới deploy indexes/Rules.

- **An toàn/idempotent:** Có. Chi nhánh mặc định dùng ID xác định từ `salonId`; migration chỉ bổ sung trường thiếu và không xóa `mirrors`, khách, điểm hoặc lịch sử.
- **Rollback:** giữ nguyên dữ liệu mới và deploy lại frontend/Functions của phiên bản trước; QR Gương 1 vẫn còn. Chỉ phục hồi Firestore export nếu kiểm tra thủ công cho thấy dữ liệu bị sai, không tự xóa các trường migration.

## 7. Lệnh deploy thủ công

Chạy đúng thứ tự sau khi đã export Firestore và cấu hình secrets:

```powershell
# 1. Functions
cd C:\tantrong\haircut-mvp\firebase
firebase deploy --only functions

# 2. Chạy migration qua giao diện owner, sau đó indexes và chờ tạo xong
firebase deploy --only firestore:indexes

# 3. Firestore Rules
firebase deploy --only firestore:rules

# 4. Storage Rules
firebase deploy --only storage

# 5. Hosting (script tự build và chép www sang firebase/public)
cd C:\tantrong\haircut-mvp
.\scripts\deploy-firebase.ps1 -OnlyHosting

# 6. Zalo Testing
cd C:\tantrong\haircut-mvp\zalo-mini-app
npm run deploy:zmp:test
```

Không deploy Rules yêu cầu `branchId` trước khi migration và index hoàn tất.

## 8. MANUAL ACTIONS

- Đăng nhập Firebase/Zalo, xác nhận App ID `2038116772828167300` và cấu hình `ZALO_APP_SECRET`, `QR_SIGNING_SECRET` trong Secret Manager.
- Export Firestore, deploy Functions, chạy migration cho từng salon thật và kiểm tra chạy lần hai không tạo trùng.
- Điền email/điện thoại hỗ trợ thật vào Privacy và hồ sơ Zalo.
- Tạo salon, owner đã xác minh email, staff và ít nhất hai chi nhánh làm dữ liệu kiểm thử; điền tài khoản/mật khẩu test vào hồ sơ.
- Deploy theo thứ tự ở mục 7; kiểm tra dashboard, hàng chờ và dữ liệu cập nhật không cần F5.
- Tạo QR salon/chi nhánh Testing, quét bằng Zalo thật trên Android và iPhone; kiểm tra QR xoay, chi nhánh khóa, ảnh consent, hủy/no-show, duyệt điểm, vòng quay và xóa dữ liệu retry.
- Chụp/tải đủ ảnh màn hình, xác nhận URL Privacy công khai, sau đó mới bấm gửi xét duyệt và phát hành Production.
