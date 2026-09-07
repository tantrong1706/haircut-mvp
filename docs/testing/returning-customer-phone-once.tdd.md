# TDD evidence: customer phone entered once

Date: 2026-09-07

## Source and journeys

No plan file was supplied. The journeys were derived from the product-owner request:

1. A first-time customer enters a valid phone number before creating a salon queue session.
2. A returning customer whose phone is already stored sees only the final four digits and confirms without entering or sending the phone again.
3. A salon QR never selects the previous branch; the customer chooses an active branch on every new visit. A branch QR remains fixed to its signed branch.
4. Profile lookup verifies the Zalo identity and signed QR at the server before reading the salon-scoped customer record.

## RED and GREEN evidence

| Stage | Command or target | Result | Evidence |
|---|---|---|---|
| RED | `vitest run src/services/api.test.ts` | Expected failure | `getCustomerCheckinProfile is not a function` |
| RED | `vitest run src/pages/ScanEntryPage.test.tsx` | 2 expected failures | Saved-phone state was absent and first-time submit was not disabled. |
| RED | `vitest run test/zaloContract.test.ts` | 1 expected failure | The backend did not yet enforce the effective first-or-stored phone rule. |
| GREEN | `vitest run src/pages/ScanEntryPage.test.tsx src/services/api.test.ts` | PASS, 29/29 | Covers returning customer, first visit, valid phone, no phone resend, and explicit salon branch selection. |
| GREEN | `vitest run test/zaloContract.test.ts` | PASS, 14/14 | Covers identity-before-read, derived customer identity, masked response, rate-limited endpoint contract, and server phone rule. |
| GREEN | `npm run test:unit` in Functions | PASS, 96/96 | No backend unit regression. |
| GREEN | Firebase rules emulator | PASS, 20/20 | Firestore and Storage access boundaries remain intact. |
| GREEN | Firebase integration emulator | PASS, 60/60 | Callable transactions, branding, photo operations, and adversarial cases remain intact. |
| GREEN | `npm run test:coverage` in Mini App | PASS, 158/158 | Full Mini App unit/component suite passes. |
| GREEN | `npx playwright test` | PASS, 21; skipped 3 | Returning check-in passes on desktop Chromium, mobile Chromium, and mobile WebKit. The three intentional screenshot-capture tests remain manual-only. |
| GREEN | Production `npm run build:zmp` | PASS | TypeScript and Vite production bundle completed; ZMP config and assets are synchronized. |
| GREEN | `npm run check:zalo-review` | PASS, 34/34 | Production candidate keeps preview disabled and satisfies the repository's Zalo review checks. |

## Security guarantees

- The server derives the customer ID from the verified Zalo token and salon ID; the client cannot submit a customer ID.
- The new lookup validates the signed QR and applies token/IP rate limiting before reading customer data.
- The response contains only `hasPhone`, `phoneLast4`, `exists`, and `allowPhoto`; it never returns the full phone or Zalo user ID.
- A returning confirmation omits the phone field, so the stored number is preserved rather than copied back to the client.
- First-time phone validation exists in both the UI and backend.
- No credential or real customer identifier is present in the tests.

## Coverage and known gaps

The repository-configured V8 coverage gate passed with 73.44% statements, 77.01% branches, 79.06% functions, and 73.44% lines. This is below the generic 80% TDD target because the existing coverage configuration measures four legacy service files only (`qr`, `wheel`, `sessionStore`, and `firebase`) and excludes the changed check-in component/API. The new behavior is covered directly by component, API-contract, backend-contract, emulator regression, and three-browser E2E tests. Raising the repository-wide baseline is a separate test-debt task and was not hidden or re-scoped into this feature.

The tracked-file secret scan passed across 518 files. A read-only production dependency audit found no critical advisory, but it did report two high and two moderate advisories in Mini App transitive packages plus twelve moderate advisories in Functions transitive packages. No dependency or lockfile was changed because dependency upgrades are outside this task's authorization.

## Deployment status

No Firebase Functions, Firebase Hosting, Zalo Testing version, review submission, or publication was performed as part of this TDD run.
