# App Check rollout — 1 October 2026

Project: `haircut-c7d12`. Active product: customer Web at `app.chhaircutsalon.cc`.

## Verified configuration

Authenticated read-only checks confirmed:

- One existing score-based reCAPTCHA Enterprise key; domain validation is enabled.
- Allowed domains: `app.chhaircutsalon.cc`, `haircut-c7d12.web.app`,
  `haircut-c7d12.firebaseapp.com`.
- App registration matches the Web build; token TTL 3600 seconds and minimum score 0.5.
- Browser API key permits the Firebase App Check API.
- The App Check service agent has `roles/firebaseappcheck.serviceAgent`.
- Firestore, Storage and Authentication enforcement are `UNENFORCED`.
- The normal frontend App Check site-key variable is absent; the live customer app does not
  initialize the provider. No key or policy was changed by this audit.

A standard Chromium automated probe using the installed Firebase SDK and the real provider
returned `appCheck/initial-throttle`, HTTP 403. No debug provider or browser identity modification
was used. Historical key metrics include scores below the configured threshold. That is consistent
with automated-environment rejection, but is not proof of the result on a customer's real browser.

## Support check

`/app-check` is an independent support route. It does not restore a customer session, read salon
data or change points. It runs only after one button press, uses a separate Firebase app instance,
disables automatic token refresh, rejects debug mode, limits waiting to 25 seconds and deletes
the probe instance afterwards. It renders status/error codes only; no token or error payload.

The optional public build variable `VITE_FIREBASE_APP_CHECK_DIAGNOSTIC_SITE_KEY` configures this
route only. It is separate from `VITE_FIREBASE_APP_CHECK_SITE_KEY`, which remains unset for normal
traffic while this issue is investigated.

Tests cover success without token disclosure, sanitized failures, missing configuration,
debug-mode rejection, timeout/cleanup, no automatic execution, repeated-click prevention and
route isolation from customer session/points logic.

## Gate before enforcement

The support page was deployed Hosting-only from `e179d754e0ab9869029490d677e5749a1f1f7908`
on 1 October 2026 at 17:31 Asia/Saigon. Hosting version: `62ea2e1fdaf44d42`.
[Source CI](https://github.com/tantrong1706/haircut-mvp/actions/runs/36849128252) passed all six jobs.
Live HTTPS/render smoke passed with no automatic attestation or console/page errors.
Real-device attestation remains pending; this deployment is not an enforcement rollout.

Obtain a successful result on the browser/device actually used by the customer. Then validate
normal App Check initialization and Auth restoration in monitor mode, and inspect verified traffic
before enabling enforcement. Do not lower the risk threshold or use debug tokens to declare
production attestation successful.

This follows the [Firebase Enterprise provider guide](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)
and [request-metrics rollout guidance](https://firebase.google.com/docs/app-check/monitor-metrics).
The [provider REST schema](https://firebase.google.com/docs/reference/appcheck/rest/v1/projects.apps.recaptchaEnterpriseConfig)
defines `riskAnalysis.minValidScore`.
