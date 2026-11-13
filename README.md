# سِكّة | seKKa

Mobile-first Egyptian commuter subscription marketplace (Cairo & Giza).

**Authoritative product specification:** [seKKa PRD v3.1 — 73 Screens / 8 Stages](docs/PRD.md).

**Implementation audit:** [v3.1 Gap Audit](docs/PRD_MIGRATION_AUDIT.md).

Frontend workspace: `web/` (React, TypeScript, Vite). Current repository also contains historical backend integration and documentation; those files do **not** override PRD v3.1. Historical PRDs and screen maps are retained solely for traceability until the migration is reviewed. Do not implement real money flows under the current frontend-only scope.

Development (from `web/`):

```sh
npm ci
npm run typecheck
npm test
npm run build
```

Do not consider these checks passed unless they are actually executed. Production deploy remains separate from review changes.
