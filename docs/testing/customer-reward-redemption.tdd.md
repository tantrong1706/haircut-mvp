# Redeeming a gift from customer search

An owner or reward-authorized staff member can find a customer by name or phone suffix,
verify the suffix, choose a branch and confirm the gift after handing it over. No gift
code or QR is required. The existing code-based flow stays available.

| Check                                                  | Result                                                                                                                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RED `7eccb2c`                                          | Reward-only staff could not use the lookup, and redemption required a gift code.                                                                                                           |
| Focused Web Vitest and coverage                        | 40 passed. `CustomerRewardActions.tsx`: 100% lines and 90.78% branches.                                                                                                                    |
| Firestore emulator: adversarial audit and Web customer | 53 passed. New helper: 100% lines and 83.33% branches. Covered scope, wrong suffix, wrong customer, expired and branch-restricted gifts, pagination, and retry without another redemption. |
| Owner Playwright                                       | 10 passed across mobile, tablet, and desktop profiles.                                                                                                                                     |
| Web and Functions checks/builds; Manager typecheck     | Passed. Functions check included 119 unit tests.                                                                                                                                           |

The list does not include bearer reward codes. The server checks salon, branch, role,
the customer's phone suffix, expiry, and the gift's redemption scope. The existing
redemption transaction still controls one-time use and audit logging. No live data,
permissions, Firestore rules, or deployed functions were changed.
