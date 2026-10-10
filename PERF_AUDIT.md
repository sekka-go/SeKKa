# SeKKa Performance Audit

**Baseline date:** 2026-10-10  
**Baseline target:** `https://sekka-go.pages.dev/` (production)  
**Local branch:** `perf-fix`, based on `origin/main` at `196138822773434f73070a2f177542bc14edfe76`
**Scope:** startup and route loading, browser network waterfall, React bundle split, search behavior, PWA caching, and Supabase performance advisor.

## Measurement setup

Chrome DevTools Performance traces ran at a 390 × 844 mobile viewport, device scale factor 3, 4× CPU slowdown, and Slow 4G. The cold landing measurement used an isolated browser context; the repeat measurement used the same context after the first visit, including its service worker/cache and session storage. The login measurement used a fresh isolated context. CrUX has no field data for the measured page, so these are lab results, not real-user percentiles.

| Scenario | LCP | TTFB | Render delay | CLS | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| Landing, first visit | 4,619 ms | 91 ms | 4,528 ms | 0.00 | LCP was the Arabic splash title; the intro completely hides the landing screen. |
| Landing, repeat visit | 1,335 ms | 105 ms | 1,230 ms | 0.00 | LCP was page text (`H1`); document came from the service worker. |
| `/login`, first visit | 1,246 ms | 59 ms | 1,188 ms | 0.00 | Login content is shown directly; no intro overlay. |

The largest opportunity is client render delay, especially the first-visit intro gate. The initial landing's network critical path was also delayed by Google Fonts: CSS followed by three Tajawal font files, each taking about 3.5 seconds under Slow 4G. The origin response itself was fast, compressed (Brotli), and not redirected. On the repeat visit, the document was served from the service worker and the intro was skipped.

## Implemented results (local preview)

- The timed first-launch intro no longer blocks the landing route.
- Auth and workspace screens are separate lazy-loaded chunks. Initial JS went from 630.69 KiB (167.33 KiB gzip) to 417.24 KiB (116.33 KiB gzip), a 51 KiB gzip reduction (about 30%). Auth is 3.59 KiB gzip and Workspace is 39.79 KiB gzip. MapPicker remains a separate 46.02 KiB gzip chunk. The previous >500 KiB chunk warning is gone.
- Google Fonts CSS is requested without blocking first paint; Tajawal still loads with `display=swap`. DevTools' estimated render-blocking savings fell from about 971 ms on an earlier local capture to 154 ms. Local cold captures varied from 2,451 to 2,820 ms LCP, 14 ms TTFB, and 0.01 CLS; the local repeat capture was 658 ms LCP, 11 ms TTFB, and 0 CLS. These localhost captures are directional, have no CrUX data, and are not directly comparable to production's edge/service-worker timings.
- API requests now have a 15-second default timeout (overridable per call), preserving caller cancellation. Existing loading cards announce a slow connection after eight seconds. A lazy route chunk failure presents an inline retry action. Upload endpoints are unchanged.
- Mobile Lighthouse on local `/login`: Accessibility 100, Best Practices 100, SEO 100, Agentic Browsing 67. The first pass found disabled zoom, an accessible-name mismatch on the brand link, and missing crawler rules; those were corrected. The remaining Agentic Browsing finding is the optional `llms.txt` recommendation, intentionally not added.
- `pnpm build` and `pnpm test` passed; the server suite reports 209/209 passing. `pnpm lint`, PWA cache-boundary checks, and recursive locale-key parity passed (1,156 keys in each locale). PWA checks confirm the manifest, icons, offline fallback, and cache boundaries. Authenticated API/user data caching was not introduced.

The initial production database advisor reported six unindexed foreign keys. The additive migration for those six FK indexes was subsequently applied to production and verified. A later advisor snapshot reports 47 unused indexes, including the six recently added indexes; this is not enough evidence to remove them. Earlier `pg_stat_statements` data showed `sekka_process_pool_deadlines()` at 11,981 calls, 10.94 ms mean, 270.57 ms max, and `sekka_purge_expired_location_data()` at 751 calls, 24.56 ms mean, 83.25 ms max. Both are mutating maintenance functions, so no `EXPLAIN ANALYZE` was run against production. Higher-mean Supabase metadata queries were schema/extension introspection rather than application route queries.

## Findings and planned work

### P1 — First-visit splash blocks useful content

Previously, `App.tsx` rendered `null` for the primary route while `introStage` was active. A new unauthenticated visitor saw a 1.65-second logo screen followed by a full-screen splash animation before the landing page was interactive. This was removed from automatic startup; public content is no longer held behind a timer.

### P1 — No route-level code splitting

`App.tsx` now keeps the public landing eager and lazy-loads `AuthScreen` and `Workspace`; chunk waits are inline and retryable. The map remains lazy-loaded through `MapPickerLoader`.

### P2 — Search already has several good safeguards

`LocationSearchField` waits 350 ms, requires at least three characters, aborts stale requests, and calls the same-origin `/locations/search` API rather than querying a geocoder directly from the browser. These protections remain. A response cache or shared-query layer should be added only if request traces or usage establish repeat-query waste; this app does not currently include a data-query library.

### P2 — PWA startup and cache boundaries

`registerPwa()` waits until the `load` event, so service-worker registration is not on the critical render path. `web/src/pwa.ts` reports a waiting update through an app event. The PWA checker passed with cache boundaries intact; authenticated/API responses and user data are not cached. Production's repeat document was served by the worker.

