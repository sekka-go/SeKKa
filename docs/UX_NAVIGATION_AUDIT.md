# SeKKa UX and Navigation Audit

Date: 2026-10-30
Scope: current tracked React application routes and interactions. This records the implementation present in source; a route or screen shell is not evidence that its business operation is complete.

## Navigation changes in this pass

- Rider navigation now has the same five destinations on home, trip search, trip history, and rider journey screens: Home, Search, My requests, Conversations, More.
- The active destination is exposed with `aria-current="page"`; the gold marker remains the visual selected-state cue.
- Rider home quick actions are reduced to My requests, Subscriptions, and Support so they complement the primary trip search rather than repeat the bottom bar.
- The conversation shortcut now opens `/journey/conversations`, and the My requests shortcut resolves to `/my-trips` instead of the unimplemented `/requests` route.
- Journey-screen back controls return to the same-origin previous page when available and fall back to the relevant role home.
- Captain navigation keeps role-specific destinations: Home, Offers, Groups, Notifications, More. Related nested screens highlight their parent section.
- Rider and captain journey screens now group all screen links inside a collapsed service directory, grouped by trip/subscription, payment, communication/support, or account tasks.
- Technical auth/query exception text is replaced with short Arabic guidance in rider/captain journey screens.

## Route and destination map

| Area | Routes in `web/src/App.tsx` | Main destinations/actions | Data source in current screen code |
|---|---|---|---|
| Public/auth | `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/terms`, `/privacy`, `/admin/login` | Start/sign in/create account/recover password/legal pages | Supabase Auth for rider/captain; admin API for admin login |
| Rider core | `/home`, `/trips`, `/my-trips` | Search, inspect a trip, switch to requests/history | Screen code still uses legacy Supabase reads; the current product API exposes custom-session rider routes instead |
| Rider journey | `/journey/{group,subscriptions,subscription,receipt,payment-method,proof,captain-confirmation,payment-code,payment-result,renewal,replacement-captain,conversations,conversation,notifications,ratings,complaint,complaint-status,profile}` | View memberships, conversations, notifications, profile and support states | Screen code queries legacy Supabase tables that are not in the current product schema |
| Captain journey | `/captain/home`, `/captain/journey/{approval,documents,vehicle,offers,new-offer,edit-offer,rider-requests,rider-request,groups,group,riders,subscriptions,payments,payment,confirm-receipt,send-code,payment-status,renewal,replacement,conversations,notifications,ratings-reports,profile}` | Manage offers, requests, groups, payment review, notices and profile | Screen code queries legacy Supabase tables; the production API provides custom-session captain routes |
| Admin/shared | `/admin` and `/admin/{users,user,captains,documents,vehicles,offers,rider-requests,groups,group,subscriptions,payments,payment,disputes,complaints,ratings,notifications,commission,settings,reports,audit-log,admin-permissions,trip-operations,pool-overview,finance,pricing,campaigns,otp-settings,ledger}`; `/shared/{notifications,loading,error,empty,offline,confirm,access-denied,not-found}` | Operational console and shared system states | Deployed `sekka-api` endpoints where implemented; unavailable endpoints should remain explicit empty/unavailable states |

The PRD's screen inventory and implemented route inventory are not interchangeable: some routes render a shell while their writes or underlying backend operation remain unavailable. Confirm each screen against its behavior before marking it complete.

## Findings requiring follow-up

### P0 — live UI and production data/auth architecture are out of sync

- Read-only inspection of the connected production project shows the current product schema is the custom-session SeKKa backend (`users`, `captain_lines`, `demand_requests`, `demand_groups`, `captain_profiles`, etc.). It does not expose the old frontend model (`profiles`, `ride_groups`, `ride_group_members`, `subscriptions`, `conversations`, `messages`, `notifications`, and similar tables) used by rider/captain screen code.
- The real `captain_lines` shape uses fields such as `origin_label`, `destination_label`, `service_days`, `arrival_time`, `seats`, `price_per_seat`, and statuses `active/paused/cancelled`; `/trips` currently queries removed fields such as `origin_name`, `operating_days`, `monthly_price`, `published_at`, and status `published`. The live browser request returned Postgres/PostgREST `42703` (missing `origin_name`) with HTTP 400.
- The connected product is authenticated through the deployed `sekka-api` custom session endpoints, while the rider/captain frontend still calls Supabase Auth and reads product tables directly. RLS is enabled and `users`, `captain_profiles`, and `vehicle_types` have backend-only `service_role` policies. Do not grant public table access to make the old UI appear to work.
- The deployed API already exposes relevant role-scoped routes, including `/rider/lines/discover`, `/rider/lines/search`, `/rider/requests`, `/rider/trips`, `/captain/lines`, and `/captain/profile`. The next implementation batch should adapt role login/session handling and rider/captain reads to these API contracts, then validate real navigation with test accounts. No production schema changes were made in this audit.

### P1 — service paths currently presented before they are actionable

- Rider payment method selection, transfer evidence submission, complaints, ratings, and several captain write actions currently display an unavailable/server-write notice or do not persist. Keep those controls explicitly disabled or state the limitation before the user enters data; do not imply success.
- `/requests` and `/requests/new` are still listed as legacy `HomeAction` destinations in `App.tsx`. Current home controls no longer use them; remove stale route types before reintroducing those actions.
- `/journey/conversation?id=...` currently displays the latest message but explicitly does not provide message sending. The UI should make this read-only state clear.

### P1 — role separation and backend consistency

- Rider screens use Supabase Auth and product tables directly; admin uses the deployed `sekka-api`. Verify the schema and RLS policies for every rider/captain table before enabling any write path. Never mirror a UI field into a new database field without a migration and authorization design.
- A role may access the other role's sign-in only through explicit role-aware routing; navigation must not infer a new role from the current UI.

### P2 — navigation and accessibility

- Rider and captain journey routes are grouped by task inside a collapsed, accessible disclosure menu; bottom navigation remains stable and always visible.
- Captain journey screens reuse the rider journey shell and symbol glyphs. Replace remaining text glyphs with the project's consistent SVG icon set and verify labels/contrast/touch targets on narrow devices.
- Validate browser back behavior after direct links and refreshes on mobile browsers; this pass provides same-origin history navigation with a role-home fallback.

## Verification record

`npm ci --ignore-scripts`, `npm run typecheck`, and `npm run build` passed after regenerating the lockfile from `package.json` in a clean npm environment. Vite reports the primary JavaScript chunk is 559 kB (over its 500 kB warning threshold). The package has no `lint` or `test` script. Browser checks at 320px confirmed five rider navigation destinations, the active search state, and no horizontal overflow. The no-session conversations route displays Arabic sign-in/network guidance instead of the raw auth exception. No browser console errors were observed during these checks.

Cloudflare Pages project configuration was inspected read-only and is correctly set to root `web`, build command `npm run build`, output `dist`. Cloudflare's failed preview build for `c827840` was traced to the committed lockfile containing pnpm symlinks into a directory outside the repository; its clean install omitted the build tools and failed with `tsc: not found`. The lockfile has now been regenerated with ordinary npm package entries and a clean `npm ci` succeeded locally. A new preview build still needs to be triggered by pushing this commit and then checked in Cloudflare. Production was not changed.
