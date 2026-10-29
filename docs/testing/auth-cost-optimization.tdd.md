# OTP cost controls and optional passkeys — TDD evidence

Date: 2026-10-28, Asia/Saigon. Local branch: `codex/auth-cost-optimization`.
Base: `origin/main` at `89cee9a6b9febac888bd27f7511698969fb8f16e`.
This is the historical implementation checkpoint at `e59e4cf`. The separately authorized
dependency remediation and subsequent verification are recorded in
[OTP dependency remediation](otp-dependency-remediation.tdd.md); do not treat the baseline
audit counts or absence of GitHub CI below as the final branch status.
Scope derives from the owner's request to apply four sign-in/cost-control approaches.
No production configuration, account, data, Firebase resources, SMS provider or DNS changed.

## Journeys and boundaries

- A returning customer keeps the existing Firebase customer session/UID, without another SMS.
- A new customer explicitly requests OTP; overlapping sends and immediate reload/resend are buffered.
- Optional passkey enrollment follows a recent, unrevoked Phone authentication. The customer can
  cancel or remove keys and recover through OTP without automatically sending a message.
- Existing customer IDs, tenant isolation, QR checks, points, rewards, private photos and manager
  sign-in remain unchanged. Privileged UIDs cannot use the customer passkey bridge.
- Firebase remains the managed SMS service. Negotiating/buying a different provider is not done;
  no quoted unit price, actual SMS bill, volume discount or free unlimited delivery is claimed.
- The server SMS hook and new passkey exports are opt-in/omitted by default. Local tests do not
  prove production App Check, signing IAM, Auth Enterprise integration or physical-device behavior.

## RED checkpoints

- `ef5ab10`: the existing Web Auth suite executed 27 tests, with three new runtime failures:
  duplicate concurrent send, missing reload buffer and redundant send for a restored user.
  New policy/client modules initially failed to import because implementation did not exist;
  those compile failures are not counted as executed assertions.
- `5d1f73d`: an emulator regression proved the existing customer API rejected the proposed
  passkey session. Its replacement requires a live server-owned credential/UID/phone/account
  check; the pure Phone principal still rejects all custom tokens, including a purpose marker.
- `350fcff`: three emulator regressions failed at runtime: revoked Phone token enrollment,
  bypassing revocation with a refreshed/exchanged token, and disabling new passkey ceremonies
  stranding an already valid session. All three passed after fixes in the final implementation.
- Additional runtime RED: removing the currently used passkey failed to sign out; context
  rejection offered no explicit OTP recovery. The final Web tests cover both fixes.

An initially rejected claim-only authentication extension was not applied. The safer implementation
checks live credential binding, Firebase account state, both privilege registries, authentication
time and server verification time. It never trusts the client to select its Firebase UID.

## Executed verification

