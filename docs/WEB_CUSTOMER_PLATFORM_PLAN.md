# Web Customer Platform implementation plan

## Release surface

- Base: PR #36 at `5ae0ff21200ae4d32b07e9f588ee6b7797c35d0e`.
- Working branch: `feat/web-customer-platform`.
- Customer entry: `https://app.chhaircutsalon.cc/checkin` with the existing signed QR fields.
- Zalo Mini App remains an adapter over the existing Zalo callables and is not deployed or changed
  in Mini App Center by this task.
- Gateway, Cloudflared and Firebase production remain untouched.

## Architecture decisions

1. Use a named Firebase app and Auth instance for web customers. This isolates customer phone
   sessions from owner/staff email sessions on the same browser origin.
2. Configure `browserLocalPersistence` before attaching the first auth-state listener or sending
   an OTP. The UI remains in `AUTH_INITIALIZING` until Firebase resolves the current user.
3. Use Firebase Phone Auth with `RecaptchaVerifier`; OTP is sent only after the customer presses the
   send button. Production has no hard-coded test phone numbers.
4. Keep the existing signed QR payload and backend verification. Web URLs use `/checkin` plus the
   signed fields because the current HMAC is intentionally stateless and needs salon/branch/version
   inputs for verification. Client-supplied IDs are never trusted without the signature.
5. Store pending QR context only in `sessionStorage`, with a short expiry, to survive OTP/reload.
   Remove it after authenticated context resolution. Never use localStorage as identity.
6. Derive web customer documents from `salonId + provider + Firebase UID`. Zalo document IDs retain
   their exact current derivation. A phone number never triggers automatic merge or lookup across
   salons.
7. Add authenticated web adapters around shared customer-session, history, rewards and wheel core
   functions. Sensitive collections remain server-only under Firestore Rules.
8. A web check-in creates one `pending_approval` service session and one `staff_confirmation` point
   request. The correct branch staff confirms after service; no extra owner handoff is required.
   Active-request, idempotency and the two-hour post-award cooldown remain server authoritative.

## Additive data model

Existing Zalo customer documents remain unchanged. A web-created customer adds:

```text
customers/{sha256(salonId:web:firebaseUid)}
  salonId
  firebaseUid
  identityProvider = "firebase_phone"
  phone
  phoneLast4
  points
  createdAt
  updatedAt
```

All session, history, reward and point documents continue to reference the tenant-scoped
`customerId`. No destructive migration or production backfill is required.

## Security boundaries

- Every web customer callable requires a Firebase-authenticated request with a verified
  `phone_number` claim.
- The backend derives UID from `request.auth`; no customer endpoint accepts a caller-supplied UID.
- Customer callables recompute the customer ID and verify customer/session/reward salon ownership.
- Owner/staff profiles, customers, sessions and rewards remain unreadable directly by customer web
  clients; callables return bounded views.
- Analytics records event names, salon IDs and result categories only; never phone, OTP, ID token or
  QR token.

## Delivery phases

1. RED: phone normalization, auth initialization/persistence, pending QR, tenant identity and web
   adapter tests.
2. GREEN backend: authenticated web context/check-in/session/history/rewards/spin callables and
   shared read cores.
3. GREEN frontend: OTP screen, returning-device restore, customer account/logout, API dispatch and
   mobile web routing.
4. Regression: Functions, emulator rules/integration, web unit/build/E2E, Manager and Zalo tests.
5. Deploy only after explicit approval. Firebase Functions and Hosting were approved and deployed;
   no push, merge, Zalo deployment, review action or Gateway change followed.

## Deployment and rollback gate

- Firebase Authentication Phone is enabled, Vietnam is permitted by the SMS allowlist and
  `app.chhaircutsalon.cc` remains in Authorized Domains.
- Deploy additive Functions before Hosting so the web client never calls a missing authenticated
  callable. The existing Zalo callables remain available during and after this rollout.
- Generate/print replacement salon and branch QR only after the web Hosting smoke test passes.
  Existing QR signatures remain valid; only newly returned QR URLs switch to the web entry point.
- Rollback Hosting through Firebase Hosting release history and redeploy the prior Functions release.
  Do not delete `firebaseUid` or `identityProvider` fields: they are additive and harmless to the prior
  release. Keep previously printed QR available until the rollback smoke test completes.

## Read-only production configuration audit (2026-09-15)

- Firebase Authentication Phone provider: disabled.
- Authorized Domains: `app.chhaircutsalon.cc` present; no domain change required.
- App Check: reCAPTCHA Enterprise provider registered for the web app, but the production-local web
  build does not yet have `VITE_FIREBASE_APP_CHECK_SITE_KEY` and Functions currently use
  `ENFORCE_APP_CHECK=false`. Enforcement must remain off until a real web token smoke test passes.
- Current deploy delta requires Functions and Hosting only. Firestore Rules, Storage Rules and
  Firestore indexes are unchanged from the base candidate and must not be redeployed for this delta.
- A real Phone OTP, browser-close/reopen and second-browser smoke test is still mandatory before the
  release can be marked ready for deployment.

Configuration was rechecked and updated on 2026-09-21. Phone is enabled and the existing SMS region
allowlist permits Vietnam; Authorized Domains and unrelated Auth/reCAPTCHA settings were verified
unchanged. Firestore, Storage and Authentication App Check services remain UNENFORCED. See
[release readiness](WEB_CUSTOMER_RELEASE_READINESS.md) for the named Functions deployment scope,
captured rollback revisions and real-device test plan. The local automated browser tests use an
explicitly gated mock adapter and do not prove real SMS persistence.

## Production completion status (2026-09-27)

The authorized source work is complete: account-only reads, server-resolved branch QR, direct staff
confirmation, two-hour cooldown, reward QR camera scanning and accessibility regression checks are
implemented. Web passes 214/214 unit and 42 executed E2E tests (3 intentional screenshot skips);
Functions passes 108/108 unit and 77/77 integration; Rules 22/22; Manager 78/78; Zalo readiness
34/34. Fifteen named Functions and Hosting were deployed after explicit approval. Real OTP,
browser-close/reopen persistence, multi-salon separation, staff confirmation, point/history writes
and the two-hour cooldown passed on production. App Check remains registered but monitor-only and is
not initialized by the final web build after Enterprise attestation caused Auth throttling in the
in-app browser. Rules, Storage, indexes, Zalo, Gateway and Cloudflared were unchanged.
