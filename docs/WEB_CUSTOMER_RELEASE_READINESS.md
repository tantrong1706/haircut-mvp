# Web customer release readiness

Evidence date: 2026-09-21. Repository: `haircut-mvp`; branch: `feat/web-customer-platform`.
Starting candidate: `22be8eebe144bf0482d23180d287ef04196b483b`.
Release base for the web migration: `5ae0ff21200ae4d32b07e9f588ee6b7797c35d0e`.

## Decision

`READY_FOR_DEPLOY=false`; `READY_FOR_REAL_PHONE_TEST=false`.

The automated suites exercise local UI fixtures and Firebase demo emulators. They do not prove real
SMS delivery, reCAPTCHA on the custom domain, or Firebase persistence after closing a real browser.
No production configuration was changed by this audit. No deployment, push, merge or Zalo review
action was performed. Gateway and Cloudflared were not modified.

## Verified production configuration

Read using authenticated GET requests; credentials and site-key values were not printed.

| Check | Result |
| --- | --- |
| Firebase Phone provider | Disabled |
| Authorized Domain `app.chhaircutsalon.cc` | Present |
| SMS region policy | `allowlistOnly` is empty; Vietnam is not allowed |
| Web App Check provider | reCAPTCHA Enterprise registration exists |
| Production-local web App Check site key | Missing |
| Firestore, Storage and Authentication App Check enforcement | `UNENFORCED` |
| Existing affected Functions `ENFORCE_APP_CHECK` | `false` |
| New six web customer callables | Not deployed |

Required owner actions in Firebase Console, project `haircut-c7d12`:

1. Authentication → Sign-in method → Phone → Enable → Save.
2. Authentication → Settings → SMS region policy: permit Vietnam (`VN`) for the test.
3. Leave existing Authorized Domains unchanged.
4. Leave App Check enforcement off. The registered public site key must be wired into the real
   deployment build and valid token traffic verified before enforcement is considered separately.

The local ignored Functions environment now explicitly sets
`CUSTOMER_WEB_CHECKIN_URL=https://app.chhaircutsalon.cc/checkin`. Secrets, key IDs and the gateway URL
were not rotated. This local setting has not been deployed.

## Source and test evidence

- Fetch confirmed no new commits on `origin/main` or the candidate's remote base that are missing
  from this branch. Existing dependency-update branches were not merged.
- New regression tests cover rotated QR rejection, replacement of an expired active session,
  insufficient points in a second salon, and all public reward states without tenant leakage.
- A newly reproduced adapter bug dropped `qr.branchId` from the backend's nested check-in response
  when entering through a single-branch salon QR. RED checkpoint `5bbf8c5` failed with an empty
  branch ID. GREEN checkpoint `8663840` reads the server-resolved nested branch first; the same
  adapter suite then passed 6/6. The shared point/reward business rules were not changed.
- RED `a8bc3a8` and GREEN `7440de8` prove direct staff confirmation, the two-hour post-award
  cooldown, authenticated account-only reads and server-owned branch resolution for salon QR.
- RED `da28b0a` and GREEN `cd9c41b` prove returning account access without a fresh QR and removal of
  displayed customer data on Firebase logout or UID change.
- RED `785760e` and GREEN `da6b29b` add safe staff camera scanning for existing reward QR payloads.
  Scanning only fills the existing lookup flow; explicit confirmation remains mandatory. A bundler
  regression found during E2E was fixed by isolating ZXing instead of treating its internal QR reader
  as the existing QR generator chunk.
- Functions typecheck/lint/build/unit passed; unit count 108. Full demo-emulator integration passed
  77/77. Firestore and Storage Rules passed 22/22. Manager typecheck and tests passed 78/78.
- Final web lint/format/build passed with 214/214 unit tests. Playwright passed 42 executed tests
  across desktop Chrome, Android Chrome and iPhone Safari; 3 review-screenshot cases were skipped by
  design. Nine axe-core checks found no serious/critical issue in the tested entry, OTP and account
  states.
- Existing Zalo adapters remain present; Zalo package validation and static readiness passed 34/34.
- Production dependency audit reports 0 critical, 2 high and 3 moderate transitive advisories. The
  new exact ZXing dependency and dev-only axe Playwright package are not named in those findings; no
  unrelated or forced dependency upgrade was made.

## Exact deployment scope (plan only)

| Resource | Required for this migration? | Reason |
| --- | --- | --- |
| Customer Firebase Hosting site `haircut-c7d12` | Yes | New Auth/entry/account UI, adapter and reCAPTCHA CSP |
| Functions | Yes, named subset below | Six new callables, six QR producers and three shared-core Zalo read adapters |
| Firestore Rules | No | No rule-source changes against the migration base |
| Storage Rules | No | No rule-source changes against the migration base |
| Firestore indexes | No | No index-source changes; queries reuse existing indexes |
| Zalo / Gateway / Cloudflared / Manager native / Admin Hosting | No | Outside this release |

After owner deployment approval and fresh release gates, the proposed Functions command from the
repository root is:

```powershell
firebase deploy --project haircut-c7d12 --config firebase/firebase.json --only "functions:getWebCustomerContext,functions:checkInWebCustomer,functions:getWebCustomerSession,functions:getWebCustomerHistory,functions:getWebCustomerRewards,functions:spinWebLuckyWheel,functions:createSalon,functions:listBranches,functions:createBranch,functions:updateBranch,functions:rotateSalonQr,functions:rotateBranchQr,functions:getCustomerSessionFromZalo,functions:getCustomerHistoryFromZalo,functions:getCustomerRewardsFromZalo"
```

