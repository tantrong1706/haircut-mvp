# Web customer platform TDD evidence

## Scope

The customer entry point is moved from an implicit Zalo-only flow to an authenticated web flow while
the Zalo adapter, owner/staff applications, Gateway and production deployments remain unchanged.
Firebase Auth UID is the global identity; customer documents remain tenant-scoped by salon.

## RED checkpoint

Commit `f2fd543` introduced tests and the implementation plan before production code. The Functions
tests failed because `customerWebIdentity` and the authenticated web callables did not exist. The web
tests failed because the Phone Auth adapter, web API adapter and customer pages did not exist.

## GREEN evidence

| Boundary | Evidence |
| --- | --- |
| Firebase Phone identity | Unit tests cover E.164 Vietnam normalization, verified Phone claims, persistent Auth initialization, invalid/expired OTP messages and logout. |
| Signed QR | Emulator tests cover valid salon/branch QR, tampering, disabled branches, single-branch salon resolution and web HTTPS generation. |
| Tenant isolation | Emulator tests cover the same UID in two salons, independent points/rewards, another UID session denial and no caller-supplied customer identity. |
| Check-in integrity | Concurrent double click and retries create one pending staff confirmation; an active request cannot move to another branch; the two-hour post-award cooldown is server-enforced. |
| Wheel and rewards | The shared server wheel core remains cryptographically random, transactional and idempotent; the web callable derives customer ID from Auth. |
| Firestore/Storage rules | 22/22 rule tests pass; web customer documents remain server-only even when `firebaseUid` matches. |
| Functions | Typecheck, lint, format, build and 108/108 unit tests pass; full emulator integration passes 77/77 after adding direct staff confirmation, cooldown, account-only reads and salon-QR branch integrity. |
| Customer web | Lint, format, production build and 214/214 unit tests pass. Full Playwright passes 42 executed tests across desktop Chrome, Android Chrome and iPhone Safari; 3 review-screenshot cases remain intentional skips outside capture mode. Nine axe-core scans report no serious/critical violations in the tested entry, OTP and account states. |
| Manager/Zalo regression | Manager typecheck and 78/78 tests pass. ZMP validation passes and Zalo review readiness remains 34/34. |
| Secrets | The tracked and untracked working tree scan passes without printing credential contents. |

## Production configuration evidence

- `app.chhaircutsalon.cc` is already present in Firebase Auth Authorized Domains.
- Firebase Phone provider is enabled and the existing SMS allowlist permits Vietnam. The masked
  Admin API update was followed by a read-back verifying Authorized Domains, other sign-in methods,
  test phone numbers and reCAPTCHA configuration were unchanged.
- The production-local web configuration does not currently contain an App Check site key. Phone Auth
  still uses Firebase's required reCAPTCHA verifier; App Check enforcement is a separate rollout gate.
- Fifteen named Firebase Functions and customer Hosting were deployed after explicit approval.
  Rules, Storage, indexes, Zalo, Gateway and Cloudflared were not deployed or changed.

## Migration and rollback

No destructive backfill is required. Web customer IDs are derived from
`sha256(salonId + ":web:" + firebaseUid)` while the existing Zalo derivation remains byte-for-byte
unchanged. A rollback redeploys the previous Hosting and Functions versions; additive identity fields
may remain in Firestore and must not be removed or auto-merged by phone number.

## 2026-09-20 check-in response regression

- Journey: a verified customer enters with a signed salon QR that resolves to its sole active branch.
- Reproducer: `src/services/webCustomerApi.test.ts` uses the actual nested `qr.branchId` response
  shape produced by `webAppSessionResult`, rather than assuming a top-level `branchId`.
- RED: `npx vitest run src/services/webCustomerApi.test.ts` failed 1/6; expected `branch-a`, got an
  empty branch. Checkpoint `5bbf8c5` records this result.
- GREEN: the adapter prefers the server's nested branch, retaining the existing top-level fallback.
  The same command passed 6/6. Checkpoint `8663840` contains the two-line production fix.
- Backend point, wheel and reward logic and gateway configuration were untouched by this fix.
- Real OTP delivery and browser-close/reopen persistence passed on the production custom domain.
  App Check Enterprise registration is retained, but runtime initialization/enforcement remain OFF
  because the attestation pilot returned 403 and throttled Firebase Auth in the in-app browser.

## 2026-09-21 completion regressions

- RED `a8bc3a8` proved the previous web flow still created `waiting` sessions, lacked a point request,
  required a service session to read the account and allowed a salon QR to accept a caller-selected
  branch. GREEN `7440de8` moved the flow to direct staff confirmation, added the two-hour cooldown,
  enabled authenticated account-only reads and kept branch resolution server-owned.
- RED `da28b0a` required returning customers to see their account without scanning a new QR and
  required logout/UID changes to clear displayed data. GREEN `cd9c41b` implemented the account view,
  a navigation-only salon hint and the app-level Auth listener.
- RED `785760e` required a safe staff reward scanner. GREEN `da6b29b` lazy-loads ZXing, accepts only
  `haircut-reward:v1:` payloads, retains manual entry and never auto-redeems. Its first production
  build exposed a circular chunk caused by matching ZXing's internal `qrcode` path; the bundler now
  isolates ZXing and the rebuilt app loads successfully in all three Playwright projects.
- Exact additions are `@zxing/browser@0.2.1` and dev-only `@axe-core/playwright@4.13.0`. A production
  audit reports 0 critical, 2 high and 3 moderate transitive advisories; neither new package is named
  in those findings. No force-upgrade or unrelated dependency update was performed.

## 2026-09-27 production evidence

- Full release gate: 27 required checks passed, zero failed; iOS sync remained a non-required Windows
  limitation. Functions 108/108, integration 77/77, Rules 22/22, web 214/214, Playwright 42 executed
  with 3 intentional screenshot skips, Manager 78/78 and Zalo readiness 34/34.
- All six web callables returned HTTP 401 without Firebase Auth. Signed branch QR resolution passed.
- The owner completed real Phone OTP without sharing the phone or OTP. Closing all tabs and reopening
  restored the customer account without another OTP.
- The same Firebase UID entered a second salon without another OTP and produced a separate
  tenant-scoped request. The first salon's staff could not see the second salon's request.
- Correct staff confirmation changed points from 0 to 1, completed the session, created exactly one
  haircut record and stored a two-hour `nextPointEligibleAt` cooldown.
