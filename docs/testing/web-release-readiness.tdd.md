# Bản chuẩn bị phát hành Web — cập nhật 04/11/2026

Base main `89cee9a6b9febac888bd27f7511698969fb8f16e`, nhánh `codex/web-release-readiness`.
Kết quả dưới đây đã chạy local; **chưa phải xác nhận CI hay production**.
Hành trình và phạm vi được chốt trực tiếp với chủ dự án, không dùng kế hoạch bên ngoài.

## Bằng chứng RED → GREEN

| Phần              | RED thực chạy                                                | GREEN thực chạy / bảo đảm                                                                                                                  |
| ----------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Dependency        | `67159ae`: 29/54 ca lỗi ở phiên bản/bounds cũ                | 54/54 ca PASS sau cập nhật lockfile và `npm ci` cả bốn workspace; `a28105a`                                                                |
| Tên khách backend | `582ced0`: 20 ca emulator lỗi vì chưa có callable            | 20/20 PASS, `4b26e75`; chủ sửa danh bạ, nhân viên chỉ sửa yêu cầu chờ đúng chi nhánh; không đổi điểm/SĐT/ID/lịch sử hoàn tất               |
| Tên khách UI      | `4b1a219`: chưa có thao tác ở trang thật/fixture trình duyệt | `f756b51`: service/editor 14 ca, trang Staff 3 ca và browser Owner PASS; giữ ghi chú và điểm                                               |
| Phát hành Web     | `3a995c7`: policy chưa tồn tại                               | `834418a`: 37/37 ca PASS, gồm chạy PowerShell thật trong fixture cô lập và xác nhận strict mặc định vẫn chặn thiếu App Check/Sentry/native |

CodeQL PR #83 còn phát hiện regex hostname trong bộ quan sát mạng E2E khớp quá rộng.
`d18215c` tái hiện sáu tên miền giả; `aeca289` sửa biên tên miền và 15/15 ca PASS.
Regression này được thêm vào CI. Không đổi website, bỏ cảnh báo hoặc hạ mức quét bảo mật.

Rà phạm vi bằng cả source và nơi gọi, không chỉ hậu tố tên: `getSystemFeatureFlags` chỉ dùng
ở Admin và yêu cầu `assertSystemAdmin`. Checkpoint `b0a10f1` bắt lỗi danh sách ban đầu;
sau loại API này, policy/runtime 38/38 PASS, coverage giữ 100% dòng và 97.06% nhánh.
Danh sách cuối chỉ có 54 callable Web hiện hữu và ba callable mới, không phát hành API Admin.

Đã gặp một lần metadata của dependency `file:` vẫn dùng hợp đồng cũ dù cập nhật lock;
bộ regression phát hiện 14 ca lỗi. Cài lại rõ đường dẫn hợp đồng, tạo lock rồi `npm ci` sạch đã sửa.
Không sửa kiểm thử, hạ ngưỡng hoặc dùng `npm audit fix --force` để làm kết quả xanh.

## Kiểm thử tổng thể đã thực chạy ngày 31/10

| Lệnh / nhóm                                                         | Kết quả                                                                                 |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `node --test test/*.test.mjs`                                       | 118/118 PASS                                                                            |
| Functions `npm run check`, `npm run build`                          | typecheck/lint/format/build PASS; 119 unit PASS                                         |
| Rules + integration, project demo, Firestore/Storage emulator       | 35/35 Rules và 200/200 integration PASS                                                 |
| Customer `npm run lint`, `npm run format:check`, `npm run test:run` | PASS; 360/360 test                                                                      |
| Customer `npm run test:e2e`                                         | 72/72 PASS                                                                              |
| Customer `npm run test:owner:browser`                               | 40/40 PASS, gồm rename và viewport nhỏ/WebKit/desktop                                   |
| Customer `npm run test:returning:browser`                           | 6/6 PASS                                                                                |
| Admin `npm run check`                                               | 42/42 test, typecheck/lint/build PASS                                                   |
| Manager `npm run check`                                             | 87/87 test và build PASS; lần đầu format lỗi ba file hỗ trợ, đã format và chạy lại PASS |
| `npm audit --omit=dev`, cả bốn workspace sau `npm ci`               | 0 lỗ hổng runtime được báo trong lần kiểm tra                                           |
| `node scripts/check-secrets.mjs --include-working-tree`             | PASS; không in credential                                                               |

