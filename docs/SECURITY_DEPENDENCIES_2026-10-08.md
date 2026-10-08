# Vá dependency backend — 08/10/2026

Phạm vi: Firebase Functions trên `codex/web-primary`. Chỉ cập nhật dependency gián tiếp tương thích,
không đổi Firebase Admin/Functions, logic nghiệp vụ, dữ liệu khách, Rules hoặc cấu hình App Check.
**Chưa deploy production.** Các bản vá Rules/Hosting ngày 04/10 cũng chưa được xác nhận đã triển khai.

## Thay đổi đã chọn

| Dependency                         | Trước  | Sau    |
| ---------------------------------- | ------ | ------ |
| `@fastify/busboy`                  | 3.2.0  | 3.2.2  |
| `@grpc/grpc-js` trong `google-gax` | 1.14.4 | 1.14.5 |
| `proxy-addr`                       | 2.0.7  | 2.0.8  |
| `express`                          | 4.22.2 | 4.22.3 |
| `body-parser`                      | 1.20.6 | 1.20.8 |
| `qs`                               | 6.15.3 | 6.16.0 |

Giữ `firebase-admin@13.10.0`, `firebase-functions@7.2.5` và toàn bộ dependency trực tiếp khác.
Không dùng `audit fix --force`, override vượt range, downgrade hoặc nâng major.
Npm cũng chuẩn hóa metadata `@haircut/contracts` từ link sang `file:contracts` theo cấu hình
`install-links=true` sẵn có; version vẫn 0.2.0, source/API không đổi. Clean install đã kiểm tra.

## Bằng chứng TDD và kiểm thử

User journeys: dependency backend không chấp nhận IP không thuộc subnet tin cậy; query round-trip
không crash vì trường `constructor.isBuffer` do đầu vào cung cấp; query và subnet hợp lệ vẫn hoạt động.

- RED `e402354`: 4/5 test fail với lockfile cũ, gồm hành vi trust subnet sai.
- GREEN `12024e1`: 5/5 PASS sau ba bản vá đầu.
- RED `3bc0655`: 2/7 fail, tái hiện `qs.stringify` ném TypeError sau `qs.parse` đầu vào thử nghiệm.
- GREEN `42cd252`: 7/7 PASS sau cập nhật chuỗi Express/body-parser/qs.
- Test: `node --test test/backend-dependency-security.test.mjs`, đã thêm vào job Firebase Functions
  trong CI sau `npm ci`. Kiểm tra tất cả bản production của bốn gói mục tiêu trong lockfile.
- Hai vòng `npm ci --ignore-scripts --no-audit --no-fund` thành công. Install lifecycle scripts không chạy.
- `npm run check` và `npm run build` của Functions PASS, gồm typecheck/lint/format và 108 unit tests.
- Không thay mã ứng dụng nên không báo coverage cho thư viện bên thứ ba là coverage của ứng dụng.
  Test hành vi dependency và bộ hồi quy giao dịch là bằng chứng tương thích, không phải chứng minh
  mọi advisory có đường khai thác được từ API hiện tại.

## Audit production dependency

Theo `npm audit --omit=dev` trước thay đổi và `npm audit --omit=dev --package-lock-only` với lockfile
sau thay đổi: **1 Critical / 2 High / 11 Moderate → 0 Critical / 0 High / 8 Moderate**.
Đây là số package alerts, có thể gồm cảnh báo kế thừa trùng nhau, không phải số exploit độc lập.

Tám Moderate còn lại thuộc chuỗi Google Cloud/gaxios/google-gax/teeny-request/retry-request/uuid và
cảnh báo kế thừa ở firebase-admin. Audit gợi ý nâng Firebase Admin major 14.5.0 cho phần lớn chuỗi này;
cần một đợt kiểm tra migration riêng, không ép nâng major trong bản vá hiện tại.
Dependency Web, Manager, Admin và dev-only chưa được cập nhật/re-audit trong lượt này; không tuyên bố
toàn repo đã hết cảnh báo.

## Nguồn đối chiếu

- [busboy CRLF, bản vá 3.2.2](https://github.com/fastify/busboy/security/advisories/GHSA-gxm5-99cw-xjw9).
- [gRPC auth-context, bản vá 1.14.5](https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j).
- [proxy-addr trust subnet, bản vá 2.0.8](https://github.com/advisories/GHSA-jqcg-44mw-7w3h).
- [qs isBuffer, bản vá 6.16.0](https://github.com/ljharb/qs/security/advisories/GHSA-4mjr-xmp4-gh2g).

Các lỗi gRPC/proxy-addr cần điều kiện cấu hình cụ thể. Test dependency không chứng minh production
đang dùng cấu hình lỗi. Không gửi payload khai thác đến production và không log credential.

## Triển khai

## Kết quả CI cuối cùng

[CI 37755858721](https://github.com/tantrong1706/haircut-mvp/actions/runs/37755858721) tại source
`42cd2521a9880e78348589800ce0aa2da3a3ba2e`: **6/6 jobs PASS**. Log backend xác nhận 7 kiểm tra
dependency, 108 unit tests, 26 Rules tests và 78 integration tests đều PASS. Browser flows,
Customer Web, Manager, Admin và Repository Checks cũng PASS.
Kết quả integration cuối lấy từ CI đã hoàn tất; không suy diễn từ terminal local bị gián đoạn.

## Phạm vi phát hành

Khác bản vá ngày 04/10 chỉ cần Rules/Hosting, **đợt dependency này cần phát hành Functions** để có hiệu lực
trên server. Phải xác nhận phạm vi Functions, giữ env/secret bindings và mốc rollback trước khi deploy.
Chưa có triển khai, merge main hay thay đổi dữ liệu trong lượt này.
