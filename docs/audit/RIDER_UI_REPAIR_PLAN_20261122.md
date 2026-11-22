# seKKa — Rider UI repair plan (22 November 2026)

Status: **Implementation started on PR #185 (draft); not approved for Production.**

## Scope and constraints
- Source: owner-reviewed 39-second Android PWA screen recording and the current Rider mobile shell.
- Preserve seKKa sky-blue, cyan, white and bright yellow colors; Arabic-first RTL, English/LTR and dark theme.
- Keep the existing Supabase / Google OAuth / booking / requests pipeline, with no schema migration or production changes.
- Do not add a standalone create-request action. The **طلباتـي / Requests** tab opens the existing Rider-owned trip requests list under bookings; the contextual **اطلب مشوار** action remains restricted to zero matching search results.
- Existing 73-screen developer gallery remains untouched.

## Repair stages

| Stage | Priority | Defect | Implementation | Acceptance criteria |
|---|---|---|---|---|
| 1 | P1 | Fullscreen cyan route wipe obscures information | Remove route-wide overlay and motion-state increment, preserve native navigation | Back/tab changes do not paint over navigation or content |
| 1 | P1 | Floating header overlaps home eyebrow and page back actions | Make shell top-safe offset reflect raised header height | No title, label, close or back button hides under the header at 320–412px |
| 1 | P1 | Bottom dock overlaps last action/card | Reserve content scroll space independent of safe-area | Every final button and card can scroll fully above the dock |
| 1 | P1 | White text on bright yellow | Force black text on verified yellow controls | Yellow-action labels readable in light/dark |
| 2 | P2 | Magnifier looks like zoom-out | Remove minus sign inside the search lens | Search reads unambiguously as search |
| 2 | P2 | Notifications duplicate in header and dock | Keep header notification shortcut, use fifth dock slot for owned requests | Exactly one persistent bell, Requests opens saved requests without creating any new one |
| 2 | P2 | Splash replay on reload | Once-per-tab-session splash; bypass reload and OAuth callbacks | No repeated 5.15-second splash on reload during a session |
| 2 | P2 | Booking hero copy wraps awkwardly | Compact heading, widen copy and limit painted hero height | Clear heading and status/filter controls |
| 2 | P2/P3 | Notifications background discontinuity, close return button | Harmonize page surface and spacing | One consistent page surface and accessible back control |
| 3 | P1 | CI verify failed from ESLint globals | Scope readonly Node runtime globals to *.test.mjs | typecheck, lint, build, unit, structure and relevant browser checks pass |

## Current implementation
- Updated: `MobileApp.tsx`, `RiderTabBar.tsx`, `LaunchSplash.tsx`, `navigation-reference-refresh.css`, `web/eslint.config.js`.
- No modifications to Supabase, OAuth configuration, Production or admin permissions.
- PR must remain Draft, unmerged, until CI and visual QA acceptance.

## Verification checklist (pending independent confirmation)
- [ ] GitHub Actions `verify` succeeds at repair HEAD.
- [ ] Relevant Rider / role navigation Playwright suites succeed.
- [ ] 320×700, 360×800, 390×844, 412×915, Arabic RTL and English LTR screenshots checked for overlap.
- [ ] Light and dark controls pass contrast and safe-area checks.
- [ ] Real Staging Google-authenticated account can navigate Home → Search → Bookings → Requests → Profile, then Back.
- [ ] Notifications open only from the header or menu.
- [ ] Search with no match still shows contextual yellow **اطلب مشوار** only then; accepting does not silently create requests.
- [ ] Production stays unchanged; no merge to main.

**Important:** A successful Cloudflare deployment confirms that code was published, not that these acceptance checks passed.
