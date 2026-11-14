# Real infrastructure audit — 12 November 2026

Source: authenticated GitHub, Supabase and Cloudflare connectors plus checkout at `f605e1e`.
This is an observed inventory, not a claim of deletion or completed replacement.

## Ownership and limits

GitHub authenticated owner: `sekka-go`; one visible owned repository `sekka-go/SeKKa`.
Cloudflare account: `d717a4d03ce35008332f281420dc6753`, `Sekkago.app@gmail.com's Account`.
Supabase organization: `sekka-go` (`klzmbhqhqqvbfinacpku`), project `seKKa` (`uorxfakceqnhxqnaawdy`), PostgreSQL 17.
Connector repository scope may omit repositories not granted to the GitHub App. No unrelated resource was assumed to be seKKa.

| Resource | Classification | Evidence / action |
|---|---|---|
| Repository and git history | KEEP | Rebuild on independent branch, never force-push main |
| React/Vite build and supplied logo | KEEP | PRD framework choice is advisory; existing Pages build is compatible |
| Legacy App, screens, CSS, design tokens | REPLACE | Inactive in replacement entry point, retained for recovery |
| Custom login/session APIs | REPLACE | New Supabase Auth OTP adapter; existing custom identities require review |
| `web/functions/__sekka-api/[[path]].ts` | REPLACE | 410 in preview; production main remains unchanged |
| Supabase project | KEEP | New isolated `sekka_v2` schema; no legacy data mutation |
| Existing DB migrations | NEEDS REVIEW | 45 remote versions, one legacy SQL file in checkout; blind db push unsafe |
| Edge Function `sekka-api`, version 61 | RETIRE after cutover approval | Old `/rider/trips`, `/pool/*`, password and Telegram endpoints remain live in production |
| Legacy bucket `verification-documents` | MIGRATE after consent/identity mapping | 11 objects; never copy identity records into new auth identities automatically |
| `identity-documents`, `avatars` | KEEP / NEEDS REVIEW | Empty when audited; retain until retirement approval |
| Auth users | NEEDS REVIEW | 0 auth.users; legacy public.users are a separate identity domain |
| Realtime publication | NEEDS REVIEW | No published tables returned; new messaging uses API reads |
| Three legacy cron jobs | RETIRE after dependency verification | Pool deadlines, location purge, verification grace; no changes made |
| Cloudflare Pages `sekka-go` | REFACTOR | GitHub main, web root, npm run build, dist output |
| Pages production and preview history | RETIRE separately | 1,029 deployments in initial list metadata, not all individually inspected |
| D1 `sekka-db` (02d4a246-dd9e-431f-8b9c-d08602e43b7f) | NEEDS REVIEW | API reports zero tables; no current Pages D1 binding observed |
| Workers, KV, Queues, Durable Objects, Worker domains | KEEP (none found) | Empty authenticated resource lists |
| Zones/custom Pages domains | KEEP (none found) | Empty in earlier authenticated audit; only pages.dev domain |
| R2 | NEEDS REVIEW | API returns enable-R2 message, not a successful empty listing |
| Stream, Containers, Pipelines, dispatch namespaces | NEEDS REVIEW | Not enabled / not available under plan; not asserted empty |
| Managed Free Ruleset | KEEP | Cloudflare-managed account security, outside retirement scope |
| External Telegram/Twilio integrations | NEEDS REVIEW | References in deployed Edge source and env template; provider accounts outside scope |

## Legacy schema classification

All `public` tables remain untouched. Incompatible subscriptions, trips and ledger rows are NOT converted to valid subscriptions.

