# سِكَّة / Sekka Go — current visual system (22 November 2026)

## Names
Installed PWA name: **Sekka Go**. In-app Arabic wordmark: **سِكَّة**
(exact diacritics). English in-app brand: **seKKa**.
Slogan: «معاك في السِكَّة».

## Urban Mobility — current palette (22 November 2026)
The sea-like aqua/cyan gradients are superseded by an urban transport identity.
Use deep/navy structure, electric blue navigation, neutral ivory canvas and
yellow for essential actions. No ocean waves as decorative background.

| Semantic role | Hex | Usage |
|---|---|---|
| Mobility blue | `#1753E8` | Brand blue, selection, road graphics |
| Urban navy | `#17253A` | Header anchor, dark text, chrome |
| Warm ivory | `#F5F3ED` | Main light canvas |
| Action yellow | `#FFD02A` | Important CTA with dark ink |
| White | `#FFFFFF` | Cards and high-contrast text on blue |
| Dark canvas | `#101827` | Dark mode |
| Dark raised | `#1B2638` | Dark card surfaces |
| Dark readable blue | `#8BA8FF` | Selected navigation in dark mode |

Production CSS: `web/src/v2/urban-mobility-palette.css` loaded last.
Existing style layers remain temporarily for compatibility. The new tokens
override legacy sky/aqua values without changing gallery screen layout.
Splash retains the approved SUV and timing but removes sea-wave decoration.

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
