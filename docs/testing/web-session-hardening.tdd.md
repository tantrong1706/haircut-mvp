# Web session hardening — 11 October 2026

## Scope

Continue the owner's Web-only cleanup and readiness request. Journeys were derived from the
actual source audit. Keep Firebase, branch QR, Phone Auth, server-authoritative points and rewards;
do not migrate data or deploy Functions. The owner separately approved bounded Dependabot version
PRs and main + Hosting after tests/CI pass.

## Reproduced and fixed

RED `9e71116`: 9 new failing cases, 28 existing cases passed in the same target.
GREEN `973376a`: the same 37 cases pass.

| Guarantee                                                                     | Evidence                                                           |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| A stopped polling subscription never emits a late result, sync event or error | `src/services/api.test.ts`: resolve/reject after stop              |
| Direct UID switch reloads context and hides old points                        | `WebCustomerEntryPage.test.tsx`: UID A → B                         |
| Late check-in/account results cannot reopen the old customer after logout     | Two deferred-request component tests                               |
| Stale context and unmounted entry results are discarded                       | Deferred context/entry tests                                       |
| Leaving the wheel suppresses old results and cancels its animation timer      | Two new `WheelPage.test.tsx` cases                                 |
| Version-update PRs are bounded without changing security update rules         | `node --test test/dependabot-policy.test.mjs`: RED 0/2 → GREEN 2/2 |

Hosting guards: RED `e69240e` failed 2/2 source-contract tests; GREEN `a50e0de` passed both.
Windows fault injection also passed in an isolated temporary fixture: mocked npm exit 17 preserved
the previous staging HTML; mocked packaging exit 19 prevented any Firebase command invocation.
No real deployment was invoked by those tests.

## Broader validation

- `npm run check` in `customer-web`: lint, formatting, 209 unit tests, TypeScript, production build PASS.
- `npm run test:e2e`: 51/51 PASS across desktop Chromium, mobile Chromium and mobile WebKit.
- Scoped coverage: 41 tests PASS; statements/lines 89.76%, branches 80.57%, functions 91.89%.
- Production HTML read-only smoke before deployment: eight routes HTTP 200; old entry still served.
- Windows CRLF introduced by checkout caused the first format pass to fail; Web LF attributes
  and formatting fixed it without disabling a test or changing unrelated logic.

Coverage command (inside `customer-web`):

```text
npm exec -- vitest run src/services/api.test.ts src/services/api.web-only.test.ts src/pages/WebCustomerEntryPage.test.tsx src/pages/WheelPage.test.tsx --coverage --coverage.include=src/services/api.ts --coverage.include=src/pages/WebCustomerEntryPage.tsx --coverage.include=src/pages/WheelPage.tsx --coverage.reportsDirectory=coverage/session-hardening --coverage.thresholds.lines=80 --coverage.thresholds.functions=80 --coverage.thresholds.statements=80 --coverage.thresholds.branches=80
```

These are mocked/emulated browser flows, not newly executed real SMS or customer mutations.
CI/deployment/rollback metadata are recorded in [release status](../RELEASE_STATUS.md) when verified.
Remaining dependency advisories and App Check monitor mode are not disguised as complete security.

The Dependabot version-PR limit does not limit security update PRs: see the
[official options reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#open-pull-requests-limit).
Existing open PRs are not claimed closed merely because the configuration changed.