| Command / target                                          | Actual result              | Guarantee / limitation                                                                                                                   |
| --------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Customer Web `npm ci`, then pinned SimpleWebAuthn install | PASS                       | Existing lockfile used for baseline, manifest/lock updated together for the new browser library                                          |
| Functions `npm ci`, then pinned SimpleWebAuthn install    | PASS                       | Maintained backend verifier; no hand-written signature/CBOR verification                                                                 |
| Customer Web `npm run test:run`                           | PASS, 316 tests / 56 files | Full existing suite plus new OTP/passkey/recovery cases                                                                                  |
| Customer Web `npm run test:auth:coverage`                 | PASS, 38 tests             | 98.31% lines/statements, 85.71% branches, 100% functions for the selected auth surface                                                   |
| Customer Web lint / format checks                         | PASS                       | Existing repository formatting baseline retained                                                                                         |
| Customer Web `npm run build:test`                         | PASS                       | Test artifact only, never deployed                                                                                                       |
| Customer Web `npm run build:web`                          | PASS                       | Production-mode compile using the same public synthetic Firebase fixture as CI; passkey rollout false; not a production release artifact |
| Customer Web `npm run test:e2e`                           | PASS, 57 cases             | Chromium desktop/mobile and WebKit mobile; real OTP delivery is mocked                                                                   |
| Customer Web `npm run test:auth:browser`                  | PASS, 2 cases              | Virtual Chrome/Pixel authenticator, real browser SDK and backend crypto verifier; wrong origin, RP and signature rejected                |
| Functions `npm run check` / `npm run build`               | PASS, 124 unit tests       | Typecheck, lint, configured formatting check, standard unit suite and compile                                                            |
| Functions targeted policy tests                           | PASS, 19 tests             | Recent Phone enrollment, account binding, normalized quota keys and invalid/exhausted limits                                             |
| `test:rules:emulator` in demo Firestore/Storage           | PASS, 40 cases             | Five new private auth collections deny client reads/writes, including owner/staff identities                                             |
| `test:integration:emulator` in demo Firestore/Storage     | PASS, 166 cases            | Existing customer/manager/points/rewards/photos/tenant transactions preserved                                                            |
| `test:auth:integration:emulator` in demo Firestore        | PASS, 32 cases             | Live-credential bridge, same UID/customer ID, revocation/rollback and concurrent replay/quotas                                           |
| `test:auth:coverage:emulator` in demo Firestore           | PASS, 47 cases             | 94.85% lines, 90.15% statements, 84.27% branches, 95% functions for auth domains                                                         |
| Root `node --test test/*.test.mjs`                        | PASS, 40 cases             | Repository/security/Hosting/transport contracts; Admin dependencies installed from their unchanged lockfile for this check               |
| `node scripts/sync-csp.mjs --check`                       | PASS                       | No policy/header changes                                                                                                                 |
| Secret scan before final staging                          | PASS, 670 tracked files    | Final staged scan is rerun before the implementation checkpoint                                                                          |

Counts above overlap; do not add them as a count of unique tests. Chrome virtual-device tests are
not Samsung/iPhone hardware tests. Crypto is mocked in the Firestore service tests; the separate
browser tests exercise the actual verifier. No SMS, OTP, email, customer account or business record
was created on production.

## Failures encountered and resolved / remaining

- Restricted-network npm attempts failed DNS; approved retries installed dependencies successfully.
- Vitest 4 cache writes failed with Windows EPERM in the restricted environment; approved local
  test runs succeeded. These failures were not reported as business-logic RED or PASS.
- Java 17 could not start the Emulator. Java 21 was already installed. A Windows Unix-socket
  temp-directory failure was resolved per documented JVM options using an existing workspace
  temp directory; no firewall or global Java configuration changed.
- The Windows checkout produced CRLF/LF differences between contract source and its deploy copy.
  The repository sync script restored byte equality without changing the contract's meaning.
- An initial root test failed because this fresh worktree lacked Admin's Firebase dependency.
  Installing Admin's unchanged lockfile resolved it; all 40 root checks then passed.
- A supplemental ESLint invocation from the root failed to locate the workspace config; the
  ordinary Customer Web lint passed, and supplemental config lint is retried from that workspace.
- At this implementation checkpoint, `npm audit --omit=dev` for Functions reported 2 High / 10 Moderate / 0 Critical issues in
  existing dependency families (including zod and body-parser). Existing lock entries were not
  upgraded by this task; the new backend lock diff only adds the WebAuthn package family.
  This is NOT an all-clear production security audit. No broad dependency auto-fix was applied.
- At this implementation checkpoint no GitHub CI had run and no PR had been opened. No merge or deploy was performed. Supplier procurement, live SMS
  hook prerequisites/budget, production signing IAM and physical-device canary remain release gates.

## Release / rollback

See [operating boundaries](../AUTH_COST_CONTROLS.md). Preserve the session-validation bridge
while valid passkey sessions exist, even if new enrollment/sign-in is disabled. Never remove a
registered Auth blocking hook without unregistering it first. New auth/quota collections need
an explicitly approved TTL setup; correctness does not rely on TTL deleting expired challenges.
No background watcher or recurring task was created.
