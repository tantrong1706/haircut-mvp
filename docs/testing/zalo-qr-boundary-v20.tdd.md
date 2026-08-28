# Zalo QR boundary and Testing Version 20 TDD evidence

## User journey

- As the project owner, I can scan the ZMP admin login QR without Mini App Testing parameters.
- As a Zalo reviewer, I can scan the salon QR and open the exact Testing Version 20 candidate.
- Branch QR values remain backend-issued and are not modified by the Testing-version helper.

## RED / GREEN evidence

| Guarantee | RED evidence | GREEN evidence |
| --- | --- | --- |
| ZMP login URL remains unchanged while salon QR receives Testing context | `node --test tools/zmp-url.test.mjs` failed with `ERR_MODULE_NOT_FOUND`; checkpoint `caa3ebb` | 3/3 PASS after `zmpLoginUrl` and `salonTestingUrl`; checkpoint `0cb28fa` |
| Salon QR targets the uploaded Testing Version 20 | 2/3 tests failed with actual `19` versus expected `20`; checkpoint `746cc6f` | 3/3 PASS after Version 20 synchronization |

## Validation

- `node --test tools/zmp-url.test.mjs`: 3/3 PASS.
- `npm run check:zalo-review`: 34/34 PASS.
- Login QR is generated from the unmodified ZMP admin login URL.
- Only `qr-salon-review-dev.png` is generated with `env=TESTING&version=20`; branch QR generation remains unchanged.

## Known device-only evidence

The real Zalo permission popup and salon QR opening Version 20 still require a physical Zalo client. No browser screenshot is accepted as device evidence.
