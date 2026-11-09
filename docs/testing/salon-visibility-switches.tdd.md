# Salon visibility switches

The owner can choose whether the logo, hotline, and opening hours are shown to customers.
The switches take effect after saving. Hidden values are retained for the owner, and the
salon name stays visible. There is no new operational switch or directions integration.

| Check                                                                                             | Evidence                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RED `6853564`                                                                                     | Targeted Web tests reported missing switches and the wrong save path; the emulator reproduced accepting an invalid switch value.                                                                                 |
| Focused Web Vitest suite                                                                          | 49 passed across five files. `SalonProfilePanel.tsx`: 100% lines and 96.49% branches.                                                                                                                            |
| Firestore emulator with `webCustomer.integration.test.ts` and `salonBranding.integration.test.ts` | 28 passed, with 100% lines and 97.22% branches in `publicContact.ts`. Checked owner authorization, no data loss, public QR and authenticated responses, partial re-enable, and compatibility with older clients. |
| `npm run test:owner:browser` filtered to Settings and management layout                           | 10 passed across five browser/viewport profiles, including keyboard switching.                                                                                                                                   |
| Web lint, formatting, and production build; Functions check and build                             | Passed, including 119 Functions unit tests.                                                                                                                                                                      |

No production writes. Older salons default to showing their existing populated fields.
Hiding a logo excludes its URL from subsequent customer responses; it does not revoke
previously shared URLs or remove copies already downloaded.
