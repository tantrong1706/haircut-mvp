# Admin operations center — test evidence

## Owner-approved scope

Extend the existing Admin app, not Customer Web. The human selected an existing verified operator
account, approved separate Admin Hosting and required Admin APIs after CI PASS, subsequently approved
main integration and adding only `haircut-c7d12-admin.web.app` to the existing reCAPTCHA domain list.
No production points/reward mutations, legacy admin-write switch, customer Hosting release or customer
API deployment is authorized by this task. The operator's owner role must remain intact.

## Journeys and checkpoints

| Guarantee | RED | GREEN / evidence |
|---|---|---|
| Separate admin authority; tenant-safe diagnostic/repairs; concurrency, stale preview and audit safeguards | `e71b227`: 28 intended emulator failures for missing endpoints / missing grant support | `02cefdf`: same 28 PASS |
| List pagination, independent load errors, repair confirmation, stale auth/diagnostic response isolation | `797f07d`: 8 intended UI failures, 9 passes | `f07c5b4`: 42 UI/service tests PASS |
| Accessible text contrast in all browser engines | `ecc1994`: 3 failures / 6 passes | `3841bde`: 9/9 browser tests PASS |
| Mobile salon identity stays visible and logout remains accessible | `0e4867e`: 2 mobile failures / 1 desktop pass | `d1cb105`: full browser gate passed before commit |
| Admin Node Firestore dependency is patched without upgrading Firebase SDK | `a066aae`: gRPC 1.9.16 failed the 1.14.6 guard | `f4b5d07`: guard and actual SDK/emulator compatibility PASS; production Admin audit 0 alerts |
| Production Admin build never copies private config or targets the wrong Firebase project | `27a7d6b`: 2 intended missing-helper failures | `8489cd2`: both guard tests PASS |

## Commands actually run

- Admin `npm run check`: typecheck, lint, 42 tests, build PASS.
- Admin `npm test -- --coverage`: **100% lines/functions, 98.14% statements, 94.79% branches**
  for `adminSupport.ts` and `SalonSupportPanel.tsx`.
- Functions `npm run check`: typecheck, lint, formatter and **108 unit tests PASS**.
- Local demo emulators, `npm run test:rules:emulator`: **28 PASS**, including browser attempts
  to self-grant admin and forge repair receipts.
- Local demo emulators, `npm run test:integration:emulator`: **106 PASS** across six files.
- Local demo emulator, `npm run test:admin:coverage`: **28 PASS**; support domain **95.27% lines,
  94.3% statements, 100% functions, 86.25% branches**.
- Admin real Node Firebase 12.16.0 / Firestore 4.16.0 with gRPC 1.14.6: write/read/batch/transaction/
  listener/unauthenticated rejection all PASS in `demo-haircut-grpc-compat` on loopback only.
- All emulators shut down after runs. Browser fixture never calls real Firebase or sends SMS.
- Tracked-file secret scan PASS at the recorded checkpoints; final scan required before push.

The first Admin transport command used a rules path outside its test project; Firebase CLI correctly
rejected it. A local equivalent fixture fixed test setup, then the real transport test passed.
This setup error is not counted as a security RED signal. Windows newline warnings were normalized
without changing unrelated business code; LF attributes prevent checkout-dependent formatting.
RTL role-query typing and optional legacy-profile access were corrected during implementation.

## Security and limitations

- Repairs touch only a derived customer counter or a stale pointer. They do not modify points,
  rewards, finished sessions, pending approvals or cooldowns. Audit and deduplication are atomic.
- Actual admin membership is rechecked inside repair transactions, not trusted from the UI.
- Diagnostic pointer scan is bounded at 50 and is explicitly partial when more exist. It is not
  a full error-log collector or a universal auto-fix system.
- Google Billing and code/index errors require their proper operational workflow; links never
  execute repairs or payment actions.
- Scoped gRPC override is temporary and outside Firestore's upstream `~1.9.0` declaration.
  Compatibility was tested; this is not a claim of an upstream Firebase release fix.
- Admin production dependency audit: **0 Critical / 0 High / 0 Moderate / 0 Low**.
- Unchanged Functions production audit: **0 Critical / 0 High / 9 Moderate**, in existing SDK
  dependency chains. Do not claim the entire repository has zero vulnerabilities or silently
  upgrade major Firebase dependencies to hide these findings.
- Admin CSP is the same narrow enforced baseline (`base-uri`, `object-src`, `frame-ancestors`),
  not a complete script/XSS allowlist. No App Check enforcement policy is changed.
