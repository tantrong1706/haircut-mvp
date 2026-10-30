# Quyền riêng tư CH Hair Web — bằng chứng kiểm thử

Ngày kiểm tra: 30/10/2026. Base `89cee9a6b9febac888bd27f7511698969fb8f16e`;
nhánh `codex/privacy-readiness`. Đây là bằng chứng local, chưa phải CI hoặc production.
Không merge, deploy, đổi Rules/IAM/TTL hoặc chạy thử bằng dữ liệu/OTP/email khách thật.
Source quyền riêng tư ban đầu được chốt ở `8ed9ce0`; phần liên hệ do chủ dự án cung cấp sau đó
được cập nhật riêng tại `729eea9`, với checkpoint kiểm thử `27d7a76`.

## Phạm vi

- Chặn giám sát tùy chọn trước khi khách chọn; cho đổi lựa chọn mà không xóa đăng nhập.
- Ảnh mặc định không chọn; điểm không phụ thuộc quyền ảnh; rút quyền ảnh bằng UID đã xác thực.
- Trang cookie, dịch vụ, quyền dữ liệu công khai; giữ công cụ quản lý xóa sau đăng nhập riêng.
- Sửa lỗi yêu cầu xóa đã hoàn tất bị tái dùng sau khi khách tạo lại hồ sơ, có kiểm tra phiên bản
  hồ sơ tại xác nhận và bước xóa cuối. Không tự chạy xóa dữ liệu cũ.
- Không thu phí, thêm thư viện, đổi App ID, đồng nhất lại khách hoặc xóa API tương thích lịch sử.

## RED → GREEN được giữ trong Git

Không sửa lịch sử hoặc dùng kiểm thử chỉ khớp chuỗi source để thay kiểm thử runtime.

| RED                  | Vấn đề đã tái hiện                                                              | GREEN / bằng chứng                                                           |
| -------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `b43ef63`, `2f7aaf2` | Monitoring init trước lựa chọn; ảnh chưa có opt-in riêng, server mặc định true  | `d524b04`, `765684c`: Web 23 ca và backend 18 ca                             |
| `cd491e0`            | Event đã xếp hàng vẫn gửi sau khi rút lựa chọn                                  | `305a29b`: chặn lại khi callback chạy                                        |
| `44a5fb8`, `6d300d0` | Thiếu liên hệ/trang công khai, còn câu đồng ý ngầm                              | `c6465c8`: route/contact/policy runtime tests                                |
| `686e2b4`            | Chưa có API/panel rút quyền ảnh                                                 | `e49e0d9`, `c6465c8`: API xác thực + client/panel                            |
| `05ff4e5`, `e2423a8` | Thiếu đường dẫn quyền dữ liệu, panel không phản ánh thu hồi từ server           | `7a6130b`: account/panel 5 ca                                                |
| `9723361`            | Session/point request đang mở còn quyền ảnh sau khi rút                         | `294ccb3`: giao dịch thu hồi và giữ khả năng xác nhận điểm                   |
| `d06028d`            | Cookie bị chặn; Performance không bật lại sau lựa chọn mới; aria-expanded sai   | `8eb898b`: 12 ca hardening                                                   |
| `1e46d46`, `fc9fd43` | Job xóa hoàn tất cũ báo hoàn tất giả hoặc retry cũ xóa hồ sơ tái tạo            | `8782664`: 2 integration và 12 contract/client ca                            |
| `0c7b1a7`            | Browser đầu 3 PASS/2 FAIL: so sánh innerText khác textContent và thiếu landmark | `c957ef2`: sửa assertion đúng nội dung và thêm nav có nhãn; 5/5 desktop PASS |
| `9872af0`            | Endpoint mới thiếu quota registry; TypeScript và runtime quota đều bắt được     | `aa41b56`: policy 20/phút theo UID/salon, 11/11 integration PASS             |
| Browser full lần đầu | 71 PASS/1 FAIL: selector heading mơ hồ khi bảng cookie hiện cùng chính sách     | `33efba2`: chọn chính xác h1 chính sách; lần chạy kế tiếp 72/72 PASS         |
| `c9cdc85`            | Ghi lựa chọn mới thất bại vẫn đọc opt-in cũ; 7 PASS/1 FAIL                      | Vá fail-closed trong phiên; kết quả cuối ở bảng bên dưới                     |

Các vòng check còn bắt được lỗi React refresh (helper export trong TSX), định dạng file mới,
và mirror contracts khác byte xuống dòng trên Windows. Đã tách helper vào config, format đúng file
và chạy script đồng bộ contracts; không thay schema hoặc lockfile để bỏ qua lỗi.

