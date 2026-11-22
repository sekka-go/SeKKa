# seKKa — UI/UX Design Quality Standard (Phase 2)

Status: **implementation guideline**, not independent visual acceptance. Applies to all future changes across rider, captain and admin. For the new brand and recurring UX, the 2026-11-21 owner vNext amendment takes precedence over incompatible v3.1 UI instructions; unamended financial/product rules remain in v3.1.

## Design principles
- World-class quality means legibility, predictable behavior, accessibility, consistency and truthful states, **not** extra animation or cosmetic decoration.
- Mobile-first hierarchy; use the **blue seKKa/white lettering/yellow road icon** for installed PWA and favicon, the approved sky-blue Splash, bundled Tajawal typography, and accessibility. The updated 2026-11-22 sky-blue/cyan/white/yellow direction supersedes the previous purple/coral UI palette; keep the original road-mark geometry.
- Consistent spacing scale: 4 / 8 / **12** / 16 / 24 / 32 px. Separate adjacent independent interactive buttons by **at least 12px** wherever presented as a group; prefer a two-column grid for rider-home shortcuts at mobile widths.
- Minimum interactive target: **44 × 44 CSS px**, with a visible focus state; never communicate selection by color alone. Wrap long English and Arabic labels rather than letting them overlap.
- Prefer logical CSS properties (`inline-start`, `inline-end`) and verify RTL/LTR. Dates, currency, time, empty and validation copy must be localized in the rendered screen, not merely present in a catalog.
- Clearly distinguish loading, success, failure, disabled, no-data and prerequisites with direct recovery actions. Preserve entered data through retries and back navigation.
- Use subtle hover/press/focus treatment only where appropriate; no hover-dependent functionality. Honor `prefers-reduced-motion`.
- Maintain readable contrast and keyboard navigation; independently test with assistive tech before signoff.
- Never make a preview OTP, payment, wallet or booking look like a real completed external operation.

## Acceptance matrix
For each of 73 screens, review Arabic/English × Light/Dark × 320/390/768px (desktop where relevant); check content overflow, touch gaps, focus order, forms, interactive states, error recovery, Back, data retention and accessibility. Attach actual screenshots, issue identifiers and per-screen evidence. Automated smoke passing is not a visual approval.

## Implementation handoff
- Rider-home shortcut gap fixed and regression-tested on the review branch.
- Rider offer/card affordances and compact layout refined.
- Captain onboarding, route wizard and operations spacing/focus refined.
- Admin shared surfaces, action spacing, selected navigation and compact responsive controls refined.
- Independent screenshots, genuine device acceptance and complete all-screen QA are still required.

Do not merge to `main` or deploy production without owner approval.