| Table | Classification | Migration condition |
|---|---|---|
| public.api_rate_limits | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.pool_notification_mutes | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.app_feature_flags | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.user_location_searches | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.google_maps_api_usage | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.user_verifications | MIGRATE | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.rider_saved_places | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.telegram_phone_verification_challenges | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.message_conversations | MIGRATE | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.direct_messages | MIGRATE | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.rider_preferred_routes | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.rider_commuter_preferences | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.commuter_board_campaigns | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.users | MIGRATE | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.captain_lines | MIGRATE | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.vehicle_types | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.service_categories | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.app_config | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.demand_groups | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.sessions | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.pool_groups | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.daily_commute_requests | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.otp_challenges | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.trip_stops | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.matches | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.pricing_config | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.payments | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.payment_status_events | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.captain_profiles | MIGRATE | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.pool_categories | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.admin_trip_actions | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.pool_subscriptions | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.pool_members | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.pool_trips | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.admin_ledger_adjustments | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.pool_trip_stops | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.pool_ledger | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.pool_trip_cancellations | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.trips | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.pool_captain_stats | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.pool_captain_capabilities | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.super_admins | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.pool_captain_escrows | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.pool_notifications | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.admin_user_controls | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.admin_audit_logs | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.pool_captain_escrow_transfers | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.push_subscriptions | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.admin_system_settings | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.demand_requests | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.telegram_password_reset_challenges | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.audit_log | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.account_deletion_events | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |
| public.policy_acceptances | NEEDS REVIEW | Explicit identity mapping, compatibility review and approved staging rehearsal |

Raw structural evidence: `audit/supabase-schema.json`, `audit/supabase-details.json`, `audit/cloudflare.json`. No row-level personal data or secrets were exported.

## Branch inventory

113 remote branch refs observed by clone. All are KEEP pending branch-specific retirement approval.

