# Private haircut photos: security evidence and release gates

Status: local implementation and security regression PASS. Not deployed.
GitHub push, PR and CI authorized by the owner on 2026-10-20; merge/deploy not authorized.

## Local verification

- Rules: 30/30 PASS, including a new RED reproduction where legacy upload incorrectly succeeded.
  RED checkpoint `324bcaf`; GREEN Rules checkpoint `3437063`.
- Full callable integration: 120/120 PASS across seven files, with no skipped cases.
- Backend unit: 119/119 PASS; typecheck, lint, formatting and build PASS.
- Photo security coverage: 30 cases PASS; lines 97.08%, branches 91.72%, statements 97.27%,
  functions 94.11% across decoding, revocation and private-photo authorization/signing.
- Private client coverage: 18 cases PASS; lines/statements/functions 100%, branches 94.11%.
- Web regression: 231/231 PASS before two additional URL-hardening cases (both passed in the
  subsequent focused suite). Web lint, formatting, typecheck and test build PASS.
- Stored Playwright report: 57 expected, 0 unexpected/flaky/skipped, across desktop Chromium,
  mobile Chromium and mobile WebKit. Additional returning-customer browser lane: 6/6 PASS.
- Windows Node 22 tested locally; Linux/native Sharp compatibility is a remote CI gate.
- Repository secret scan passed across 620 tracked/untracked source files; CSP synchronization
  and 18 repository-boundary/safety checks passed.
- Production-dependency audit on 2026-10-20: 0 High, 0 Critical; 8 Moderate package entries
  propagate from the existing `uuid` 9.0.1 dependency chain. The uuid version is unchanged from
  `origin/main`. npm suggests a Firebase Admin major upgrade for the chain; no forced/major
  upgrade was performed. This is an outstanding dependency review, not a clean audit claim.

Earlier TDD checkpoints: JPEG rejection `ad33c34` RED / `6b63d0e` GREEN;
forwarded-header quota `f3e73f9` RED / `c356e72` GREEN; photo-token/client boundary
RED checkpoints `80a6977`, `a73d39a`, `85869df`, `bbb6d32`, `8bca14c`.

## Findings and mitigation

1. Persistent Firebase download tokens could outlive membership or photo-consent changes.
   Use an authorized server reader and bounded GCS URLs, revoke old object tokens using a
   metadata-only conditional patch, and deny client metadata/media reads of haircut objects.
   Keep avatars unchanged. Existing legacy photo identifiers remain separate from display URLs.
2. JPEG marker/checksum validation accepted non-images. Decode the full image with bounded
   dimensions, bytes, output pixels, time and server concurrency. This is validation, not
   re-encoding; no claim of stripping EXIF or changing stored bytes.
3. Public quotas trusted a spoofable forwarded header. Bind that quota to the normalized
   transport peer, not an unverified forwarded prefix. Behind Google infrastructure this may
   group clients behind one proxy; it is not accurate end-user IP attribution. Capacity canary
   is required before changing production behavior. Token-specific limits remain unchanged.

## Real Storage canary already executed with explicit approval

One random private test path, one synthetic 2x2 JPEG; no customer objects/documents were read or
modified. Result captured locally in `output/security-audit-20261015/canary-results.json`:

- Initial bearer link HTTP 200; after conditional token removal, the same link HTTP 403.
- Token metadata absent, cache policy `private, no-store, max-age=0`.
- Other metadata preserved; object generation and image bytes unchanged.
- Exact test object deleted with generation and ownership guards; cleanup PASS.

Do not rerun the real canary without authorization. It is not a bulk migration.

## Emulator limitation, not a silent PASS

Firebase Storage Emulator 15.22.3 keeps a separate `downloadTokens` array after a GCS
`metadata.firebaseStorageDownloadTokens = null` patch. The original two token-removal assertions
failed there although the same helper passed the real canary. Do not patch installed emulator
code, fabricate a 403 response or claim emulator revocation behavior matches production.

The local integration test instead observes the actual `setMetadata` call-through, including
the null token patch and metadata-generation precondition, and checks no-store policy/unchanged
bytes. Unit tests cover idempotency, deleted objects, bounded 412 retries and path restrictions.
Authorization tests verify a fresh role/consent check for each new URL. Signing-contract tests
verify V4 read scope, JPEG response type, expiry and fail-closed behavior. The real 200 -> 403
evidence above remains a distinct release gate, not replaced by a weaker emulator claim.

History/phone/tenant integration tests use a synthetic signer because the emulator has no
signing credentials. They must return a temporary URL, never a legacy Firebase token URL.

## Remaining release gates

- Run remote CI against the final commit and preserve the local evidence above.
- Confirm runtime signing IAM and backend endpoint before restricting deployed reads.
- Backend first, compatible clients next, restrictive Storage Rules next. Cached older clients
  must refresh. Preserve image bytes and stable identities throughout rollout.
- Inventory existing photo tokens with a bounded dry run, then obtain explicit approval before
  revoking customer-photo tokens. Existing links are not retroactively fixed until that happens.
- New uploads use an operation and finalizer; legacy upload creation must be denied to prevent
  bypassing validation/revocation. Pending uploads can have temporary tokens until finalization
  or existing orphan cleanup; do not claim those are immediately revoked.
- Signed URLs are valid for at most 15 minutes and do not revoke copies already downloaded.
- No App Check enforcement, MFA, main merge, production deploy or bulk data change is implied.
