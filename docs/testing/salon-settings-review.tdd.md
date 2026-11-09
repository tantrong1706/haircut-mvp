# Salon settings review: preview and current directions

The review covers the owner settings and customer-facing information. It separates the
salon's profile address from the branch address and names the shortcut panel separately
from the operation switches. History copy does not promise internal notes to customers.

| Check                                                           | Result                                                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| RED `7ef27eb`: focused Web and Firestore regressions            | Missing preview; an existing visit returned its old branch address.                                                 |
| Focused Web Vitest and coverage                                 | 52 passed. The three preview/contact/profile components reached 100% lines and 95.76% branches combined.            |
| Firestore emulator: Web customer and salon branding integration | 30 passed. Directions use the current branch address, hide an inactive branch, and leave the visit state unchanged. |
| Owner Playwright Settings and management layout                 | 10 passed, including preview at 320px and keyboard-accessible settings.                                             |
| Web lint, formatting, build; Functions check and build          | Passed. Functions check included 119 unit tests.                                                                    |

The preview renders only information intended for customers, filters to active branches
of the owner salon, and does not submit, dial, or navigate. Directions use an already
resolved QR branch if it matches; the session refresh reads the current branch only
when directions and address display are both enabled. No live changes or release.
