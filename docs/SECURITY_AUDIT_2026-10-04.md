# Web security audit — 4 October 2026

## Tóm tắt cho chủ dự án

- Đã vá trong source: chủ bị khóa vẫn đọc hồ sơ nhân viên; dùng một quyền upload để tạo ảnh
  khác tên; bộ lọc log bỏ sót token/mã xác thực Web. Bổ sung chặn nhúng trang để giảm clickjacking.
- Chưa triển khai các bản vá này lên production. Cần phát hành Rules và Hosting đã kiểm thử;
  không cần deploy Functions chỉ để áp dụng những thay đổi code hiện tại.
- Thư viện vẫn còn cảnh báo High: ưu tiên cập nhật có kiểm soát dependency backend, sau đó
  xử lý SDK Zalo cũ và chuỗi Firebase trên các app. Không tự hạ Firebase theo gợi ý audit.
- App Check vẫn theo dõi; cần số liệu traffic trước khi bật chặn. Cần xác minh khôi phục backup.
- Không thay định danh khách, không sửa điểm/lịch sử và không chạy thử tấn công trên dữ liệu thật.

Phần dưới ghi bằng chứng, phạm vi và giới hạn; đây không phải chứng nhận hệ thống không còn lỗ hổng.

Scope: `codex/web-primary`, Customer Web, Manager/Admin boundaries, Firebase Functions,
Firestore/Storage Rules, QR/points/rewards/photos, telemetry, dependencies and Hosting headers.
This is a source-and-test audit, not a claim that every vulnerability has been eliminated.
No destructive tests were sent to production. No real OTP/customer data were used in tests.

## Findings fixed in source (not deployed)

| Priority                               | Finding and evidence                                                                                                                                                                                                                                                   | Fix                                                                                                                                                             | Verification                                                                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| High                                   | `/users` allowed a salon owner to read another staff profile without checking the owner's active status or salon suspension. Two emulator tests reproduced the unauthorized reads.                                                                                     | Reuse `isOwner(resource.data.salonId)`, which includes active membership and operational salon checks. Self-profile reads remain available for status/recovery. | RED: inactive/suspended owner reads unexpectedly succeeded. GREEN: Rules suite 26/26, including active-owner and cross-salon controls. |
| Medium                                 | Storage upload rules checked the operation's stored path but did not bind the actual uploaded filename to that operation. An authorized staff member could reuse one operation's metadata for another `op-*.jpg` object, bypassing the intended one-object allocation. | Require `fileName == operationId + '.jpg'` in addition to existing ownership, consent, expiry, size and metadata checks.                                        | RED: alternative filename upload succeeded. GREEN: alternative filename rejected while canonical upload still succeeds.                |
| Medium, conditional telemetry exposure | The monitoring scrubber recognized Zalo token names but missed Firebase Storage `token`, Web ID/refresh tokens, action codes and quoted JSON credentials. This proves insufficient sanitization, not that a real token was sent to Sentry.                             | Case-insensitive Web credential redaction in URL query/hash/userinfo and text/JSON error content; separate testable privacy module.                             | RED: fixture secrets survived. GREEN: 8 tests; new privacy module 100% lines/statements/branches/functions.                            |
| Defense in depth                       | Live GET on 4 October returned HSTS/nosniff/report-only CSP, but no enforced CSP or X-Frame-Options. The report-only frame policy does not prevent framing. No clickjacking attack was performed.                                                                      | Add global `X-Frame-Options: DENY` for the Web-only product. Keep existing CSP rollout unchanged.                                                               | Header regression RED then GREEN 2/2; CSP source synchronization PASS.                                                                 |

Checkpoint commits: Rules RED `d79f4a4`; redaction RED `16656c9`; three fixes GREEN `19b530c`;
anti-framing RED `2a5710a`, GREEN `a9fd6b0`; privacy extraction/coverage `b98b80e`.

Read-only Firebase Rules API verification also inspected the deployed Rules releases: the exact
live `/users/{uid}` block still has the legacy owner clause and lacks the active-owner guard;
the live Storage source lacks the filename/operation binding. No exploit was sent to production,
and no Rules release was changed. These two fixes therefore remain urgent deployment work.

### Commands and limitations

- Rules: `firebase emulators:exec --project demo-haircut --only firestore,storage
"npm --prefix functions run test:rules:emulator"` (from `firebase/`). RED 3 failures/23 passes;
  GREEN 26/26. No production project was targeted.
- Windows Java 21 needed a short `jdk.net.unixdomain.tmpdir` for emulator sockets. This was a
  per-process test setting, not a system/firewall change. The first emulator startup failure was
  not counted as RED evidence.
