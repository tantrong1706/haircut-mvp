# Active product: Web only

The owner has permanently switched the active product to the customer Web app. Work on
`codex/web-primary` and the Firebase Web flow at `https://app.chhaircutsalon.cc`.

- `codex/zalo-archive` preserves Zalo Version 24 at
  `5ae0ff21200ae4d32b07e9f588ee6b7797c35d0e`. It is a frozen historical branch.
- Do not resume Zalo Testing deploys, Mini App Center, tester invitations, reviewer screenshots,
  review submissions or Publish as the next step for Web work.
- Zalo review documents and old release scripts are historical. Start with `README.md` and
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
- Do not merge main or rewrite published history without explicit authorization.
- Use the main agent for routine work, not subagents for search, tests or reports.

Scope confirmed by the owner on 2026-09-28.
