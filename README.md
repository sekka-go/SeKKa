# سِكّة — seKKa

معاك في السِكّة. Fixed-route weekly/monthly commuting subscriptions for Greater Cairo.

This branch is an **in-progress product replacement**, not a production release.
The current authority is [docs/product/PRD.md](docs/product/PRD.md), supplemented by the owner's 12 November 2026 rebuild instruction.

- [Implementation status](docs/IMPLEMENTATION_STATUS.md)
- [Actual legacy audit](docs/LEGACY_AUDIT.md)
- [Migration/recovery plan](docs/MIGRATION_PLAN.md)
- [75-screen registry and honest acceptance status](docs/product/SCREEN_INVENTORY.md)
- [Open policies and blockers](docs/OPEN_QUESTIONS.md)
- [Deployment and verification](docs/DEPLOYMENT.md)

`web/src/v2` is the active replacement frontend; older screens remain only as historical recovery sources.
The new additive migration creates a private `sekka_v2` schema and new document bucket, without deleting or rewriting existing data. It must pass the hosted migration confirmation before application; never use blind `supabase db push` against the existing project.

```bash
cd web
npm ci
npm run typecheck
npm run lint
npm test
npm run build
# In a normal browser-capable environment:
npx playwright install chromium
npm run test:e2e
```

Thirty-two domain/PostgreSQL tests cover calendar pricing, ownership/RLS, simultaneous last-seat reservations, idempotency, immutable snapshots and one-time security release. No real financial operations are enabled. No provider integration or production acceptance is claimed.
