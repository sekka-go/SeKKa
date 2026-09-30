---
name: Urban Transit Modern
colors:
  surface: '#fbf8ff'
  surface-dim: '#dad9e3'
  surface-bright: '#fbf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f2fd'
  surface-container: '#eeedf7'
  surface-container-high: '#e8e7f1'
  surface-container-highest: '#e3e1ec'
  on-surface: '#1a1b22'
  on-surface-variant: '#4d4632'
  inverse-surface: '#2f3038'
  inverse-on-surface: '#f1effa'
  outline: '#7f7660'
  outline-variant: '#d1c6ab'
  surface-tint: '#725c00'
  primary: '#725c00'
  on-primary: '#ffffff'
  primary-container: '#ffd21f'
  on-primary-container: '#705b00'
  inverse-primary: '#edc200'
  secondary: '#5f5e60'
  on-secondary: '#ffffff'
  secondary-container: '#e2dfe1'
  on-secondary-container: '#636264'
  tertiary: '#006c49'
  on-tertiary: '#ffffff'
  tertiary-container: '#61efb2'
  on-tertiary-container: '#006a48'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffe080'
  primary-fixed-dim: '#edc200'
  on-primary-fixed: '#231b00'
  on-primary-fixed-variant: '#564500'
  secondary-fixed: '#e4e2e4'
  secondary-fixed-dim: '#c8c6c8'
  on-secondary-fixed: '#1b1b1d'
  on-secondary-fixed-variant: '#474649'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#fbf8ff'
  on-background: '#1a1b22'
  surface-variant: '#e3e1ec'
typography:
  headline-xl:
    fontFamily: Tajawal
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Tajawal
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Tajawal
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
  headline-sm:
    fontFamily: Tajawal
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 22px
  body-lg:
    fontFamily: Tajawal
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Tajawal
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Tajawal
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Tajawal
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 18px
  label-md:
    fontFamily: Tajawal
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
  label-sm:
    fontFamily: Tajawal
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
  metric-display:
    fontFamily: Tajawal
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 38px
    letterSpacing: -0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.875rem
  space-lg: 1.25rem
  space-xl: 1.75rem
---

## Brand & Style
The design system powers an executive daily commute platform engineered specifically for Egypt's metropolitan professionals across Greater Cairo and Alexandria. It positions daily collective transit not as dynamic ride-hailing (taxi) or informal carpooling, but as scheduled, high-efficiency urban transit arteries. 

### Brand Personality & Emotional Vector
- **Disciplined Precision:** Punctual, structured, and strictly schedule-driven. Replaces commute anxiety with predictable operational rhythm.
- **Modern Egyptian Pragmatism:** Confident, executive, and direct. The interface embodies the principle "قل أقل، ووضّح أكثر" (Say less, clarify more), stripping decorative clutter in favor of legible commute metrics.
- **Accessible Premium:** Elevates collective mass transit into a dignified, comfortable, and reliable professional routine without feeling unapproachable.

### Visual Style
A tailored modern transit framework utilizing crisp high-contrast surfaces, architectural card layouts, clear RTL flow, and intentional focal points. Visual hierarchy relies on dense informational modules, legible route chronologies, and precise status tokens.

## Colors
The color architecture relies on high contrast and functional economy. The signature brand yellow is reserved strictly as an active operational signal and primary action trigger, preventing visual fatigue.

### Primary Palette & Roles
- **Brand Signal Yellow (`#FFD21F`):** Used exclusively for high-priority primary actions (Confirm Route, Book Daily Pass), live operational markers (bus approaching, on-time pulse), and active selected states. Paired with Charcoal `#1D1D1F` text for contrast compliance.
- **Brand Charcoal (`#1D1D1F`):** Anchors typographic hierarchy, high-contrast dark frames, top app-bar containers, and bottom navigation sheets.
- **Pristine White (`#FFFFFF`):** Dominant surface canvas for cards, meeting point sheets, and scheduling modules.
- **Functional Green (`#10B981`):** Operational certainty (On-Time, Seat Reserved, Confirmed Departure).

### Neutral Foundations & Borders
- **Canvas Base:** `#F8F9FA` for overall screen background, separating white card surfaces.
- **Surface Muted:** `#F3F4F6` for input fills, inactive badge containers, and timeline node backings.
- **Structural Borders:** `#E5E7EB` for hairline dividers (1px) between transit steps and ticket perimeters.
- **Text De-emphasis:** `#71717A` for metadata, timeline arrival timestamps, and secondary Egyptian address coordinates.

### Transit Category Palette
- **Saver (الموفر):** Neutral Slate (`#4B5563` text, `#F3F4F6` surface) - standard stop-by-stop transit.
- **Faster (السريع):** Cobalt Express (`#2563EB` text, `#EFF6FF` surface) - highway bypass routes.
- **Plus (بلس):** Emerald Comfort (`#059669` text, `#ECFDF5` surface) - guaranteed wide seating, charging ports.
- **Elite (إيليت):** Deep Charcoal / Gold Line (`#1D1D1F` background, `#FFD21F` border accent) - executive direct sprinter.

