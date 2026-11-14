# Legacy frontend retirement — 2026-11-14

## Current authority and runtime
- Product: [PRD v3.1](PRD.md), 73 public screens in eight stages.
- Runtime entry: `web/src/main.tsx` → `web/src/v2/App.tsx` with independent persistent preferences.
- `web/tsconfig.json` includes only `src/main.tsx`, `src/v2`, `src/vite-env.d.ts` and the current domain package.
- `web/package.json` lint targets `src/v2`; active import/static asset inspection found no references to the deleted files.
- A new CI guard `npm run test:structure` ensures the retired directory paths stay absent.

## Removed from the live repository tree
**32 unused files** (331,562 bytes), grouped by:
- `web/src/App.tsx`, old entry app
- `web/src/screens/**`, earlier rider/captain/admin/auth/legal screens and CSS
- `web/src/lib/**`, earlier client helpers and obsolete matching test
- `web/src/design-system/**`, old unused implementation (not the approved `DESIGN_SYSTEM.md`)
- `web/src/styles/**`, old green theme
- `web/src/sekka-system.css` and `web/src/auth-login-screen-two.css`

These files remain recoverable from Git history, not active `main`.

## Deliberately preserved
- Official brand assets, PWA manifest, phase screenshots/references used by current onboarding and discovery, React 19 + Vite UI, tests and PRD.
- Historical engineering documents and SQL files. No database operations were performed.
- `web/functions/__sekka-api/[[path]].ts` is retained to explicitly return HTTP 410 for old endpoints; removing it could cause uncontrolled stale-client behavior.
- Remaining assets or documentation not proven unused remain for a separate evidence-based cleanup.

## Acceptance and limits
- CI must pass typecheck, lint, domain/historical tests, structure guard, Vite build and Playwright.
- No real OTP/identity, payment provider, durable booking inventory, live messaging or admin authorization was activated. This cleanup must not be mistaken for a complete backend release.
- Because Cloudflare Pages is connected to GitHub `main`, merging the PR deploys the frontend automatically.
