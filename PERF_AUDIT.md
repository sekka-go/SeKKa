# SeKKa Performance Audit

**Baseline date:** 2026-10-10  
**Baseline target:** `https://sekka-go.pages.dev/` (production)  
**Local branch:** `perf-fix`, based on `origin/main` at `ffa16d4808447a0ea67d00256e4d00593cef6738`  
**Scope:** startup and route loading, browser network waterfall, React bundle split, search behavior, PWA caching, and Supabase performance advisor.

## Measurement setup

Chrome DevTools Performance traces ran at a 390 × 844 mobile viewport, device scale factor 3, 4× CPU slowdown, and Slow 4G. The cold landing measurement used an isolated browser context; the repeat measurement used the same context after the first visit, including its service worker/cache and session storage. The login measurement used a fresh isolated context. CrUX has no field data for the measured page, so these are lab results, not real-user percentiles.

| Scenario | LCP | TTFB | Render delay | CLS | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| Landing, first visit | 4,619 ms | 91 ms | 4,528 ms | 0.00 | LCP was the Arabic splash title; the intro completely hides the landing screen. |
| Landing, repeat visit | 1,335 ms | 105 ms | 1,230 ms | 0.00 | LCP was page text (`H1`); document came from the service worker. |
| `/login`, first visit | 1,246 ms | 59 ms | 1,188 ms | 0.00 | Login content is shown directly; no intro overlay. |

The largest opportunity is client render delay, especially the first-visit intro gate. The initial landing's network critical path was also delayed by Google Fonts: CSS followed by three Tajawal font files, each taking about 3.5 seconds under Slow 4G. The origin response itself was fast, compressed (Brotli), and not redirected. On the repeat visit, the document was served from the service worker and the intro was skipped.

## Findings and planned work

### P1 — First-visit splash blocks useful content

`web/src/App.tsx` renders `null` for the primary route while `introStage` is active. A new unauthenticated visitor sees a 1.65-second logo screen followed by a full-screen splash animation before the landing page is interactive. That sequence accounts for most of the measured first-visit LCP delay. Keep the branded animation available without gating route content; render the landing immediately and make any intro presentation non-blocking or remove the timed startup gate. Preserve direct `/login` and protected-route behavior.

### P1 — No route-level code splitting

`App.tsx` statically imports `AuthScreen`, `LandingScreen`, and `Workspace`, so entry routes share code they do not immediately need. The prior production build emitted an initial JS file around 631 KiB (167 KiB gzip), plus a map chunk around 155 KiB (46 KiB gzip); CSS was around 231 KiB (40 KiB gzip). The map is already lazy-loaded through `MapPickerLoader`, which is good. Add route/screen-level lazy loading only where it reduces initial transfer without introducing an empty or full-screen wait state.

### P2 — Search already has several good safeguards

`LocationSearchField` waits 350 ms, requires at least three characters, aborts stale requests, and calls the same-origin `/locations/search` API rather than querying a geocoder directly from the browser. Keep these protections. A response cache or shared-query layer should be added only if request traces or usage establish repeat-query waste; this app does not currently include a data-query library.

### P2 — PWA startup and cache boundaries

`registerPwa()` waits until the `load` event, so service-worker registration is not on the critical render path. `web/src/pwa.ts` reports a waiting update through an app event. Inspect the generated worker's cache rules before changing them; preserve the security boundary that authenticated/API responses and user data must not be cached. Production's repeat document was served by the worker. Verify safe offline and logout behavior if changing cache policy.

### P2 — Supabase performance advisor

The connected project's performance advisor reported six foreign keys without covering indexes:

- `audit_log(actor_user_id)`
- `commuter_board_campaigns(created_by_admin)`
- `direct_messages(sender_user_id)`
- `message_conversations(last_message_sender_id)`
- `pool_notification_mutes(group_id)`
- `pool_notifications(actor_id)`

It also reported 41 indexes unused in the advisor's observation window. Do not remove those based on this signal alone: a low-traffic/new project or infrequent admin/retention paths can make valid indexes appear unused. Confirm their migration definitions and representative query plans/longer usage window. Add only indexes with verified workload value, in a new migration and without applying it directly to production as part of this audit.

### Authentication and route coverage limitation

The isolated browser had no authenticated account. `/search`, `/captain`, and other protected workspace routes require sign-in, so this run did not measure real authenticated payload loading or verify role-specific response waterfalls. No credentials were requested or entered. Repeat those traces with an approved non-production test account before making route-specific claims.

## Baseline architecture notes

- React 19 + Vite 8; no TanStack Query/SWR or equivalent request cache.
- Main `App` and route screen modules are loaded eagerly.
- Leaflet map module is already split with `React.lazy` and an inline fallback.
- Search requests already debounce, enforce a minimum query length, and cancel stale work.
- Service worker registration runs after `window.load`.
- `/auth/me` is refreshed after a stored session is loaded; the cached workspace renders without a full-screen auth-check gate.
- Several individual workspace sections use inline `LoadingCard`/status UI, but `RiderWorkspace` initially returns only a loading card while its first data request completes. This remains confined to that workspace area and should become a matching skeleton/inline retry if its loading error path permits.
- The production theme preference bootstrap script participates in first navigation; do not remove it without preserving correct initial theme and avoiding a visual flash.

## Verification plan

After each implementation category, run the repository's requested typecheck/build/tests and compare equivalent cold and repeat traces at the same mobile/Slow 4G/4× CPU settings. Record route, cache state, LCP/TTFB/render delay/CLS, initial transfer sizes, and any auth/session prerequisites. Use a non-production test account for protected route traces. Preserve a clear retry state for requests that exceed the app's configured timeout; never replace authorization or RLS checks with client-side shortcuts.