Hai lượt full integration trước đó gặp lỗi emulator `Transaction is invalid or closed` ở ca đồng thời
cũ (lần lượt 164/167 và 166/167 PASS). Không skip, tăng quyền hoặc đổi transaction nghiệp vụ để ép
PASS. Lượt đầy đủ sau cùng trên Node 22/Java 21 và Firestore+Storage đạt 180/180; lỗi cũ không
tái hiện trong lượt đó. Đây không phải bằng chứng rằng emulator không bao giờ bị lỗi.

## Kết quả thực chạy của lần chốt ban đầu

Các lệnh dùng lockfile hiện tại và Node.js 22.23.2; emulator dùng Java 21 và demo project
`demo-haircut`. Không kết nối thử nghiệm ghi dữ liệu với project production.

Một lượt `npm run check` bị truyền nhầm `VITE_APP_ENV=production` cho cả unit suite: 340/342
PASS, 2 ca adapter test FAIL vì khóa production đã từ chối adapter như thiết kế. Không nới khóa,
skip hoặc đổi kỳ vọng. Lượt xác minh đúng quy trình tách môi trường unit test khỏi build
production có cấu hình Firebase CI giả; kết quả cuối được ghi dưới đây.

| Kiểm tra                                    | Kết quả                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `npm ci` Customer Web / Functions / Manager | PASS, lockfiles không đổi                                                                                    |
| Web lint / format / unit toàn bộ            | PASS: lint 0 warning, format, 342/342 tests trong 63 file                                                    |
| Web production-mode build                   | PASS: TypeScript và Vite; cấu hình Firebase CI giả, không phải artifact để deploy production                 |
| Web coverage privacy                        | PASS 34/34; lines/statements 99,43%, functions 100%, branches 94,94%; chỉ 7 module mới, không phải toàn repo |
| Functions `npm run check`                   | PASS: contracts byte equality, typecheck, lint, format, 119/119 unit                                         |
| Functions `npm run build`                   | PASS                                                                                                         |
| Firestore/Storage Rules                     | PASS 35/35                                                                                                   |
| Full callable integration                   | PASS 180/180, 11 file, gồm privacy và deletion lifecycle                                                     |
| Withdrawal domain coverage                  | PASS 11/11; lines/statements/functions 100%, branches 96,77%                                                 |
| Browser default 3 project                   | PASS 72/72; chạy lại từ test build mới sau hardening cuối, desktop Chromium, Pixel viewport, iPhone WebKit   |
| Owner responsive browser                    | PASS 35/35 trên 5 cấu hình từ 320px, 360px, iPhone WebKit, tablet đến desktop                                |
| Returning customer staff browser            | PASS 6/6 trên Chromium desktop/mobile và WebKit mobile                                                       |
| Manager Web check                           | PASS: typecheck/lint/format, 78/78 unit, Web build                                                           |
| Root `node --test test/*.test.mjs`          | PASS 40/40                                                                                                   |
| Secret scan tracked + untracked             | PASS; không in giá trị credential                                                                            |
| CSP synchronization                         | PASS; CSP không bị đổi                                                                                       |
| GitHub CI / PR                              | BLOCKED: chưa có xác nhận push/PR của đợt privacy này                                                        |
| Merge / deployment / kiểm tra live bản mới  | NOT RUN, không có quyền thực hiện                                                                            |

Build/test có cảnh báo NO_COLOR/FORCE_COLOR và Manager plugin esbuild/oxc/chunk >500KB;
các cảnh báo không bị ẩn. Không gọi bản Web build là phát hành native.

Browser dùng adapter và OTP giả được khóa bởi test build + cờ test; không gửi SMS thật. Ca giữ
storage không chứng minh mọi trình duyệt vật lý giữ Auth vô hạn. Network không có analytics trong
test build (monitoring disabled) không tự chứng minh SDK production; các runtime unit tests có
monitoring enabled, SDK mocks kiểm tra init/queued callback/withdrawal riêng.
Coverage domain backend không bao gồm toàn bộ index.ts; regression giao dịch xóa có 2 ca riêng.
Các trang công khai qua axe trong phạm vi đã chạy, không phải chứng nhận WCAG toàn site.

## Cổng bảo mật và vận hành còn mở

`npm audit --omit=dev` trên lockfiles không đổi ngày 30/10 vẫn **FAIL**:

