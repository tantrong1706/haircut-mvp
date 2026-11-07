# Customer visit photos and salon setup

Scope: Web only. Requirements came from the salon owner's requests, not a separate plan.

- A verified customer can open eligible photos from a completed visit in History. The visit list
  only contains a photo-availability marker. The photo request is scoped to the authenticated
  account, salon, completed visit, and its photo consent. Internal notes and legacy download
  URLs are not returned. The request uses the existing rate-limited History callable.
- The Owner Settings tab groups salon and account details and links to the existing branch,
  staff and wheel forms. This change adds no new management permissions or business rules.

| Verification                                                                                                  | Result                                                                |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| RED `de03731`: targeted History UI and Firestore integration tests                                            | Missing “Xem ảnh” button and `hasCustomerPhotos` marker, respectively |
| GREEN `0d84290`: focused Web tests and `webCustomer.integration.test.ts`                                      | 13 Web and 24 integration tests passed                                |
| RED `305d13f`: Owner regression test                                                                          | Missing accessible salon profile group and setup shortcuts            |
| GREEN `17e28e1`: Owner regression and History suites                                                          | 15 tests passed; included the owner Settings journey                  |
| Full Customer Web `npm run test:run`                                                                          | 379 tests passed in 68 files                                          |
| Focused Vitest coverage for `HistoryPage.tsx` and `OwnerSetupLinks.tsx`                                       | 26 tests passed; 97.10% lines, 87.50% branches, 88.88% functions      |
| Firestore emulator coverage for `customerVisitPhotos.ts`                                                      | 24 tests passed; 90.90% lines, 83.05% branches, 91.66% functions      |
| Firestore and Storage emulator: `privatePhotoAccess`, `webCustomerPrivacy`, `visitDetails` integration suites | 50 tests passed                                                       |
| `npm run test:e2e -- e2e/customer-navigation.spec.ts`                                                         | 15 passed on desktop Chromium, mobile Chromium and mobile WebKit      |
| `npm run test:owner:browser -- -g "settings groups salon setup\|all management tabs remain usable"`           | 10 passed across 320px, 360px, iPhone, tablet and desktop profiles    |
| Web lint, formatting and production build; Functions check and build                                          | Passed; Functions check included 119 unit tests                       |

Emulator tests ran against `demo-haircut`, with loopback alternate ports on Windows.
The new integration test stubs signing, and browser tests use synthetic photo responses. No real
customer data, production Firebase configuration, or Storage Rules were changed. Production
signing and device smoke checks are not established by the local tests. Legacy photos without
verifiable visit ownership and consent are not exposed. Revocation prevents new links; previously
issued signed links may remain usable until expiry (at most 15 minutes).