### P2 — Supabase performance advisor

The connected project's performance advisor reported six foreign keys without covering indexes:

- `audit_log(actor_user_id)`
- `commuter_board_campaigns(created_by_admin)`
- `direct_messages(sender_user_id)`
- `message_conversations(last_message_sender_id)`
- `pool_notification_mutes(group_id)`
- `pool_notifications(actor_id)`

It also reported 41 indexes unused in the advisor's observation window. They were left untouched: low-traffic or infrequent admin/retention paths can make valid indexes appear unused. The six missing-FK indexes are added in a new additive migration and were not applied directly to production.

### Authentication and route coverage limitation

The isolated browser had no authenticated account. `/search`, `/captain`, and other protected workspace routes require sign-in, so this run did not measure real authenticated payload loading or verify role-specific response waterfalls. No credentials were requested or entered. Repeat those traces with an approved non-production test account before making route-specific claims.

## Baseline architecture notes

- React 19 + Vite 8; no TanStack Query/SWR or equivalent request cache.
- The landing screen stays eager; Auth and Workspace are lazy-loaded.
- Leaflet map module is already split with `React.lazy` and an inline fallback.
- Search requests already debounce, enforce a minimum query length, and cancel stale work.
- Service worker registration runs after `window.load`.
- `/auth/me` is refreshed after a stored session is loaded; the cached workspace renders without a full-screen auth-check gate.
- Workspace loading states remain inline. Loading cards surface a slow-connection message at eight seconds; API requests time out at 15 seconds and route data errors retain retry actions.
- The production theme preference bootstrap script participates in first navigation; do not remove it without preserving correct initial theme and avoiding a visual flash.

## Follow-up baseline before this branch's code changes — 2026-10-10

The follow-up uses the merged production build at commit `196138822773434f73070a2f177542bc14edfe76`. Chrome DevTools emulated a 390 × 844 mobile viewport at device scale factor 3, 4× CPU slowdown, and Slow 4G. These are lab measurements with no CrUX field data.

| Scenario | LCP | TTFB | Render delay | CLS |
| --- | ---: | ---: | ---: | ---: |
| Public landing, cold isolated context | 1,316 ms | 58 ms | 1,257 ms | 0.02 |
| Public landing, second navigation in same context | 1,246 ms | 87 ms | 1,158 ms | 0.00 |
| `/login`, cold isolated context | 1,500 ms | 71 ms | 1,429 ms | 0.00 |

The landing LCP is the text `H1`, not an image. The trace's render-blocking insight estimated 0 ms savings; render delay (not TTFB or a render-blocking stylesheet) dominates. The second navigation still performs a network navigation: `sw.js` is network-first for navigations and currently does not cache the app shell. The production HTML has `Cache-Control: public, max-age=0, must-revalidate`, which is appropriate for the entry document. In contrast, the content-hashed JS and CSS responses also have `max-age=0, must-revalidate`; the JS response's decoded body is about 417 KB and CSS about 225 KB. The audited build output from the previous perf change measured initial JS at 116.33 KiB gzip. Hashed assets can safely use a long immutable cache lifetime; this is the main concrete repeat-load opportunity.

The `/login` trace was unauthenticated and measured only rendering of the login form. Login-to-home, `/search` results, and Captain data latency remain unmeasured because no approved test account/session is available. No production login was attempted. Supabase project `uorxfakceqnhxqnaawdy` is in `eu-central-1`. The current performance advisor reports 47 unused indexes and no missing-FK-index finding; recent indexes are included in the unused list. No index was dropped and no live query was run with `EXPLAIN ANALYZE`.

### New code findings and planned changes

- Captain's initial profile and preference requests are awaited sequentially even though they are independent; this creates an avoidable network waterfall. The profile screen also treats every profile failure as a missing profile, while only HTTP 404 should mean that a captain has not created a profile. Plan: run the requests concurrently and show a retryable inline error on a real profile-load failure. Keep the existing session, API authorization, and server validation unchanged.
- Rider startup requests already run concurrently. However, the Rider workspace withholds its selected content until unrelated startup data settles; preserve the app navigation and allow independent screens to render while their own data loads. Avoid showing an empty state until its request resolves.
- The service worker correctly bypasses `/api` and third-party URLs, but it does not cache the public app shell for offline navigation. Plan: cache only the shared root HTML document, revalidate it online, and use it as an offline navigation fallback before `offline.html`. Never cache protected navigation responses, API data, or user-specific content.
- The Cloudflare Pages response for hashed `/assets/*` files uses `max-age=0`. Plan: add output-header rules for immutable hashed assets, while keeping `/`, `/sw.js`, and the theme bootstrap revalidated. Preserve existing CSP and security headers.
- Keep the existing 350 ms debounced, minimum-three-character, cancellable address search and lazy map loading. Do not add a query-cache dependency, tile cache, retry of mutations, or a service-worker kill switch without evidence and a safe account-isolation/update test.

### Baseline limitations

The production browser cannot authenticate Captain or Rider flows without an authorized test session. Do not use stored production account data for this audit. Supabase's advisor is an aggregate snapshot; the 47 "unused" entries are not sufficient basis for deleting indexes. No production schema changes are planned in this follow-up.

## Verification plan

Verification previously completed for the public landing and login. In this follow-up, fresh unauthenticated production traces were captured; protected Captain/Admin/Search timing remains unmeasured because no authorized test account was available. Auth/RLS behavior was not changed. The earlier additive FK-index migration was applied to production; no new production database migration is planned here.
