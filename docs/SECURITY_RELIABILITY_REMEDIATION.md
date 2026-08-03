# Khắc phục Security & Release Readiness

Cập nhật: 29/07/2026

## Phạm vi

- Branch: `fix/repository-readiness-remediation`
- Base `origin/main`: `3e55436ec2228f18f106b0b8ee3c918c18d20dfd`
- Production deploy, migration và dữ liệu thật: không truy cập
- Trạng thái GitHub Actions: chỉ xác nhận sau khi Draft PR chạy trên HEAD cuối

## Cập nhật reliability

- Scheduler hết hạn session xử lý transaction cho cả `waiting`, `serving` và
  `pending_approval`, dọn active pointer, từ chối point request liên quan và audit idempotent.
- Staff invite chỉ được nhận qua `acceptStaffInvite` sau thao tác đồng ý; đọc hồ sơ không
  còn làm thay đổi trạng thái lời mời.
- Search khách trả summary; callable chi tiết kiểm tra tenant/branch/quyền và không có
  direct Firestore fallback.
- Xóa khách giới hạn 250 document/trang và 2 trang/lần gọi; Storage giới hạn 100 file/trang,
  10 thao tác đồng thời, có retry lỗi tạm thời. Job lưu cursor/progress và xác minh residue
  trước khi xóa customer cuối cùng.
- Zalo phân loại lỗi quyền và lỗi tạm thời để retry/settings không tạo vòng lặp.

## Khách dùng chung toàn salon

### Nguyên nhân

`searchSalonCustomers` lọc hồ sơ khách bằng `lastBranchId`. Trường này chỉ mô tả
chi nhánh gần nhất, nên staff A1 không tìm được khách vừa đến A2 dù hồ sơ, điểm và
quà thuộc toàn salon.

### Bản sửa

- Query hồ sơ khách chỉ dùng `salonId` cùng `namePrefixes` hoặc `phoneLast4`.
- Cursor chỉ cần tồn tại và thuộc đúng salon.
- Staff vẫn chỉ nhận records, ghi chú và reward thuộc branch được xác thực.
- Staff không nhận full phone, ảnh owner, `branchVisits`, lịch sử quà toàn salon
  hoặc reward code khi thiếu `canRedeemRewards`.
- Owner xem toàn salon hoặc lọc branch hợp lệ.
- Xóa hai composite index `lastBranchId` chỉ phục vụ search; giữ index dashboard
  `salonId + lastBranchId + lastVisitAt`.

### Bằng chứng

Adversarial suite bao phủ khách chuyển A1 sang A2, khách legacy thiếu
`lastBranchId`, owner/staff, branch A1/A2, salon khác, quyền đổi quà và redeem
idempotent.

## Emulator fail-fast

- `test:rules` và `test:integration` tự chạy Firebase Emulator Suite bằng project
  `demo-haircut`.
- Hậu tố `:emulator` chỉ dùng bên trong `emulators:exec`.
- Test helper từ chối khi thiếu host, host không phải loopback hoặc project không
  bắt đầu bằng `demo-`.
- Không còn `describe.skipIf(!emulatorHost)`.

Kết quả đã chạy trong quá trình sửa:

| Suite | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Rules emulator | 19 | 0 | 0 |
| Integration/adversarial emulator | 45 | 0 | 0 |
| Integration thiếu emulator (negative gate) | 0 | 3 suite bị từ chối đúng | 0 |

## Readiness và deploy gate

`scripts/check.ps1` có:

- Quick: Functions, Zalo, Admin, Manager, Git diff, generated output, credential,
  secret và CSP checks.
- Full: thêm Rules, integration, browser E2E, Zalo review readiness, Capacitor
  sync và production configuration readiness.
- Kết quả tách `PASSED`, `FAILED`, `BLOCKED`, `NOT RUN`.
- Full suite ghi `.tmp/release-readiness.json` bị Git ignore, chứa SHA và công cụ.

`scripts/deploy-firebase.ps1` mặc định từ chối:

- Working tree bẩn.
- Branch ngoài `main`/`release/*`.
- Thiếu evidence, evidence không full, không đạt hoặc sai SHA.
- Strict readiness chưa đạt App Check, monitoring, live URL, project/Zalo/contact hoặc
  bằng chứng thiết bị tương ứng.

`-DryRun` kiểm tra gate mà không deploy.
Các cờ bỏ qua chỉ hoạt động ngoài CI khi có `HAIRCUT_BREAK_GLASS=true`, lý do cụ thể
và xác nhận tương tác. Không dùng break-glass trong remediation này.

## CI và dependency automation

- Build workflow giữ Functions, Rules, integration, Zalo, Admin, Manager,
  Android, iOS Simulator, browser và repository checks.
- Zalo job chạy thêm review readiness.
- Manager `check` gồm typecheck, ESLint, Prettier baseline, unit và build.
- CodeQL upload SARIF vào GitHub Code Scanning; artifact được giữ làm fallback.
- Dependabot theo dõi cả Admin và Manager; dependency Capacitor/native không bị
  gom vào nhóm web lớn.
- Required checks/branch protection vẫn cần owner cấu hình trên GitHub.

## Manager lint và format

- ESLint bật TypeScript, React Hooks `rules-of-hooks`/`exhaustive-deps`, React
  Refresh và `--max-warnings=0`.
- Sửa import thừa và dependency effect được lint phát hiện.
- Tám file chạm trong remediation đã được format.
- Còn baseline 68 file legacy trong `.prettierignore`; file mới không thuộc
  baseline sẽ bị kiểm tra. Không format hàng loạt để tránh diff hành vi khó review.
