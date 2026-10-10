# Performance audit follow-up

- [ ] Remove the timed full-screen intro gate from normal cold startup while keeping the landing route immediately visible.
- [ ] Split authenticated workspace and auth screen modules from the public landing entry; keep route loading compact, inline, and recoverable.
- [ ] Replace the initial rider workspace loading card with an in-place skeleton and ensure errors retain retry controls.
- [ ] Add verified indexes for the six foreign-key columns reported by the Supabase performance advisor, using a migration only; do not apply against production directly.
- [ ] Re-run typecheck, web build, server tests, PWA checks, and any repository checks after their respective changes.
- [ ] Re-measure cold and repeat landing/login traces at mobile + Slow 4G + 4× CPU; record authenticated route limitations unless a safe non-production account is available.
- [ ] Inspect worker cache policy and document safe offline/logout boundaries; do not cache authenticated API/user responses.
- [ ] Confirm after measurements whether fonts or additional code splitting warrant further changes; avoid a new query/cache dependency without observed duplicate-request impact.
- [ ] Confirm no main-branch push; prepare a review branch/PR after verification.

## Deferred pending evidence

- Do not drop the advisor's 41 "unused" indexes based only on the current observation window.
- Search already has a 350 ms debounce, minimum length of three, stale-request cancellation, and same-origin API use; do not rewrite without measured benefit.
- Authenticated Captain/Admin/Search waterfall measurements need an authorized test session. The current isolated Chrome context has no credentials.
