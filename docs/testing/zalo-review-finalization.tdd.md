# Zalo Review Finalization — TDD Evidence

## Source

Journeys and acceptance criteria were derived from the project owner's request to consolidate PR #30 and PR #32 into one review candidate without merging or pushing either PR, without deploying Firebase/Zalo, and without submitting review or publishing.

## User journeys

1. Firebase Functions must use the Vietnam Gateway only when an explicit verifier mode and bound Secret Manager HMAC are present.
2. Public Gateway requests must be bounded before body authentication, retain HMAC/replay controls, and return HSTS.
3. Windows persistence must run a checksummed immutable release rather than executable JavaScript from a writable development worktree.
4. CI and local full checks must include Gateway source, dependency audit, and Functions compatibility.
5. Reviewer screenshots must use the current 16-name checklist, with the Zalo permission popup explicitly captured on a real device.
6. A single strict gate must distinguish static readiness from actual pre-submission readiness.

## RED → GREEN evidence

| Guarantee                                                                                           | RED evidence                                                                          | GREEN evidence                                                                                        |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Gateway HMAC is declared with defineSecret and bound to every Zalo callable                         | zaloGatewayVerifier test: 2 failed                                                    | Targeted suite: 6 passed; Functions full unit: 79 passed                                              |
| Missing verifier mode does not silently use direct egress                                           | Static contract test failed on direct default                                         | Targeted suite: 6 passed                                                                              |
| Unauthenticated clients are rate-limited before body/HMAC parsing                                   | Integration expected 429, received 401                                                | Gateway security integration: 19 passed                                                               |
| Gateway emits HSTS                                                                                  | Health test expected header, received null                                            | Targeted health test passed                                                                           |
| Local/full CI includes Gateway and main-branch PR trigger                                           | Root release tests: 2 failed                                                          | Root release/submission tests: 6 passed                                                               |
| Screenshot tooling uses only the current 16 names                                                   | Root release test failed on 01-open.png                                               | Root release tests passed; owner/staff legacy names removed                                           |
| Strict submission checker rejects incomplete evidence                                               | Compile-time RED: checker module missing                                              | Submission checker unit: 2 passed                                                                     |
| Windows release is immutable/checksummed and rollback reads the prior version before activation     | Template test failed for missing scripts, then failed ordering 5653 < 5148            | Deployment template suite: 4 passed; PowerShell parser: 0 errors                                      |
| Administrator can install a candidate owned by the Codex sandbox without changing global Git config | Live installer failed with dubious ownership and then called Trim on empty Git output | Installer uses a repo-scoped safe.directory, validates Git exit status first, template suite 4 passed |
| A partially prepared immutable Windows release can be retried safely                                 | Live retry stopped at `Release already exists`                                        | Existing release is reused only after manifest, size and SHA-256 verification; template suite passed  |
| A missing WinSW registration is recovered without creating duplicate services                        | Live activation returned Windows service error 1060                                   | Installer detects the missing service, installs once, starts it and requires local health 200          |
| Windows replay state is stored under the restricted ProgramData runtime                               | Final admin audit found the live replay DB outside ProgramData                         | Runner forces the secured path; installer copies DB/WAL/SHM only while the service is stopped          |
| Repeated activation replaces the current release pointer on Windows                                   | Live retry could not overwrite the existing `current.txt` with `Move-Item -Force`      | Existing pointer uses atomic `File.Replace` with a restricted rollback backup; first install uses move  |
| First startup on Windows has enough time for checksum, AV scan and Node initialization                 | Secure Node reached `gateway_started` at the old 30-second readiness boundary          | Health gate remains mandatory with a bounded 120-second startup window                                 |

## Final validation

| Area                       | Command or evidence                                                             | Result                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Gateway                    | npm run check                                                                   | 9 files, 62 tests PASS; typecheck/lint/format/build PASS                                                   |
| Functions                  | npm run check then npm run build                                                | 14 files, 79 tests PASS; typecheck/lint/format/build PASS                                                  |
| Root gates                 | node --test test/release-gates.test.mjs test/zalo-submission-readiness.test.mjs | 6 PASS                                                                                                     |
| Mini App unit              | npm run test:run on integrated source before review-tool-only changes           | 29 files, 127 tests PASS                                                                                   |
| Mini App coverage          | npm run test:coverage                                                           | Lines 71.24%, branches 79.5%, functions 76.31%; repository thresholds PASS                                 |
| Mini App E2E               | npm run test:e2e                                                                | 15 PASS across desktop/mobile Chromium and mobile WebKit; 3 screenshot-capture tests intentionally skipped |
| ZMP build                  | npm run build:zmp then validate:zmp                                             | Build PASS; manifest/assets complete                                                                       |
| Static Zalo check          | npm run check:zalo-review                                                       | 34/34 static checks PASS                                                                                   |
| Secret scan                | node scripts/check-secrets.mjs --include-working-tree                           | 506 files PASS; no credential contents printed                                                             |
| PowerShell                 | parser check for check.ps1 and Windows release scripts                          | 0 parse errors                                                                                             |
| Emulator rules/integration | Local Firebase emulator                                                         | Not rerun: sandbox denied loopback selector; PR #30 CI jobs were green on its exact SHA                    |

## Coverage and known gaps

