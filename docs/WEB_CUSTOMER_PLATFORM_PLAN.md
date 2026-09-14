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
8. Use the existing waiting/serving/completed service-session flow for web check-in. Active-session
   and idempotency documents remain server authoritative.

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
5. Stop with local commits only. No push, merge, Firebase deployment, Zalo deployment, review action
   or Gateway change.
