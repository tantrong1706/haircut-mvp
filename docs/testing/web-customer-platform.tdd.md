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
| Check-in integrity | Concurrent double click and retries create one waiting session; an active session cannot move to another branch. |
| Wheel and rewards | The shared server wheel core remains cryptographically random, transactional and idempotent; the web callable derives customer ID from Auth. |
| Firestore/Storage rules | 22/22 rule tests pass; web customer documents remain server-only even when `firebaseUid` matches. |
| Functions | Typecheck, lint, format, build and 108/108 unit tests pass; full emulator integration passes 71/71. |
| Customer web | Lint, format, production build and the full unit suite pass. Focused Auth/API coverage is 99.1% statements/lines, 100% functions and 84.21% branches. Full Playwright covers desktop Chrome, Android Chrome and iPhone Safari; review-screenshot cases remain intentional skips outside capture mode. |
| Manager/Zalo regression | Manager typecheck and 78/78 tests pass. ZMP validation passes and Zalo review readiness remains 34/34. |
| Secrets | The tracked and untracked working tree scan passes without printing credential contents. |

## Production configuration evidence

- `app.chhaircutsalon.cc` is already present in Firebase Auth Authorized Domains.
- Firebase Phone provider is currently disabled. The code intentionally reports a friendly error and
  production rollout must wait for the project owner to enable Phone in Firebase Console.
- The production-local web configuration does not currently contain an App Check site key. Phone Auth
  still uses Firebase's required reCAPTCHA verifier; App Check enforcement is a separate rollout gate.
- No Firebase, Zalo, Gateway or Cloudflared deployment was executed for this candidate.

## Migration and rollback

No destructive backfill is required. Web customer IDs are derived from
`sha256(salonId + ":web:" + firebaseUid)` while the existing Zalo derivation remains byte-for-byte
unchanged. A rollback redeploys the previous Hosting and Functions versions; additive identity fields
may remain in Firestore and must not be removed or auto-merged by phone number.
