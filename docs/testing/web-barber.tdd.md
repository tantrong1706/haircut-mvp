# Dark barber Web UI — evidence, 29 September 2026

Status: implemented on `codex/web-primary`, not deployed. The first design was rejected by
the owner; the second revision uses a compact dark member card, quieter typography and one
Web visit-status message. Visual preference still needs owner acceptance before rollout.

## Scope

- Preserve Phone Auth, signed branch QR, staff confirmation, tenant isolation and hidden cooldown.
- Restyle customer, history, reward/wheel, staff and owner screens; keep backend unchanged.
- Self-host [Be Vietnam Pro from Google Fonts](https://github.com/google/fonts/tree/main/ofl/bevietnampro)
  as eight WOFF2 subsets (about 136 KB total), with OFL in `public/fonts/OFL.txt`.
- Keep the Zalo archive at `5ae0ff21200ae4d32b07e9f588ee6b7797c35d0e`. No Zalo deployment or review.

## TDD and functional evidence

| Guarantee                                                                           | Evidence                                                                                                                                    |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Member card displays authoritative points and masked phone                          | RED: 1 new HomePage test failed because the named card was absent; existing 4 passed. Checkpoint `aca42b2`.                                 |
| Web confirmation has one concise status, without old repeated steps or cooldown CTA | RED: 1 new test failed because status region was absent; existing 5 passed. Checkpoint `c2525fb`.                                           |
| New card and all existing HomePage status/navigation/sync cases                     | GREEN: 12/12 HomePage tests; lines/statements 99.32%, branches 96.11%, functions 100%. Thresholds were explicitly 80% for this focused run. |
| Existing customer, auth, history, photo and wheel logic                             | Full functional run before the last 6 HomePage cases: 220/220 tests passed.                                                                 |
| Browser flows including Phone login, four tabs, narrow screens and accessibility    | 45 passed, 0 failed, 0 flaky; 3 existing historical screenshot tests intentionally skipped. Chromium desktop/mobile and mobile WebKit.      |
| Build/typecheck, formatting, lint, source safety                                    | Production and test builds passed; formatting/lint passed; secret scan and CSP synchronization passed.                                      |
| Fixture exclusion                                                                   | No design fixture IDs or HTML are emitted in the production build.                                                                          |

Focused command:
`npm run test:coverage -- src/pages/HomePage.test.tsx --coverage.include=src/pages/HomePage.tsx --coverage.thresholds.lines=80 --coverage.thresholds.functions=80 --coverage.thresholds.statements=80 --coverage.thresholds.branches=80`.

Browser command: `npm run test:e2e`. Report stats: total 48, expected 45, unexpected 0,
flaky 0, skipped 3. New regression: `e2e/web-barber.spec.ts`.

## Visual and accessibility checks

Local design fixtures only, without Firebase credentials. Six page types were rendered at
390 and 1440 px; eight owner tabs were also checked at 360 and 1440 px. All final checks:
no document overflow, no serious/critical axe findings. Fixed unreadable inherited text,
two unnamed branch selects, and a staff-management label overflowing on narrow screens.

Fixture HTML is outside the production entry graph. It refuses to render outside test mode
or with Firebase configuration. Start Vite in test mode, then open
`/e2e/fixtures/barber-preview.html?page=home` (also history, rewards, wheel, staff, owner).
These screenshots use illustrative data, not customer records or real QR signatures.

## Known limits — not a blanket PASS

The existing broad service-coverage gate fails: lines/statements 68.53%, functions 69.38%,
branches 77.65%. Its configured 70% thresholds were not lowered. The main gap is
`src/services/firebase.ts`, which is unchanged from `06e7e1a`.
The focused HomePage coverage result must not be presented as whole-app coverage.

Visual fixtures and automated browser engines do not replace acceptance on the owner's phone.
No Hosting/Functions deployment, merge to main, gateway modification or production data mutation
was performed for this design revision.

## Typography refinement after owner feedback

The owner found text too heavy. This follow-up changes type only: a real locally hosted
500 Medium face, less compressed heading tracking, gentler label weights, and slightly
larger small navigation/member labels. Colors, component layout and business logic remain
unchanged. The CH decorative monogram keeps its stronger weight.

- RED checkpoint `99c19f6`: the new browser check expected heading weight 500, observed 600.
- GREEN: 15 focused browser checks passed across desktop/mobile Chromium and mobile WebKit.
  The new check verifies a loaded 500 font face, heading/action weight and relaxed tracking.
- Repeated 12 page-layout and 16 owner-tab checks: no page overflow or serious/critical axe issues.
- Preview screenshots now use device scale factor 2 and explicitly await font loading.
- No new business-code coverage is claimed for a CSS/font-only change. The earlier whole-service
  coverage limitation above remains unchanged; no thresholds were lowered.

## Customer layout refinement — 30 September 2026

Customer headings use the locally hosted 300 Light face with Regular controls and thin icons.
The customer stylesheet is scoped to `customer-main`. The member card is shorter; existing
History/Rewards shortcuts have descriptions; desktop Home uses two columns; Account groups
its existing points, device information and logout action.

No API, data-loading, authentication or points behavior was added.

- RED checkpoint `3ecf0b8`: expected customer heading weight 300; previous build rendered 500.
- GREEN: 48 browser tests passed, 3 historical screenshot tests skipped, no failures.
- Home, Account and Rewards component checks: 15/15 passed.
- Focused Home/Account coverage: lines/statements 98.88%, branches 92.03%, functions 100%.
  These figures cover those two pages only; the service-coverage limitation remains unchanged.
- Fourteen mobile/desktop design renders passed overflow and serious/critical axe checks.
- Build, lint, formatting and secret scan passed. Hosting deployment is recorded separately
  in release status after verifying the live result.
