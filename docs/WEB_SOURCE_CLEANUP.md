# Web source cleanup — 2 October 2026

> Historical first-stage report. The 10 October Web-only retirement removes the frontend
> compatibility paths described as retained below. See `testing/web-only-retirement.tdd.md`
> and the root README for current scope. Backend production resources remain unchanged.

## Completed source boundaries

- Renamed `zalo-mini-app/` to `customer-web/`, preserving local ignored configuration and builds.
- Updated active workflows, Manager adapters, scripts, ignore rules and workspace package name.
- Extracted pure types, wheel calculations and safe storage into `packages/client-domain/`.
  Web retains thin re-exports. Firebase singleton/auth services remain behind existing adapters.
- Removed unused `prepare-zalo-review.mjs`, `run-zalo-review-capture.mjs` and their preparation
  config test. They are recoverable from Git history before this cleanup.
- No dependency versions upgraded. No customer identity, points, history, rules or auth changes.

## Deliberately retained

`customer-web/src/services/api.ts` still imports Zalo identity helpers alongside Web API paths.
The backend still exports Zalo callables, including `getCustomerCheckinProfileFromZalo` in
addition to the five originally listed. Those callables use the verifier, phone and privacy helpers.
They are not proven-unused production resources just because their names contain Zalo.

No Functions, secrets, environment bindings, Gateway services or Firebase data were deleted.
No production deployment or main merge is part of this source cleanup. Full removal of the
compatibility runtime is not claimed by this structural refactor.

## Verification / TDD

Journeys: Customer Web keeps building under its new name; Manager resolves shared code;
OTP persistence, points and rewards preserve their behavior; no shared domain import reaches UI/SDK.

`node --test test/web-workspace-boundary.test.mjs`: RED 0/3 before the move (`f274870`),
GREEN 3/3 afterwards (`a7b05d7`). The same test is now part of Repository Checks CI.
Coverage includes the actual extracted implementations, not only re-export wrappers.
Local verification: Web typecheck/test build PASS; 42 focused OTP/App Check/storage/wheel tests
PASS. Manager `npm run check` PASS (78 tests, typecheck, lint, formatting and production build).
`npm run test:domain` PASS: 17 tests; shared domain lines/statements/functions 100%, branches
98.07%. The first external-coverage attempt reported no files; the dedicated configuration now
measures the implementations and enforces 80% on all four dimensions in CI.

The cleanup preserves backend source byte-for-byte. No dependency resolution/version change:
the Web lockfile only changes its root package name. Historical release evidence retains old paths.

Final CI verified on 4 October 2026 (Asia/Saigon): source
`487016d238cfcb0172b86c01bf8a3d6e7a2dd879`, all six jobs PASS, including browser flows.
Run: https://github.com/tantrong1706/haircut-mvp/actions/runs/36971231614.
No production deployment or main merge was performed for this cleanup.
