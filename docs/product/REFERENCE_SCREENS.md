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
