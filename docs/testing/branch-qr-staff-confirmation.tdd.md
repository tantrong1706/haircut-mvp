# Branch QR and staff confirmation

## Agreed behavior

Only signed branch QRs start point requests. Customers enter a phone number once, then request points using their verified Zalo identity. Scanning does not award points. Before the request button, the app explains that submitting authorizes the branch to capture up to three haircut photos for this visit. There is no consent checkbox; taking photos is optional for staff.

A request appears directly in the branch staff screen. Staff can capture/upload photos, confirm the fixed points recorded when the request was created, or reject the request. New requests do not require claiming a customer or owner approval. Existing legacy sessions and historical records are retained.

Requests expire after 30 minutes. Duplicate submissions reuse the same open request. Confirmation writes points, history, image attachments, audit events, and the next eligible timestamp in a transaction. The customer must wait two hours after successful awarding before requesting again anywhere in that salon. Expiry and rejection do not start a cooldown. A cached session cannot override another branch's QR.

## Test evidence

RED checkpoint: `ab9ceca`.

- Backend unit/contract RED: 4 expected failures (missing cooldown/authorization helpers and new request flow).
- Client RED: 8 expected failures (old queue button, branch selector, owner approval and missing staff actions).
- Emulator RED: the two new tests failed because staff could neither confirm nor upload photos for new requests.
- Backend unit/contract GREEN: 100 tests passed.
- Backend integration GREEN: 63 tests passed across callable transactions, photo operations, branding and adversarial cases. Zalo verification is replaced with an explicit test-only verifier; no real tokens or customer data are used.
- Firestore/Storage rules GREEN: 21 tests passed. The added test verifies staff upload/read within the correct branch and rejection of an expired upload. A Storage expression-limit failure was reproduced and fixed by consolidating repeated membership checks.
- Mini App unit/component GREEN: 162 tests passed across 30 files. Includes saved phone, branch-cache isolation, cooldown display, staff confirmation and rejection.
- Browser GREEN: 21 tests passed on desktop Chromium, mobile Chromium and mobile WebKit. Three screenshot-capture jobs remain intentionally skipped.
- Typecheck, lint, production build and ZMP asset validation passed. Repository Zalo readiness checks passed 34/34; this is not evidence that the new version has been deployed or approved by Zalo.

## Scope and remaining release work

No dependency versions, lockfiles, Zalo App ID, gateway configuration, points balances, existing customer data or live services were changed during implementation. Six existing files received formatting-only changes to satisfy the repository format check.

The live release must deploy the modified customer/profile/session callables, approval/rejection and photo callables, the request notification trigger, and Storage rules together with the customer and staff frontend. The previous production build remains available until that release. Do not publish or submit a review as part of the implementation step.

The earlier repository coverage report measured a restricted legacy service set at 73.44% statements. This run verifies the critical new behavior through unit, component, emulator and browser tests; it does not claim 80% repository-wide coverage or real-device/Zalo verification.
