# SeKKa — Role UX Fix Report

**Date:** 2026-10-31  
**Branch:** `integration/sekka-stable`  
**PR:** #167

## Implemented

### Passenger
- Removed the 18-item "خدمات الراكب" route directory from the journey screen.
- Kept the existing five-item passenger bottom navigation: الرئيسية، البحث، طلباتي، المحادثات، المزيد.
- Secondary screens remain reachable through contextual flows and their existing guarded routes.

### Captain
- Removed the 24-item "خدمات الكابتن" route directory.
- Kept the compact five-item captain bottom navigation.
- Added a frontend state gate for creating/editing offers: if the verification state is not approved, the user is shown the required next steps (documents and approval status) instead of the offer form.
- Removed the premature "الأرباح والإيصالات" shortcut from the main captain actions. Payment routes are not promoted as primary navigation.

### Administrator
- Removed the 26-item admin section directory from the top of every admin screen.
- Replaced the dashboard's all-sections catalogue with six task-oriented shortcuts: users, captains, documents, complaints/reports, trip operations, and audit history.
- Kept the compact admin bottom navigation for dashboard, users, trips, and audit history.

## Validation

For commit `f436b867f1840025bb55526aa09edf74b5447cbe`:
- Web typecheck, tests, production build, and dependency audit: **PASS**.
- Edge Function checks/tests: **PASS**.
- Cloudflare branch preview build: **PASS** (preview only, not production).
- Gitleaks full-history scan: **FAIL**, still finding four historical findings. Do not suppress the scan. Previously audited findings include historical key-like values in Git history; potentially exposed credentials must be revoked/rotated by the owner, and history cleanup must be handled separately with an explicit recovery plan.

## Remaining work / non-claims

- This patch corrects the oversized role navigation and gates the captain offer form in the frontend. It is not a complete proof of backend authorization.
- Direct-route authorization and every `sekka-api` handler still need route-by-route verification against the deployed v61 source.
- The live Supabase migration history and deployed Edge Function were not modified.
- No production migration, Edge Function deployment, Cloudflare production deployment, or merge to `main` was performed.
- Staging end-to-end tests with distinct rider, unapproved captain, approved captain, and admin accounts remain required.