- `origin/HEAD -> origin/main`
- `origin/cleanup/auth-and-home-extras`
- `origin/codex/align-prod-migration-history-20261024`
- `origin/codex/captain-pricing-release`
- `origin/codex/complete-release-20261024`
- `origin/codex/fix-captain-price-rounding`
- `origin/codex/fix-preview-api-proxy-20261001`
- `origin/codex/reload-deletion-rpc-schema`
- `origin/codex/remove-duplicate-rider-search`
- `origin/codex/rider-stitch-full-redesign`
- `origin/codex/sekka-ui-rebuild`
- `origin/codex/sekka-ui-rebuild-main`
- `origin/codex/supabase-backend-20261001`
- `origin/compact-workspace-trip-details`
- `origin/dependabot/npm_and_yarn/web/types/node-26.6.5`
- `origin/design/mobile-pages-reference`
- `origin/design/simplify-homepage`
- `origin/feat/78-screen-bright-ui`
- `origin/feat/android-dark-app-icon-name`
- `origin/feat/animate-home-route-art-20261003`
- `origin/feat/autocomplete-map-picker-20261003`
- `origin/feat/brand-tagline-under-name`
- `origin/feat/captain-line-publish-prd`
- `origin/feat/device-pin-map-and-search-20261003`
- `origin/feat/first-10-screen-flows`
- `origin/feat/greater-cairo-location-search-20261003`
- `origin/feat/header-navigation-refresh`
- `origin/feat/join-requests`
- `origin/feat/location-without-map-20261003`
- `origin/feat/post-login-light-mobile-ux-20261003`
- `origin/feat/rider-join-group-home`
- `origin/feat/rider-trip-cancel-price-compare`
- `origin/feat/saved-home-work-places`
- `origin/feat/separate-landing-and-auth`
- `origin/feature/admin-broadcast-messages`
- `origin/feature/google-maps-address-search`
- `origin/feature/rider-route-discovery`
- `origin/fix-booking-flow-validation-mobile`
- `origin/fix-category-occupancy-rule`
- `origin/fix-schedule-price-category-label`
- `origin/fix-trip-create-cancel-edit-toast`
- `origin/fix-trip-prices-and-unified-view`
- `origin/fix/admin-login-direct-routing`
- `origin/fix/android-launcher-label-requested`
- `origin/fix/android-mobile-overscroll-20261003`
- `origin/fix/app-name-only`
- `origin/fix/arabic-auth-copy`
- `origin/fix/arabic-auth-tagline`
- `origin/fix/arabic-text-spacing`
- `origin/fix/auth-switch-links-below-form`
- `origin/fix/captain-location-auto-sync`
- `origin/fix/edge-function-path-normalization`
- `origin/fix/hide-admin-public-entry`
- `origin/fix/hide-join-cta-when-empty`
- `origin/fix/homepage-no-scroll`
- `origin/fix/landing-single-primary-cta`
- `origin/fix/limit-design-previews-to-development`
- `origin/fix/location-search-provider-and-picker-events`
- `origin/fix/location-sharing-rider-captain`
- `origin/fix/mobile-auth-card-centering-20261003`
- `origin/fix/mobile-home-auth-viewport-20261003`
- `origin/fix/mobile-homepage-reference-20261003`
- `origin/fix/mobile-homepage-safe-overflow-20261003`
- `origin/fix/mobile-layout-margins`
- `origin/fix/mobile-tabbar-fixed`
- `origin/fix/pr152-ci-install`
- `origin/fix/rebuild-shell-styles`
- `origin/fix/reconnect-authenticated-app`
- `origin/fix/reduce-workspace-whitespace`
- `origin/fix/registration-rate-limits-ci`
- `origin/fix/remove-stuck-health-banner-20261003`
- `origin/fix/restore-previous-logo`
- `origin/fix/restore-supabase-migration-history`
- `origin/fix/rider-home-join-card-layout`
- `origin/fix/rider-trip-back-flow`
- `origin/fix/server-lockfile-manifest-sync`
- `origin/fix/splash-brand-spelling`
- `origin/fix/unify-dark-brand-logo`
- `origin/fix/use-app-logo-everywhere-20261003`
- `origin/fix/web-lockfile-manifest-sync`
- `origin/fix/white-pwa-splash-20261003`
- `origin/fix/workspace-home-and-push-readiness`
- `origin/fix/workspace-mobile-density`
- `origin/fix/workspace-visual-rhythm`
- `origin/integration/captain-workspace-design-phase-2`
- `origin/integration/public-auth-experience-phase-2`
- `origin/layout/further-reduce-home-gap`
- `origin/layout/reduce-home-hero-gap`
- `origin/layout/sync-hero-gap-mobile`
- `origin/main`
- `origin/polish-saved-places-category-menu`
- `origin/rebuild/clean-foundation`
- `origin/redesign/admin-screens-phase-4`
- `origin/redesign/captain-screens-phase-3`
- `origin/redesign/public-screens-phase-1`
- `origin/refine-booking-flow-layout`
- `origin/release/sekka-2026-10-05`
- `origin/remove-date-word-from-schedule-copy`
- `origin/rename-sekka`
- `origin/replace-booking-history-after-save`
- `origin/revert/homepage-footer-layout`
- `origin/split-booking-route-and-schedule`
- `origin/trim-trip-booking-ui`
- `origin/ui/android-back-navigation`
- `origin/ui/clean-workspace-hierarchy`
- `origin/ui/distinguish-rider-home-actions`
- `origin/ui/map-first-trip-cards`
- `origin/ui/reduce-screen-density`
- `origin/ui/separate-entry-flows-and-category-select`
- `origin/ux/account-settings-disclosure`
- `origin/ux/action-layout-verification-flow`
- `origin/ux/lock-mobile-zoom`
- `origin/ux/preferences-verification-brand`
- `origin/ux/verification-onboarding-wizard`

## Conflicts and exposure

The deployed Edge source includes password hashes, Telegram/Twilio references, single-trip and pool APIs. These are not imported by the new frontend. They remain reachable in the old production service until approved retirement. Hiding the UI does not retire them.
No workflows existed in the checked-out default tree. Connector cannot inspect all secret/admin endpoint families; only references and variable names were examined.
The historical git log includes a committed then removed env-local file. Secret rotation is not performed here; exposure review is an owner/security follow-up, with no credential values printed.
