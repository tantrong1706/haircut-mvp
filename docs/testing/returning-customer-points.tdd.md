# Returning customers: staff phone-suffix lookup

Date: 2026-10-19. Source: owner-requested Web workflow, not a Zalo feature.

## User journey and boundaries

An authorized staff member opens `/staff`, selects their current branch, enters the last four
phone digits, selects the matching existing customer and explicitly confirms the visit.
The customer does not need to scan the branch QR again for this flow. Initial customer registration
and Phone Auth are unchanged. A suffix is only a search hint, never an authentication credential.
If names/suffixes cannot distinguish the customer, use the existing QR flow.

- Requires existing owner or `canAwardPointsDirectly` staff permission; no permission grants.
- Server chooses the salon's points-per-visit, verifies tenant/branch/member status, and rechecks
  membership inside the same transaction as the balance write.
- Two-hour per-customer/per-salon cooldown, hidden from the customer UI, remains enforced.
- Repeated operation IDs are idempotent even after the cooldown. Concurrent requests share the
  customer transaction. Different customers sharing a suffix remain independent.
- Existing active QR sessions block the shortcut; their requests/photos are not discarded.
- Existing daily direct-award staff limit is shared. Each new award writes the existing
  point request, completed session, haircut history and an audit actor/source.
- No new customer creation, phone disclosure, arbitrary point input or direct Firestore fallback.
- This shortcut records a completed visit without adding photos. Existing QR/photo capture is
  unchanged; it does not fabricate new consent or silently reuse per-visit photo consent.

## TDD checkpoints

| Stage | Commit | Evidence |
| --- | --- | --- |
| Backend RED | `4d21d4d` | Integration test imports missing award factory; expected missing-handler failure, no runtime cases executed |
| UI RED | `ec17b34` | Component test imports missing panel; expected missing-component failure |
| UI GREEN | `785868e` | 5 panel + 5 existing StaffPage cases PASS |
| Backend GREEN | `8f19e88` | 8 emulator cases PASS |

Expanded regression evidence, run locally with Node 22:

| Guarantee | Command / test | Result |
| --- | --- | --- |
| Authorization, limits, cooldown, concurrency, audit, idempotency | Firestore Emulator `demo-haircut`; `vitest.returning.config.ts --coverage` | 14 PASS; lines 100%, branches 93.97%, statements 98.64%, functions 100% |
| Selection, collision warning, stale lookup/branch change, retry, double click | `npm run test:returning:coverage` in `customer-web` | 11 PASS; lines/statements/functions 100%, branches 85.29% |
| Browser interactions, retry, no horizontal overflow, no serious/critical axe issues | `npm run test:returning:browser` | 6 PASS: desktop Chromium, mobile Chromium, mobile WebKit |
| Web regression | `npm run lint` and `npm run test:run` in `customer-web` | PASS; 231/231 tests |
| Backend unit regression | `npm run lint`, `npm run test:unit` in `firebase/functions` | PASS; 118/118 tests |
| Type safety and build | Functions `typecheck`/`build`; Web `tsc --noEmit`/`build:test` | PASS |

The browser harness uses actual UI/service code but substitutes network transport with fixture
endpoints on loopback. It is not a production Firebase authentication or live award test.
The initial browser harness omitted the application's `.app-shell` and over-scanned unrelated
entries. Fixed the harness, not production styling, then reran all six cases successfully.
An initial broad test invocation from the repository root failed a cwd-dependent branding test;
rerunning the full suite from `customer-web` passed all 231. No tests were disabled.

## Release status

Local implementation complete. On 2026-10-20 the owner authorized push, PR creation and CI only.
Merge and Firebase deployment remain unauthorized. No live customers, points, sessions or rewards
were mutated. The combined branch subsequently passed 30 Rules and 120 integration cases;
photo-security evidence and outstanding rollout gates are in `photo-security.tdd.md`.
Before release, pass remote CI and obtain scoped merge/deployment approval.
Required callable: `awardReturningCustomerPoints`; existing `searchSalonCustomers` also gains
an authenticated lookup limit. Release backend before the staff UI. Do not deploy all Functions.
