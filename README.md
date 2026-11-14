# سِكّة | seKKa

معاك في السِكّة.

**The sole authoritative product specification is [PRD v3.1](docs/PRD.md): 73 screens across 8 stages.**

This iteration is frontend-only. Authentication, document review, booking, wallet balances, payments, messages and administration are previews or disabled states, not production services. Existing SQL and old integration sources are historical engineering work, not evidence of a connected backend.

- [v3.1 audit and implementation checklist](docs/PRD_V31_AUDIT.md)
- [Screen-by-screen audit](docs/product/SCREEN_INVENTORY.md)
- [Historical documents (not active requirements)](docs/archive/pre-v3.1/README.md)
- [Deployment history](docs/DEPLOYMENT.md)

Active frontend: `web/src/v2`, React 19 + TypeScript + Vite. URL screen IDs follow the PRD; component view IDs remain stable internally. React state holds preview flows; preferences use local storage.

```sh
cd web
npm ci
npm run typecheck
npm run lint
npm test
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

No production migration or cutover is authorized by this frontend synchronization.
