# UX audit — before redesign

Baseline reviewed from the current React routes and screen components on 2026-10-10. The app is Arabic/RTL-first with persisted Light / Dark / System theme selection. Screenshot baseline captured at 390×844 in dark, light, and system color-scheme modes for the landing screen. The login screen is captured in auto mode. The PNGs are stored under `docs/ux-screenshots/`. Authenticated screens require seeded rider/captain/admin sessions and backend data, so complete role-specific screenshots need those accounts.

## Current screen map

- Public: `/` landing → Start journey → `/login` or `/register` → authenticated workspace.
- Rider: Home → Search/new request (`/search`) → route, schedule, price, review → request; My Trips (`/trips`) → group detail and scheduled trips; Messages (`/messages`); Account (`/account`) → profile, verification, password/security, theme/language.
- Captain: Home/available lines (`/captain`) → inspect offer → accept; Publish (`/publish`) → route points, service days, seats/price → publish; My Trips (`/captain/trips`) → stop arrival, complete/report absence; Account (`/account`) → vehicle profile, verification and preferences; Messages (`/messages`).
- Admin: Overview (`/admin`) → analytics, pending captain review, operations/ledger summaries; Admin Control Panel tabs → Users, Documents, Trips, Disputes, Finance, Pricing, Audit log; Broadcast (`/broadcast`); Account (`/account`).
- Shared secondary navigation: support email, invite friends, terms, privacy, FAQ, language selector, profile shortcut, sign out; notifications drawer and message count.

## Screen inventory: actions, intent, issues

| Role / screen | Visible action groups and purpose | UX issues found before changes |
| --- | --- | --- |
| Public landing | Brand, language/theme controls, primary Start journey CTA, route illustration | Main CTA is clear; visual style partly mixes legacy palette values; controls vary in size and emphasis. |
| Sign in / register | Switch mode, role choice, form submit, password visibility, legal links | Role/action buttons and form controls use separate styling; native theme affordance is not consistent. |
| Rider home | Search a trip, register a request, find a trip, open requests/groups | Two equal-weight buttons in the welcome card perform the same navigation; duplicate “find/search” affordances compete; empty state has another primary CTA. |
| Rider new trip / search | Back/step controls, map selection, price info, category/package choices, next/review/submit | Many controls are visually buttons but serve selection/navigation; native checkbox controls exist; long flow can have multiple prominent actions. |
| Rider trips | Find/search action, group switcher, group detail actions, scheduled trip details | Main create/find action repeats on loading and loaded states; empty state needs one clear next action. |
| Rider messages | Search/filter conversations, open conversation, send message, attachment/refresh controls | Dense toolbar can give utility and send actions similar prominence; empty state should route to a next step. |
| Rider account | Profile/avatar edit, verification documents, password/security, appearance/theme, language | Multiple unrelated settings share one page; theme/language controls look different from the global button family. |
| Captain home / available lines | Update location, publish line, refresh offers and published lines, inspect/map/accept offer | Header has three competing actions; refresh and location are utilities with full button weight; first-use activation is separate from the available-lines flow. |
| Captain publish | Map open/close, route origin/destination, days, seats, vehicle/service options, price, publish | Native checkboxes and long form lack compact grouping; publish can scroll away; values/defaults need clearer labels. |
| Captain trips | Refresh list, open trip, mark stop reached, complete trip, report absence | Several actions may appear together; completing or reporting is consequential and needs confirmation/context. |
| Captain account/onboarding | Save vehicle data, update location, toggle AC/service tiers, adjust radius, save preferences, open verification | Checkbox rows are unstyled; repeated save/update actions share emphasis; role labels and raw values need centralized mapping. |
| Admin overview | Refresh metrics, approve/reject captain, expand operations/ledger summaries, open control panel | Multiple refresh buttons; verification decisions rely on browser prompts; counters display an em dash while unavailable; approve/reject are peer-weighted. |
| Admin users | Search, open verification documents, edit user/captain, change status, view details | Several large per-row actions create clutter; raw sensitive values are shown; statuses/roles need consistent labels. |
| Admin documents | Filter status, refresh, Telegram setup, preview, approve/reject | Toolbar is crowded; approve and reject controls vary; destructive review requires an explicit, consequence-aware confirmation. |
| Admin trips / disputes | Filter/search, inspect trip/dispute, resolve or change status | Need consistent tab hierarchy, secondary action weight and clear empty/error recovery. |
| Admin finance / pricing | Adjust ledger, edit pricing, save values | Inputs need unit labels and clearer compact grouping; raw decimal commission values can be unclear. |
| Admin audit log | Filter and inspect event details | Secondary filters need a consistent compact treatment and visible empty/loading/error states. |
| Broadcast | Title/body, character count, send to everyone | Global send is consequential and needs a clear preview/confirmation; button placement should stay distinct from ordinary actions. |

