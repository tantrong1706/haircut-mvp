# Bản chuẩn bị phát hành Web — 31/10/2026

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

Đã gặp một lần metadata của dependency `file:` vẫn dùng hợp đồng cũ dù cập nhật lock;
bộ regression phát hiện 14 ca lỗi. Cài lại rõ đường dẫn hợp đồng, tạo lock rồi `npm ci` sạch đã sửa.
Không sửa kiểm thử, hạ ngưỡng hoặc dùng `npm audit fix --force` để làm kết quả xanh.

## Kiểm thử đã thực chạy

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

## Giới hạn và cổng còn phải qua

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