- Redaction: `npm run test:run -- src/services/monitoring.test.ts --coverage
--coverage.include=src/services/monitoringPrivacy.ts`; final 8/8, coverage 100% all dimensions.
- Header assertions: `node --test test/web-security-headers.test.mjs`; final 2/2.
- Final source CI: [run 37210809569](https://github.com/tantrong1706/haircut-mvp/actions/runs/37210809569),
  commit `7db662af2572bdbd1424ce41c213b80ce5431947`, **6/6 jobs PASS**: Customer Web, Manager,
  Admin, Functions/Rules/integration, browser flows and repository checks. The earlier run stopped
  at formatting of a new Rules test; formatting was corrected before this full green run.
- Local long-running regression output interrupted by a chat/runtime transition is not counted
  as a completed PASS; the full CI above supplies the completed regression evidence.

## Dependency audit: unresolved upgrade work

`npm audit --omit=dev --json` ran against the four existing lockfiles on 4 October. These are
package-level findings, not counts of independently exploitable app vulnerabilities; inherited
alerts and shared packages repeat across workspaces.

| Workspace          | Critical | High | Moderate |
| ------------------ | -------- | ---- | -------- |
| Customer Web       | 0        | 10   | 2        |
| Firebase Functions | 0        | 2    | 11       |
| Manager            | 0        | 6    | 0        |
| Admin Web          | 0        | 4    | 0        |

1. **Prioritize targeted backend dependency patches.** The installed production tree includes
   `firebase-admin@13.10.0 -> @fastify/busboy@3.2.0` and
   `google-gax@4.6.1 -> @grpc/grpc-js@1.14.4`. Review compatible patched resolutions and rerun the
   emulator suite before deployment. See the [busboy advisory](https://github.com/advisories/GHSA-xjh9-v7x6-24jw)
   and [gRPC advisory](https://github.com/advisories/GHSA-m9gg-hp2v-232j). The gRPC certificate issue
   has specific server-credential/auth-context conditions; this application uses Firestore clients,
   and no matching application-owned gRPC authentication server was identified.
2. **Retire the remaining Zalo SDK dependency through a separate compatibility-path refactor.**
   `zmp-sdk` still pulls old Sentry and build-tool chains into the production dependency tree.
   The [Sentry advisory](https://github.com/advisories/GHSA-593m-55hh-j8gv) concerns a gadget requiring
   prototype pollution; no prototype-pollution entry point was demonstrated in this app.
3. **Resolve Web/Manager/Admin Firebase dependency alerts coherently.** Do not apply the audit
   tool's proposed Firebase 9.14.0 or ZMP 2.9.4 downgrade blindly. Inspect lockfile ranges, browser
   versus Node entry points and actual built bundles. Preserve OTP/session compatibility.

No dependency versions or lockfiles were changed by this security patch. A zero-Critical audit
count is not a clean bill of health. Dev-only tooling was not included in these counts.

## Other changes worth planning

- **Before claiming production patched:** deploy the tested Firestore/Storage Rules and Hosting
  changes separately with rollback evidence. Until then, live behavior is unchanged.
- **App Check:** retain monitor mode until representative customer/staff verified traffic and
  failure rates are measured. One successful phone check is not enough to enable enforcement
  for everyone. The owner has since confirmed repeated sign-in persistence; the old audit notes
  about that pending user check are historical, not proof of a current failure.
- **CSP:** remove obsolete Zalo allowances and move the remaining policy from report-only to
  enforced only after testing OTP/reCAPTCHA, photos and print/export. The anti-framing header is
  deliberately a small independent protection, not a claim of full CSP enforcement.
- **Recovery:** a Firestore backup script and source TTL definitions exist. A recent successful
  production backup restore and deployed TTL settings were not independently verified in this audit.
- **UX/reliability:** distinguish missing salon context from signed-out/restore-error states on
  `/history`; otherwise the generic "Cần QR" screen can look like a login failure. Never guess the
  tenant or silently substitute an account/branch to conceal this state.

## Boundaries inspected

- Web principals are derived from verified Firebase Phone Auth; customer IDs include salon and UID.
- QR verification uses HMAC and constant-time comparison; client business writes are denied.
- Point awards and reward redemption use transactions, ownership/branch checks and replay/idempotency
  guards; concurrent-customer/retry scenarios remain covered by the existing integration suite.
- Photo paths, consent, MIME/size, ownership, operation expiry and finalization checks were inspected.
- Admin/member authorization is server-side; React text rendering and QR print escaping were checked.
- Service worker excludes cross-origin Firebase traffic; no caching change was made.
- No claim is made about live secret rotation, IAM, billing limits, complete dependency reachability,
  penetration testing, all browser privacy modes or a fresh real-phone transaction in this audit.
