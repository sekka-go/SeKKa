# seKKa preview release gate — mandatory UI/UX review

Every link offered as a *reviewed* preview must be the exact successful Cloudflare preview deployment corresponding to a commit whose CI has finished successfully.

## Mandatory review before offering a new preview
1. Review every button and action, label, warning, toast, alert, empty state, form and navigation control on the changed screens.
2. Inspect at least 360px and 390px mobile widths for Arabic RTL and English LTR, in **both light and dark** appearances. Where changed screens are desktop/admin, also check a desktop viewport.
3. Check element boxes relative to the intended parent card and viewport: nothing may overlap the logo, hero, illustration, another control, or a sticky navigation bar. Alerts must stay with the failed action.
4. Ensure error, retry, loading, authenticated and unauthenticated states use the same layout. No separate error card may collide with the primary action card.
5. Test keyboard focus, tap targets, back navigation, scrolling, dynamic text, and preserved input.
6. Run typecheck, lint, unit/structure tests, build, Playwright, and any focused visual/layout regression tests.
7. Capture and **inspect actual rendered screenshots** for each affected mode and viewport before declaring the visual review complete. Automated bounding-box checks alone do not constitute a visual audit.
8. If any step fails or remains unperformed, report that explicitly and do not call the preview visually approved. Do not merge or publish production based solely on a successful build.

## Current known regression
On live home, a free-floating 'Unable to connect ... Retry' block appeared above/behind the main action card in mobile light mode. Place the warning inside the action card, constrain its width, and verify mobile light/dark layout. Also address root cause of auth lookup failures separately; layout is not equivalent to a successful login.
