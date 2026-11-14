> Historical reference. Superseded wherever it conflicts with `docs/PRD.md` v3.1. Not an active product specification.

# Phase one — approved seven paired references

Owner supplied 7 full screen images, each containing dark (left) and light (right), 12 November 2026. These supersede earlier framed mockups and the initial generic onboarding. Scope is PHASE ONE ONLY. Do not start phase two without its reference batch.

| Phase screen | Paired source | Visual role | Live service status |
|---|---|---|---|
| 01 | references/phase-1/01.png | Splash and tagline | Click to continue; gallery inspection can freeze auto advance |
| 02 | references/phase-1/02.png | Welcome / benefits / CTA | Navigation only |
| 03 | references/phase-1/03.png | Rider / captain cards | Local role choice; next goes to phone preview |
| 04 | references/phase-1/04.png | Phone entry | SMS sending disabled |
| 05 | references/phase-1/05.png | Four OTP boxes / resend | Verification and resend disabled |
| 06 | references/phase-1/06.png | Verification-success illustration | Explicitly labeled design preview; never sets verified state |
| 07 | references/phase-1/07.png | Account form / password / Google / Facebook | Account creation and OAuth disabled |

## Explicit owner decision

The owner selected **implement the appearance and leave authentication integration pending** when asked about conflicts between image 7 (password/Google/Facebook) and the OTP-only PRD. Therefore these fields/buttons are visual previews. This does not approve a change to authentication architecture or enable providers. No credentials are submitted or persisted. OTP length and the timer are visual reference states, not assertions about a configured provider.

## Implementation

Original PNG files are stored byte-for-byte. `ReferenceArt` uses CSS viewports to reuse supplied logos, isolated character/vehicle art, phone illustrations and road decorations without generating replacement artwork. Headings, buttons, fields, role selection, OTP inputs and password visibility are actual semantic components. Entire reference screens are never overlaid as clickable screenshots.

Dark/light use a common canvas and the corresponding side of each source for artwork. The canonical reference is 768×1024 per theme; the canvas scales proportionally to fit mobile and desktop. The review toolbar and service-status note live outside the canvas. No phone bezel or fake OS status bar is embedded. A theme toggle and 01–07 gallery allow review on a real mobile device.

Arabic Tajawal is self-hosted at pinned versions and 400/500/700/800/900 weights. Fine illustration extraction is limited to available raster resolution; a transparent/vector export would improve reuse. Typography and screen rendering are code-based, so no pixel-exact claim is made before visual acceptance.

## Checks

Type checking, lint and production build. Browser suite captures all 14 screen/theme combinations, checks role selection in both themes, phone/OTP editing, password reveal, disabled auth actions, absence of auth network requests and horizontal overflow. Build/CI evidence must be recorded after the actual run.

This update does not apply hosted database migrations, change production, claim successful identity verification, or implement phase two.

## Phase two — supplied batch and corrected 11/12

Owner started phase two, paused it for corrected references 11/12, then supplied 1000636594.png (11) and 1000636595.png (12). Older 11/12 designs are superseded.

| Screen | Function | Repository reference |
|---|---|---|
| 08 / 09 | Journey planner, area search and times | phase-2/08.png |
| 10 | Four-category and duration filters | phase-2/10.png |
| 11 | Captain-defined subscription offers | phase-2/11.png (corrected) |
| 12 | Fixed offer details; no duration/direction picker | phase-2/12.png (corrected) |
| 13 | Confirmed booking, captain and vehicle illustration | phase-2/13.png |
| 14 | Favorites | phase-2/14.png |
| 29 | Current/previous subscriptions | phase-2/29.png |
| 15 | Request a route | phase-2/15.png |

`?preview=phase2` explicitly enables isolated example data. Gallery labels state that names, prices and bookings are illustrative. Preview booking buttons explain that no booking is created. Preview requests never transmit. Outside preview, search uses configured V2 service data with empty/error/loading states; example routes and confirmed bookings are not injected. Authentication integration remains held.

### Resolved discrepancies

- Corrected 11 shows PRIME with four available seats; capacity is three. Sample availability is three.
- Corrected 12 shows SAVER with five seats; capacity is four. Selection supplies consistent category/availability within the approved limits.
- Offer price, direction and duration are read-only. Filters only choose which offers appear. Examples use corrected 11 prices EGP 2,800 / 850 / 3,400. Actual rendered offer count is displayed instead of screenshot's unexplained eight.
- Return-only examples omit outbound time; outbound-only omit return time, displaying a dash.
- Example offer cards show captain display names/ratings as in updated reference. Contact and vehicle identity remain confined to explicitly labelled confirmed-booking preview, not public live details.
- Supplied subscriptions view is canonical screen 29, included because owner supplied it; registry is not renumbered.
- All four categories are available in filters. Request form has no preferred-category selector or extra note. Feature claims from superseded view 12 are removed.

Hosted fixed-offer schema acceptance and phase-three booking remain pending. Existing API price configurations render as distinct offer rows; this does not certify hosted migration. Live booking is held pending that flow. No production cutover or database migration occurred.

## Phase three — approved functional map, shared visual system

Owner approved screens 16–22 and authorized extending the established button/card/icon/theme style without supplying each mockup. BookingFlow shares the existing wordmark, tokens and SVG icon language, adds code-native wallet/phone/confirmation illustrations, and uses reusable offer/snapshot/price/timeline components. No image was invented as an official brand logo.

Explicit `?preview=phase3` is an isolated demonstration. Its deterministic November 2026 quote reuses the domain calendar/proration function with a clearly labelled **unapproved example calendar without holiday exclusions**. It is never passed as a real quote, used for a booking request, or offered as approved Egyptian holiday coverage. Example monthly EGP 2,800 gives 12/22 eligible days = EGP 1,527; 22 is this example's counted result, not a monthly cap. Weekly and one-direction offers carry their own immutable terms. Offer ID preserves example selection across refresh.

Demo actions are labelled as previews; sample confirmation never creates a seat reservation, wallet credit/debit or real payment declaration. Balance/receipt scenarios live outside the product canvas. Real top-up and reservation remain disabled, with provider/policy blockers explained. Cancellation and renewal open honest unavailability explanations without mutation. Actual authenticated quote/read, rider declaration and dispute adapters use existing server endpoints; they have not been certified against a hosted migrated database. Guest views cannot show a real confirmation or personal booking data.
