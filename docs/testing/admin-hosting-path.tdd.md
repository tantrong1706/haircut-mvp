# Admin Hosting project-root fix — 2026-10-14

Journey: publish the isolated Admin artifact without touching customer Hosting.

Firebase CLI rejected `../apps/admin-web/dist` relative to the config in `firebase/`.
The artifact is intentionally outside that directory, so move only the Admin config to
the repository root (`firebase.admin.json`) and keep its site and security headers intact.

- RED: `node --test test/admin-hosting-boundary.test.mjs` — 1 failed, 1 passed.
  The new assertion reproduced the actual outside-project-directory rejection.
- GREEN: the same boundary test plus `test/admin-build-script.test.mjs` — 5 passed.
  Config path, artifact containment, customer-site isolation, production fixture exclusion,
  public-config allowlist and Vite entry resolution are checked.
- No business logic, Functions code, authentication policy or customer artifact changes.
- Runtime release verification remains required; test success alone does not prove deployment.

Separate local preparation: the Windows checkout used CRLF for shared contracts and LF for
its generated Functions mirror. The existing sync command restored byte equality without
a Git content diff. Function discovery uses the existing project's 60-second timeout setting.
