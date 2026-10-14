# Admin release — 2026-10-14

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

| API | Active revision |
| --- | --- |
| getSystemAdminAccess | getsystemadminaccess-00002-zad |
| getSystemAdminSalonDiagnostics | getsystemadminsalondiagnostics-00002-suf |
| repairSystemAdminSalon | repairsystemadminsalon-00002-log |
| getSystemAdminOverview | getsystemadminoverview-00004-gam |
| listSystemAdminSalons | listsystemadminsalons-00004-quj |
| getSystemFeatureFlags | getsystemfeatureflags-00004-wug |
| listSystemAdminAuditEvents | listsystemadminauditevents-00004-kal |

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
