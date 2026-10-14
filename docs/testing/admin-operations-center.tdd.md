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

Prepared locally. CI, production deployment, grant provisioning and live authenticated smoke checks
are pending; see the final task report for the subsequently verified state.