Coverage đã đo: tên khách client 98.01% dòng, 91.66% nhánh; module giao dịch backend
91.66% dòng, 86.53% nhánh; policy phát hành 100% dòng, 97.06% nhánh. Các ngưỡng giữ từ 80%.
PowerShell không được tính chung vào số coverage JavaScript. Bài thử fixture dùng dữ liệu/proof
tổng hợp **chỉ trong thư mục tạm**, không thay proof thật của repository.

## Bổ sung ngày 04/11 — chưa phải bằng chứng production

- Chủ dự án chấp thuận thêm khách tự sửa tên và API `updateWebCustomerName`, phát hành khi
  kiểm thử/CI đạt. Danh sách cuối 57 API: 54 callable Web hiện hữu và ba API mới, vẫn loại Admin.
- `fd57c8e`: 15 ca API và 9 ca client RED vì chưa có self-service. Sau triển khai, nhóm tên
  khách gồm 37 API PASS (22 owner/staff + 15 tự sửa), 26 client/component PASS.
  Coverage backend 92.66% dòng / 87.41% nhánh; client 98.73% dòng / 94.44% nhánh.
- `93e37b0`: thêm hai ca RED cho salon bị tắt. Guard mới nằm trong transaction của API đổi tên,
  không đổi API nghiệp vụ khác. Khách chỉ sửa hồ sơ hash từ UID Phone Auth server xác minh;
  không nhận quyền từ customerId/uid/SĐT/điểm client gửi và không viết lại lịch sử hoàn tất.
- Browser thêm ba dự án PASS cho thao tác mở/hủy sửa tên ở Tài khoản, không yêu cầu OTP thêm.
  Save thực được kiểm tra qua component và adapter + emulator, không gán là đã thử với khách thật.
- `545ad66`: hai ca Web RED cho thời hạn 2 giờ và một ca empty-state RED. Sau sửa, hai ca Web
  và 10 ca Owner panel PASS: lượt 31 phút còn xác nhận được, vẫn chặn tích điểm lặp sau cộng.
  Chỉ thay hằng thời hạn tạo lượt Web; không đổi legacy/Zalo, lịch chạy dọn hoặc dữ liệu đang lưu.
  Đối chiếu lỗi người dùng bằng đọc metadata cho thấy yêu cầu hết hạn, không phải tự phê duyệt;
  không lưu thông tin định danh khách/salon vào báo cáo này và không sửa bản ghi thật.

### Kiểm thử giao dịch và giới hạn emulator

- CI trên `fd5b8ac` có 199/200 integration PASS; ca duyệt đồng thời gặp cùng lỗi
  `INVALID_ARGUMENT: Transaction is invalid or closed`. Không đánh dấu bỏ qua hoặc chạy lại đến xanh.
- `aa1cc27` → `535118b`: test runner riêng ép REST **chỉ cho child process** với project `demo-*`
  và host loopback; 14 guard PASS (100% dòng / 92.86% nhánh). Production không import runner.
- Thử REST ban đầu có 198/200 lỗi do fallback tìm ADC. Đã sửa fixture auth dùng token quản trị
  emulator `owner`, không phải credential thật; không dùng ADC/OAuth thật hoặc sửa node_modules.
  Sau đó toàn bộ 200 integration cũ PASS. Không có retry/skip, không đổi các assertion giao dịch.
- Giữ các bài tương thích gRPC riêng cho SDK khách/Admin. Không coi transport giả lập là chứng minh
  mọi tình huống production hoặc tự nới xử lý lỗi giao dịch của ứng dụng.
