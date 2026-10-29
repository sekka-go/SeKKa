# SeKKa product reset — audit and execution plan

**Status:** Source review complete; implementation in progress.

**Branch:** `codex/sekka-ui-rebuild`  
**Production changes:** None performed as part of this audit.

## Scope and source readiness

The approved source pack is in `C:\Users\hp\Downloads\sekka project\` and contains `ARCHITECTURE.md`, `DECISION_LOG.md`, `DESIGN.md`, two separate implementation plans (`IMPLEMENTATION_PLAN_v1.md` and `IMPLEMENTATION_PLAN_v2.md`), the MVP PRD, the MVP screen map, the UI/UX specification, and a visual reference image. These files were read as separate documents and compared; the v2 plan was not treated as automatically replacing v1.

The new pack establishes React + TypeScript, PWA, Supabase/Postgres, Cloudflare Pages, GitHub, Arabic-first RTL, and the light mobile reference with evergreen/teal emphasis. It requires retaining the logo, preserving current infrastructure and historical migrations, and avoiding production database or secret changes during this rebuild. The screenshot is a multi-screen visual reference, not a complete implementation contract; product behavior and screen inventory come from the PRD/screen map, and the decision log controls approved/open/deferred decisions.

The two implementation plans do not present conflicting product decisions in their reviewed sections: both require an audit-first, staged implementation, forbid invented business rules, and refer to the same approved PRD and decision log. They differ in organization and details of audit/acceptance steps, so both are retained as independent references. For any process difference, follow the safer explicit requirement (audit current state, preserve data/configuration, test before release) rather than infer document supersession.

No unresolved *conflict between the supplied documents* was found in the reviewed source hierarchy. There are, however, explicitly open product decisions in both the PRD and decision log. P0 items include vehicle capacity definition, minimum group size, operating dates, cancellation, replacement captain and financial settlement, payment-code validity/reissue, subscription pricing/partial-month handling, activation criteria, and account authentication. Matching policy and many operational details are also open. Those decisions remain blocked from final operational behavior and launch claims. This does not block implementation of independent screens, shared UI, localization, routing, and already-approved rules.

## Repository and technical baseline

- Frontend: React 19, TypeScript, Vite, Tailwind CSS v4 dependency, PWA service worker and manifest.
- Local/test backend: Express and SQLite under `server/`, with 16 local migrations and server/API tests.
- Hosted backend per the current README: Supabase Postgres and the `sekka-api` Edge Function; 46 Supabase migrations and pgTAP tests.
- Maps: Leaflet client and routing/location helpers in the Edge Function.
- Routing: screen/path mapping and role guards currently live in `web/src/screens/Workspace.tsx`; this is custom history navigation, not a routing library.
- User roles currently represented in code: rider, captain, and admin.
- Configuration: pnpm workspace and lockfile, Vite config, Supabase config, server/Edge environment examples, PWA assets and headers.
- GitHub workflows currently cover web quality, Supabase database checks, routing checks, and security checks. No Cloudflare/Wrangler deployment workflow or config was found; current hosting setup is described as external to this repository.

### Current route inventory

| Area | Routes currently present in code | Main implementation |
| --- | --- | --- |
| Public/auth | `/`, `/login`, `/register`, `/terms`, `/privacy` | `App.tsx`, `LandingScreen.tsx`, `AuthScreen.tsx`, `InfoPages.tsx` |
| Rider | `/`, `/search`, `/trips`, `/requests`, `/account`, `/settings`, `/messages`, `/notifications` | `Workspace.tsx`, `RiderWorkspace.tsx`, `RiderDemandFlow.tsx`, shared panels |
| Captain | `/captain`, `/publish`, `/captain/requests`, `/captain/trips`, `/captain/earnings`, `/account`, `/settings`, `/messages`, `/notifications` | `Workspace.tsx`, `CaptainWorkspace.tsx` |
| Admin | `/admin`, `/admin/users`, `/admin/users/:id`, `/admin/documents`, `/admin/trips`, `/admin/complaints`, `/admin/finance`, `/admin/finance/adjustment`, `/admin/pricing`, `/admin/audit`, `/broadcast`, `/account`, `/settings`, `/notifications` | `Workspace.tsx`, `AdminWorkspace.tsx`, `AdminControlPanel.tsx` |

These paths describe the existing implementation only. The new screen map is the approved target inventory; implementation will reconcile it with these paths without assuming old routes are authoritative.

## Current working tree requiring preservation

At audit time the branch had uncommitted changes in API, Edge Function, locale, screen, shared component, and implementation-progress files; one new Supabase migration and several untracked frontend files were present. Six older global CSS files were already marked deleted in the working tree, and `web/src/sekka-system.css` was untracked. These are not equivalent to a reviewed product reset. Do not run `git reset`, `git clean`, or overwrite this working tree; compare and preserve its changes during the approved reset.

## Source comparison and implementation constraints

- `SeKKa_Master_PRD_MVP_v2_AR.md` controls MVP product scope and business requirements.
- `DECISION_LOG.md` controls approved/open/deferred status; it does not authorize resolving OPEN entries by assumption.
- `SeKKa_Master_Screen_Map_MVP_v1_AR.md` controls target screens and flows.
- `SeKKa_Master_UI_UX_Design_Spec_AR.md` and `DESIGN.md` control the UI system, wording, responsive/RTL behavior, and visual patterns. The attached contact sheet is visual grounding.
- `ARCHITECTURE.md` controls the existing technical direction and preservation/validation practices.
- `IMPLEMENTATION_PLAN_v1.md` and `IMPLEMENTATION_PLAN_v2.md` remain separate planning inputs; neither is treated as an implicit replacement for the other.

Approved decisions include scheduled recurring commute (not instant rides), 0% current platform commission, direct passenger-to-captain payment (no internal wallet), receipt/transfer evidence separate from captain confirmation, server-generated payment codes, and captain approval enforced by server/database permissions. Do not enable future electronic commission collection.

## Legacy material inventory

### Candidate for replacement or removal after comparison with the new sources

- Product requirements and phase records: `docs/PRD.pdf`, `docs/TASKS_PHASE1.md`, `HANDOFF.md`, `NEXT_PROMPT.md`, `IMPLEMENTATION_PROGRESS.md`.
- Product/design/flow references: `docs/SCREEN_MAP.md`, `docs/design-system/**`, `docs/stitch-screens/**`, `web/DESIGN.md`, `UX_AUDIT.md`, `docs/migration/ACTIONABLE-UX-AUDIT.md`, and design decisions under `docs/migration/`.
- Feature-specific specifications and handoffs for old notification, Pool, routing, admin, and API concepts under `docs/`.
- Existing screens, navigation, shared UI components, and CSS that the new screen/flow catalog explicitly supersedes.

These are candidates to replace when the new screen map/PRD supersede them. Keep technical architecture, security policies, data contracts and migration history needed by the new product. Old business logic that conflicts with approved decisions should be retired through forward-compatible code/schema changes, never by erasing historical migrations or production records.

### Preserve unless the new requirements demonstrate a safe, approved replacement

- `.git` history, active branch, pending user changes, lockfiles, package manifests, CI workflows, security configuration, PWA/build configuration, environment examples, auth/session/security services, integrations, and deployment settings.
- All historical Supabase and SQLite migrations. Schema evolution must use forward migrations with tests; no production database or data changes are part of this reset.
- Legal/privacy documents and deployment configuration until replacement legal copy and host configuration are provided and validated.
- Existing logo source files and assets until the new design explicitly selects an approved replacement; do not redraw or mutate the logo by inference.

## Key risks and decisions needed from the new source pack

1. Which roles and screens are in the replacement product, including admin/operations access?
2. Which backend is the canonical runtime, and is the local SQLite server to remain as a test/development adapter?
3. What are the new API operations, entities, lifecycle states, and authorization rules?
4. Which existing data concepts remain compatible, and which require forward migrations?
5. Which exact visual source, tokens, language/localization rules, and responsive states are approved?
6. What legal/privacy language and production-host constraints must be preserved?

If the new files disagree on a product or data decision, record the conflict and request a decision before implementing it.

## Execution plan

1. Keep the current non-main branch and preserve all existing uncommitted changes.
2. Replace UI/screens/routes only where the approved screen map and new decisions establish the target.
3. Keep API/auth/database integrations and infrastructure unless they demonstrably violate an approved rule; use forward migrations and tests only.
4. Do not resolve any OPEN P0/P1 business decisions in code. Leave dependent actions non-final and document blockers.
5. Run checks and verify role access, responsive layouts, Arabic RTL, English LTR, and console behavior.
6. Do not deploy or mutate production data as part of this rebuild.

## Work completed in the current pass

- Copied the full approved source pack, including the reference contact sheet, into `docs/product-spec/` so future work in this repository has the actual source materials.
- Updated `AGENTS.md` to use the new source hierarchy and to retain v1/v2 as distinct implementation plans.
- Replaced redundant, unreferenced draft splash/mark files and an unused theme file; the app continues to use the existing official logo assets and `SekkaSplash` component.
- Renamed user-visible Latin brand copy to lowercase `sekka` across browser/PWA metadata, install name, app title, splash title, logo wordmark translations, and displayed vehicle-class labels. Technical identifiers, URLs, storage keys, and repository names remain unchanged.
- Aligned the PWA browser chrome and offline page light/dark colors with the current shared theme tokens.

### Business rules intentionally left unresolved

Do not enable final seat-capacity enforcement, pricing/partial-month calculations, cancellation/refund promises, captain replacement guarantees, payment-code expiry/reissue limits, activation criteria, or final auth policy until the applicable P0 decisions are approved. Existing UI/configuration can display the documented vehicle class names and listed capacities, but the meaning of those capacities remains open and must not be guessed in booking/matching logic.

## Validation observed before this audit

The immediately preceding implementation turn ran `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test`; the captured output showed lint/typecheck/build passing and 201/201 server tests passing. These checks validate that prior working-tree state only, not a future reset or the missing replacement product requirements.
