# seKKa — UI/UX Design Quality Standard (Phase 2)

Status: **implementation guideline**, not independent visual acceptance. Applies to all future changes across rider, captain and admin. Canonical product authority remains `docs/PRD.md` v3.1 (73 public screens).

## Design principles
- World-class quality means legibility, predictable behavior, accessibility, consistency and truthful states, **not** extra animation or cosmetic decoration.
- Mobile-first hierarchy; preserve the **original Arabic app icon shape** (palette-only recolor), bundled Tajawal typography, and accessibility. Owner explicitly approved replacing black/yellow colors with the warm purple/coral/yellow palette on 2026-11-21. Screens 1–7 may be recolored as part of the renewed onboarding UX.
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
