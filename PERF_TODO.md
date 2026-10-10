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

- [ ] Set immutable one-year caching for content-hashed `/assets/*`; keep HTML, `sw.js`, and `theme-preference.js` revalidated.
- [ ] Cache only the shared root app shell and use it as the offline navigation fallback; never cache protected routes or API responses.
- [ ] Parallelize Captain profile/preferences startup requests and distinguish a missing profile (404) from a transient/API failure with a retry action.
- [ ] Let Rider account and request-registration screens render without waiting for unrelated dashboard data; keep pending states from appearing as false empty states.
- [ ] Verify the above in a local preview, including SW offline fallback, and re-run build, server tests, lint, and PWA checks.
- [ ] Re-measure public cold/repeat and login LCP under the same 390 × 844, 4× CPU, Slow 4G setup; document that authenticated route metrics still require a test session.
- [ ] Review Cloudflare cache rules and Supabase region/compute sizing manually; the app does not expose configuration to verify those account-level settings.
