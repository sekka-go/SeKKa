# SeKKa UX and Navigation Audit

Date: 2026-10-30
Scope: current tracked React application routes and interactions. This records the implementation present in source; a route or screen shell is not evidence that its business operation is complete.

## Navigation changes in this pass

- Rider navigation now has the same five destinations on home, trip search, trip history, and rider journey screens: Home, Search, My requests, Conversations, More.
- The active destination is exposed with `aria-current="page"`; the gold marker remains the visual selected-state cue.
- Rider home quick actions are reduced to My requests, Subscriptions, and Support so they complement the primary trip search rather than repeat the bottom bar.
- The conversation shortcut now opens `/journey/conversations`, and the My requests shortcut resolves to `/my-trips` instead of the unimplemented `/requests` route.
- Journey-screen back controls return to the same-origin previous page when available and fall back to the relevant role home.
- Captain navigation keeps role-specific destinations: Home, Offers, Groups, Notifications, Profile. Related nested screens highlight their parent section.

## Route and destination map

| Area | Routes in `web/src/App.tsx` | Main destinations/actions | Data source in current screen code |
|---|---|---|---|
| Public/auth | `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/terms`, `/privacy`, `/admin/login` | Start/sign in/create account/recover password/legal pages | Supabase Auth for rider/captain; admin API for admin login |
| Rider core | `/home`, `/trips`, `/my-trips` | Search, inspect a trip, switch to requests/history | `profiles`, `ride_group_members`, `ride_groups`, `captain_lines`, `vehicle_types` |
| Rider journey | `/journey/{group,subscriptions,subscription,receipt,payment-method,proof,captain-confirmation,payment-code,payment-result,renewal,replacement-captain,conversations,conversation,notifications,ratings,complaint,complaint-status,profile}` | View memberships, conversations, notifications, profile and support states | Current screen queries include memberships, subscriptions, conversations/messages, notifications, ratings, complaints and profiles |
| Captain journey | `/captain/home`, `/captain/journey/{approval,documents,vehicle,offers,new-offer,edit-offer,rider-requests,rider-request,groups,group,riders,subscriptions,payments,payment,confirm-receipt,send-code,payment-status,renewal,replacement,conversations,notifications,ratings-reports,profile}` | Manage published offers, requests, groups, payment review, notices and profile | Current screen queries include captain profiles/documents, lines, join requests, groups/memberships, payment requests, notifications, conversations, ratings and complaints |
| Admin/shared | `/admin` and `/admin/{users,user,captains,documents,vehicles,offers,rider-requests,groups,group,subscriptions,payments,payment,disputes,complaints,ratings,notifications,commission,settings,reports,audit-log,admin-permissions,trip-operations,pool-overview,finance,pricing,campaigns,otp-settings,ledger}`; `/shared/{notifications,loading,error,empty,offline,confirm,access-denied,not-found}` | Operational console and shared system states | Deployed `sekka-api` endpoints where implemented; unavailable endpoints should remain explicit empty/unavailable states |

The PRD's screen inventory and implemented route inventory are not interchangeable: some routes render a shell while their writes or underlying backend operation remain unavailable. Confirm each screen against its behavior before marking it complete.

## Findings requiring follow-up

### P1 — service paths currently presented before they are actionable

- Rider payment method selection, transfer evidence submission, complaints, ratings, and several captain write actions currently display an unavailable/server-write notice or do not persist. Keep those controls explicitly disabled or state the limitation before the user enters data; do not imply success.
- `/requests` and `/requests/new` are still listed as legacy `HomeAction` destinations in `App.tsx`. Current home controls no longer use them, but remove or implement them before exposing those actions again.
- `/journey/conversation?id=...` currently displays the latest message but explicitly does not provide message sending. The UI should make this read-only state clear.

### P1 — role separation and backend consistency

- Rider screens use Supabase Auth and product tables directly; admin uses the deployed `sekka-api`. Verify the schema and RLS policies for every rider/captain table before enabling any write path. Never mirror a UI field into a new database field without a migration and authorization design.
- A role may access the other role's sign-in only through explicit role-aware routing; navigation must not infer a new role from the current UI.

### P2 — navigation and accessibility

- Rider and captain journey pages still expose a long horizontal list of every screen. Group these links by task (profile/onboarding, trips/groups, payments, communication/support) in a compact “More” index in a later pass; the bottom bar is now the stable primary navigation.
- Captain journey screens reuse the rider journey shell and symbol glyphs. Replace remaining text glyphs with the project's consistent SVG icon set and verify labels/contrast/touch targets on narrow devices.
- The home featured-card pagination dots are visual only. They should either be removed or become real, keyboard-accessible controls if the card becomes a carousel.
- Validate browser back behavior after direct links and refreshes on mobile browsers; this pass provides same-origin history navigation with a role-home fallback.

## Verification record

The package currently defines `typecheck` and `build`; it does not define `lint` or `test` scripts. Run available checks after implementation and report unavailable scripts as such rather than claiming they passed.
