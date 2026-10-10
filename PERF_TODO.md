# Performance audit follow-up

- [x] Remove the timed full-screen intro gate from normal cold startup while keeping the landing route immediately visible.
- [x] Split authenticated workspace and auth screen modules from the public landing entry; keep route loading compact, inline, and recoverable.
- [x] Keep loading states inline, announce slow connections after eight seconds, and surface API timeout failures through existing retry UI.
- [x] Add indexes for the six foreign-key columns reported by Supabase; migration was applied and verified on production after PR #102 merged.
- [x] Re-run web build, server tests, PWA checks, lint, and translation-key parity.
- [x] Re-measure cold and repeat landing traces at mobile + Slow 4G + 4× CPU; protected routes remain unmeasured without a safe test login.
- [x] Verify generated worker cache boundaries; authenticated API/user data caching was not added.
- [x] Defer further query/cache dependencies; current search debounce/cancellation safeguards are present and code splitting/font loading were measured.
- [x] Keep changes on `perf-fix`; open review PR #102 without pushing to `main`.

## Deferred pending evidence

- Do not drop the advisor's 47 "unused" indexes based only on the current observation window.
- Search already has a 350 ms debounce, minimum length of three, stale-request cancellation, and same-origin API use; do not rewrite without measured benefit.
- Authenticated Captain/Admin/Search waterfall measurements need an authorized test session. The current isolated Chrome context has no credentials.

## Follow-up audit (2026-10-10)

- [x] Set immutable one-year caching for content-hashed `/assets/*`; keep HTML, `sw.js`, and `theme-preference.js` revalidated.
- [x] Cache only the shared root app shell and use it as the offline navigation fallback; never cache protected routes or API responses.
- [x] Parallelize Captain profile/preferences startup requests and distinguish a missing profile (404) from a transient/API failure with a retry action.
- [x] Let Rider account and request-registration screens render without waiting for unrelated dashboard data; keep pending states from appearing as false empty states.
- [x] Verify Captain failure and request-waterfall behavior with local mocks; verify SW offline fallback; re-run build, server tests, lint, and PWA checks.
- [x] Re-measure public cold/repeat and login LCP under the same 390 × 844, 4× CPU, Slow 4G setup; authenticated route metrics still require a test session.
- [ ] Review Cloudflare cache rules and Supabase region/compute sizing manually; the app does not expose configuration to verify those account-level settings.

### Completed local validation (2026-10-10)

- Local Captain startup was measured with deterministic mock delays (500 ms for preferences and 800 ms for profile). Before parallelization, the profile response completed about 1.32 seconds after the first request started; after the change it completed about 0.81 seconds after both requests started together (approximately 0.51 seconds / 38% faster in this mock). This is a controlled local comparison, not a production account measurement.
- A simulated HTTP 503 for `/captain/profile` now displays the retryable error state instead of incorrectly showing the new-profile form. Only HTTP 404 is treated as a missing profile.
- Captain and Rider account/request entry screens preserve their controls while unrelated data is loading. Rider startup API calls were already concurrent; no change was made to request security or validation.
- The app shell fallback was tested from a local preview while offline on a protected route: the shared shell opened, with no protected response or `/api` data cached.
- Validation after the frontend change: `pnpm build`, `pnpm lint`, `pnpm --filter web check:pwa`, and `pnpm test` all pass; server suite reports 217/217.
- Cloudflare Pages `_headers` syntax and static-directory behavior were checked against [Cloudflare Pages custom headers documentation](https://developers.cloudflare.com/pages/configuration/headers/). The new header rules are in build output, but still require publishing this branch before production responses change.
- Manual account-level review remains: Supabase compute sizing and Cloudflare zone-level cache/CDN settings. No real authenticated production session was available for login-to-home/Search/Captain traces.