- No production repair, permission grant or release is claimed by local fixture tests. Deployment
  and authenticated live evidence must be added only after they actually happen.

## Release status

PR #68 and deployment-path correction #70 were merged after all CI checks passed.
Admin Hosting, the seven scoped Admin APIs and the operator grant were released on 2026-10-14.
See [ADMIN_RELEASE_STATUS.md](../ADMIN_RELEASE_STATUS.md) for exact source, CI and live evidence.
Authenticated operator smoke checks are still pending user login; fixture tests are not a substitute.

## Admin clarity revision — 2026-10-27 (not released)

This revision starts from main `89cee9a6b9febac888bd27f7511698969fb8f16e` on
`codex/admin-clarity-workspace`. The human approved push, a PR and CI only. No main integration,
Hosting/Functions deployment, production repair, role change or infrastructure update is authorized.
The earlier release evidence above is historical and is not evidence that this UI is deployed.

### Changes and boundaries

- Focused readonly overview, directory, configuration, audit and incident-guide components replace
  inline presentation. Existing APIs, authentication, authorization and feature flags are unchanged.
- The directory filters only already-loaded pages and preserves paging/error isolation. Mobile shows
  the selected salon with an explicit way back; desktop keeps directory and diagnostics side by side.
- Diagnostic guidance, partial-scan warnings, a privacy-limited report and before/after repair previews
  clarify existing capabilities. No automatic repair or new repair action is introduced.
- Exact salon confirmation, reason, acknowledgement, recent-login errors, idempotency keys, in-flight
  guards, stale-response isolation and server-side restrictions remain. A `changed=false` response is
  not presented as a newly applied data change.
- Reports omit salon names, free-form issue messages, customer/session/pointer identifiers, photos,
  tokens and reward codes. Unknown issue codes are replaced with `UNCLASSIFIED_ISSUE` in reports.

### Executed checkpoints

| Check | Result |
|---|---|
| Original Admin baseline | PASS: 42/42 tests |
| Guided UI RED, `e1a8915` | Expected FAIL: 8 new requirements; 13 existing focused tests passed |
| Missing presentation helper RED | Import failed before tests ran; not counted as executed assertion failures |
| Focused UI/helper GREEN, `363598d` | PASS: 38/38 tests and typecheck |
| Narrow navigation RED, `0210f27` | Expected FAIL: 3/3 engines reproduced overflow at 320px |
| Failed next-page status RED, `c9efd6c` | Expected FAIL: 1; 11 dashboard tests passed |
| Locked installation | PASS: `npm --prefix apps/admin-web ci`; no package/lockfile diff |
| Final `npm --prefix apps/admin-web run check` | PASS: typecheck, lint, 72/72 tests and production build |
| Final `npm --prefix apps/admin-web run test:coverage -- --maxWorkers=1` | PASS: 72/72; 99.17% lines, 96.69% statements, 96.62% functions, 90.25% branches in the configured Admin support/presentation scope; thresholds remain 80% |
| Final `npm --prefix apps/admin-web run test:e2e` | PASS: 15/15 on desktop Chromium, mobile Chromium and mobile WebKit; includes 320px targets, cancellation, partial-failure display and axe WCAG checks |
| `node --test test/*.test.mjs` | PASS: 40/40 repository regressions |
| Tracked secret scan / CSP synchronization / diff whitespace | PASS |
| Screenshot inspection | PASS: desktop and iPhone-sized diagnostic viewport images inspected locally using fictitious Salon A |

One additional clipboard test initially used an unsupported asymmetric `toHaveValue` matcher. The
assertion was corrected to inspect the textarea value, then the full suite passed. This harness error
is not treated as an application RED signal. The first formatting check found the edited coverage
configuration; that file was formatted before final verification.

Browser tests abort all non-loopback requests and use in-memory fixtures, not real customer records.
The test preview server exits with Playwright. Authenticated production smoke tests are NOT RUN for
this revision because there is no release approval. CI results belong in the PR for its exact head.

### Existing dependency findings — not a clean audit

On 2026-10-27, `npm audit --omit=dev` reports **1 High** for the installed `zod`; the full Admin audit
reports **8 High / 6 Moderate / 0 Critical**. Package manifests and lockfiles are identical to main.
The report references [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
These findings are not introduced by this UI revision, are not suppressed, and are not claimed fixed.
Library upgrades and production exploitability analysis require a separate scoped change; passing
UI/CI checks is not a claim of zero vulnerabilities or permission to release.