- The Mini App's configured coverage scope passes repository thresholds but remains below the generic 80% TDD target for firebase.ts. No Mini App production logic changed in this finalization; changes there are review capture tooling and package scripts.
- Gateway production dependencies audit clean: critical 0, high 0, moderate 0.
- Functions production dependencies: critical 0, high 0, moderate 8.
- Mini App production audit reports one transitive high finding through ZMP SDK build tooling. No dependency was upgraded because the owner explicitly prohibited dependency upgrades and Dependabot changes.
- The strict submission command intentionally remains blocked until real Zalo, HTTPS enforcement, hardened live runtime, Firebase canary/deployed SHA, final Testing Version, Android/iPhone checks, screenshots, and placeholders are completed.

## Integration evidence

- Base source: PR #30 SHA af1cbfd682352a7338e7372041893170edd0e7c8.
- Gateway commits were cherry-picked in order: 21a9d06, 88454f4, 7de813f, 2f46dcf.
- No PR was merged, no remote branch was pushed, and no Firebase/Zalo/review/publish action was performed.

## Canonical review metadata — 2026-08-24

Reviewer preparation must present the same public brand and custom-domain routes as the deployed customer app.

| Guarantee | RED evidence | GREEN evidence |
| --- | --- | --- |
| Review setup creates a `CH Haircut Salon`-branded test salon and writes owner/staff links under `app.chhaircutsalon.cc` | `node --test test/zalo-review-preparation-config.test.mjs`: 0 pass, 1 fail because the preparation script still contained `HAIRCUT Studio` and the default Firebase Hosting domain | The same command: 1 pass, 0 fail after changing only the three review metadata strings |

- RED checkpoint: `9b50fca` (`test: require canonical Zalo review metadata`).
- GREEN checkpoint: `a01b69f` (`fix: align Zalo review setup with canonical brand`).
- No application business logic, Firebase Functions, Zalo App ID, credential, or production secret changed in this cycle.

## Completed reviewer package — 2026-08-24

The static readiness gate previously accepted only the pre-deployment placeholder state. After the real Version 19 review data was prepared, that behavior correctly produced RED and was updated to accept either a safely deferred package or a complete token-free package.

| Guarantee | RED evidence | GREEN evidence |
| --- | --- | --- |
| Static readiness accepts completed Version 19 reviewer metadata without weakening placeholder or raw-token checks | `npm run check:zalo-review`: 33 pass, 1 fail at `Placeholder reviewer được đánh dấu chờ gateway và Testing cuối` after the completed review package removed all placeholders | `npm run check:zalo-review`: 34/34 pass; root release/submission/preparation suite: 7/7 pass |

- RED checkpoint: `7370da4` (`docs: finalize Version 19 review package`).
- GREEN checkpoint: `d4ee932` (`fix: accept completed Zalo reviewer metadata`).
- Completed metadata is accepted only when the canonical salon name, Testing Version 19 and versioned HTTPS QR image are present and neither `qrToken=` nor `mirrorId=` occurs in the submission document.

## Wheel and reward redemption UX — 2026-08-25

### User journeys

1. A customer who changes session must never see the previous customer's spin result.
2. A winning customer can move directly from the spin result to a clear, copyable active reward.
3. Used, expired and revoked codes are history, never presented as usable.
4. Staff must verify the customer and reward, then explicitly confirm only after the benefit was delivered.
5. Reward codes remain branch-scoped; staff cannot inspect or redeem a code from another branch.
6. Wheel labels remain readable after the wheel stops.

### RED → GREEN evidence

| Guarantee | RED evidence | GREEN evidence |
| --- | --- | --- |
| Session changes clear stale spin results and winning results link to My Rewards | Targeted React suite: 5 failed, 5 passed | Targeted React suite: 10/10 passed |
| Revoked rewards are not treated as unused; active rewards alone expose copy action | `RewardsPage` behavior test failed because sections, revoked status and copy action were missing | `RewardsPage` behavior test passed with active/history regions and one active copy action |
| Staff confirmation wording and repeated idempotent requests are unambiguous | `RedeemRewardPanel` tests failed on missing customer-used confirmation and repeated-request message | Both redemption component tests passed; manager-side code copy was removed |
| Branch isolation remains enforced | A proposed salon-wide redemption caused 2 adversarial tests to fail | Proposal was rejected; final integration/adversarial suite passed 52/52 with branch scope intact and branch applicability shown to customers |
| Wheel labels stop upright | Targeted wheel suite: 2 failed, 4 passed because `--wheel-label-counter` was absent | Targeted wheel suite: 6/6 passed; updated review screenshot visually confirms upright labels |

### Checkpoints

- RED behavior checkpoint: `0d32a64` (`test: reproduce wheel and reward redemption issues`).
- RED visual checkpoint: `00cafdc` (`test: require readable wheel labels after spin`).
- GREEN checkpoint: `5be1a2c` (`fix(zalo): clarify wheel and reward redemption`).

### Final validation

- Mini App full check: 30 files, 145/145 tests; lint, format, TypeScript build, ZMP validation and static Zalo readiness 34/34 PASS.
- Firebase Functions unit: 14 files, 80/80 tests PASS.
- Firebase emulator integration/adversarial: 4 files, 52/52 tests PASS.
- Playwright: 18 PASS across desktop Chromium, mobile Chromium and mobile WebKit; 3 capture-only tests skipped by design.
- Coverage command passed repository thresholds: lines/statements 73.06%, branches 79.16%, functions 78.57%. The generic 80% line target remains a known repository-wide gap in `firebase.ts`; changed reward/wheel behaviors are directly covered by component and E2E tests.
- No dependency, authentication model, secret, Zalo App ID or production deployment changed in this cycle.
