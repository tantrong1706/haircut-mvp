# Reward branch selection and refresh

The salon owner can choose the redemption branch without leaving the reward screen.
If only one active branch exists it is used automatically. Checking a code in one
branch cannot enable confirmation in a different branch. Customers can refresh the
list manually and when returning to the page; the refresh uses existing API data and
does not redeem anything.

| Check                                                           | Result                                                                                                                                                           |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RED `6c3fc4c`                                                   | Targeted Web tests reproduced missing branch selection and the absence of a refresh control.                                                                     |
| Focused Web Vitest with coverage                                | 28 passed across the redemption, rewards, owner and staff suites. Changed reward UI modules reached 92.92% lines, 82.75% branches and 85.18% functions combined. |
| Web lint, formatting, production build                          | Passed.                                                                                                                                                          |
| Owner browser: management tabs                                  | Five profiles passed. The reward tab selected the only active branch without relying on the overview filter.                                                     |
| Customer navigation Playwright                                  | 18 passed, including active-to-used refresh on Chromium desktop, mobile Chromium and mobile WebKit.                                                              |
| Local Firestore: adversarial audit and Web customer integration | 49 passed; includes redemption, cross-tenant authorization, and duplicate, expired and wrong-branch cases.                                                       |

No Firebase rules, Functions, reward entitlements, balances, or live data changed.
