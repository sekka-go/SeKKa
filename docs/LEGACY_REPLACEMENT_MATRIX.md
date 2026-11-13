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

| Previous behavior | New expected behavior | Implementation | Migration / deployment |
|---|---|---|---|
| Legacy 16–18 duration/direction controls and booking form | Fixed captain offer summary 16, security 17, confirmed snapshot 18 | BookingFlow.tsx, App.tsx handoff | UI replaced; hosted acceptance and financial activation held |
| Legacy 19–23 booking/payment screens | 19 details, 20 rider paid, 21 receipt timeline, 22 management; 23 alias | BookingFlow.tsx, screen registry | UI replaced; API/ledger contracts unchanged, no retirement claim |
| Phase-two booking placeholder modal | Navigate to approved summary carrying selected offer | Discovery onBook, URL offer metadata | Preview navigation; no reservation mutation |

| Captain onboarding 37–43 | Generic legacy forms and direct upload | Shared themed flow, local preview selections, guarded real status | web/src/v2/CaptainOnboarding.tsx | No data migrated | Phase-six E2E added | Branch preview pending | Verification/storage policy; production activation |

| Previous | Phase 7 replacement | Location | Verification | Remaining dependency |
|---|---|---|---|---|
| Generic captain JSON / pending pages | Themed operations 51–62 | web/src/v2/CaptainOperations.tsx | PostgreSQL role/privacy test; mobile E2E | Hosted migration/auth |
| Captain chat could only follow existing rider thread | Owned-booking captain chat open | captain_operations migration | Unrelated actor and unknown booking rejected | Staging migration |
| Receipt list shown as generic bookings | Direct-payment receipt history | Screen 60 | No wallet credit assumptions | Live transaction data |

| Generic admin JSON / missing screens | Desktop/mobile themed administration 63–74 | web/src/v2/AdminDashboard.tsx | Both-theme desktop/mobile E2E; no POST | Live staff auth, scoped APIs and durable audit |
