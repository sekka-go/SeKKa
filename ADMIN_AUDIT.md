# Admin Panel Audit and Restructure Plan

## Scope and access control

The admin interface is rendered by `web/src/screens/AdminWorkspace.tsx` and `web/src/components/AdminControlPanel.tsx`. The browser does not grant access by itself: the Supabase Edge Function `supabase/functions/sekka-api/index.ts` applies `requireSuperAdmin` to `/admin/*` endpoints. That check verifies both the authenticated user's `users.role = 'admin'` and membership in `super_admins`. Keep this server-side check on every admin read and write.

This audit uses the deployed `sekka-api` implementation and the current frontend contract. It does not change production data or database migrations.

## Current page inventory

| Current widget/section | Data required | Source/query | Current behavior / issue |
|---|---|---|---|
| User totals | total users, riders, captains | `GET /admin/analytics/overview` | UI expects `total_users`, `total_riders`, `total_captains`; deployed response uses generic keys (`users`, `captain_profiles`, etc.). Missing properties silently become `0`, making the dashboard misleading. |
| Pending captain verification | pending captain identity and vehicle summary | `GET /admin/captains?status=pending` | Fetched for the overview and again in the control-panel verification tab. Duplicate request and duplicate refresh controls. Phone/license values are returned to the UI; license is masked in this card, phone is not. |
| Pool group counts and dues | counts by group state, company/captain ledger balances | `GET /admin/pool/overview` | Frontend expects `response.overview.waiting_groups` and related fields. Deployed endpoint returns `{groups, trips, totals}` and loads full group, trip, and ledger rows. Contract mismatch plus excessive data transfer; expected counts resolve as zero. |
| Platform health | approved captains, active/completed trips, open disputes | `GET /admin/analytics/overview` | Same response contract mismatch. Deployed aggregate handler also reads all payment amounts to sum them in application code instead of returning a compact aggregate. |
| Fake tab navigation | users, verification, trips, disputes, finance, settings, audit | Local `tab` state in `AdminControlPanel` | Tabs change the content in-place; they are not routes. Deep links, browser back, and refresh to a section do not work. Admin panel is mounted on the overview page, producing a very long composite screen. |
| Users list | users, role/status, captain profile | `GET /admin/users?q=...` | Search is debounced in the browser, but pagination is only the endpoint's first 50 rows (up to 100); filters are applied locally. Phone and some captain data are unmasked. No server page/offset contract. |
| Verification queue | documents + owner/vehicle information | `GET /admin/verifications?status=all` | Loads up to 200 documents and then filters in the client. Re-fetched by overview and tab. Review uses authenticated admin endpoints and rejection reason. File preview obtains a signed URL through `/admin/verifications/:id/file`. |
| Trips and pool trips | daily and pooled trip state | `GET /admin/trips` | Returns capped lists (daily in-progress and a subset of pool states). Does not supply a complete state-count summary for waiting, price review, waiting for captain, and active groups. |
| Payment disputes | pending disputes and payment details | `GET /admin/disputes` | Existing business object is a payment dispute, not a general complaints subsystem. Keep its state/actions intact and avoid inventing a new complaints table or behavior. |
| Finance / ledger adjustments | settings and accounting adjustments | `GET /admin/settings`, `GET /admin/ledger/adjustments?limit=100` | Both are loaded together in the finance tab. This is an accounting ledger only; it does not collect or transfer funds. Adjustment writes remain server-authorized and audited. |
| Pricing settings | commission and per-vehicle rates | `GET /admin/settings`, pricing endpoints | Shared with finance/settings loading. Percentage conversion is performed in UI; labels must make units explicit. |
| Audit log | audit entries | `GET /admin/audit?limit=100` | Fixed first page with no filter/pagination. Empty reason is rendered as an em dash in some rows. |
| Broadcast | title/message and delivery count | `POST /admin/notifications/broadcast` | Separate admin utility already routed through `section === 'broadcast'`; retain its workflow. |
| Refresh and live indicators | fresh data | several page-local refreshes + 30-second dashboard timer | Duplicate refresh buttons and repeated calls. A hardcoded “live” indicator can imply Realtime freshness when the data is polling. |

## Root cause of empty counters

The empty/zero-looking overview is primarily a frontend/backend response mismatch, not evidence that RLS should be loosened. The deployed analytics endpoint returns generic keys such as `users`, `captain_profiles`, `trips`, and `confirmed_payment_amount`, while the UI reads `total_users`, `total_captains`, `total_trips_in_progress`, and other dashboard-specific keys. Optional chaining then converts missing values to zero. The pool overview has a larger envelope mismatch: the UI reads a nested `overview` object, while the endpoint returns `groups`, `trips`, and `totals`. The dashboard therefore substitutes zero for real values.

