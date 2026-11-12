# Legacy replacement verification matrix

| Legacy behavior/resource | New behavior | Implementation | Migration/test evidence | Deployment / remaining dependency |
|---|---|---|---|---|
| Single trip purchase | Fixed-route weekly/monthly subscriptions | v2 App, private API | Calendar and DB tests | Old production API remains until approved retirement |
| Old category labels | PRIME/SAVER/SPACE/MAX and 3/4/9/13 | domain/categories, SQL constraints | Exact category assertion | No legacy category data converted |
| Legacy session/password login | Supabase Auth phone OTP | v2/api.ts, App auth screens | Adapter build; provider E2E pending | SMS provider/legal approval blocked |
| Old pricing | Server civil-calendar quote and snapshot | subscriptions.ts, quote SQL | Midnight, month-end, holidays, no 22 cap | Holiday coverage approval pending |
| Pool/ride reservations | Direction/date inventory under row locks | API book | Real simultaneous DB clients and cross-period tests | Renewal priority remains disabled |
| Old payment assumptions | EGP 100 reservation, full direct captain payment | bookings/reservations/ledger/events | Double-confirmation, repeated/concurrent release tests | Provider integration/withdrawals blocked |
| GPS and attendance | No geolocation permission or attendance API in v2 | CSP/Permissions-Policy, v2 entry | Static bundle check, old proxy returns 410 | Old Edge APIs still independently active |
| Old document storage | Private v2 bucket, owner path policies | migration/storage policies | Ownership tests in local PG | Legacy 11 objects kept; no UUID mapping |
| Old conversations | Owned rider/captain threads | messages API/UI | Unauthorized third-party read denied | In-app polling; realtime delivery pending |
| Legacy admin console | Server capability checks and audit | admin.list/review | Rider escalation denied | Full operator UX still partial |
| Old frontend | New dark RTL tokenized shell | web/src/v2 | Build/type/lint and UI checks | Not production-approved |
| Existing D1 | No new dependence | audit only | API reports zero tables | RETIRE only with separate approval |
| Existing Edge/cron/legacy SQL | Inert after approved future retirement | none mutated | Inventory only | Not replaced/retired yet |
