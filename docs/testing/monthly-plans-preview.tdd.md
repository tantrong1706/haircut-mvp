# Monthly Plus/Pro preview — 2026-10-28

## Approved scope and boundaries

The owner approved two proposed monthly paid tiers: Plus for one branch and Pro for at most three.
Both include the existing core customer/points, photo/note, wheel/reward and OTP capabilities.
Prices and numeric OTP, staff, customer-directory and image-storage allowances are not approved.
The owner separately approved push + PR + CI for this preview, not merge or deployment.

This implements **presentation only** inside Owner Settings. There is no checkout, payment provider,
activation, expiry scheduler, subscription write, new API or entitlement enforcement. The existing
free-customer policy and existing salon rights/data remain unchanged. The expiry-retention text is
the proposed product policy, not a newly implemented subscription lifecycle.

Base: main `89cee9a6b9febac888bd27f7511698969fb8f16e`. Branch: `codex/monthly-plus-pro-preview`.
Admin PR #79 and Zod security PR #80 are independent and are not merged or included here.
The known dependency risks on main are not fixed by this UI preview; integrate/reverify the security
patch separately before a future release. No dependency or lockfile changes are made in this task.

## Journeys and checkpoints

Journeys were derived from the discussion, not a separate plan file.

| Guarantee                                                                          | RED                                                                    | GREEN / executed evidence                                                                            |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Existing Owner behavior remains intact                                             | Baseline 10/10 PASS                                                    | Final full Web suite 304/304 PASS                                                                    |
| Settings shows only Plus/Pro, monthly cadence and the approved branch proposals    | `401c05e`: 3 new expected missing-region failures / 10 existing passes | `92f60f8`: same Owner target 13/13 PASS                                                              |
| No fabricated price, checkout link, subscription write or additional profile fetch | Same new tests failed before implementation                            | Region has no buttons/links, shows two unpublished-price labels; mutation spies stay untouched       |
| Existing salon above the proposed branch limit is not clamped                      | Same RED target                                                        | Four existing branches remain selectable and their scoped overview still loads                       |
| Existing settings save retains its exact whitelist payload                         | Same RED target                                                        | Save includes salon/name/address/phone/points only, not plan or billing fields                       |
| Responsive comparison and accessible content                                       | Additional browser assertions, not claimed as the original RED gate    | Final 40/40 on 320px, 360px, mobile WebKit, tablet and desktop; scoped axe audit has zero violations |

Commands actually executed:

- `npm --prefix customer-web ci --no-audit --no-fund`: PASS, lockfile unchanged.
- `npm --prefix customer-web run test:run -- src/pages/OwnerPage.regression.test.tsx`: baseline,
  RED and GREEN as recorded above, with `VITE_APP_ENV=test`.
- Same target with `--coverage --coverage.include=src/features/owner/MonthlyPlansPreview.tsx`
  and 80% thresholds for lines/functions/statements/branches: **100% in every dimension**.
- Web lint and formatting: PASS. OwnerPage is in the existing legacy formatting baseline;
  its only production edits are one import and one component insertion, not a broad rewrite.
- Full Web `test:run` in test mode: **304/304 PASS**, 54 files.
- `build:web` in production mode with public Firebase CI fixture values: PASS, including TypeScript.
- `test:owner:browser`: final **40/40 PASS**, all eight existing menu sections remain usable.
- `node --test test/*.test.mjs`: **40/40 PASS**.
- Tracked secret scan, CSP synchronization, whitespace and scope checks: PASS.

The browser fixture aborts non-loopback traffic and uses fictitious owner/salon data. It does not
send real OTPs or operate on real customer data. Desktop and actual 320px viewport screenshots were
inspected locally, with the sticky menu still present. All browser preview servers shut down.

## Visual-check correction, not a hidden failure

The first complete browser run passed 40/40. A later stronger capture check initially passed 39/40:
tablet intersection was 0.998066 instead of exactly 1 because the comparison's lower border was at
the viewport edge. Large-element phone captures also included the sticky menu over the captured area.
The test now deliberately scrolls the comparison below the existing menu with a 16px margin, keeps
the strict full-viewport assertion, and checks each heading using elementFromPoint before capturing
the viewport/cards. The final full run passed 40/40. No application style was changed to hide the menu.

## Not performed / future gates

- No real charge, provider integration, subscription activation or limit enforcement.
- No Firebase/Hosting deploy, main merge, schema migration, role update or production-data edit.
- No native build/release or physical Samsung/iPhone test.
- No new local backend/emulator runs for this presentation-only change; backend/package/config
  source is byte-unchanged. Required CI must be verified on the PR's exact head.
- Actual subscriptions require approved prices/allowances and server-owned, verified billing state.
  Do not treat this private client-side preview catalogue as authority for paid rights.
