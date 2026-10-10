# Web-only retirement — 10 October 2026

## Scope and journeys

Owner decision: keep Firebase, cancel Botkeep, remove unused Zalo material, rewrite README and
push the current Web branch. Journeys derived from that request, not an external plan.

- Customer uses Firebase Phone Auth in every browser; legacy cached identity never authorizes data.
- Keep branch QR, OTP persistence, staff confirmation, points, history, photos and reward behavior.
- Retire SDK/review tools without removing shared Manager adapters or live Firebase resources.
- Keep Git changes recoverable and push `codex/web-primary`, not `main`.

## RED → GREEN

RED checkpoint: `7c6f11c` on `codex/web-primary`.

- `node --test test/web-only-retirement.test.mjs`: 0/3 passed before cleanup. The SDK, legacy
  runtime and Botkeep server were still present.
- `npm run test:run -- src/services/api.web-only.test.ts`: 0/4 passed before cleanup.
  Legacy sessions returned demo data instead of rejecting. The first run was stopped to isolate
  Firebase/SDK dependencies; the isolated run executed all four intended failing assertions.
- After cleanup the same architecture tests and identity rejection tests pass.

## Verified locally

| Guarantee                                                                                      | Command / test                                                        | Result                                                                         |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| No ZMP dependency/runtime and no Botkeep/review tool entry points                              | `node --test test/*.test.mjs`                                         | 22/22 PASS                                                                     |
| Web routing, logout isolation, backend adapter, UI components                                  | `npm run check` in `customer-web`                                     | Lint, formatting, 200 unit tests, TypeScript and production build PASS         |
| Legacy identity rejected before history/rewards/config/spin                                    | `api.web-only.test.ts`                                                | 4/4 PASS                                                                       |
| New/returning customer, tenant switch, logout, history, wheel, staff/owner auth, accessibility | `npm run test:e2e`                                                    | 51/51 PASS; desktop Chromium, mobile Chromium, mobile WebKit; no skipped tests |
| Production cannot activate locally forged E2E fixtures                                         | `webCustomerApi.test.ts`                                              | PASS; authenticated callable still required                                    |
| Shared pure client domain                                                                      | `npm run test:domain`                                                 | 17/17 PASS; lines/statements/functions 100%, branches 98.07%                   |
| Scoped Web adapter coverage                                                                    | Command below                                                         | 25 tests PASS; lines/statements 94.11%, branches 85.38%, functions 100%        |
| No new dependency version changes                                                              | Compare surviving lockfile entries to pre-cleanup HEAD                | 0 version changes                                                              |
| No SDK/test fixture code in production assets                                                  | Scan `www/assets/*.js` for SDK and E2E fixture markers                | PASS                                                                           |
| No tracked secret or CSP drift                                                                 | `node scripts/check-secrets.mjs`; `node scripts/sync-csp.mjs --check` | PASS                                                                           |
| PowerShell check scripts parse                                                                 | PowerShell AST parser                                                 | PASS; strict production readiness was not executed                             |

Scoped coverage command (run inside `customer-web`):

```text
npm exec -- vitest run src/services/api.test.ts src/services/api.web-only.test.ts src/services/webCustomerApi.test.ts src/services/qr.test.ts --coverage --coverage.include=src/services/api.ts --coverage.include=src/services/webCustomerApi.ts --coverage.include=src/services/qr.ts --coverage.reportsDirectory=coverage/web-only --coverage.thresholds.lines=80 --coverage.thresholds.functions=80 --coverage.thresholds.statements=80 --coverage.thresholds.branches=80
```

The SDK-specific tests and review screenshot capture were retired with their implementation.
Customer navigation, wheel animation and returning-customer E2E coverage were migrated to the
explicit Web test adapter, not disabled. Generated `.tmp/` diagnostic files are excluded from
formatting; production/test source remains checked.

One early repository test ran while clean npm installation was still extracting files and failed
to resolve a dependency. After installation completed, all 22 tests passed. The initial formatter
failure concerned ignored local diagnostic files; no application test was skipped to fix it.

## Recovery and boundaries

Remote `codex/zalo-archive` was deleted after verifying head
`5ae0ff21200ae4d32b07e9f588ee6b7797c35d0e`, no open PR on that head branch, and a complete local
Git bundle. The ignored backup is `.tmp/retired-zalo-20261010.bundle` in the working checkout.
`git bundle verify` passed. Other branches, `main`, and published Git history were not rewritten.

Backend source, Rules, contracts, Admin, Manager and Gateway source were not modified.
No Firebase deploy, service deletion, secret rotation, DNS change, Botkeep upload or database
migration was performed. Tests do not establish that this source is already deployed.

`npm audit --omit=dev` now reports 0 critical / 4 high / 0 moderate in Customer Web.
Remaining high findings are the Firebase/Firestore/gRPC dependency chain; no unrelated upgrade
was attempted. This cleanup is not a claim of zero vulnerabilities or a complete production audit.

GitHub CI is the independent validation for Functions/Rules, Admin and Manager on this source;
record the final run separately once complete.
