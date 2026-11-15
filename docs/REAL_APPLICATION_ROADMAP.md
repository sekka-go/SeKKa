# seKKa — Owner-approved Real Application Roadmap (2026-11-15)

Authority: owner instructions in current conversation; canonical product screens: [PRD v3.1](PRD.md), **73 screens / eight UX stages**. This implementation roadmap supersedes contradictory implementation notes, not the canonical PRD. **Do not restart completed work or replace existing working OAuth.**

## Hard release rules
- **Google OAuth already integrated:** inspect and test signup, login, logout, persistence and profile creation. Fix defects only; no additional providers.
- **OTP POSTPONED:** no phone verification gate for account creation, route creation, bookings or login. Phone may be stored as ordinary unverified profile data. Keep legacy demo screens isolated from real user journeys.
- **Payments POSTPONED:** no gateways, payment confirmation, wallet ledger or real financial transfers. Display authorized trip prices. Leave previous financial code/DB structures disabled and dependency-reviewed, not deleted.
- No merge to `main` or production deployment without explicit owner approval. Free-tier resources only.
- Every preview requires functional, bilingual/light/dark mobile layout review and inspected screenshots; CI alone does not grant visual acceptance.

## Phase execution (12 implementation phases + release acceptance)
| Phase | Task | Actual state and acceptance |
|---|---|---|
| 01 | Audit 73 screens, action inventory, gaps | Screen map and initial mock tests exist; **full control + visual acceptance pending**. |
| 02 | Supabase integration and RLS | Profiles, captain approvals, service areas, route/stops, reservation tables deployed; **complete backend coverage pending**. |
| 03 | Existing Google Auth validation | Connected and real Google accounts exist; **complete session/signup/logout/callback E2E pending**; preserve configuration. |
| 04 | Real Passenger/Captain profiles | Roles stored for existing 3 riders and 3 captains, admin allowlist for 3 accounts; **account editing and full role flows pending**. |
| 05 | Vehicles and trip management | Captain draft creation/publishing partially live; **vehicle lifecycle + complete trip states pending**. |
| 06 | Route search, matching, maps | Published-route read and stop matching partly live; **map integration and full matching pending**. |
| 07 | Seat booking / lifecycle | Atomic reserve RPC + pending cancellation deployed, retries keyed; **concurrency E2E, UI connection, lifecycle pending**. No OTP or payment dependency. |
| 08 | Passenger demand and captain offers | **Real persisted request/offer lifecycle pending**. |
| 09 | In-app notifications | **Real persistence and recipient/read-state pending**. |
| 10 | Admin real data + RBAC | Verified Google admin allowlist exists; **data modules, audit and role operation testing pending**. |
| 11 | Navigation, localization, theme and UI/UX | Early frontend coverage exists; **all-screen bilingual light/dark visual and control review pending**. |
| 12 | Security, full E2E, installable PWA and staging | CI for partial flows available; **complete journeys, concurrency, RLS, PWA installation and staging sign-off pending**. |

## Release acceptance — all required
- A signed-in Passenger can manage a real profile, browse/pick route, book seats with real durable `pending` booking, see status, cancel per approved rules and submit a trip request; no OTP/payments prompts.
- A signed-in approved Captain can manage profile/vehicle, publish permitted trip route, receive/respond to eligible requests, see reservations, manage permitted trip statuses without finance activation.
- An Admin's identity is verified through server-side authorization, with real dashboard data, enforceable controls and audit trail; no client-side admin-only enforcement.
- No double-seat reservation under parallel requests. RLS and cross-account isolation pass.
- User journeys have accurate Arabic/English text, automatic and manual appearance settings, no dead ends or misplaced errors; layout screenshots checked.
- PWA installs and staging preview passes mobile full E2E; owner approves before production promotion.

## Progress policy
An item is **complete only when its existing implementation has been verified**. Preserve completed assets and integrations; log new gaps with reproducible evidence. The initial implementation plan is not proof of release readiness.

## Owner correction applied
On 2026-11-15, removed the obsolete `v31_reserve_seats` server phone verification prerequisite and the client-side OTP booking guard; existing `v31_phone_verifications` table remains unused, not removed. Previous booking and financial schema were not deleted.