## Findings prioritized

1. Color values and older CSS declarations are duplicated across `styles.css`, `product-system.css`, `auth-layout.css`, and `theme.css`; some dark-only surface and text values leak into Light theme. The semantic tokens exist but are incomplete and overridden.
2. Buttons are styled by several overlapping class families (`button-primary`, `button-outline`, `button-quiet`, `button-dark`, raw Tailwind/admin utility classes, standalone nav/icon buttons). Secondary buttons can look disabled, while several controls compete as primaries.
3. Native checkboxes in booking and captain preferences do not consistently match the theme or provide a reliably large RTL tap target.
4. Navigation differs by role; captain lacks a dedicated Home item and riders see both “My Trips” and “New Ride” mixed into the primary order. Admin IA is a separate long overview with grouped tabs embedded below it.
5. Some internal values reach labels/details directly, error messages are not consistently actionable, and native `prompt()` is used for admin decisions/edits.

## Target IA

- Rider bottom navigation: Home, My Trips, Messages, Account. Home has one primary “New Ride” action; search existing lines and register a request remain available in that flow.
- Captain bottom navigation: Home, My Routes, My Trips, Messages, Account. Home emphasizes availability and nearby requests; one “Publish a line” primary action. Refresh/location stay icon utilities.
- Admin sections: Users, Documents, Trips, Complaints, Finance, Pricing, Audit log, with overview available as a compact landing/dashboard. Section switching is segmented/tabbed; support/legal/invite/logout stay in the drawer.
- Every screen/card has one main action; other actions use secondary, ghost, icon, or danger treatment. Empty/error states include a recovery action. Destructive or irreversible actions explain the consequence before confirmation.

## Verification boundary

No backend, auth, role authorization, or business rules are changed by this UX task. Authenticated screenshots and end-to-end role flows require seeded rider/captain/admin sessions; anonymous testing cannot establish those states.

## Implemented changes and verification

- Introduced shared semantic color tokens and common surfaces/controls for Light and Dark themes. Shared button states no longer lower disabled opacity, which was washing out labels. The mobile landing CTA now keeps its gold fill and dark text when shared button styles load later in the cascade.
- Added a persistent bottom navigation on narrow screens. Rider tabs are Home, My Trips, Messages and Account; the new-ride action remains within Home. Captain tabs are Home, My Routes, My Trips, Messages and Account. Home is the initial captain section, while “My Routes” opens publishing.
- Consolidated captain availability/location actions into compact icon controls, grouped service day/payment choices into consistent controls, added a seat stepper, and clarified the price field. Admin user row actions now sit in a menu with role/status filters, masked license tails, consistent labels and percent units.
- Updated map route colors and browser theme-color metadata to read active semantic theme tokens. Status labels in admin reuse the shared localized formatter.
- Checked the primary foreground and control token pairs against WCAG 2.1 AA: text/background contrast is 17.06:1 in Dark and 13.91:1 in Light; muted text/surface is 9.85:1 and 8.22:1; primary button text/fill is 9.42:1; borders/surfaces are 3.07:1 and 3.30:1 respectively. Text pairs exceed 4.5:1; borders exceed the 3:1 non-text threshold.
- Arabic and English locale files both contain 1,171 flattened keys with no missing counterparts.
- Captured after screenshots at 390×844 for dark, light, and system color-scheme modes under `docs/ux-screenshots/after-home-*.png`. The mobile CTA and route illustration were visually checked in Dark and Light.
- Verification passed: `pnpm lint`, `pnpm typecheck`, `pnpm test` (217 passed, 0 failed), and `pnpm build`.

## Remaining audit limits

- Authenticated role pages cannot be visually exercised without seeded rider, captain and admin sessions. Existing server tests cover service/API behavior, but no UI end-to-end test dependency is installed; no dependency was added for this audit.
- The repo still has legacy literal colors in older CSS bundles. Semantic tokens and shared high-specificity rules cover the audited shared controls and surfaces, and inline route/map colors now use tokens; a full CSS-by-CSS replacement should be handled screen-by-screen with authenticated visual coverage to avoid regressions.
- Admin destructive/edit actions still use existing browser confirmation/prompt behavior. Replacing that interaction needs a dedicated dialog flow and was kept out of this pass to avoid changing operational behavior.

