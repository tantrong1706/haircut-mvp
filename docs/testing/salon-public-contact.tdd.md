# Salon public profile settings

The salon owner selected display name, logo, hotline, and opening hours. The Web Settings
form reuses the existing profile and logo workflows. Hours are optional free text for the
salon, not a per-branch schedule and not an input to point eligibility or check-in.

| Verification                                                                               | Result                                                                                                   |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| RED `6946046`: owner and check-in UI regressions plus Firestore integration                | Existing forms and responses lacked the requested display fields                                         |
| GREEN `dff7062`: eight focused Customer Web test files                                     | 69 passed; contact and form components reached 100% lines and 96.42% branches combined                   |
| Full Customer Web `npm run check`                                                          | Lint, formatting, 389 tests in 71 files, TypeScript, and production build passed                         |
| Firestore emulator: `webCustomer.integration.test.ts`, `salonBranding.integration.test.ts` | 27 passed; contact parser reached 100% lines and 96.66% branches                                         |
| Functions `npm run check` and `npm run build`                                              | Passed, including 119 unit tests                                                                         |
| Manager shared adapter compatibility: `npm run typecheck`                                  | Passed                                                                                                   |
| Customer navigation Playwright suite                                                       | 15 passed, including visible hours and a safe dial link on desktop Chromium, mobile Chromium, and WebKit |
| Owner settings and management-tab browser checks                                           | 10 passed across the five viewport profiles                                                              |

The new field is opt-in: only the explicit hotline is shown to customers, never the
existing internal phone. An owner from another salon and a staff member cannot edit it.
Omitting the new fields preserves existing values for older clients; clearing a field
removes it from customer displays. The browser tests use synthetic data and the server
tests use the local `demo-haircut` emulator. The emulator rerun used the repository's
20-second test timeout after an existing concurrent check-in test exceeded the runner's
five-second default. No live data or configuration was changed.