The current aggregate handlers also have observability/performance problems: they fetch all payment amounts for a sum, and the pool summary transfers entire group, ledger, and trip lists. On errors, they replace query details with generic messages (`analytics query failed`, `pool overview query failed`), which prevents identifying an underlying table/column/RLS error. Preserve the admin gate; improve error reporting on the server without returning sensitive query data to clients, and replace full-row summary reads with count/sum queries or a guarded RPC.

## Target information architecture

| Route | Responsibility |
|---|---|
| `/admin` | Action-needed overview: pending captain verification, payment disputes, active trips, pending price approvals; compact KPI strip. |
| `/admin/users` | Searchable, filterable, paginated riders/captains/admins. Mask contact/document identifiers in list rows; reveal authorized details only on a logged details view. |
| `/admin/documents` | Captain verification queue and signed document preview. |
| `/admin/trips` | Daily trips and groups, grouped by their existing workflow states. |
| `/admin/complaints` | Preserve current payment dispute feature under a clear label, until a distinct complaints product/data model is specified. |
| `/admin/finance` | Read-only dues and ledger history; retain the explicit no-money-movement notice. |
| `/admin/finance/adjustment` | Separate manual accounting-adjustment form with validation, confirmation, and server-side audit logging. |
| `/admin/pricing` | Commission and pricing controls with explicit units, confirmation, and audit history. |
| `/admin/audit` | Audit history with filters/pagination where supported. |

All links must support direct load, refresh, and browser back/forward. Route matching is a usability feature only; `/admin/*` API authorization remains server-side. Keep status-changing behavior behind the existing authorized endpoints/RPCs and audit logging.

## Implementation sequence

1. Correct summary response contracts and empty/loading/error behavior; use server-side aggregate queries and preserve role checks.
2. Split admin screens behind real, lazy-loaded routes and replace fake tabs with route links.
3. Compact overview, rows, and refresh affordance; mask list-level personal data and add server pagination only when the endpoint contract supports it.
4. Separate finance and pricing views while preserving accounting-only semantics and audit logging.
5. Run lint, typecheck, unit tests, build, and available security/database checks. No production migration is applied as part of this audit without a staging database and successful tests.

## Known limitations before implementation

- The current backend has payment disputes but no separate general complaints entity/endpoint.
- The current users and audit endpoints lack a complete server-pagination/filter contract.
- The analytics and pool endpoints need compact aggregate response contracts; do not derive summary counters from client-side full lists.
- The configured workspace has no local Supabase/Docker environment. Database integration tests and before/after admin screenshots require a test database and an authorized admin test account; do not use production credentials or mutate production data for visual testing.

## Implemented on `admin-restructure`

- Replaced the composite admin page with `/admin` plus `/admin/users`, `/admin/documents`, `/admin/trips`, `/admin/complaints`, `/admin/finance`, `/admin/finance/adjustment`, `/admin/pricing`, and `/admin/audit`. The shared workspace router maps direct URLs and browser back/forward to the matching admin section. The admin panel is loaded as a separate lazy chunk.
- The overview API now returns the field names consumed by the UI, uses exact count queries for user/captain/trip/group statuses, and no longer downloads every payment amount. Pool overview returns status totals; the finance summary walks pending ledger values by stable ID batches and returns only sums/counts. Neither endpoint returns group/trip/ledger lists to the browser. The open-dispute overview returns a bounded count and marks the 100-item cap as `100+`.
- Overview numbers render zero only after a successful empty result; load failures stay visible with retry. Removed the duplicate dashboard refresh and 20-second document polling; overview refreshes at 60 seconds, and other sections use the single header refresh.
- Users are loaded 25 at a time, with role/status filters and search applied in the API. List responses mask phone and license identifiers. Opening user details or a document preview is allowed only through the server-side super-admin gate and writes an audit log entry.
- Finance and pricing are separate routes. Finance includes company/captain pending ledger totals and the accounting-only notice; ledger adjustments and pricing changes require validation, a reason, and confirmation.
- No database schema migration is needed for these changes. The Edge Function source must still be deployed to Supabase separately from the Cloudflare Pages frontend. Do not deploy this Edge Function to production until its branch has been reviewed and verified against a staging/test database.

## Verification and visual artifacts

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (217 tests), `pnpm build`, `pnpm --filter web check:pwa`, and `deno task check:edge` pass for the implementation commit.
- A visual before/after screenshot set was not generated: the attached desktop environment reports no free space on `C:`, and no isolated admin test account or staging session was available. The current production session was not used for data-bearing admin screenshots.
- `supabase db reset` / `supabase test db` were not run because Docker is not available and this branch makes no schema migration.
