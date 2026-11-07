# Admin release — 2026-11-06

## Current verified release

- URL/site: https://haircut-c7d12-admin.web.app / `haircut-c7d12-admin`.
- Admin source: `91a599bea0895255055c89e5ab5c238248e87df8`, merged PR #87 after PR #79.
- Hosting version: `95a492122200b8e7`; release time `2026-11-06T11:18:02.655Z`.
- HTML SHA-256: `4def14fe6e531322267aa225d07813861d4b8244ad2465d16f24ba9a1a2fcae1`.
- Initial PR #79 release: source `288276b`, Hosting `b27bc5483018f060`. Authenticated smoke
  found the callable SDK encoded an absent optional cursor as null; this release fixes both
  first-page client omission and server null compatibility. Do not use that initial rollout as
  evidence the queue worked before the corrective deploy.

| API                           | Source deployed | Runtime / control state                                     |
| ----------------------------- | --------------- | ----------------------------------------------------------- |
| getSystemAdminSalonOperations | `91a599b`       | ACTIVE, Node.js 22, max 3; dedicated controls enabled       |
| manageSystemAdminSalon        | `288276b`       | ACTIVE, Node.js 22, max 3; dedicated controls enabled       |
| listSystemAdminAuditEvents    | `288276b`       | ACTIVE, Node.js 22; existing resource/env settings retained |

Only suspend/reactivate salon and cancel a consistent pending request are enabled through
`ADMIN_SUPERVISION_WRITES_ENABLED`. Legacy `ADMIN_WRITE_OPERATIONS_ENABLED` remains disabled.
Recent login, exact salon name, reason, confirmation, transaction authorization and audit/receipt
guards remain enforced. No permanent deletion, point/reward edits or user-role changes.

## Executed verification and exact limits

- PR #79 and #87: 9/9 checks PASS on their respective heads. Main Build Web/CodeQL PASS for
  `288276b` and `91a599b`; no push-main Lighthouse run is claimed.
- Local full suite on baseline `288276b`: 19/19 required steps PASS with Firebase CLI 15.35.0
  for emulators and isolated loopback ports. Rules/index copies were SHA-verified against source;
  all test files/assertions were unchanged. The private runner records its origin/hash and config.
- Earlier local attempts are retained: one browser timeout (77/78), then default Storage port
  9199 EACCES; an alternate-port attempt was stopped after the old CLI lost a split JSON response
  and hung. Firebase's upstream newline-framing fix is present in the test-only CLI 15.35.0.
  This was not a production dependency/configuration change or a skipped test.
- Corrective fix: Admin 95 unit/component tests, Admin emulator 63 cases, Functions 119 unit
  tests, repository 154 regressions and Admin browser 21 cases PASS. Types/lint/format/build,
  secret scan and CSP checks PASS. The baseline full-suite result is not mislabeled as a new
  full local run on `91a599b`; fresh CI verified the corrective head and merge.
- HTTP verification on `91a599b`: HTTPS/HTML/eight entry assets match the approved bundle;
  source marker and security headers PASS. All three Admin APIs reject anonymous POSTs with
  HTTP 401 / UNAUTHENTICATED. This protocol target does not execute browser App Check.
- Real existing operator session: source marker `91a599b`, login preserved, overview/list/diagnostics,
  queue and enabled control previews load. Missing confirmation keeps submit disabled; preview
  was closed without submitting. Server-scoped audit loaded selected-salon events without UI alerts.
- Strict anonymous headless smoke on the initial release **FAILED**: browser storage-access
  errors and HTTP 403 during App Check token exchange. This is retained, not relabeled PASS or
  used to disable security. The real authenticated UI checks above passed; no fresh headless
  App Check token success is claimed for the corrective release.
- No live suspension/cancellation, real SMS, operator impersonation or customer photo/point/reward
  mutation was performed merely to get PASS. Transactional write cases use demo/fixture data.

Initial API rollout changed exactly three endpoints; 85 existing functions retained state/updateTime.
Corrective rollout changed only the queue-read API; the other 87 retained state/updateTime. Total
functions: 88, all ACTIVE. Existing audit env/secret bindings/service identity/resource settings
and new API runtime/control settings were compared and preserved. No Rules release changed.

Customer Hosting remains `86906d689d90731c`; its HTML hash is unchanged. No Customer Hosting,
business API, Rules, IAM policy, App Check enforcement/domain/threshold or existing account grant
was deliberately changed in this Admin release. The missing local public App Check site key was
recovered from the existing provider, verified against the deployed Admin key/authorized domain,
and injected for build only. No new key or debug bypass was created.