- Tham chiếu: [giới hạn giao dịch emulator của Google](https://docs.cloud.google.com/firestore/native/docs/emulator),
  [báo cáo upstream cùng dạng lỗi](https://github.com/googleapis/google-cloud-node/issues/9693).

Tổng kiểm thử sau toàn bộ thay đổi mới phải được chạy lại và ghi trên PR #83/CI; không dùng số
31/10 thay cho source mới. Không merge/deploy chỉ vì các nhóm chọn lọc ở trên đã đạt.

Full-suite trên `9c044e1` ngày 04/11 đạt 16/19 bước: 371 unit Web, 219 integration và 35 Rules
đã PASS, nhưng format hai file test backend chưa đúng và một test RTL dùng nhầm tùy chọn `exact`
của Playwright, làm TypeScript/build/E2E dừng. Đã sửa tùy chọn test (tên chuỗi của RTL vẫn khớp
chính xác theo mặc định), dùng formatter của đúng workspace; không bỏ typecheck hoặc hạ assertion.
Build test và format đã chạy lại PASS; full-suite trên SHA cuối vẫn bắt buộc chạy lại.

## Giới hạn vận hành và cổng còn phải qua

- Lần tổng thể đầu trên `9a340ec`: 18/19 bước PASS; integration 199/200, bài hai spin đồng thời
  trả `INVALID_ARGUMENT: Transaction is invalid or closed` từ emulator. Không bỏ bài, tăng retry
  kiểm thử hoặc sửa nghiệp vụ để ép xanh. Chạy cô lập đúng bài ba lần liên tiếp đều PASS
  (mỗi lần chỉ 1 ca được chọn; 33 ca khác bị lọc, **không tính là full suite**).
  Cần chạy lại toàn bộ trên HEAD cuối cùng; không coi ba lần thử riêng là thay thế proof đầy đủ.

- Dev-tool dependency audit vẫn còn cảnh báo; không tuyên bố toàn bộ ecosystem không lỗ hổng.
  Không nâng major Vite/SDK hoặc native app trong đợt này. API runtime mới cần phát hành mới nhận thư viện đã vá.
- Không có chứng nhận pháp lý/WCAG hay cam kết không còn lỗi. Ảnh minh họa AI do chủ dự án xác nhận;
  quyền ảnh khách và vận hành inbox vẫn cần người phụ trách.
- Privacy giữ email hỗ trợ đã duyệt, ẩn tên/SĐT/địa chỉ riêng. Lưu lâu dài khi mục đích còn hiệu lực,
  không vô hiệu OTP/link expiry hoặc dọn upload tạm. Chưa tạo lịch xóa dữ liệu khách thật.
- API classic branch protection trả 404, nhưng kiểm tra tiếp rulesets xác nhận main **có bảo vệ**:
  bắt buộc PR, giải quyết review thread và 9 status checks; cấm xóa/force push.
  Không tự đổi cấu hình hoặc đẩy thẳng main để bỏ qua ruleset. Cổng phát hành còn yêu cầu
  CI tin cậy và mọi check trả success trên đúng SHA, không nhận skipped/pending.
- Phải chạy `scripts/check.ps1 -Full` trên **SHA main cuối cùng** để tạo proof thật, kiểm tra CI lại,
  sao lưu riêng cấu hình/artifact trước phát hành và chỉ dùng danh sách 57 callable đã duyệt.
- Không deploy Zalo, Admin, native, trigger/schedule, Rules, IAM, TTL hoặc đổi App Check.
  Không thử OTP/email/điểm/xóa hồ sơ khách thật để kiểm thử.
- Biên bản phát hành thật phải ghi riêng SHA/Hosting version/API ACTIVE và kiểm tra HTTPS sau deploy.

## Cách chạy bảo trì đã được duyệt

Sau khi main sạch, CI và full-suite trên đúng SHA đạt:

```powershell
PowerShell -NoProfile -ExecutionPolicy Bypass -File scripts/release-web-maintenance.ps1 -ExpectedSha <full-main-sha> -DryRun
PowerShell -NoProfile -ExecutionPolicy Bypass -File scripts/release-web-maintenance.ps1 -ExpectedSha <full-main-sha>
```

Không tạo Functions dotenv: Firebase CLI giữ biến môi trường riêng từng endpoint khi không dùng dotenv.
Không đọc/commit giá trị secret, không đổi QR signing key. Nếu rollout một phần lỗi, giữ Hosting cũ,
đối chiếu trạng thái từng endpoint và dùng backup đúng phạm vi; không tự deploy toàn bộ để chữa lỗi.
