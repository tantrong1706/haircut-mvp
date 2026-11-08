# Address-free customer check-in

The owner removed address and directions from customer Web because visitors are already
at the salon when scanning its QR. The branch name remains visible. The owner preview and
Settings no longer ask for an address or offer directions switches. Existing address
records remain unchanged, and the branch management form can still use an optional address.

| Check                                                           | Result                                                                                                                                                                             |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RED `74888e0`                                                   | Targeted tests reproduced an address and switches in the UI and the saved address in the check-in response.                                                                        |
| Focused Web Vitest with coverage                                | 72 passed across seven files. The profile, preview, and contact components reached 100% lines and 94.94% branches combined.                                                        |
| Firestore emulator: Web customer and salon branding integration | 30 passed. Checked that old visibility flags cannot expose addresses in public QR, authenticated context, check-in, or session reads. The owner's branch list retains its address. |
| Web and Functions lint, formatting, build; Manager typecheck    | Passed. Functions check included 119 unit tests.                                                                                                                                   |
| Playwright owner Settings and customer navigation               | 25 passed across the tested desktop and mobile profiles.                                                                                                                           |

Public Web callables keep compatible empty address fields. No data migration is needed
to ignore obsolete switches; signed QR checks and points rules are unchanged. This
replaces the location UI documented in the earlier settings work. No live release.
