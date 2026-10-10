# Active product: Web only

The owner has permanently switched the active product to the customer Web app. The canonical
branch is `main`, serving the Firebase Web flow at `https://app.chhaircutsalon.cc`.
Use short-lived `codex/<task>` branches for future changes and retire them after integration.

- Zalo source is retired. Historical Version 24 remains recoverable from Git history at
  `5ae0ff21200ae4d32b07e9f588ee6b7797c35d0e`; do not recreate an active Mini App workflow.
- Do not resume Zalo Testing deploys, Mini App Center, tester invitations, reviewer screenshots,
  review submissions or Publish as the next step for Web work.
- Retired Zalo review documents/tools have been removed from the Web tree. Start with `README.md` and
  `docs/WEB_CUSTOMER_RELEASE_READINESS.md` for the active Web product.
- Customer Web lives in `customer-web/` (renamed from `zalo-mini-app/`). Pure shared client
  domain modules live in `packages/client-domain/`; Manager still uses explicit adapters for
  Firebase-dependent services in Customer Web. Do not delete those services as Zalo cleanup.
- Production uses Firebase Phone Auth, browser-local persistence, signed branch QR, direct staff
  confirmation and per-customer/per-salon cooldown hidden from the customer UI.
- Preserve server-authoritative points, identity, tenant isolation and signed QR verification.
- Do not delete production Functions, secrets or Gateway services as branch cleanup.
- Use Web CI and focused tests. Native releases and Zalo-specific work require a new explicit task.
- Do not commit credentials, OTPs, raw QR signatures or generated outputs.
- Do not rewrite published history. Future merges/deployments still need authorization for their scope.
- Use the main agent for routine work, not subagents for search, tests or reports.

Scope confirmed by the owner on 2026-09-28.

Cleanup confirmed on 2026-10-10: Firebase remains the hosting/backend platform. Remove unused
frontend Zalo and Botkeep code; preserve live backend/identity/data and Manager shared adapters.

On 2026-10-10 the owner explicitly authorized promoting the verified Web branch to `main`
and pruning obsolete branches. `codex/web-primary` is retired after that promotion;
do not recreate it as a second long-lived main branch. No production deploy is implied.
