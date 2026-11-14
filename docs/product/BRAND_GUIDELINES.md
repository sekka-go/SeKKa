# سِكّة / seKKa

Tagline: **معاك في السِكّة**. Reuse `web/public/brand/sekka-mark.png` unchanged; do not redraw official assets.

Brand tokens: yellow #FFC400, black #0B0B0D, charcoal #15191F, white #FFFFFF, gray #8D929B.
Dark: background #0B0B0D, secondary #101923, cards #1B2027, elevated #252B33, border #343B45.
Light: background #FAFAF8, secondary #F2F3F4, cards #FFFFFF, border #DDE0E4.
All active CSS colors in `web/src/v2/theme.css`. Mobile RTL, semantic labels, visible focus, 46px targets, no GPS attendance.
Fonts use installed Arabic font fallbacks; bundled Tajawal font licensing/asset delivery still needs review. No external Google Fonts dependency.

Voice: respectful concise Egyptian Arabic, practical warm man in his forties, supportive with captains. All primary new copy/errors in `web/src/v2/copy.ts`, screen labels in `screens.ts`; some field labels still colocated with forms and tracked as incomplete localization.
Examples: «حجزك اتسجل.» «ادفع للكابتن أول يوم.» «مستنيين تأكيد الكابتن.» «تأمينك متاح دلوقتي.»
Dark is the primary reference; light uses tokens, not separate screens. No fake payment success, fabricated supply or financial urgency.
