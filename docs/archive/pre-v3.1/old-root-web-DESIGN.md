# SeKKa Mobile Design System

Use this file as the visual and product-flow source of truth when continuing SeKKa in Google Stitch. Treat the attached SeKKa mobile contact sheet as a visual reference for hierarchy and flow, not as an asset to copy. Keep the existing SeKKa logo exactly unchanged.

## Product

SeKKa (سِكّة) is a bilingual Arabic/English ride coordination PWA for passengers and captains. Design mobile-first screens for both roles, RTL for Arabic and LTR for English. Preserve the product distinction between captain-published trips and passenger-created ride requests.

## Visual direction

- Calm, clear, polished transport app; light screens use a cool near-white background and white cards.
- Primary brand color is emerald green. Use deep evergreen for emphasis and dark-mode surfaces.
- Use dark navy-teal text, muted blue-gray supporting text, pale mint selection surfaces, and fine blue-gray borders.
- Use rounded cards and controls with restrained shadows. Keep the screen dense enough for practical trip details without crowding.
- Use Tajawal for Arabic and a clean system sans-serif for English. Respect the existing wordmark and icon mark without redrawing them.
- Use clear semantic status colors: green success, amber pending, red cancelled/error, blue informational.
- Maintain readable contrast, visible keyboard focus and touch targets of at least 44px.

## Tokens

### Light

| Token | Value |
| --- | --- |
| Background | `#F6F8FC` |
| Surface | `#FFFFFF` |
| Raised surface | `#EEF6F2` |
| Border | `#D3DEEB` |
| Primary text | `#102A3C` |
| Secondary text | `#50677B` |
| Muted text | `#657C90` |
| Primary action | `#008765` |
| Primary action text | `#FFFFFF` |
| Selected surface | `#CEF7E4` |

### Dark

| Token | Value |
| --- | --- |
| Background | `#0B2427` |
| Surface | `#103438` |
| Raised surface | `#164347` |
| Border | `#315B5D` |
| Primary text | `#F3FBF8` |
| Secondary text | `#BAD1CC` |
| Primary action | `#19B783` |
| Selected surface | `rgb(25 183 131 / 18%)` |

Use 16px page gutters on phones, 16px card radius, 12–14px control radius, 8px spacing increments, and subtle shadows. Bottom navigation stays fixed above the safe-area inset.

## Core screens and user journeys

1. **Splash / welcome** — preserve the current logo; show one clear entry action and a secondary account-creation action over a dark evergreen image/hero.
2. **Sign in / create account** — light, uncluttered form, role selection where applicable, clear labels, visible password control, one dominant emerald CTA.
3. **Passenger home** — greeting, current location and favorite places, prominent “Find a ride” action, then relevant suggested captain-published trips and alerts.
4. **Available trips** — search by pickup and destination; when destination is omitted, show captain trips near the passenger’s current location. Present trips as comparable cards with route, captain, departure, available seats and captain-set price.
5. **Trip details / join** — show route map, ordered stops, captain and vehicle, schedule, price and seats; passenger reviews details and explicitly requests to join. Do not automatically select a captain.
6. **My trips** — separate trips the passenger joined from requests the passenger created. Show status, route, date and next available action.
7. **Create ride request** — used when no suitable published trip exists. Confirm pickup, destination and schedule, then show a clear confirmation and explain that matching trips appear as suggestions/notifications for passenger choice.
8. **Captain home** — summary of published trips, matching passenger requests and upcoming trips; actions lead directly to their respective lists.
9. **Publish trip** — origin and destination first, optional ordered intermediate stops, schedule, seats, captain-entered price and final review. Keep “add stop” visibly repeatable.
10. **Captain trip management** — published line cards with schedule, seats and price; permit edit/cancel only while no passenger has joined, then show trip details and passenger states.
11. **Messages, notifications, earnings, profile, settings and admin** — reuse the same card, navigation, form, status and table language; keep each area’s primary task obvious.

## Interaction and content rules

- Use a fixed mobile bottom navigation with concise labels and one visibly selected destination.
- Prefer one primary action per screen and one secondary action. Keep confirmation before consequential joins, cancellations or publishing.
- Keep forms in short, focused steps with progress and a review screen; preserve entered values when navigating back.
- Use inline validation next to the relevant field, and informative empty states with a context-specific next action.
- Reuse the app’s existing Arabic and English translations; do not hard-code one language or mirror Arabic layouts by manually reversing text.
- A captain’s published trip is an offer. A passenger’s created request is a request. Never merge these into one list or imply that a request is already a trip.
- Payment is settled directly between passenger and captain; the captain confirms actual receipt. MVP platform commission is 0%.
- Keep screen content responsive at 354px width and up; avoid horizontal overflow and ensure sticky actions do not cover form fields.

## Stitch iteration workflow

Start from the supplied mobile reference image plus this document. Generate a small connected prototype for passenger search → trip details → join request and captain publish → manage trip. Compare the output against the current SeKKa PWA, then bring approved screens or exported code back into the existing React components and CSS tokens. Keep backend behavior, authentication and the existing logo unchanged unless separately requested.
