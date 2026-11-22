# سِكَّة / Sekka Go — current visual system (22 November 2026)

## Names
Installed PWA name: **Sekka Go**. In-app Arabic wordmark: **سِكَّة**
(exact diacritics). English in-app brand: **seKKa**.
Slogan: «معاك في السِكَّة».

## Palette and tokens
The current owner direction is sky blue / cyan / white / bright yellow.
Older purple/coral descriptions were historical and must not control the
production UI.

| Semantic role | Color | Use |
|---|---|---|
| Electric blue | `#078CF4` | Logo artwork, accents and navigation |
| Cyan | `#20D8E6` | Waves and decorative illustrations |
| Sunny yellow | `#FFCC24` | Contextual actions, selected state |
| Dark ink | `#10344F` | On yellow, white and ice surfaces |
| Light paper | `#F4FBFF` | Light page |
| Light raised | `#FFFFFF` | Cards and popovers |
| Dark canvas | `#102A3C` | Dark page |
| Dark raised | `#19384E` | Dark cards |
| Text-safe blue | `#075687` | White-text headers and primary surfaces |

Source-controlled semantic fixes: `web/src/v2/ui-quality-hardening.css`.
The earlier stylesheets remain temporarily for integration compatibility
until screenshot QA allows deleting redundant rules.

## Installed app icon — S monogram
The app icon installed on the phone is the standalone Latin **S** symbol:
a continuous white roadway ribbon over a sky-blue/cyan rounded square.
It contains **no wordmark** or Arabic logotype and does not change the
in-app «سِكَّة» identity or the existing animated Splash.

- `web/public/brand/sekka-s-icon.svg`
- `web/public/brand/sekka-s-icon-192.png`
- `web/public/brand/sekka-s-icon-512.png`

The manifest, browser favicon, and Apple touch icon use the same S family.
Previous seKKa-road install icons are historical assets only.

## Typography and accessibility
Arabic: locally bundled Tajawal. Use title 800–900, section 700–800,
body 400–500, control 700–800. Bottom-navigation labels ≥12 CSS px;
primary touch targets ≥44×44 CSS px. Text contrast ≥4.5:1, large text
and UI boundaries ≥3:1; clear focus indicator; RTL and LTR; reduced
motion; safe-area-aware layout.

## Truthful interface states
Do not fabricate available trips, fees, map distances, pickup stops,
periods, payment success or OTP. Weekday selection is a saved
preference, not a verified server filter or trip-request field yet.
A ride request requires valid server-supported departure/return times.
Preserve current Supabase RLS and approved server-owned booking flows.

This is implementation guidance on Draft PR #185, not Production approval.
