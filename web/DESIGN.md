# seKKa v3.1 — current frontend design reference

**Authoritative product specification:** [PRD v3.1](../docs/PRD.md) (73 screens, eight stages). If a historical Stitch or old design file conflicts with the PRD, follow the PRD.

**Approved brand and tokens:** [Brand Guidelines](../docs/product/BRAND_GUIDELINES.md). Official yellow `#FFC400`, black `#0B0B0D`; current live variables are in `src/v2/theme.css`. Reuse the official assets in `public/brand/` unchanged, with Tajawal for Arabic.

**Active architecture:** `src/main.tsx` renders `src/v2/App.tsx`. Arabic is RTL, English LTR; theme and language each default to the device but support independent manual overrides. Never build from retired `src/App.tsx` or `src/screens/`.

**UX acceptance:**
- Every warning or empty state that requires an action must provide a nearby, direct recovery button (sign in, complete profile, retry, clear filter, return to search, or contact support).
- Preserve route, selected offer/stops and entered drafts when navigating to prerequisites and back.
- Every screen needs an easy primary action and predictable Back; no dead-end or decorative click targets.
- Check small-mobile Arabic and English, Light and Dark, with keyboard focus and meaningful accessible names.
- Booking, refundable EGP 100 security and captain confirmations are **frontend-only** previews until an explicitly approved live backend is connected.
- Do not claim full 73-screen visual approval just because screens render or tests pass.

**Current implementation:** `src/v2/`; [screen inventory](../docs/product/SCREEN_INVENTORY.md); [UX audit](../docs/UX_ACTIONABILITY_PROGRESS.md). Superseded green-theme and 74/78-screen documents have been removed from the active repository.