## Typography
Built natively for Arabic RTL reading flow via **Tajawal**, optimizing geometry for dense mobile viewports (390px base).

### Typographic Rhythm & Metrics
- Numbers, timing schedules (e.g. `07:45 ص`), and pricing (`EGP 45`) maintain tabular alignment to streamline route comparison.
- Arabic line-heights are calibrated roomier than Latin counterparts (minimum 1.35x–1.45x ratio) to avoid diacritic clipping and maintain clear scanability in dense schedules.
- `metric-display` is dedicated to departure countdowns ("8 دقائق") and live boarding gate/seat numbers.

## Layout & Spacing
A 4-column fluid mobile grid anchored to a standard 390px viewport width with 16px (`1rem`) outer safe margins and 12px (`0.75rem`) internal column gutters.

### Rhythm & Alignment
- **RTL Baseline:** All alignments, chevron directions, and horizontal progression vectors read right-to-left. Timeline nodes begin on the right margin, leading into transit stop descriptions.
- **Vertical Stacking:** Information-dense card blocks use an 8-point vertical baseline. Micro-spacing within route milestones (time, station pin, walking distance) adheres to `space-xs` (4px) and `space-sm` (8px).
- **Persistent Bottom Anchor:** Primary CTA containers stick to the mobile viewport base with 16px bottom padding, elevated above system navigation bars with safe-area insets.

## Elevation & Depth
Visual separation avoids heavy, generic drop shadows in favor of low-contrast hairline borders, solid structural containment, and subtle diffused ambient occlusion.

### Surface Tiers
- **Tier 0 (Backdrop):** Screen ground `#F8F9FA`. Completely flat.
- **Tier 1 (Cards & Modules):** Pure White `#FFFFFF` with a 1px solid border in `#E5E7EB`. Flat, sharp, and structural.
- **Tier 2 (Floating Action Panels & Bottom Sheets):** `#FFFFFF` paired with an ultra-diffused upward ambient elevation: `box-shadow: 0 -4px 24px rgba(29, 29, 31, 0.06), 0 -1px 2px rgba(29, 29, 31, 0.04)`.
- **Tier 3 (Active Route Banners & Alert Modals):** High-contrast Brand Charcoal `#1D1D1F` panels with an ambient depth of `box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.12)`.

## Shapes
A balanced modern rounding architecture using `0.5rem` (8px) for modular stability, expanding to `1rem` (16px) on primary card enclosures to balance clean executive posture with physical touch ergonomics.

### Element Curvature Rules
- **Interactive Buttons & Form Fields:** 12px border radius.
- **Route Cards & Commute Pass Containers:** 16px border radius (`rounded-lg`).
- **Category Chips, Status Pills, and Badges:** Fully circular pill shapes (`rounded-full` / 9999px) to clearly differentiate meta-labels from structural cards.
- **Timeline Station Nodes:** Pure 10px circles with 2px borders, connected by 2px vertical solid or dotted transit lines.

## Components

### Buttons & CTA Hierarchy
- **Primary CTA:** Brand Signal Yellow (`#FFD21F`) fill, Brand Charcoal (`#1D1D1F`) text, font weight 700 (`label-lg`), height 52px, corner radius 12px. Pressed state dims slightly to `#E5BD1B`.
- **Secondary CTA:** Charcoal fill (`#1D1D1F`), White text (`#FFFFFF`), height 52px. Used for ticket validation and QR presentation.
- **Outline / Ghost:** Transparent fill, 1px solid `#E5E7EB` border, Charcoal text. Used for secondary actions (e.g., "تعديل الموعد").

### Commute Cards & Recurrent Passes
- **Commute Ticket Card:** White container, 16px radius, 1px `#E5E7EB` border. Divided into two zones: top operational segment (meeting point station, time, line code) and bottom metadata segment (vehicle standard, seat count, category badge) separated by a 1px dashed divider.
- **Recurrent Booking Matrix:** Weekly day selector (السبت إلى الخميس) represented by rounded square toggle cells (40x44px). Active selected days use Charcoal `#1D1D1F` background with White text and a 2px `#FFD21F` bottom indicator line.

### Category Chips & Badges
- **Pill Shape:** Height 28px, horizontal padding 12px, font size 12px (`label-md`).
- **Active State:** Tinted category background paired with high-contrast text.
- **Elite Badge:** `#1D1D1F` background with `#FFD21F` typography and micro-crown glyph.

### Meeting Point & Route Milestones
- **Timeline List Item:** Right-aligned milestone indicator. Green dot for pickup, Brand Charcoal square for terminal drop-off.
- **Walking Proximity Tag:** Light gray pill (`#F3F4F6`) with walking icon and minute distance ("3 دقائق مشي من موقعك").

### Input Fields & Search Bars
- **Meeting Point Search Input:** Height 48px, background `#F3F4F6`, border 1px transparent, focus border 1.5px `#1D1D1F`. Placeholder text `#71717A` with explicit right-side search glyph.

### Status Indicators
- **Live Tracking Pulse:** 8px glowing green circle (`#10B981`) paired with `"على المسار"` label.
- **Boarding Countdown:** High-contrast Charcoal bar displaying real-time departure metrics in yellow text.