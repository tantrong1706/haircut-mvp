# Zalo Testing Version 24 review evidence

## Source and user journeys

The journeys were derived from the owner's request to make the salon branch QR usable by Zalo
reviewers without changing the point-award business flow.

- As a reviewer, I see the same `CH Haircut Salon` name in Mini App Center, the ZMP header, web
  metadata and legal pages.
- As a reviewer, I can open a public HTTPS QR image, scan it in Zalo and arrive at the exact
  Testing Version 24 candidate with the branch already selected.
- As the owner, I can give the reviewer a short, token-free test guide and staff confirmation path.

## RED and GREEN evidence

| Guarantee                                  | RED evidence                                                                                                                                     | GREEN evidence                                                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Portal and packaged branding are identical | `branding.test.ts` failed because the Version 24 submission file did not exist and the package still used `CH Hair Studio`; checkpoint `192ee5b` | The branding, configuration, metadata, legal pages and submission guide use `CH Haircut Salon`; checkpoint `b68cd03`                                               |
| Reviewer receives stable branch QR links   | Version 23 QR links targeted the older Testing build and the prior checklist described a salon selector                                          | Both Version 24 QR images decode with `env=TESTING`, `version=24`, `qrType=branch`; production `resolveCustomerQr` returns HTTP 200 with `selectionRequired=false` |
| Review package is internally consistent    | The readiness checker expected Version 8/21 metadata and the previous brand                                                                      | `npm run check:zalo-review` passes 34/34 against Version 24                                                                                                        |

## Validation performed

| What is guaranteed                                                                                                                 | Test or command                                        | Type           | Result                                             |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------- | -------------------------------------------------- |
| Branding and legal-page copy are consistent                                                                                        | `vitest` on branding, terms and scan-entry tests       | Unit/component | 16/16 PASS                                         |
| Existing Mini App behavior is unchanged                                                                                            | Full `vitest` suite                                    | Unit/component | 162/162 PASS                                       |
| Production ZMP package compiles and references existing assets                                                                     | `npm run build:zmp`                                    | Build          | PASS                                               |
| Review metadata and package contain no known secret pattern or localhost endpoint                                                  | `npm run check:zalo-review`                            | Release gate   | 34/34 PASS                                         |
| Customer navigation, saved-phone check-in, wheel and owner/staff entry work on desktop Chromium, mobile Chromium and mobile WebKit | Playwright full suite                                  | E2E            | 21 PASS; 3 manual screenshot jobs skipped          |
| Hosted page retains Zalo site verification                                                                                         | HTTPS source check at `https://app.chhaircutsalon.cc/` | Deployment     | HTTP 200, title correct, verification meta present |

## Deployment evidence

- Firebase Hosting deployment completed for project `haircut-c7d12`; Functions were not deployed.
- Mini App Center displays Version 24 with status `Testing` and description
  `Version 24: reviewer branch QR and CH Haircut Salon branding`.
- Public reviewer QR:
  `https://app.chhaircutsalon.cc/review-branch-v24.png`.
- Alternate branch QR:
  `https://app.chhaircutsalon.cc/review-branch-v24-chi-nhanh-chinh.png`.
- Deterministic SHA-256 over sorted Version 24 ZMP artifact paths and bytes:
  `5abe55bae52de72475e2a05c6e24b8b38026998235f8080b113bae6ec6bf4f62`.
- Review has not been submitted and Version 24 has not been published.

## Coverage and remaining manual evidence

The repository's configured service coverage report is 73.76% statements, 77.65% branches,
79.06% functions and 73.76% lines. This is a known restricted legacy service set; the branding and
QR change is covered directly by the tests above. The only device-only evidence still unavailable
to automation is the native Zalo permission popup and a reviewer-equivalent account scan. A normal
unlisted Testing account is not equivalent to Zalo's review session.
