# SeKKa — Role-Based UX Audit (Phase 0D)

**Date:** 2026-10-31  
**Branch:** `integration/sekka-stable`  
**Scope:** Source-level review of passenger, captain, and admin navigation and their alignment with the approved MVP PRD. No production data or application code was changed by this audit.

## Executive decision

**UX status: NOT READY.** The current issue is structural, not merely visual: each role screen exposes a large directory of routes instead of showing a small set of next-step actions and revealing secondary actions only when the relevant state exists.

The deployed screenshot labelled "خدمات الكابتن" corresponds to the captain's `journey-directory` navigation. The same pattern exists in the passenger journey and the administrator console.

## Confirmed source findings

### 1. Captain experience — critical UX mismatch

File: `web/src/screens/CaptainJourneyScreen.tsx`

- Renders a `<details className="journey-directory">` titled "خدمات الكابتن" with grouped links.
- The directory currently lists 24 destinations: approval, documents, vehicle, offers, new/edit offer, rider requests, group details, riders, subscriptions, payments, payment confirmation, code sending, payment status, renewal, replacement, conversations, notifications, ratings/reports, and profile.
- The bottom navigation is separate, but the directory exposes the whole catalogue on every captain journey screen.
- The source loads verification information, but the route directory itself is not reduced to the next required onboarding step or gated by approval state.

**Required correction:** keep the primary captain bottom navigation to no more than five destinations; make onboarding state-led (profile/documents → review status → vehicle/eligibility → offers). Show request/group actions only when records exist. Remove payment collection/confirmation/code workflows and replacement-captain promises from the MVP experience. Do not imply SeKKa receives or verifies money.

### 2. Passenger experience — critical UX and product mismatch

File: `web/src/screens/RiderJourneyScreen.tsx`

- Renders a `journey-directory` titled "خدمات الراكب" with 18 destinations across journey/subscription, payment, communication/support, and account groups.
- The directory exposes receipt, payment method, proof upload, captain confirmation, payment code, payment result, renewal, and replacement-captain routes.
- The approved MVP PRD says payments are direct between passenger and captain; SeKKa does not collect, hold, transfer, or guarantee money. It also excludes providing a replacement captain and excludes financial dispute settlement.
- Several of these screens currently display unavailable-write or missing-data messages, so they are not completed user journeys and should not be presented as primary services.
- The current bottom navigation already has a compact five-item pattern; the large secondary directory undermines it.

**Required correction:** passenger primary flow should be Home → Search offers / Create request → Offer details → Contact / join-request state only where supported → My trips/requests. Keep conversations, notifications, support/reporting, and profile as contextual secondary destinations. Remove unsupported payment-code/receipt/collection and replacement-captain flows from the MVP navigation; retain only informational payment evidence where a supported backend contract exists.

### 3. Administrator experience — overexposed catalogue

Files: `web/src/App.tsx`, `web/src/screens/AdminConsoleLiveScreen.tsx`

- Admin route keys enumerate 30 destinations, including commission, finance, ledger, subscriptions, payment, pricing, pool overview, campaigns, OTP settings, and other legacy operational areas.
- The admin console renders the full `links` navigation catalogue on each screen.
- Several screen captions explicitly say there is no current API route or no independent API support (for example offers, subscriptions, complaints, and ratings). A route being listed is not proof that its workflow is operational.
- This produces an administrative route directory rather than a task-oriented admin dashboard.

**Required correction:** organize admin navigation around actual MVP responsibilities: overview, users/captains, verification documents, offers/requests where supported, reports, and audit history. Keep unsupported financial/commission/pool controls hidden or explicitly marked unavailable until their API, policy, and PRD scope are approved. Use contextual detail pages instead of showing every route at once.

### 4. Route-level role checks — partially present, not a substitute for backend review

File: `web/src/App.tsx`

- Rider routes are checked against `rider` role after restoring the session.
- Captain routes are checked against `captain` role after restoring the session.
- Admin screens require an admin API token and call `/auth/me` to confirm the returned role before loading admin data.
- These are useful frontend guards, but they do not establish that every Edge Function handler enforces ownership, role, and object-level authorization. The deployed `sekka-api` v61 has `verify_jwt=false` and requires the previously identified route-by-route review.

**Required correction:** maintain frontend route guards, but add automated direct-route tests for all three roles and verify authorization in each backend handler. Never rely on hiding navigation as security.

## Approved role flows to implement

### Passenger
1. Home.
2. Search open captain offers.
3. Create a trip request (only if the approved request type is supported).
4. View results and offer details.
5. Contact captain / submit the supported request action.
6. My trips and request status.
7. Contextual conversations, notifications, support/report, and profile.

Do not represent contact as a confirmed booking, seat reservation, guaranteed trip, or payment confirmation.

### Captain
1. Home with one clear next action.
2. Complete profile and required documents.
3. See review status and missing requirements.
4. Complete vehicle details / eligibility where required.
5. Create and manage offers when eligible.
6. Review passenger contact requests only if the corresponding backend endpoint is deployed and supported.
7. Contextual conversations, notifications, support, and profile.

Do not expose payment collection, payment code, or replacement-captain workflows in the MVP.

### Administrator
1. Overview.
2. User and captain account review.
3. Document review and eligibility decisions.
4. Reports and evidence review (only after the required migration, storage, and API are deployed and verified).
5. Audit history.
6. Settings only where an approved, implemented API exists.

## Backend and product blockers that must remain visible

- The live database has 45 recorded migrations; latest observed version is `20261028224659`.
- Reports and line-contact-request migrations are not applied to the live project. Their source routes must not be presented as live capabilities.
- The deployed `sekka-api` is v61 and differs from the candidate source. Do not deploy it until source reconciliation, authorization review, and staging E2E are complete.
- The PRD defines 0% MVP commission and direct party-to-party payment. Do not expose in-app commission/ledger/escrow or payment confirmation as active MVP services.
- The MVP does not promise a replacement captain or guaranteed trip execution.

## CI checkpoint observed for PR #167

At the time of this audit:
- Web typecheck/tests/build/dependency audit job: **success**.
- Edge checks/tests job: **success**.
- Gitleaks full-history scan: **failure**. This is a merge blocker until annotations are inspected, all real exposed credentials are rotated/revoked, and the history scan is resolved or formally documented without suppressing real secrets.
- Cloudflare created an automatic **branch preview** for the integration branch. This is not production deployment and does not imply backend compatibility.

## Implementation sequence

1. Reduce role navigation and remove unsupported MVP routes.
2. Add explicit role + account-state navigation tests.
3. Add direct-route and unauthorized-access tests.
4. Verify every visible action maps to a supported API and database contract.
5. Run staging E2E using separate rider, captain, and admin test accounts.
6. Only then request PR review/merge. Keep production migrations and Edge Function deployment separate.

## Safety boundary

This audit did not apply migrations, change Supabase data, deploy Edge Functions, modify Cloudflare configuration, merge the PR, or change `main`.
