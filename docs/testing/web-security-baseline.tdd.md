# Customer Web dependency and CSP baseline — 12 October 2026

## Scope and authority

The owner approved addressing the remaining Customer Web Firebase dependency warnings and WebKit
CSP warnings, then main + Hosting only after all tests and CI pass. No Functions, Rules, Auth
configuration, App Check enforcement, customer data, native release or unrelated major upgrade.

## Findings and narrow fix

- Four High package alerts were inherited through one gRPC dependency chain: `firebase` →
  `@firebase/firestore` / compat → `@grpc/grpc-js@1.9.16`. They were not four independent Web exploits.
- The installed Firestore browser entry uses WebChannel; the flagged transport is its Node entry.
  The upstream advisories describe gRPC server authentication/error handling. This repository's
  customer site is a static browser app, not a gRPC server.
- Firebase remains **11.10.0**, Firestore remains **4.8.0**. A scoped npm override under
  `@firebase/firestore` resolves gRPC to **1.14.6**; no remaining nested 1.9 copy was found.
  Of existing lockfile package versions, only gRPC changed. The patched gRPC adds its compatible
  proto-loader/ordered-map dependencies; Firestore's original proto-loader remains intact.
- This override deliberately goes outside upstream's `~1.9.0` range. It is a temporary, explicitly
  tested mitigation, not a claim of upstream release support. Remove it after a suitable Firebase
  release includes a patched transport and passes the same regression checks.
- CSP now enforces only `base-uri 'self'; object-src 'none'; frame-ancestors 'none'`.
  It replaces a report-only policy with no reporting endpoint. X-Frame-Options, HTTPS, MIME and
  referrer defenses remain. No external reporting collector is introduced.
- This is **not a full script/XSS allowlist**. Script, network, iframe destinations and inline
  styles are not newly restricted, preserving the effective behavior of Firebase OTP/telemetry.
  No protection is claimed merely from silence in the console.

## RED / GREEN evidence

RED checkpoint `d896718`:

- `node --test test/firebase-grpc-security.test.mjs test/web-security-headers.test.mjs`:
  2 intended failures, 3 passes (gRPC 1.9.16 and no enforced CSP header).
- Desktop CSP E2E: 1 intended failure / 1 pass. An external `<base>` changed `document.baseURI`
  under the old report-only policy; the authenticated fixture flow remained usable.
- An initial Playwright command used the repo root instead of the customer workspace and could
  not select a project; that runner error was not counted as RED.

GREEN checkpoint `3892a6b`:

- The same Node targets: **5/5 PASS**.
- CSP browser tests: **6/6 PASS** across desktop Chromium, mobile Chromium and mobile WebKit.
  Tests observe enforced violations for external base/object and verify OTP fixture, reload/session
  restore and history navigation remain usable.
- Firestore Node SDK emulator test: **PASS** for writes, server reads, batch, transaction, realtime
  listener and unauthenticated rejection. It refuses to run outside `127.0.0.1:8786` and uses only
  project `demo-haircut-grpc-compat` with isolated test rules. No real customer writes.
- The initial listener test timed out because metadata-only cache→server transitions were excluded.
  `includeMetadataChanges: true` corrected the test setup; the assertion still requires a server
  snapshot. No timeout increase, skip or fallback was used to produce PASS.
- Actual Firebase reCAPTCHA SDK rendered under the candidate CSP on Chromium and WebKit using
  browser-local response interception at the authorized domain: zero CSP violations, zero SMS
  requests, no probe uploaded to Hosting. This is bootstrap evidence, not a real OTP verification.
- `npm audit --omit=dev` for **Customer Web**: **0 Critical / 0 High / 0 Moderate / 0 Low**.
  This result does not represent all workspaces or guarantee the absence of undisclosed issues.

Commands (inside `customer-web` unless noted):

```text
npm exec -- playwright test e2e/csp-baseline.spec.ts
firebase emulators:exec --project demo-haircut-grpc-compat --config firebase.grpc-test.json --only firestore "node scripts/test-firestore-grpc.mjs"
npm audit --omit=dev --json
npm ls firebase @firebase/firestore @grpc/grpc-js @grpc/proto-loader --depth=5
```

Full local validation on 12 October:

- Customer Web `npm run check`: lint, formatting, **209/209 unit tests**, TypeScript and production build PASS.
- Shared domain coverage: **17/17 PASS**, 100% lines/functions and 98.07% branches.
- Full browser suite: **57/57 PASS** across Chromium desktop/mobile and WebKit mobile.
- Repository tools/security suite: **29/29 PASS**; tracked-file secret scan and CSP synchronization PASS.

CI repeats the emulator test and dependency/header guards. CI and deploy results are recorded in
[release status](../RELEASE_STATUS.md) only when completed. Local checks do not prove a fresh
real-phone SMS verification or customer business transaction.

## Primary sources

- [gRPC authentication advisory](https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j).
- [gRPC error disclosure advisory](https://github.com/grpc/grpc-node/security/advisories/GHSA-f596-whhp-79r4): patched 1.14.6.
- [Firebase upstream transport PR](https://github.com/firebase/firebase-js-sdk/pull/10412): still open when reviewed; not treated as an already-shipped fix.
- [CSP base-uri](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/base-uri),
  [object-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/object-src),
  [frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors).
