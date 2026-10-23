# Web naming cleanup — evidence

Date: 2026-10-22/23. Scope: the owner's request to remove stale platform naming and unused
Web code from GitHub. Main integration is authorized only after checks/CI pass; no deployment.

## Boundaries

- Preserve the CH Haircut Salon display brand, repository URL and Firebase project.
- Do not rename actual legacy APIs as if they were Web APIs.
- No changes to Functions source, Firestore/Storage Rules, shared identity/schema or Gateway runtime.
- No Functions/secrets/tunnel/service deletion and no customer data access.
- Retained compatibility is explained in ../LEGACY_COMPATIBILITY.md.

## RED and GREEN

RED checkpoint b69f9c3:
- node --test test/web-naming-cleanup.test.mjs: 0 passed / 4 failed for the intended naming,
  obsolete Firebase-client routes, startup/template names and Firebase setup documentation.
- Focused Web run: 11 passed / 5 failed. Terms still described optional phone/Zalo identity;
  auth errors still showed provider text and missing-QR handling targeted a retired callable.

GREEN checkpoint 42a90d3:
- The same four repository guards passed.
- Terms/Firebase error/branding tests: 17/17 passed.
- Stable auth-session guidance replaces raw upstream auth text, including prior IP-policy details.
  QR validation guidance now targets the existing Web entry callables.
- CSS selectors removed had no JSX users. Shared entry/authentication styling remains.
- start-miniapp.ps1 moved to start-web.ps1 without changing its command, loopback binding or port.

The subsequent documentation update replaces obsolete product/architecture/deployment instructions
and documents the already-completed PR #74 release separately from this non-deployed cleanup.

## Regression guarantees

| Guarantee | Evidence |
| --- | --- |
| No Mini App branding identifiers or retired CSS in Web production source | test/web-naming-cleanup.test.mjs |
| HTML no longer carries obsolete platform verification meta; display title unchanged | repository guard + branding.test.ts |
| Web Firebase mapping does not route through retired callables | repository guard + firebase.test.ts |
| Authentication errors do not expose upstream/provider details | firebase.test.ts |
| Terms describe Phone OTP, branch QR and photos/notes before points | TermsPage.test.tsx |
| Startup/issue/PR templates use Web terminology | repository guard; PowerShell parser PASS |
| Backend, identity data and runtime unchanged | git diff against 5435256 scoped to protected paths: empty |
| New naming guard runs in GitHub CI | repository-checks step in Build Web |

## Verification

- Repository safety suite: 40/40 PASS, no skipped tests.
- Secret scan: PASS across 643 tracked/untracked source files at the recorded check.
- CSP synchronization: PASS.
- A literal negative-test pattern was initially mistaken for a secret assignment. Its equivalent
  whitespace-aware expression was used instead; the scanner was not disabled or weakened.
- Full Customer Web regression: 256/256 tests, lint and format PASS.
- Existing V8 scope (api.ts, firebase.ts, qr.ts): 82.45% lines/statements, 80.97% branches,
  88.37% functions. This is scoped service coverage, not coverage of the whole app.
- Manager Web: typecheck/lint/format, 78/78 tests and production Web build PASS.
  Existing plugin deprecation/chunk-size warnings remain; no native build was run.
- Coverage thresholds were not reduced. Remote CI must pass on the final pushed SHA before merge.

Deleted UI/meta code remains recoverable through Git history. Archived Gateway documentation
is explicitly historical, not a new Web installation requirement. No production deployment
or claim that every legacy reference has been removed is part of this work.
