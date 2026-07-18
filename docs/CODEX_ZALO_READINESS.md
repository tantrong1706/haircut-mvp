# HAIRCUT - Zalo readiness

> **Ảnh chụp trạng thái cũ:** tài liệu này ghi nhận bộ kiểm tra và Zalo Testing Version 5 tại thời
> điểm trước. Không dùng các dấu `[x]` bên dưới để kết luận Version 8 sẵn sàng. Checklist hiện hành
> là `docs/ZALO_REVIEW_CHECKLIST.md`.

## 1. Trạng thái

**NOT READY FOR ZALO SUBMISSION**

Code local đã qua lint, format, typecheck/build ZMP, 99 unit/rules/integration tests và 15 lượt E2E trên desktop Chrome, Android Chromium và iPhone WebKit. Firebase production, migration, dữ liệu xét duyệt và Zalo Testing **Version 5** đã hoàn tất; ảnh đại diện HAIRCUT cũng đã được cập nhật trên Zalo Developer Portal. Chưa bấm gửi xét duyệt trước khi kiểm thử thật và chụp đủ ảnh trên Android lẫn iPhone.

## 2. File đã sửa

- Tài liệu: `README.md`, `docs/API_CONTRACTS.md`, `docs/DATABASE.md`, `docs/architecture.md`, `docs/deployment.md`, `docs/BRANCH_QR_MIGRATION.md`, `docs/ZALO_REVIEW_SUBMISSION.md`, `docs/CODEX_ZALO_READINESS.md`.
- Firebase: `firebase/firestore.indexes.json`, `firebase/firestore.rules`, `firebase/storage.rules`, `firebase/functions/package.json`, `firebase/functions/src/index.ts`, `firebase/functions/src/security.ts`, `firebase/functions/src/businessRules.ts`.
- Test backend/rules: `firebase/functions/test/security.test.ts`, `firebase/functions/test/businessRules.test.ts`, `firebase/functions/test/zaloContract.test.ts`, `firebase/functions/test/firestore.rules.test.ts`.
- Frontend pages: `HomePage.tsx`, `ScanEntryPage.tsx`, `StaffPage.tsx`, `OwnerPage.tsx`, `WheelPage.tsx`, `PrivacyPage.tsx` và test liên quan trong `zalo-mini-app/src/pages`.
- Frontend services: `api.ts`, `auth.ts`, `customerPhotos.ts`, `monitoring.ts`, `operations.ts`, `qr.ts`, `sessionStore.ts`, `types.ts`, `wheel.ts` và test liên quan trong `zalo-mini-app/src/services`, gồm test scrub telemetry và production không sinh QR demo.
- Giao diện/cấu hình: `zalo-mini-app/src/styles/global.css`, `zalo-mini-app/app-config.json`.

Không lưu mật khẩu, token QR hoặc phiên ZMP vào Git. Thông tin nhạy cảm của tài khoản xét duyệt chỉ nằm trong các file local bị `.gitignore` loại trừ.

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

- **H-09:** đã có integration test emulator cho quota, duyệt điểm chống replay và vòng quay/đổi/hoàn tác quà; chưa phủ toàn bộ callable, race và partial failure.
- **H-10:** coverage hiện hành đạt 70,5% với 43 unit test, nhưng vẫn chưa đo toàn bộ `src`.

Hai mục này không chặn deploy lên môi trường Testing, nhưng phải được xem là rủi ro còn lại trước khi tuyên bố production đã được kiểm thử toàn diện.

## 5. Test đã chạy

| Lệnh                                                                                                              | Kết quả                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `zalo-mini-app: npx --no-install tsc --noEmit`                                                                    | PASS                                                                                                     |
| `zalo-mini-app: npm run lint`                                                                                     | PASS                                                                                                     |
| `zalo-mini-app: npm run format:check`                                                                             | PASS                                                                                                     |
| `zalo-mini-app: npm run test:coverage`                                                                            | PASS - 16 file, 43 test; coverage 70,5%                                                                  |
| `zalo-mini-app: npm run build:zmp`                                                                                | PASS - có `tsc`, 3.417 module; chunk lớn nhất 262,64 KB                                                  |
| `zalo-mini-app: Playwright desktop-chromium`                                                                      | PASS - 5/5                                                                                               |
| `zalo-mini-app: Playwright mobile-chromium`                                                                       | PASS - 5/5                                                                                               |
| `zalo-mini-app: Playwright mobile-webkit`                                                                         | PASS - 5/5                                                                                               |
| `firebase/functions: npm run typecheck`                                                                           | PASS                                                                                                     |
| `firebase/functions: npm run lint`                                                                                | PASS                                                                                                     |
| `firebase/functions: npm run format:check`                                                                        | PASS                                                                                                     |
| `firebase/functions: npm run test:unit`                                                                           | PASS - 6 file, 40 test                                                                                   |
| `firebase emulators:exec --project demo-haircut --only firestore,storage "npm --prefix functions run test:rules"` | PASS - 1 file, 13 test                                                                                   |
| `firebase emulators:exec --project demo-haircut --only firestore "npm --prefix functions run test:integration"`   | PASS - 1 file, 3 test                                                                                    |
| `git diff --check`                                                                                                | PASS - chỉ có cảnh báo chuyển LF/CRLF của Git trên Windows                                               |
| `git ls-files` + quét literal secret đã che giá trị                                                               | PASS - không có file môi trường/debug bị track; 2 kết quả đều là placeholder trong `.env.example`/README |

Tổng: **99/99 unit/rules/integration test pass** và **15/15 lượt E2E pass**. Sáu mục `[x]` trong hồ sơ Zalo đã được đối chiếu bằng build schema, ZMP asset validation, unit test frontend/Functions, Rules/callable emulator và E2E đa trình duyệt. Không chạy Lighthouse hoặc test trên Firebase/Zalo production.

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

- Điền mật khẩu từ `docs/ZALO_REVIEW_ACCOUNTS.md.local` vào hồ sơ xét duyệt; không commit hoặc gửi file này công khai.
- Quét QR Testing bằng Zalo thật trên Android và iPhone; kiểm tra chọn chi nhánh, hàng chờ, ảnh consent, hủy/no-show, duyệt điểm, vòng quay và đổi quà.
- Chụp/tải đủ ảnh màn hình thực tế trong Zalo, đính kèm QR Testing còn hiệu lực và dùng bộ ảnh web tham khảo trong `docs/zalo-review-screenshots.local`.
- Kiểm tra lại tên, mô tả, ảnh đại diện và thông tin hỗ trợ trên Zalo Portal, rồi mới bấm gửi xét duyệt và phát hành Production.
