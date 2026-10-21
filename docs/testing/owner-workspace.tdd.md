# Owner/staff workspace and photo upload fixes

Date: 2026-10-21. Source: the owner's feedback about phone usability, missing
photo/note saves, a customer directory with point actions, and remembered sign-in.
Web only. The active branch is stacked on PR #74; no main merge or deploy is implied.

## Behaviors and evidence

| Guarantee                                                 | RED evidence                                                                                                | GREEN evidence                                                                                                                         |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Owner menu/metrics fit phones and desktop; usable dialogs | Clipped menu, 11px labels, collapsed wheel inputs and missing Escape handling                               | 35 browser tests across 320px, 360px, mobile WebKit, tablet and desktop; overview serious/critical axe findings: zero                  |
| Owner/staff sign-in persists on the same browser          | Persistence setup absent before sign-in; stale profile could reappear after logout                          | Auth service/gate tests; revision guard ignores stale callbacks; SDK local persistence, no app-managed password storage                |
| Saved notes survive, drafts do not cross customers        | Staff textarea was empty after restoration; drafts reset on selection                                       | Staff UI tests, owner browser save/error checks; note-only updates preserve photo arrays and points                                    |
| Note writes do not disclose image access                  | Full integration run: 135 passed / 1 failed; response leaked an existing photo URL after consent withdrawal | Full integration rerun: 136/136; text-only response is `{noteSaved: true}`, not photo locations                                        |
| Owner sees a paged customer directory/count               | Empty-term directory rejected; staff mode lacked an explicit owner gate                                     | Emulator tenant/cursor/role tests; initial directory visible without typing                                                            |
| Customer card offers safe point action                    | New component absent                                                                                        | Explicit name/suffix/branch confirmation, stable retry operation ID, double-click guard, cancelled/scope-changed action writes nothing |
| Haircut Storage upload fits real Firebase limits          | Static reachable-path check found seven Firestore document paths                                            | Exactly two: current customer consent and server-controlled upload operation                                                           |
| Photo acceptance remains authorized                       | Finalization succeeded after photo feature was disabled                                                     | Emulator tests for feature-off, disabled member/branch, changed tenant, completed visit and withdrawn consent                          |

Commands run from their package directories, using Node 22 and Java 21:

- `customer-web`: `npm run check` — lint, formatting, 256 tests and production build PASS.
- `customer-web`: `npm run test:owner:coverage` — 23 tests PASS; the new session/transport/
  point-action/dialog modules have 100% lines/statements/functions and 95.52% branches.
  This is scoped coverage, not a claim of 100% application coverage.
- `customer-web`: `npm run test:owner:browser` — 35/35 PASS. After resetting scroll for
  accurate full-page captures, the phone/desktop directory cases passed again (2/2).
- `firebase/functions`: typecheck, lint, formatting, 119 unit tests and build PASS;
  the final privacy-return change also passed a fresh typecheck.
- Firestore/Storage demo emulator: 35 Rules tests PASS; full integration suite 136/136 PASS.
- Manager shared Web package: full type/lint/format checks, 78 tests and Web bundle build
  PASS. No Android/iOS build or release was performed. Existing chunk-size/plugin warnings remain.
- `node --test test/storage-photo-rule-budget.test.mjs` — PASS.

Initial browser cold-start timeout and a Rules run from the wrong working directory were
setup failures, not valid RED evidence or product failures. Both were rerun correctly.
All emulator data is synthetic in `demo-haircut`. No real customers, points, rewards or
customer images were changed for tests.

## Photo grant design and limitations

Firebase Storage permits at most two Firestore documents in one Rules evaluation.
The old haircut upload path reached seven, even though emulator tests accepted it.
Reference: https://firebase.google.com/docs/storage/security/rules-conditions#enhance_with_cloud_firestore

The begin callable issues a grant bound to the authenticated uploader, salon, branch,
customer, session, exact object path and request ID. Its upload window is at most five
minutes, capped by the QR request and operation deadlines. Renewal runs authorization
again. Clients cannot forge or update operation documents.

Storage accepts only private staging under that grant and checks current customer consent
on every upload. Finalization rechecks current membership, branch/salon status, feature
flags, session, consent and image bytes before attachment. Direct photo reads remain denied;
the existing authorized short-lived read API is required.

This is not instant revocation of every staging capability: after membership/feature/session
changes, a previously issued grant may still stage private bytes until its short deadline,
but finalization/attachment is rejected. Customer consent withdrawal blocks the next upload
itself. Pending objects/download tokens and eventual cleanup retain the release limitations
documented in `photo-security.tdd.md`. Avatar rules are not covered by this haircut-specific
budget fix. Do not claim the real upload flow passed from emulator evidence alone.

## Product boundaries

- Notes/photos are edited before points, not after a completed visit.
- Quick points in the directory reuse the existing returning-customer API and do not attach
  photos/notes. The confirmation tells the operator to use the pending-visit flow for those.
- Server authority, tenant/branch checks, two-hour cooldown, permissions and idempotency remain.
- Remembered login is browser/domain-specific. Explicit logout, account revocation, cleared
  site data or private browsing can require another login. Customer Phone Auth stays separate.

## Authorized external change and release gate

With explicit permission, one missing `roles/firebaserules.firestoreServiceAgent` binding
was added to the Firebase Storage service agent in `haircut-c7d12`. Verification showed one
entry added, none removed, and no unrelated IAM change. Rules were not deployed and no
customer data was touched.

The owner authorized updating existing PR #74 and running CI only. Before a separately
authorized release: verify runtime signing IAM, deploy compatible begin/finalize/private-read
and workspace APIs, then compatible clients and Rules, and test an explicitly authorized
synthetic live upload with exact cleanup. Do not deploy grant-requiring Rules before the new
begin callable. Do not bulk revoke existing customer-image tokens without separate approval.

RED/GREEN checkpoint commits remain in branch history. Remote CI must be checked against
the final pushed SHA; earlier PR #74 green checks do not validate this follow-up.