- Customer Web: 1 high (Zod).
- Functions: 2 high, 10 moderate (gồm Zod/body-parser và dependency bắc cầu).
- Manager: 2 critical, 7 high; có dependency native nằm ngoài artifact Web cùng các dependency
  Firebase/gRPC/Zod. Severity của package không tự chứng minh Web production khai thác được;
  cũng không được dùng phạm vi native để bỏ qua mọi cảnh báo.

Không chạy `npm audit fix --force`, không nâng SDK/native ngoài phạm vi. PR #80/#82 và các
bản vá khác cần đối chiếu, kiểm thử, phê duyệt và phát hành riêng trước khi đóng cổng security.
Unit/E2E PASS không có nghĩa dependency scan PASS hoặc toàn hệ thống đã đạt tiêu chuẩn pháp lý.

Xác nhận mới nhất của chủ dự án: chỉ công khai email hỗ trợ; ẩn tên, điện thoại và địa chỉ cá nhân.
Giữ các trường này trống theo lựa chọn hiện tại, không tự suy ra
miễn mọi nghĩa vụ công bố thông tin. Nguồn/quyền ảnh nền, lịch lưu dữ liệu và người chịu trách nhiệm
xử lý quyền dữ liệu còn cần xác nhận. Xem [checklist 20 mục](../PRIVACY_CHECKLIST.md).
Không tự bịa thông tin công khai, gắn nhãn AI cho ảnh chưa rõ nguồn hoặc cam kết thời hạn xóa
mà chưa có quy trình, kiểm tra log/backup/TTL và rà soát pháp luật phù hợp.

Logs, coverage và screenshot local ở `.tmp/`, `coverage/`, `test-results/`, không commit.
Không sử dụng CI của PR khác làm chứng cứ của nhánh này.

## Cập nhật liên hệ do chủ dự án cung cấp

Mục tiêu: trang liên hệ dùng đúng tên cá nhân/hotline được phép công khai khi không có cấu hình
ghi đè; không bịa địa chỉ, không thay email đã được duyệt, Auth, API hoặc dữ liệu khách.

- RED `27d7a76`: chạy 2 file `PublicContact.test.tsx`, `LegalContact.test.tsx` bằng Vitest;
  3 FAIL/4 PASS vì chưa có tên/hotline đã được cung cấp.
- GREEN `729eea9`: chạy lại cùng 2 file, 7/7 PASS cho lựa chọn cũ. Tên, liên kết điện thoại,
  email và quyền ghi đè cấu hình hợp lệ được giữ đúng; địa chỉ chưa cung cấp vẫn không hiện.
- Kiểm tra bổ sung: lint PASS; format ban đầu FAIL tại `LegalContact.test.tsx`, đã format đúng
  file này và chạy lại PASS. Coverage privacy 34/34 PASS, lines/statements 99,44%, functions
  100%, branches 94,94% trong 7 module mới. `npm run build:test` (gồm TypeScript) PASS.
- Browser bổ sung: `playwright test e2e/privacy-checklist.spec.ts --grep "public policies"`
  3/3 PASS từ test build mới, kiểm tra route công khai, viewport và axe trên desktop Chromium,
  mobile Chromium và mobile WebKit. Không chạy lại toàn bộ backend/342 unit/113 E2E cho thay
  đổi metadata này; các kết quả rộng hơn ở bảng phía trên thuộc lần chốt ban đầu.
- Production-mode build bổ sung: `npm run build:web` với Firebase CI giả PASS, gồm TypeScript
  và Vite. Không deploy artifact CI hoặc dùng nó như bằng chứng website thật đã cập nhật.
- Sau khi chủ dự án hỏi về việc không công khai địa chỉ cá nhân, giữ nguyên địa chỉ trống và
  ghi nhận lựa chọn này; không thêm, tìm kiếm hoặc công bố địa chỉ nhà riêng. Việc rà nghĩa vụ
  công bố theo mô hình hoạt động là cổng pháp lý riêng, không được đánh dấu PASS tự động.

## Thay thế lựa chọn cũ: chỉ công khai email hỗ trợ

Phần này thay thế lựa chọn công khai tên/điện thoại ở trên. Không tự sửa lịch sử Git hoặc xóa
tài khoản/dữ liệu salon. Nhánh privacy chưa push; các commit cũ vẫn có thể chứa thông tin từng
được cho phép công khai. Không push lịch sử đó trước khi chủ dự án chọn cách xử lý phù hợp.

- RED `fc71a34`: 7 FAIL/6 PASS tái hiện liên hệ cá nhân hiện ra và link email cũ còn trên các trang.
  GREEN `aefe38b`: 13/13 PASS khi chưa có kênh công khai.
