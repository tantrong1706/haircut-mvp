# Web customer release readiness

Evidence date: 2026-09-27. Repository: `haircut-mvp`; branch: `release/web-customer-platform-20260921`.
Starting candidate: `22be8eebe144bf0482d23180d287ef04196b483b`.
Release base for the web migration: `5ae0ff21200ae4d32b07e9f588ee6b7797c35d0e`.

## Decision

`READY_FOR_DEPLOY=true`; `REAL_PHONE_TEST=PASS`; `PRODUCTION_DEPLOYED=true`.

The full release gate passed 27 required checks with zero failures. Real SMS/OTP, authenticated
check-in, browser close/reopen persistence, a second tenant, staff confirmation, point award,
history creation and the two-hour cooldown were verified on the custom domain. Fifteen named
Functions and Firebase Hosting were deployed. Rules, Storage, indexes, Zalo, Gateway and Cloudflared
were not deployed or modified. No push, merge, Zalo review submission or publish action occurred.

## Verified production configuration

Read using authenticated GET requests; credentials and site-key values were not printed.

| Check | Result |
| --- | --- |
| Firebase Phone provider | Enabled |
| Authorized Domain `app.chhaircutsalon.cc` | Present |
| SMS region policy | `allowlistOnly` includes Vietnam (`VN`) |
| Web App Check provider | reCAPTCHA Enterprise registration exists |
| Web App Check runtime | Registered but intentionally monitor-only/unwired |
| Firestore, Storage and Authentication App Check enforcement | `UNENFORCED` |
| Existing affected Functions `ENFORCE_APP_CHECK` | `false` |
| New six web customer callables | Deployed; unauthenticated calls return HTTP 401 |

Completed Firebase Auth configuration in project `haircut-c7d12`:

1. Phone Authentication was enabled through the official Identity Toolkit Admin API.
2. The existing `allowlistOnly` SMS policy now permits Vietnam (`VN`).
3. Existing Authorized Domains, other sign-in methods, test phone numbers and reCAPTCHA configuration
   were verified unchanged after the masked update.
4. App Check enforcement remains off. A trial build with the registered Enterprise key received
   attestation 403 and SDK throttling in the in-app browser. The final Hosting build does not
   initialize App Check. Do not enable enforcement until valid token traffic is proven without
   blocking Firebase Auth restore.

The local ignored Functions environment now explicitly sets
`CUSTOMER_WEB_CHECKIN_URL=https://app.chhaircutsalon.cc/checkin`. It was deployed with the named
Functions. Secrets, key IDs and the gateway URL were preserved and were not printed or rotated.

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

## Executed deployment scope

| Resource | Required for this migration? | Reason |
| --- | --- | --- |
| Customer Firebase Hosting site `haircut-c7d12` | Deployed | New Auth/entry/account UI and monitor-only App Check behavior |
| Functions | Deployed, named subset below | Six new callables, six QR producers and three shared-core Zalo read adapters |
| Firestore Rules | No | No rule-source changes against the migration base |
| Storage Rules | No | No rule-source changes against the migration base |
| Firestore indexes | No | No index-source changes; queries reuse existing indexes |
| Zalo / Gateway / Cloudflared / Manager native / Admin Hosting | No | Outside this release |

The approved Functions deployment used:

```powershell
firebase deploy --project haircut-c7d12 --config firebase/firebase.json --only "functions:getWebCustomerContext,functions:checkInWebCustomer,functions:getWebCustomerSession,functions:getWebCustomerHistory,functions:getWebCustomerRewards,functions:spinWebLuckyWheel,functions:createSalon,functions:listBranches,functions:createBranch,functions:updateBranch,functions:rotateSalonQr,functions:rotateBranchQr,functions:getCustomerSessionFromZalo,functions:getCustomerHistoryFromZalo,functions:getCustomerRewardsFromZalo"
```

Hosting was built from the approved release branch and deployed separately:

```powershell
.\scripts\deploy-firebase.ps1 -OnlyHosting
```

No break-glass flags were used. Firestore Rules, Storage Rules and indexes were not deployed.

Immediately before any approved deployment, re-read live environment/secret binding metadata and
compare it with the candidate. Preserve `ZALO_APP_SECRET`, `ZALO_GATEWAY_HMAC_SECRET`,
`ZALO_OPEN_API_KEY`, `QR_SIGNING_SECRET`, gateway configuration and App Check flags. Never overwrite
live settings blindly from a stale local `.env`. None of these secret payloads needs to be printed.

## Production smoke test

The owner entered the phone number and OTP directly in the production page; neither value was sent
to chat or logged. Results below are evidence from the real custom-domain flow.

| Journey | Result |
| --- | --- |
| New browser → signed QR → Phone OTP | PASS; correct customer, salon and branch |
| Close all tabs → reopen same browser | PASS; Firebase Auth restored without another OTP |
| Same UID enters a second salon | PASS; separate tenant profile, no cross-tenant request visibility |
| Customer requests point → correct staff confirms | PASS; `pending_approval` → `completed` |
| Point/history idempotency | PASS; points `0 → 1`, exactly one haircut record for the request |
| Two-hour cooldown | PASS; server stored `nextPointEligibleAt - approvedAt = 2 hours` and no duplicate open request |
| History, rewards and insufficient-points wheel | PASS on authenticated production session |
| Unauthenticated web callables | PASS; all six returned HTTP 401 |
| Another browser/new device | Not run; expected to require OTP by browser-local persistence |
| App Check enforcement | Intentionally OFF; attestation pilot must pass first |

## Silent cooldown web update (2026-09-27)

The customer web QR screen now omits the point-request action while the server-provided
`nextPointEligibleAtMs` is in the future and reveals it again when that time passes. The account
view also omits its QR prompt during cooldown. Neither screen displays a countdown. The server's
two-hour rule remains authoritative.

- Local web checks: 216/216 unit tests, lint, format and production build passed; Playwright passed
  42 executed tests with 3 intentional screenshot skips.
- GitHub [Build run #36329650042](https://github.com/tantrong1706/haircut-mvp/actions/runs/36329650042)
  passed all 8 jobs on commit `cf22618273bf923964bf308c418446c2fc8ab967`.
- Hosting-only deployment served the expected `index.Bpj64Kmg.module.js` on the custom domain.
  `/`, `/checkin`, `/history`, `/wheel`, `/owner` and `/staff` returned HTTP 200. A signed QR opened
  the Phone screen on a mobile-sized browser with no page or App Check errors.
- The original customer's two-hour window had elapsed by this deployment, so the hidden button was
  verified by component tests, not by changing production customer records or the device clock.

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

Previous Hosting release, available as a rollback point:

- Hosting release: `sites/haircut-c7d12/releases/1790428061756000`.
- Hosting version: `sites/haircut-c7d12/versions/7c28a6b40e608b94`.
- Release source commit: `7353259b60bc1b69c51acddd11d184c5d66259f5`.

Current Hosting release:

- Hosting release: `sites/haircut-c7d12/releases/1790523451012000`.
- Hosting version: `sites/haircut-c7d12/versions/1b6aeb3b68649a48`.
- Web source commit: `cf22618273bf923964bf308c418446c2fc8ab967`.
- This update deployed Hosting only; existing Functions revisions were not changed.

- Six web callables are at revision `00001`; the nine updated QR/Zalo functions are at their next
  recorded revisions (`createSalon` 00012, branch/QR functions 00006, and Zalo readers 00014–00017).

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
