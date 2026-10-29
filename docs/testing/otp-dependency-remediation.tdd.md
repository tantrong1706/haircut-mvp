# OTP dependency remediation — TDD evidence

Verification date: 2026-10-29, Asia/Saigon. Branch: `codex/auth-cost-optimization`.
Main baseline: `89cee9a6b9febac888bd27f7511698969fb8f16e`.
Implementation checkpoint before dependency changes: `e59e4cf`.

The owner authorized dependency remediation, pushing this branch, opening a PR and running CI.
This does not authorize merging, deploying, enabling passkeys/SMS hooks, changing cloud
configuration, buying SMS services, or sending real OTP/email. No production resources or data
were changed. Journeys were derived from the same
[auth cost-control request](auth-cost-optimization.tdd.md), not an external plan file.

## Guarantees and bounded changes

- Reject oversized constrained input before visiting every element, while keeping accepted
  contract values, roles, callable names, defaults and ordinary validation paths compatible.
- Keep Firebase Admin, Firebase Functions and their Google database/storage SDK versions unchanged.
- Patch only the vulnerable dependency families and refresh the same local contracts package in
  all four consumers. Contract JS/type declarations are unchanged; private package metadata moves
  from `0.2.0` to `0.2.1` so clean installs receive the updated Zod requirement.
- Preserve CommonJS and the no-argument UUID v4 use in the actual Google HTTP/RPC consumers.
- Keep existing customer/manager identity, tenant, points, rewards and private-photo tests passing.

| Dependency  | Before → after in Functions                       | Primary advisory                                                         |
| ----------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| Zod         | 4.4.3 → 4.6.7, minimum ^4.6.6 in shared contracts | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) |
| body-parser | 1.20.8 → 1.20.9                                   | [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828) |
| qs          | 6.16.0 → 6.16.2                                   | [GHSA-6pq8-jhm2-2vcw](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw) |
| uuid        | 9.0.1 → 11.1.1 in targeted consumers              | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) |

The UUID override is an intentional cross-major exception, limited to gaxios 6, google-gax 4
and teeny-request 9. Their installed source uses `require("uuid").v4()` without arguments;
the tests resolve UUID from each actual consumer, not an unrelated top-level copy. UUID 11
retains CommonJS. No Firebase major upgrade or `npm audit fix --force` was used.
The full lockfile delta contains only these four families and contracts metadata. Customer Web,
Admin and Manager locks change only Zod and contracts relative to `e59e4cf`.

## RED → GREEN checkpoints

1. `6cab614` records runtime RED before manifests changed. Running
   `node --test test/backend-dependency-security.test.mjs test/web-dependency-security.test.mjs test/admin-dependency-security.test.mjs`
   executed 45 tests: 27 failed and 18 passed. Zod visited all 64 synthetic elements rather than
   stopping at the bound, vulnerable versions failed their floor, qs could throw, and old UUID
   did not reject short output buffers. Manager's separate target executed 7 tests: 5 failed,
   2 passed. Inputs are small and local; no live endpoint was stressed.
2. An intermediate run still failed 14 of 52 cases because npm kept stale local-file package
   metadata in consumers. Refreshing the same `file:` dependency with npm regenerated the locks;
   schema definitions and runtime exports were not changed to satisfy tests.
3. `0d149de` records GREEN: the same four targets executed 52 tests, all passed. A subsequent
   clean `npm ci` succeeded in Functions, Customer Web, Admin and Manager without lockfile edits.
   No test was skipped or disabled to obtain GREEN.

## Executed verification

| Guarantee / command                                           | Result                                 | Scope                                                                                      |
| ------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------ |
| Four workspace `npm ci` runs                                  | PASS                                   | Exact checked-in lockfiles; no native release                                              |
| Four dependency security targets                              | PASS, 52 tests                         | Bounded Zod work, compatibility, version floors, actual UUID consumers                     |
| Root `node --test test/*.test.mjs`                            | PASS, 79 tests                         | Repository/security/Hosting boundaries, overlapping the 52 above                           |
| Functions `npm run check` and `npm run build`                 | PASS, 124 unit tests                   | Typecheck, lint, configured formatting check and compile                                   |
| Backend dependency target after clean install                 | PASS, 21 tests                         | Same dependency guarantees after reproducible install                                      |
| Demo Firestore/Storage `test:rules:emulator`                  | PASS, 40 tests                         | Includes private auth collection access restrictions                                       |
| Demo Firestore/Storage `test:integration:emulator`            | PASS, 166 tests                        | Business transactions and tenant isolation                                                 |
| Demo Firestore `test:auth:coverage:emulator`                  | PASS, 47 tests                         | 94.85% lines, 90.15% statements, 84.27% branches, 95% functions                            |
| Customer Web unit/auth coverage                               | PASS, 316 unit tests / 38 auth cases   | Auth surface: 98.31% lines/statements, 85.71% branches, 100% functions                     |
| Customer Web lint/format/build                                | PASS                                   | Production-mode compile uses public synthetic CI Firebase values, not a release artifact   |
| Admin and Manager `npm run check`                             | PASS, 42 Admin / 78 Manager tests      | Typecheck, lint, applicable format checks and Web builds; no Android/iOS build             |
| Browser flows and cryptographic passkey cases                 | PASS, 57 flows + 2 cryptographic cases | Chromium desktop/mobile and WebKit mobile; virtual authenticators, not actual SMS/hardware |
| Production dependency audit: Functions / Customer Web / Admin | PASS, 0 vulnerabilities in each        | `npm audit --omit=dev` executed after clean install                                        |
| GitHub CI                                                     | Reported in PR checks after push       | Exact final-head result belongs to the PR; local tests alone do not establish CI success   |

Test counts overlap and must not be added as unique cases. This is not an audit of every dev/native
dependency or a claim of zero vulnerabilities across the repository. The separate Manager production
audit still reports 2 Critical and 6 High warnings in existing native dependency families. These
are outside this patch and not released. The new CI Functions audit checks production dependencies
explicitly; the existing Lighthouse job named `audit` is not a dependency security audit.

## Failures, environment and release limits

- Java 21 and an existing workspace JVM Unix-socket temp directory were used for local emulators.
  No global Java configuration or firewall change was needed.
- Manager's first formatting check failed on 11 unchanged files checked out as CRLF on Windows.
  Comparing each file to Prettier output proved the only difference was line endings. Local LF
  normalization produced no Git source diff; no formatting baseline was suppressed or widened.
- Vite 5 reports non-blocking third-party pure-annotation comments in updated Zod. The comments
  are removed by Rollup; no warning filter or dependency source modification was added.
- An interrupted Vite build left generated timestamp config files. A formatting run also overlapped
  a new Vite build and saw its transient config. This failed formatting, not an application assertion;
  the exact stale generated file was removed and the full formatting check passed after builds finished.
- Passkey and SMS-gate rollout flags remain false/absent by default. No real customer account,
  SMS, email, points transaction, image or other business record was created by these tests.
- Production App Check/signing IAM, Identity Platform hook prerequisites/budget and real
  iPhone/Samsung behavior remain separate release gates. See [operating boundaries](../AUTH_COST_CONTROLS.md).
- The equivalent Zod fix also exists in open PR #80; this work does not merge or close it.