## Rollback and operations

Protected rollback metadata and prior API source archives with SHA checksums are stored outside
Git. Prior Hosting versions `27b031fa97bf982e` and `b27bc5483018f060` remain identified for rollback.
Disable the dedicated flag on both new Admin APIs to stop the new controls, without enabling legacy
writes or modifying owner roles. Do not erase audit/receipts as rollback.

See [Admin operations](ADMIN_OPERATIONS.md), [project overview](PROJECT_OVERVIEW.md) and
[TDD evidence](testing/admin-operations-center.tdd.md). The separate request to require photo
consent for new customer QR point requests is not deployed by this Admin release.

## Historical release — 2026-10-14

## Published scope

- URL: https://haircut-c7d12-admin.web.app
- Project/site: `haircut-c7d12` / `haircut-c7d12-admin`.
- Source: `4c30ce146f72501e635015534b411176fff06d58` (merged PR #68 and #70).
- Hosting version: `27b031fa97bf982e`; release `1791976156398000`.
- Hosting release time: `2026-10-14T11:09:16.398Z`.
- Live HTML SHA-256: `52e1f137207fa0f0fc0dfc5446c592d7342febd61f51e865c530e85adf2f3b40`.
- Separate operator grant created for the explicitly approved verified Firebase account;
  existing owner profile updateTime and role were unchanged. No UID, credential or password here.
- Only `haircut-c7d12-admin.web.app` was added to the existing reCAPTCHA SCORE key.
  All three existing allowed domains and other key settings were preserved.

## Verification

- [Main Build Web](https://github.com/tantrong1706/haircut-mvp/actions/runs/38554343792): SUCCESS.
- [Main CodeQL](https://github.com/tantrong1706/haircut-mvp/actions/runs/38554343795): SUCCESS.
- PR #70: all nine checks passed before merge; root regression suite: 35/35 passed.
- Existing evidence: Admin 42 unit/component tests, 9 browser scenarios, Functions 108 unit,
  106 integration and 28 Rules tests passed. Coverage details in the TDD report.
- HTTPS 200 and live HTML hash match; CSP baseline, frame denial and noindex headers present.
- Login screen rendered without captured console warnings/errors in the observed browser.
- All seven Admin callable endpoints rejected unauthenticated POSTs with HTTP 401 / UNAUTHENTICATED.
- New support flag enabled on the three new APIs; max instances remains 3. Existing env values
  were compared and preserved. Legacy admin writes remain disabled. App Check enforcement unchanged.

| API                            | Active revision                          |
| ------------------------------ | ---------------------------------------- |
| getSystemAdminAccess           | getsystemadminaccess-00002-zad           |
| getSystemAdminSalonDiagnostics | getsystemadminsalondiagnostics-00002-suf |
| repairSystemAdminSalon         | repairsystemadminsalon-00002-log         |
| getSystemAdminOverview         | getsystemadminoverview-00004-gam         |
| listSystemAdminSalons          | listsystemadminsalons-00004-quj          |
| getSystemFeatureFlags          | getsystemfeatureflags-00004-wug          |
| listSystemAdminAuditEvents     | listsystemadminauditevents-00004-kal     |

## Customer production unchanged

Customer Hosting and business APIs, Firestore/Storage Rules, points and rewards were not deployed
or modified as part of this release. Customer HTTPS remained 200 and its live HTML hash remained
`4e322c32051be2361fa7151e93835172499188142d55dbf85608033df0be4d0f`.
The separately granted Admin access and its audit entry are the only application-data writes.
No real repair was performed merely to obtain a passing test.

## Still requires operator login

Authenticated live salon list/diagnostics/audit checks are **pending**. The operator must sign in
with the approved existing email/password; no impersonation token or password reset was used.
Do not label these checks PASS based on fixture tests or a successful Hosting response.

Only counter reconciliation and safe stale-session-pointer removal are supported. This portal
does not automatically repair arbitrary application bugs, change payments, points or rewards.
Diagnostics scans at most 50 session pointers and reports partial results where appropriate.
Admin dependency audit was clean; existing Functions dependency audit retains 9 Moderate findings
and zero High/Critical. The narrow CSP baseline is not a complete XSS policy.

Rollback: disable `ADMIN_SUPPORT_REPAIRS_ENABLED` on the three new APIs and/or deactivate the
separate operator grant, keeping owner role intact. This is the first Admin Hosting release;
there is no older Admin Hosting release to roll back to. See the operations guide before a
subsequent deployment; recheck all safety flags after it.
