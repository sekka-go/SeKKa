# seKKa — Independent 73-screen visual audit evidence (PR #185)

**Purpose:** collect browser evidence only. **Do not redesign, fix, or mark any visual issue resolved.**

## Sources and limitations

- **Approved baseline:** `/dev/screens?screen=1..73` on the Cloudflare Staging Preview selected for the exact workflow source SHA, with the original gallery's phase-preview state. This preserves the approved 73-screen component gallery, but preview names, routes and transactions are illustrative. The original owner-supplied raster references only cover part of the inventory; the gallery capture is not a claim of raw source-PNG pixel equivalence.
- **Integrated comparison:** the **same deployed frontend build** at the real `/?tab=...` public application paths. A new anonymous browser context is created for every viewport/language/theme variant. No fake tokens, mocked booking records, Google account impersonation or data mutations.
- **Commit provenance:** the workflow resolves the successful `Cloudflare Pages: sekka-staging-web` check for its exact source SHA. Before capture, the collector reads `/build-info.json` from that preview and fails if the deployed SHA differs, is missing, or the request redirects. Every screenshot pair records the source SHA, deployed SHA, preview URL, viewport, language, theme, screen ID, capture time, and comparability state. Historical artifacts from the former pinned-URL workflow are not current-HEAD evidence.
- **Device combinations:** 360×800 and 390×844; Arabic/English; Light/Dark, 8 variants per screen = **584 numbered comparison pairs** when collection completes.

## How to review the evidence

Open the **seKKa 73-screen visual evidence** GitHub Actions workflow linked from PR #185. Download the `sekka-73-screen-visual-evidence` artifact. The archive includes an explicit `visual-audit-73.zip` bundle containing:

- `index.html` — 73 numbered expandable screen entries with side-by-side gallery and integrated browser screenshots for each of eight variants.
- `screens/S001` through `screens/S073` — actual browser image captures of the original gallery and current integrated guest screen/fallback.
- `REPORT.md` — numbered observed availability and issue counts from completed browser capture.
- `report.json` — element bounding rectangles for headers, buttons, forms, cards and bottom navigation; candidate overlaps/clipping, horizontal overflow, state mismatch and screenshot failure metadata.
- `metrics.csv` — compact per-variant measured counts and scroll widths.

The collector exits nonzero when screenshots are missing; the workflow still publishes partial evidence with `if: always()`. Inspect the status before relying on counts.

**Important:** unauthenticated gates, disabled payment/wallet features and absent production routing are explicitly classified as **non-equivalent / blocked**. Screenshots of gates or fallbacks are real, but never treated as feature screenshots. Matching authorized Captain, Admin and Passenger states remain unverified without an owner-approved real Google browser session. No fake authenticated screenshots are used.

The bounding-box and overlap indicators are **automated candidates for independent review**, not proven regressions. A preview sample must not be scored against an empty live backend as though its content were identical. Nothing in this audit counts as resolved or accepted.

## Screens and classification guide

| IDs | Gallery source | Integrated guest state |
|---|---|---|
| 01–07 | Phase 1 references, inspection frozen | 02/03/04 have guest routes; 01/05/06/07 are not directly exposed |
| 08–14 | Phase 2 previews | 09–11 show live guest search; 08 needs sign-in; 12 needs published route/stops; 13–14 not distinct integrated routes |
| 15–21 | Phase 3 previews | Booking state or account required; payment steps remain postponed |
| 22–26 | Phase 4 previews | Wallet/payment postponed and not integrated |
| 27–34 | Phase 4 previews | Booking, notification and profile guest gates; others are not distinct integrated routes |
| 35–41 | Phase 5 previews | Google-authenticated Captain application required |
| 42–49 | Phase 6 previews | Enrolled/approved Captain required |
| 50–61 | Phase 7 previews | Captain operations not independently production-routed |
| 62–73 | Phase 8 previews | Actual guest access-denied gate; server-authorized Admin session required |

### Review and acceptance boundary

Only screenshots and measurements from a **completed action run** can substantiate visual findings. The owner or independent reviewer must examine the artifact before approving any changes. **PR #185 remains draft; no production deployment, database write, or merge is authorized by this collection.**


## First completed evidence run and code issues found

- **First-pass GitHub run:** [#43693305595](https://github.com/sekka-go/SeKKa/actions/runs/43693305595) — completed successfully and produced the downloadable artifact `sekka-73-screen-visual-evidence`.
- Actual first-pass artifacts contained **584 gallery + 584 guest-integrated screenshots, zero screenshot failures**. Exactly **560/584** variant pairs were explicitly reported with inaccessible or non-equivalent states. The remaining 24 included screen 04, which is **not actually equivalent**: the original shows the postponed phone-entry design while the live app uses Google OAuth. This classification has been corrected in the collector, not in the approved design.
- Of 1,964 first-pass automated flags, **1,104 were gallery-side horizontal button clipping candidates** from original Admin's intentionally horizontally scrollable navigation, while measured document scroll width stayed equal to the viewport. The collector now exempts intentional scroller children and excludes developer gallery chrome from UI measurements. This is a **measurement correctness fix**; it does not certify any visual defect fixed.
- The first-pass integrated screenshots did show **32 overlapping-control flags**, all naming the same `Back` versus `Continue with Google` pair in the English 360px login screen, repeated on authentication-gated Captain entries. The actual **production-facing Google login** markup omitted the existing `.phase-google-auth` container; commit `89da1be0` added that container, preserving the original design CSS and Google OAuth semantics. Added 360px/390px AR/EN light/dark Playwright regression `web/e2e/production-google-login-layout.spec.ts`. **Post-fix screenshot and CI must confirm it before acceptance**.
- Updated measurements compare only semantically matching labeled elements, and mark missing headings/buttons as review candidates on genuinely comparable public states.
- **Never treat a mock login session or guest access-denied screen as authenticated visual acceptance.** No authorized Google test-session screenshots were captured and no bookings or approvals were fabricated.

