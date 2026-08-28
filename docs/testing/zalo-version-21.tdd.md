# Zalo Testing Version 21 TDD evidence

## User journey

- As a reviewer, I can scan the salon QR and open the exact Testing Version 21 candidate.
- As the owner, I can verify Version 21 is uploaded in Testing state before review submission.

## RED / GREEN evidence

| Guarantee                                 | RED evidence                                                                                                    | GREEN evidence                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Salon QR targets Version 21               | `node --test tools/zmp-url.test.mjs` failed 2 tests with actual `20` versus expected `21`; checkpoint `a041500` | 3/3 PASS after updating the salon Testing version               |
| Static review metadata targets Version 21 | Version 20 strings remained in the review checker and submission package                                        | `npm run check:zalo-review` PASS 34/34 with Version 21 metadata |

## Deployment evidence

- ZMP CLI upload completed with `Version: 21` and Testing quota `7 / 60`.
- Mini App Center displays Version 21 with status `Testing`.
- Public salon QR: `https://app.chhaircutsalon.cc/review-salon-v21.png`.
- Artifact SHA-256: `bde562b805cd474b71e8dc31145cf2b1d3de9b931ea1ab97d8efa2394b538a26`.
- Review was not submitted and Version 21 was not published.

## Access limitation found

Mini App Center shows the application in `DEV` state and no testing users are registered. A normal Zalo account therefore cannot access the Testing version until it accepts a testing invitation.