- Sau đó chủ dự án xác nhận lại chỉ email hỗ trợ được công khai. RED `d137101`: Web 6 FAIL/7 PASS;
  Manager 4 FAIL. GREEN `573bf1f`: Web 13/13 và Manager 4/4 PASS.
- Web và Manager chỉ lấy email hỗ trợ đã duyệt từ cấu hình công khai riêng, không đọc lại tên,
  điện thoại, địa chỉ hoặc email cũ. Không phát sinh `mailto:`/`tel:` trống khi email sai cấu hình.
- Trang quản lý tài khoản vẫn giữ đúng danh tính của người đã đăng nhập; không đổi Auth,
  quyền tài khoản, ID khách, điểm, quà, dữ liệu nội bộ hoặc backend.
- Các mẫu demo/kiểm thử không dùng tên/số điện thoại cá nhân của chủ dự án. Tài liệu hiện tại
  bỏ thông tin đã rút quyền công khai. Không hứa xóa được bản đã tải, cache hay lịch sử từ xa.

### Xác minh sau khi chỉ cho phép email

| Kiểm tra thực chạy                      | Kết quả                                                                                                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web `npm run test:run`                  | PASS 345/345, 64 file                                                                                                                                            |
| Web `npm run test:privacy:coverage`     | PASS 37/37; 7 module chọn: lines/statements 99,41%, functions 100%, branches 94,73%                                                                              |
| Web lint / format                       | PASS, không warning lint                                                                                                                                         |
| Web `npm run build:web`                 | PASS TypeScript/Vite, dùng Firebase CI giả, không deploy                                                                                                         |
| Web `npm run test:e2e`                  | PASS 72/72 từ test build mới; ca public policies kiểm tra email hỗ trợ có hiện và không có nhãn tên/địa chỉ/điện thoại hoặc link tel                             |
| Manager Web `npm run check`             | PASS: typecheck/lint/format, 87/87 tests và Web build                                                                                                            |
| Manager pure support component coverage | PASS 3/3 render tests, lines/statements/functions/branches 100% trong đúng `PublicSupportLinks.tsx` (4 statements, 8 branches), không phải coverage toàn Manager |
| Functions `npm run check`               | PASS contracts/typecheck/lint/format và 119/119 unit; backend production code không đổi trong lần ẩn liên hệ này                                                 |
| Root repository tests                   | PASS 40/40                                                                                                                                                       |
| Secret scan / CSP sync                  | PASS, không sửa CSP                                                                                                                                              |
| Rà tên/số điện thoại đã rút quyền       | Không còn khớp chuỗi trong tracked working tree hoặc Web production/test/Manager Web bundle; email hỗ trợ được giữ đúng xác nhận mới nhất                        |
| Lockfiles / production resources        | Không đổi lockfile, Firebase config, Rules, IAM, TTL, dữ liệu thật; không push/PR/merge/deploy                                                                   |

Hai lần đo Manager coverage đầu chưa chạy được test: runner Manager thiếu coverage provider,
runner Functions thiếu môi trường jsdom. Không coi báo cáo 0% của các lần lỗi công cụ đó là PASS.
Dùng provider Vitest 4.1.10 đã cài của Functions với môi trường Node cho component thuần, không
thêm dependency hoặc sửa lockfile; tương tác màn Owner/Staff vẫn được kiểm tra riêng bằng jsdom:

```powershell
# Chạy từ apps/manager-mobile, sau khi Functions dependencies đã được cài.
node ../../firebase/functions/node_modules/vitest/vitest.mjs run --config vitest.config.ts --environment=node src/components/PublicSupportLinks.test.tsx --coverage --coverage.include=src/components/PublicSupportLinks.tsx --coverage.reportsDirectory=coverage/support-privacy --coverage.reporter=text --coverage.reporter=json-summary --coverage.thresholds.lines=80 --coverage.thresholds.functions=80 --coverage.thresholds.branches=80 --coverage.thresholds.statements=80
```

Không chạy lại emulator integration/Rules trong lần này vì không đổi logic backend hoặc Rules.
Các cảnh báo dependency ở cổng phát hành phía trên chưa được xử lý bởi thay đổi liên hệ này.
Đây không phải bằng chứng production/GitHub cũ đã được gỡ thông tin; lịch sử, cache và bản sao
cần xử lý riêng với quyền phù hợp, không tự force-push hoặc hứa xóa các bản người khác đã tải.