Build/package Hosting from the approved SHA, then use the existing guarded Hosting path:

```powershell
.\scripts\deploy-firebase.ps1 -OnlyHosting
```

The Hosting script requires a clean approved release branch and full readiness evidence for its SHA.
No break-glass flags should be used to hide missing evidence. Do not use `-IncludeFunctions`, which
would deploy every Function instead of the named subset. Do not run either command in this audit.

Immediately before any approved deployment, re-read live environment/secret binding metadata and
compare it with the candidate. Preserve `ZALO_APP_SECRET`, `ZALO_GATEWAY_HMAC_SECRET`,
`ZALO_OPEN_API_KEY`, `QR_SIGNING_SECRET`, gateway configuration and App Check flags. Never overwrite
live settings blindly from a stale local `.env`. None of these secret payloads needs to be printed.

## Real-device smoke test

Enabling Phone alone does not install this candidate on the public website. Its six web callables
are also absent in production. A full custom-domain test therefore needs a separately approved test
rollout. Until a test environment is agreed and available, do not send the owner a fixture QR or
claim that the current public domain serves the candidate.

Once an authorized HTTPS test deployment exists, use only the owner's own test phone number. Enter
the number and OTP directly in the page; do not send them in chat or record them in screenshots.

| Journey | Expected result |
| --- | --- |
| New browser → signed Branch A QR → send OTP → confirm | No auto-send; actual SMS verification; correct salon/branch |
| Check-in twice / two tabs / retry after connection loss | One active session for the tenant customer |
| Close all tabs/browser → reopen same browser → scan same QR | Auth restores before UI decision; no phone/OTP prompt and no SMS request |
| Same browser → signed Salon B QR | Same Firebase UID; separate tenant profile and points/rewards |
| Another browser on same device | Login required until that browser is authenticated |
| New device, same phone account | OTP required; existing salon profile reused after verified login |
| Staff confirmation / retry | Only the correct salon customer's points update once |
| Spin / insufficient points / retry | Server result, one deduction, no cross-salon balance use |
| Rewards / QR scan / backup code | Only own tenant rewards; explicit staff confirmation before redemption |
| Logout / browser site-data clear | Login required again; server customer data remains |

Record pass/fail, browser/device, time, masked phone suffix if necessary, and counts/results only.
Real OTP and close/reopen persistence remain `NOT_RUN`; `READY_FOR_DEPLOY` remains false until they
are confirmed. Follow the owner's instruction to stop at the Phone-provider gate for this run.

## Rollback evidence

`PRE_DEPLOY_HEAD=22be8eebe144bf0482d23180d287ef04196b483b` records the starting local candidate,
not a claim about production source. Production Functions revisions are individually identified;
there is no verified single deployed Git SHA.

- Hosting release: `sites/haircut-c7d12/releases/1789026204535000`.
- Hosting version: `sites/haircut-c7d12/versions/ba577db2a642b262`.
- Live Functions inventory: 70 Functions; selected existing revisions below were ACTIVE.

| Existing Function | Observed revision |
| --- | --- |
| createSalon | createsalon-00011-mom |
| listBranches | listbranches-00005-xah |
| createBranch | createbranch-00005-bat |
| updateBranch | updatebranch-00005-quw |
| rotateSalonQr | rotatesalonqr-00005-vik |
| rotateBranchQr | rotatebranchqr-00005-fej |
| getCustomerSessionFromZalo | getcustomersessionfromzalo-00013-bes |
| getCustomerHistoryFromZalo | getcustomerhistoryfromzalo-00016-vib |
| getCustomerRewardsFromZalo | getcustomerrewardsfromzalo-00015-fal |

Refresh these identifiers immediately before deployment and retain the deployable prior source or
artifacts. Revision metadata alone is not a tested Functions rollback procedure. After approval,
Hosting can return to the captured prior version; Functions rollback needs the corresponding prior
deployable artifact. Preserve additive web customer fields and profiles; never merge by phone or
delete new customer data as a rollback shortcut. Rollback is not automatic.

## GitHub additions decision

Upstream metadata was checked 2026-09-20. Only additions that directly close this checklist were
accepted; no state-management rewrite was introduced.

| Priority | Repository | Application here | Constraint |
| --- | --- | --- | --- |
| Integrated | [zxing-js/browser](https://github.com/zxing-js/browser) (MIT) | Staff scans a customer's existing reward QR from the web camera | Exact `0.2.1`, lazy-loaded, strict `haircut-reward:v1:` parser, manual fallback and explicit redemption confirmation |
| Integrated in tests | [dequelabs/axe-core](https://github.com/dequelabs/axe-core) (MPL-2.0) | Accessibility checks for entry, OTP and account states | Exact Playwright adapter `4.13.0`; manual mobile usability testing remains necessary |
| Not integrated | [TanStack/query](https://github.com/TanStack/query) (MIT) | Could centralize client cache behavior | Current adapters are small and tested; a state-management migration would add complexity without closing a remaining release gate |

References: [ZXing browser usage](https://github.com/zxing-js/browser#usage-how-to-use),
[Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing),
[TanStack Query overview](https://tanstack.com/query/latest/docs/framework/react/overview).
The existing Firebase, Zod, Sentry, Vitest, Playwright, QR generation and Manager-native scanner are
already in the repository. This recommendation does not replace the backend or introduce another
salon management application.
