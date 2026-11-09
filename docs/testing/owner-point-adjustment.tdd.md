# Owner-only manual point adjustment

The owner can select a customer, enter a positive or negative correction of 1–100
points, explain the reason, review the projected balance and confirm. The feature
does not create a visit or point request, alter cooldowns, or change rewards.

| Check                                                  | Result                                                                                                                                                                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RED `87b82ee`                                          | The owner UI had no adjustment control and the callable did not exist.                                                                                                                                                   |
| Focused Web Vitest                                     | 27 passed; the adjustment component reached 100% lines and 93.87% branches.                                                                                                                                              |
| Firestore emulator: adversarial audit and Web customer | 55 passed; new helper reached 97.56% lines and 93.61% branches. Covered plus/minus, duplicate and conflicting retries, wrong roles/tenants, insufficient points, invalid input, stale balance and cooldown preservation. |
| Owner Playwright                                       | 10 passed on desktop, tablet and phone profiles.                                                                                                                                                                         |
| Web and Functions lint, formatting and builds          | Passed. Functions check included 119 unit tests.                                                                                                                                                                         |

The Firestore transaction applies the balance change and audit event together.
Only owners of the same salon may call the action; it respects the existing point
approval feature gate. No live balances were changed and this feature was not deployed.
