# Zalo V21 wheel/reward final candidate — TDD evidence

## Source

Journeys were derived from the owner request for the unified PR #34 + PR #35 candidate. No external plan file was executed.

## User journeys

- As an owner, I can configure weighted wheel slots and every save creates a new config version.
- As a customer, I only spin the wheel configuration currently displayed and the pointer stops at the backend-selected slot.
- As a customer, a no-prize result never creates a usable voucher and a winning reward keeps an immutable snapshot.
- As staff, I can inspect branch eligibility before confirmation and safely retry a redemption without consuming it twice.
- As a customer, I can present a versioned reward QR without exposing identity or authentication tokens.
- As an owner, I can restore an accidental redemption within 15 minutes while staff cannot restore it.

## RED / GREEN checkpoints

| Behavior | RED checkpoint | GREEN checkpoint | Evidence |
| --- | --- | --- | --- |
| Weighted slots, legacy defaults and version increment | `b45bd5d`, `9cf805c` | `4fe51b8`, `4026be8` | Functions business-rule tests: 27/27 PASS; wheel UI/service tests included in 154/154 Zalo unit PASS |
| Exact pointer, double-click, reduced-motion and stale response fail-closed | `6f2831d` | `4026be8` | `WheelPage.test.tsx`: 12/12 PASS, including selectedIndex 0–5 |
| Salon-wide and branch-restricted reward eligibility | `b0fc754` | `8eb1eda`, `22d3ced` | Functions emulator integration: 59/59 PASS; adversarial tenant suite: 21/21 PASS |
| Customer reward QR and status UX | `be94659` | `8eb1eda` | `RewardsPage.test.tsx`: 2/2 PASS; only unused reward renders QR |
| Strict scanner payload | `0b1b73f` | `8eb1eda` | Manager `nativeRuntime.test.ts`: PASS for `haircut-reward:v1:<code>` and malformed rejection |
| Branch-consistent lookup and server-authoritative usedAt | `4c6d1ec` | `8eb1eda` | Manager redemption component test PASS; callable concurrency/idempotency tests PASS |
| Official Mini App branding | `35e5953` | `59ff413` | Branding test PASS and Zalo review readiness 34/34 PASS |

## Validation actually run

| Target | Command | Result |
| --- | --- | --- |
| Functions typecheck | `npm run typecheck` | PASS |
| Functions lint | `npm run lint` | PASS |
| Functions unit | `npm run test:unit` | 92/92 PASS |
| Functions integration | Firebase Emulator in WSL, `test:integration:emulator` | 59/59 PASS |
| Firestore/Storage rules | Firebase Emulator in WSL, `test:rules:emulator` | 20/20 PASS |
| Functions build | `npm run build` | PASS |
| Zalo lint | `npm run lint` | PASS |
| Zalo unit | `npm run test:run` | 154/154 PASS |
| Zalo coverage | `npm run test:coverage` | PASS configured thresholds; 73.44% statements/lines, 77.01% branches, 79.06% functions; `wheel.ts` 98.85% lines |
| Zalo build/package | `npm run build:zmp` | PASS |
| Zalo readiness | `npm run check:zalo-review` | 34/34 PASS |
| Manager typecheck/lint/unit/build | package scripts | 78/78 unit PASS; remaining commands PASS |

## Known gaps

- Repository-wide Zalo coverage is below the TDD skill's aspirational 80% line target, although it passes the repository's configured 70% threshold. The changed wheel helper is at 98.85% line coverage.
- Device-only Zalo Testing evidence and adding a Testing User remain manual Portal/device steps. They are not simulated as PASS.
- No Firebase, Gateway or Zalo deployment was run for this candidate.

