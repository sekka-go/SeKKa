# SeKKa screen map

This map is derived from `web/src/App.tsx`, `web/src/screens/Workspace.tsx`, `web/src/types.ts`, and the role workspace components. It describes the current implementation; it does not assert that every workflow is complete.

## Public and authentication routes

| Route / screen | Audience | Purpose and implemented states | Main destinations | Status |
|---|---|---|---|---|
| `/` | Signed out; role-specific home when signed in | Welcome/landing when signed out; signed-in home is routed to the rider, captain, or admin workspace | Login, registration, role workspace | Implemented |
| `/login` | Rider, captain, admin | Sign in and restore session; pending route setup and verification screens | Home for the authenticated role | Implemented; verify recovery paths against deployment configuration |
| `/register` | Rider or captain | Signup, fixed role selection, signup consent/verification | Role workspace after confirmation | Implemented |
| `/terms`, `/privacy` | Public and signed-in users | Legal information pages | Landing or prior workspace | Implemented; legal readiness remains a product/legal approval |
| FAQ | All roles | In-app information page opened from navigation | Current workspace | Implemented as an in-app page, not a direct route |

## Shared authenticated screens

| Route | Audience | Purpose and implemented states | Main destinations | Status |
|---|---|---|---|---|
| `/account` | All roles | Role-specific profile/account details and saved rider places where applicable | Settings and role workspace | Implemented; rider and captain account panels differ |
| `/settings` | All roles | Language, theme, notification preferences | Any workspace | Implemented |
| `/notifications` | All roles | Notification feed and unread state | Source screen via return state | Implemented |
| `/messages` | Rider and captain | In-app conversations and inbox states | Conversation details | Implemented; contacts stay in app |

## Rider screens

| Route | Screen / flow | Purpose and implemented states | Main destinations | Status |
|---|---|---|---|---|
| `/` | Rider home | Saved places, suggested published lines, discovery/promotional cards, empty/error states | `/search`, `/trips`, `/requests`, `/account` | Implemented |
| `/search` | Find a ride | Search inputs, dates/times, vehicle/price, no-results demand creation, review and submit | `/trips`, `/requests`, home | Implemented; legacy pool-group behavior still coexists |
| `/trips` | Available and scheduled trips | Published captain line discovery, trip details, request action; existing scheduled group history | `/requests`, home | Implemented; selected-line request now has a separate persisted request API, but not yet a recurring subscription/trip instance |
| `/requests` | My requests | Unmet rider demand requests and selected-line join requests are presented as distinct types | `/search`, `/trips` | Implemented; cancellation and conversion into a recurring subscription remain incomplete |
| `/account` | Rider account | Profile, saved places, account information | `/settings` | Implemented |

## Captain screens

| Route | Screen / flow | Purpose and implemented states | Main destinations | Status |
|---|---|---|---|---|
| `/captain` | Captain workspace | Published lines, line controls, grouped/legacy demand summary, operational overview | `/publish`, `/captain/requests`, `/captain/trips` | Implemented; legacy grouped demand data remains visible for compatibility |
| `/publish` | Create/edit line | Origin, destination, intermediate stops, service days/time, capacity, captain-defined price, payment methods | `/captain` | Implemented |
| `/captain/requests` | Incoming requests | Existing pool offers plus rider-selected published-line requests; captain can accept/reject line requests | `/captain/trips`, `/captain` | Implemented; accepted line requests are not yet represented as recurring trip subscriptions |
| `/captain/trips` | Assigned trips | Stop order, arrival, completion, absence/report actions | `/captain/earnings` | Implemented for the existing pool-trip model |
| `/captain/earnings` | Earnings and payment confirmation | Completed trip records and captain confirmation of actually received amount | `/captain/trips` | Implemented for existing trip/payment records |
| `/account` | Captain account | Vehicle information and verification state | `/settings`, `/publish` | Implemented |

## Admin screens

| Route | Screen | Purpose and implemented states | Status |
|---|---|---|---|
| `/admin` | Overview | Operational metrics and summaries | Implemented |
| `/admin/users`, `/admin/users/:id` | User management | User list and user details/actions | Implemented; only server-authorized actions may be used |
| `/admin/documents` | Captain review | Document and verification review | Implemented |
| `/admin/trips` | Trip monitoring | Trip records and operational review | Implemented |
| `/admin/complaints` | Complaints | Complaint/dispute review | Implemented |
| `/admin/finance` | Finance | Payment/ledger overview | Implemented; platform commission remains 0% in MVP |
| `/admin/finance/adjustment` | Finance adjustment | Explicit review of disputed-payment actions | Implemented with server-side role checks |
| `/admin/pricing` | Pricing | Vehicle pricing configuration | Implemented |
| `/admin/audit` | Audit trail | Administrative and lifecycle records | Implemented |
| `/broadcast` | Broadcast | Admin notifications/messages | Implemented |

## Cross-cutting transient screens and states

- Navigation drawer, mobile tabs, notification panel, push permission prompt, verification reminder/center, account deletion and other dialogs are rendered by the shared workspace/components rather than exposed as distinct URL routes.
- Route chunk loading, startup splash, auth verification, errors, empty states, and user-action confirmations are implemented at screen/component level.
- The `NavKey` union has 23 authenticated sections. `Workspace.tsx` is the source for role guards and the URL-to-section map.

## Known workflow gaps

- The persisted line-join request is for one selected service date. It is not yet a monthly/weekly subscription, does not create a `trips` occurrence, and is not yet connected to the full payment lifecycle.
- The project still contains the older group/pool model alongside published captain lines. New unmet-demand requests remain distinct from a rider's selected-line join request, but the older captain pool offer path is still present.
- Production migration, Edge Function deployment, browser QA, and visual RTL checks require a separate authorized release process. No production resource was changed for this implementation.
