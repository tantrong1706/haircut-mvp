# Salon workflow, private visit details and shared login

Evidence dated 2026-10-24–26 (Asia/Saigon). Journeys come from the project owner's requests in this chat.
This report records source verification, not a claim that a Git push deploys production.

## Confirmed scope

- One management login at /login. Verified owner/staff profile determines the workspace; old /owner and /staff links remain usable.
- No salon-deletion control in the staff workspace. Staff cannot invoke salon deletion.
- Customer history shows visit dates and earned points, not internal notes or photos.
- All active staff assigned to the requested branch can read its internal haircut history; owners can read their salon. Other salons/branches remain denied.
- Owner or the responsible stylist can supplement the latest completed haircut. No new visit, points, cooldown, or completed/created timestamp changes.
- Existing customer photo consent is required. Per-visit consent is explicit; staff cannot silently restore withdrawn customer consent.
- At most three photos; server-issued upload grants, validated/re-encoded JPEG, scoped attachment, revision conflict checks, and audit metadata without note/photo contents.
- Preserve Web Phone Auth, existing identity, Rules, App Check enforcement, domain, and Firebase project. No Zalo/native deployment or dependency upgrades.

## Reproduced failures and checkpoints

| Guarantee                                                                                                  | RED evidence                                                                           | GREEN evidence                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Native picker preserves user activation; revoked consent blocks submit; failed drafts stay available       | 970af14, three executed failures after fixing a test query/cleanup issue               | 4d1b46c; photo capture, decode and invite cohort: 17 PASS                                                                        |
| HEIC is attempted only through device-native decoding; HTML image fallback works without createImageBitmap | 4dd04c6; both decode compatibility tests rejected before fixes                         | Same 17-test cohort; unsupported HEIC still fails clearly                                                                        |
| Email failures are sanitized and do not lose/recreate an already-created staff account                     | 4dd04c6; four executed invitation failures                                             | Same cohort; one separately authorized real email request was accepted and recipient confirmed receipt; no additional email sent |
| Customer browser never displays internal data even from an older API response                              | 8521dfa; privacy render and adapter assertions failed                                  | 1dadf09; 12 focused history/adapter tests PASS                                                                                   |
| Customer API never returns internal note/photo fields                                                      | d6a84bc; stored internal note leaked in response                                       | 74c624f; customer API integration tests PASS                                                                                     |
| Latest-record edit, tenant, actor, consent, revision and no-point-change guarantees                        | f756eb1, expected missing implementation; 59d492b, executed completed-upload rejection | 26 integration/coverage tests initially PASS; metadata regression added subsequently                                             |
| Shared login routes either verified role correctly from all three entry URLs                               | 69e99a9, four executed routing failures                                                | edb5f3b; 20 routing/AuthGate tests PASS                                                                                          |
| Staff workspace cannot display salon deletion                                                              | 641ca04, owner-preview of StaffPage still exposed deletion UI                          | StaffPage cohort PASS; server rejects staff even with recent authentication                                                      |
| Salon card displays internal images and post-award controls                                                | 881b825, missing history component and missing buttons                                 | 1aa5af9; 20 focused component/page tests PASS                                                                                    |
| Selecting a returning customer loads branch-scoped internal history                                        | f5e557e, existing notes did not appear                                                 | Returning-customer tests: 11 PASS; real browser harness PASS                                                                     |
| Any assigned same-branch staff can read internal record photos                                             | 73afd3b, response incorrectly returned an empty photo list                             | Full callable integration suite PASS                                                                                             |
| Actual Web transport metadata does not break saves                                                         | ca00beb, platform field caused INVALID_ARGUMENT                                        | Full integration rerun: 165 PASS                                                                                                 |

Checkpoint commits are preserved on this task branch. The final commit also contains formatting, coverage commands and regression tests discovered by the existing CI entry points.
No skipped test or relaxed coverage threshold is used as release evidence.

## Validation run locally

- Customer Web: full unit run 275 PASS before six additional coverage cases; new editor/history coverage cohort 9 PASS.
- Customer Web lint, formatting, TypeScript and production build PASS.
- Firebase Functions check/build: 119 unit tests PASS; TypeScript/lint/format PASS.
- Full callable/security/support/branding integration command: 165 PASS in demo-haircut emulators.
- General browser suite: 57 PASS (desktop Chromium, mobile Chromium, mobile WebKit).
- Returning-customer browser suite: 6 PASS, including a post-award note save without a second award.
- Owner responsive browser suite: 35 PASS at 320px, 360px, iPhone WebKit, tablet and desktop.
- Manager compatibility: 78 tests, typecheck/lint/format/build PASS.
- Repository regression suite: 40 PASS.
- Secret scan: PASS, including tracked and non-ignored untracked files; no credential values printed.

Commands include npm run test:run, npm run test:e2e, npm run test:returning:browser,
npm run test:owner:browser, npm run test:integration:emulator, npm run check,
and node scripts/check-secrets.mjs --include-working-tree. Emulator commands explicitly target demo-haircut.

One initial full integration run returned the Firestore Emulator error "Transaction is invalid or closed"
in the pre-existing concurrent check-in test. The test was not weakened or retried inside its code.
A fresh complete emulator run passed all 165 tests. Retain this failed-run observation if CI reproduces it.

## Scoped coverage

| Scope                                  | Lines  | Branches | Functions | Statements |
| -------------------------------------- | ------ | -------- | --------- | ---------- |
| New completed-visit backend module     | 98.21% | 96.02%   | 94.44%    | 98.38%     |
| New internal history/editor components | 100%   | 86.11%   | 100%      | 100%       |
| Returning-customer flow                | 96.13% | 83.75%   | 90.90%    | 96.13%     |
| Owner dialog/session helpers           | 100%   | 95.52%   | 100%      | 100%       |

New coverage commands enforce 80% on all four measures and were run locally. Their regression tests also run through the existing CI unit/integration commands. These are scoped measurements,
not a claim of 80% coverage for every historical line in the repository.

The initial push was rejected because the existing Git credential lacks the workflow scope. No broader permission was requested. The unpushed tip was corrected to preserve the original workflow YAML; only ordinary application/test files and package test entry points are changed.

## Release boundaries and verification

The owner authorized push, PR, main merge and selective Firebase release only after local checks and CI PASS.
The intended rollout is backend first, then customer Hosting. Target only:

- getWebCustomerHistory
- getSalonCustomerDetails
- beginHaircutPhotoUpload
- finalizeHaircutPhotoUpload
- getLatestHaircutDetails (new)
- updateLatestHaircutDetails (new)
- Hosting site haircut-c7d12

No Admin Hosting, Auth settings, account permissions, Firestore/Storage Rules, indexes, secrets,
billing settings or retired APIs are part of this rollout. No customer point/reward mutation is a live smoke test.
Capture immutable prior Hosting release and existing Function revision/source references before deployment;
verify selected Functions ACTIVE and customer HTML/artifact hashes after deployment.

## Known limits

- Native HEIC/camera behavior is device-dependent. Browser engine/codec mocks and WebKit viewport tests do not prove a physical iPhone camera flow.
- A signed image URL already issued expires within its existing lifetime (15 minutes); downloaded copies cannot be recalled.
- Email provider acceptance is not generally proof of inbox delivery; receipt was explicitly confirmed for the one authorized test.
- An old record without trustworthy point-request/session linkage is intentionally not editable; do not create or repair customer history silently.
- Production release status/versions must be verified separately from these local results. No claim of zero future defects.
