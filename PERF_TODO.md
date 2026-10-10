# Performance audit follow-up

- [x] Remove the timed full-screen intro gate from normal cold startup while keeping the landing route immediately visible.
- [x] Split authenticated workspace and auth screen modules from the public landing entry; keep route loading compact, inline, and recoverable.
- [x] Keep loading states inline, announce slow connections after eight seconds, and surface API timeout failures through existing retry UI.
- [x] Add indexes for the six foreign-key columns reported by Supabase, in a migration only; do not apply to production directly.
- [x] Re-run web build, server tests, PWA checks, lint, and translation-key parity.
- [x] Re-measure cold and repeat landing traces at mobile + Slow 4G + 4× CPU; protected routes remain unmeasured without a safe test login.
- [x] Verify generated worker cache boundaries; authenticated API/user data caching was not added.
- [x] Defer further query/cache dependencies; current search debounce/cancellation safeguards are present and code splitting/font loading were measured.
- [x] Keep changes on `perf-fix`; open review PR #102 without pushing to `main`.

## Deferred pending evidence

- Do not drop the advisor's 41 "unused" indexes based only on the current observation window.
- Search already has a 350 ms debounce, minimum length of three, stale-request cancellation, and same-origin API use; do not rewrite without measured benefit.
- Authenticated Captain/Admin/Search waterfall measurements need an authorized test session. The current isolated Chrome context has no credentials.
