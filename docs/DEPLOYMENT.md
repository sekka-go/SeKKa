# Deployment — current seKKa v3.1 frontend

**Production website:** https://sekka-go.pages.dev
**GitHub repository:** https://github.com/sekka-go/SeKKa
**Production branch:** `main` (automatically deployed by Cloudflare Pages).

Cloudflare Pages build settings:
- Project: `sekka-go`
- Root: `web`
- Command: `npm run build`
- Output: `dist`
- Runtime: React 19, TypeScript, Vite, PWA.
- CI uses Node 24, TypeScript, ESLint, domain tests, the structure guard, a Vite production build and Playwright.

The public frontend implements 73 PRD v3.1 screens and their mock/preview user journeys. This production deployment is **not evidence of live payments, reservations, role-based identity, transactions or real chat persistence**. The old proxy `web/functions/__sekka-api/[[path]].ts` deliberately replies HTTP 410, and no new Supabase migrations have been applied by this frontend deployment.

The currently authoritative product document is [PRD v3.1](PRD.md). The current implementation status is [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md). Older 74/78-screen specifications and legacy dashboards were deleted from the active source tree at the owner's request; historical commits can be found in Git history.

**Production verification:** use Cloudflare Pages' deployment status and confirm its commit SHA matches GitHub `main`; check the root URL on a mobile viewport. Do not activate backend env variables or payments from a frontend cleanup.
