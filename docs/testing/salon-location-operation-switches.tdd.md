# Salon location and operation switches

The owner selected both groups. Address visibility defaults on; Directions defaults off
and requires a visible, non-empty branch address. The link uses the branch address as an
encoded destination and does not load a map, request location, or require a key in the app.

Web check-in and spins default on. Owner flags can restrict but not enable a system-disabled
feature. A paused salon can still confirm a previously submitted request. The customer's
account, history, points, and awarded rewards are retained. A successful spin can be
replayed with its original idempotency key under an owner pause, without another deduction.

| Check                                                                                         | Result                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RED `ce6d994`                                                                                 | Web tests reproduced missing switches and directions; Firestore reproduced a public branch address after owner opt-out.                                                               |
| Focused Web Vitest coverage                                                                   | 76 passed across eight suites; the profile and contact components combined reached 100% lines and 96.29% branches.                                                                    |
| Firestore emulator, `webCustomer.integration.test.ts` and `salonBranding.integration.test.ts` | 29 passed; the salon settings helper reached 100% lines and 97.56% branches. Verified tenant isolation, owner pause, pending approval, idempotent spin replay, and system precedence. |
| Web and Functions build, lint, formatting, and Manager typecheck                              | Passed; Functions check included 119 unit tests.                                                                                                                                      |
| Playwright owner Settings and customer navigation                                             | 10 owner and 15 customer runs passed across desktop and mobile profiles.                                                                                                              |

All tests use fixture data or the local `demo-haircut` emulator. No production configuration,
data, or permissions were changed.