- Functions có baseline tương tự cho 26 file cũ; toàn bộ test/helper mới nằm
  ngoài baseline và phải đạt Prettier.
- Zalo Mini App có baseline 87 file định dạng cũ trong `.prettierignore`; các
  tool remediation đã chạm vẫn đạt Prettier và file mới không được tự động bỏ qua.

## Bằng chứng kiểm tra cục bộ

| Kiểm tra | Passed | Failed | Skipped/Blocked |
| --- | ---: | ---: | ---: |
| Functions unit | 63 | 0 | 0 |
| Rules emulator | 19 | 0 | 0 |
| Functions integration/adversarial | 45 | 0 | 0 |
| Zalo unit | 85 | 0 | 0 |
| Zalo browser E2E | 15 | 0 | 9 screenshot-only |
| Manager unit | 73 | 0 | 0 |
| Admin unit | 8 | 0 | 0 |
| Manager Android Capacitor sync | 1 | 0 | 0 |
| Manager Android Gradle | 0 | 0 | 1 - máy hiện tại không có Android SDK |
| Manager iOS Simulator | 0 | 0 | 1 - yêu cầu macOS/Xcode |

Zalo lint, format baseline, `build:zmp` và review readiness `24/24` đều đạt.
Functions/Manager/Admin typecheck, lint, format baseline và build đều đạt.
Android đã đạt `cap sync android`; Gradle trên HEAD cuối đang bị chặn vì máy hiện tại không có
Android SDK. iOS chỉ được xem là đạt sau khi build Simulator
trên macOS/Xcode hoặc job CI tương ứng xanh trên HEAD cuối.

## CSP, App Check và monitoring

- Nguồn CSP: `config/content-security-policy.txt`.
- `scripts/sync-csp.mjs --check` bảo đảm header Firebase khớp nguồn.
- CSP vẫn là Report-Only; chưa có endpoint báo cáo đang vận hành và chưa đủ bằng
  chứng Zalo Testing/thiết bị thật để enforce.
- Readiness phân biệt `ENFORCE_APP_CHECK` cho callable chung và
  `REQUIRE_ZALO_APP_CHECK` cho public Zalo policy.
- Source có Zalo web provider, Manager web/native provider và Admin provider.
- Không bật enforcement production trong nhiệm vụ này.
- Sentry phải có DSN hoặc được tắt có chủ đích; không in token.

## Cấu hình và secret

- Bỏ theo dõi `zalo-mini-app/.env.production`; file local vẫn được giữ và ignored.
- CI hoặc `.env.production.local` là nguồn cấu hình production.
- File example chỉ chứa placeholder, không chứa liên hệ cá nhân.
- `.codex/skills` gồm 146 file local tooling, không có tham chiếu runtime,
  binary hay mẫu secret; đã loại khỏi Git và ignore `.codex/`.
- `scripts/check-secrets.mjs` quét file Git; thêm `--include-working-tree` để quét cả
  file untracked không bị ignore. Kết quả chỉ ghi file/dòng/loại, không in credential,
  đồng thời xác minh các artifact nhạy cảm vẫn được `.gitignore` bảo vệ.
- Lịch sử Git phải được quét bằng Gitleaks hoặc TruffleHog trong CI/máy release đã
  cài công cụ; remediation không tự cài hay rewrite lịch sử.
- Giá trị từng có trong lịch sử Git không bị rewrite trong nhiệm vụ này.

## Dependency audit

| Workspace | Production Critical | High | Moderate | Ghi chú |
| --- | ---: | ---: | ---: | --- |
| Functions | 0 | 0 | 9 | Npm đề xuất thay đổi major/downgrade Firebase; không áp dụng |
| Zalo Mini App | 0 | 5 | 1 | `zmp-sdk` stable mới nhất vẫn khai báo dependency cũ |
| Admin Web | 0 | 0 | 0 | Cảnh báo chỉ nằm ở dev dependency |
| Manager Mobile | 0 | 0 | 0 | Cảnh báo chỉ nằm ở dev dependency |

Zalo Mini App đã ghim `zmp-sdk@2.51.8`, là bản stable mới nhất tại thời điểm kiểm tra,
và toàn bộ lint/test/build/readiness đều đạt. Audit vẫn báo chuỗi `@babel/cli`/`glob`
và `@sentry/browser` do SDK khai báo dependency cũ; mã SDK phân phối là bundle dựng
sẵn và source ứng dụng không import trực tiếp các dependency này. `npm audit` chỉ đề
nghị hạ SDK xuống `2.9.4`, nên không áp dụng vì có nguy cơ phá API/runtime. Tiếp tục
theo dõi bản stable ZMP sửa dependency upstream; không dùng override major hoặc
`npm audit fix --force` để làm đẹp báo cáo.

## Ngoài repository

Các mục sau chưa thể xác minh chỉ bằng code:

- GitHub required checks và billing cho Code Scanning/macOS runner.
- Firebase API key restrictions, App Check Console, Secret Manager và SHA đang deploy.
- Zalo Portal/Testing/Production.
- Android/iOS thiết bị thật, APNs/Play Integrity/App Attest.
- Backup restore drill, uptime, quota và billing alerts.

Không đánh dấu production-ready cho tới khi các mục bắt buộc trong
`docs/PRODUCTION_READINESS.md` có bằng chứng vận hành.
