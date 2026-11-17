# seKKa Phase 01 — Defect and missing-feature register

Original baseline audit source SHA: `97d534a6d231948212fd8b5c56b322f89d37d997`; visual-evidence fix: `9c9dca9351c323b4c3e5211d5baf58e2f4d587c0`. Severity is prioritization, not a claim that unauthenticated probes establish private-data access. No P0 confirmed.

## Confirmed defects and release gaps

| ID | Severity | Affected screen/component | Observable symptom | Root cause | Evidence | Required fix | Suggested phase | Status |
|---|---|---|---|---|---|---|---|---|
| P1-01 | P1 | S001–S073 production integration | 0/73 are accepted as `VERIFIED_REAL`; 32 are partial, 14 mock-only, 14 UI-only, and 13 owner-deferred. Several approved screens have no production route or only a placeholder. | `MobileApp` mounts a subset of domain components; other components are gallery/preview-only or deliberately deferred. | [Screen inventory](./PHASE_01_73_SCREEN_STATUS.md), `MobileApp.tsx`, `screenMap.ts`, approved matrix. CI does not establish real-user/backend acceptance. | Resolve the named per-screen dependencies in the prescribed roadmap phases; do not activate OTP or finance as a shortcut. Keep explicit server authorization and preserve the 73-screen map. | Phases 02–11 by screen | OPEN — phased work |
| P1-02 | P1 | 73-screen visual evidence workflow | A green “73-screen evidence” run could compare a deployment other than the PR HEAD. | Fixed by resolving the exact-SHA Cloudflare check and comparing deployed `build-info.json`; redirects and missing/mismatched metadata fail closed. | Existing [run 44128308727](https://github.com/sekka-go/SeKKa/actions/runs/44128308727) completed 584/584 pairs with 0 capture failures; source/deployed SHA match `9c9dca9351c323b4c3e5211d5baf58e2f4d587c0`. Provenance tests passed 9/9. | Keep provenance enforcement; visual and authenticated acceptance remain separate gates. | Phase 11 / release evidence | CLOSED — PROVENANCE VERIFIED |
| P2-01 | P2 | S014 request CTA; LiveTripRequests | A guest with no matching routes sees the trip-request form, but creation needs an authenticated `user.id`; the component displays `AUTH_REQUIRED` and the submit path then uses its unset identity. There is no sign-in prerequisite/return path on this form. | `LiveTripRequests` loads requests only after `auth.getUser()`, but still renders the rider search-request form after setting the auth error; `create()` is not guarded by authenticated state. | `LiveRouteSearch.tsx` renders `LiveTripRequests` for no results; `LiveTripRequests.tsx` owns the form and inserts `rider_id: uid`. Source-confirmed; not exercised against Staging. | Preserve search draft, require/sign in before submission, and resume the same review action; retain server authorization and truthful retry/error messages. | Phase 08 | OPEN |
| P2-02 | P2 | `/dev/screens` routing; `main.tsx` | A path such as `/dev/screens-not-a-gallery-route` also selects `SubscriptionApp`; unknown paths with that prefix can expose the gallery rather than the public app/fallback. | `pathname.startsWith("/dev/screens")` does not enforce a path-segment boundary. | `web/src/main.tsx`; history fallback serves the SPA. | Use an exact `/dev/screens` path boundary in the entry guard and test `/dev/screens`, nested gallery paths, and lookalike prefixes. Keep the approved gallery itself unchanged. | Phase 11 | OPEN |
| P2-03 | P2 | Production JS bundle / mobile performance | Vite build succeeds but emits a 631 kB main JS chunk, exceeding its 500 kB advisory threshold. | `main.tsx` statically imports both `MobileApp` and the developer-only `SubscriptionApp`, so both are candidates for the same production bundle. | `npm run build` output at source SHA; 631.00 kB minified. | Measure real startup impact, then isolate the developer-only app from the production entry if needed without altering its design/assets. | Phase 11 | OPEN — impact not measured |
| P2-04 | P2 | Web dependency tree | `npm ci`/npm audit reports nine moderate advisories among 176 dependencies; none high/critical. | Advisory details were not part of this phase’s product implementation; no dependency was auto-upgraded. | `npm audit --json` aggregate summary from `web/`; 9 moderate, 0 high, 0 critical. | Review advisory details and runtime reachability, then upgrade only with focused regression tests in a separate change. | Phase 12 | OPEN — triage required |

## Hypotheses and untested areas (not confirmed defects)

| ID | Area | Hypothesis / unknown | Why not confirmed | Evidence needed |
|---|---|---|---|---|
| U-01 | Live Supabase schema | Applied migrations, authenticated catalog visibility, RPC signatures, RLS policies, and storage may differ from committed source. | No management/API operator credential or applied migration ledger was available. Vehicle catalog policies in source are authenticated-only, so zero anonymous-visible rows are expected and do not establish empty data. Anonymous `42501` is consistent with protected tables and cannot validate authenticated policy behavior. | Authorized Staging migration-history/catalog read and authenticated account check; no writes. |
| U-02 | SECURITY DEFINER grants/advisors | Live grants/advisor findings may differ from the committed SQL. | Source review is not the deployed database catalog; Supabase advisors are not available through the public frontend API. | Supabase advisor and `pg_proc`/ACL/RLS review by an authorized Staging operator. |
| U-03 | Google OAuth | Real sign-in, account creation/profile persistence, cancellation, retry, and callback recovery may fail despite UI wiring and Google-enabled Auth settings. | No real test Google session was available; CI’s auth fixtures are intercepted synthetic identities. | Owner-designated Staging accounts and real browser OAuth. |
| U-04 | Booking and Captain/Admin operations | Server persistence, cross-account isolation, concurrency, private document review, and actual approval may fail or differ in live UI. | No authenticated real-user journey was run. The scripts that write/approve/publish/book were intentionally not executed. | Separately authorized disposable Staging test identities and runbook. |
| U-05 | Installed PWA/native | Install prompts, offline launch, Android keyboard/safe-area behavior, and iOS behavior may differ. | Browser CI tests manifest/service-worker behavior but no installed-device session was available. | Device acceptance in Phase 12. |

## Owner-deferred work (not defects)

OTP screens, payment confirmations/receipts, wallet/top-up/withdrawal/ledger, and finance screens are marked `DEFERRED_BY_OWNER` in the screen matrix. Their absence is intentional; do not reclassify as a defect or reactivate them without approval.

### Severity totals

| Severity | Count |
|---|---:|
| P0 | 0 |
| P1 | 2 |
| P2 | 4 |
| P3 | 0 |
