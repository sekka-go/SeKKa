# seKKa — Independent 73-screen visual audit evidence (PR #185)

**Purpose:** collect browser evidence only. **Do not redesign, fix, or mark any visual issue resolved.**

## Sources and limitations

- **Approved baseline:** `/dev/screens?screen=1..73` on the pinned Cloudflare Staging Preview, with the original gallery's phase-preview state. This preserves the approved 73-screen component gallery, but preview names, routes and transactions are illustrative. The original owner-supplied raster references only cover part of the inventory; the gallery capture is not a claim of raw source-PNG pixel equivalence.
- **Integrated comparison:** the **same deployed frontend build** at the real `/?tab=...` public application paths. A new anonymous browser context is created for every viewport/language/theme variant. No fake tokens, mocked booking records, Google account impersonation or data mutations.
- **Pinned frontend baseline:** commit `017124fc9525bef14b1ff4bd2acd801fc4f3b305` on `https://6a8b773f.sekka-staging-web.pages.dev`. This is the latest successful front-end Preview before evidence-only commits; evidence collection commits do not change production-facing UI. Report JSON records this commit and URL.
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
