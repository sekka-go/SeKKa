# Implementation status — replacement in progress

This is NOT a completed 75-screen product or a production launch claim.

## Phase A — Audit
Observed current repository, remote branches, deployed Edge source, 54 public tables, RLS/triggers/migration versions, three storage buckets (11 objects), existing Pages and empty D1. Classification/evidence in LEGACY_AUDIT. Hosted Auth provider configuration and complete external provider state remain unverified. No data or resource deleted.

## Phase B — Architecture
New private schema, server-owned subscription quotes and atomic reservations; typed React SPA, reusable layout, explicit staging variables. Migration and rollback plan documented. No legacy identities or ledger rows copied. Open-policy gates listed.

## Phases C–G — Implemented code, incomplete acceptance
- New 75-entry screen registry and replacement entry point; dark/light tokens and RTL/responsive layout.
- OTP adapter, profile/captain/vehicle/document forms, public route search/details, favorites, route demand, captain route wizard, private conversation/support and in-app notification API.
- Weekly/monthly calendar engine and SQL equivalent; price/start snapshot, transaction locks across periods/directions, idempotency, append-only ledger, reservation, dual declaration release, disputes.
- Staff capability checks, review/list/read analytics endpoints. No payment partner, top-up ingestion or withdrawals adapter activated.
- Legal registration and financial gates false; official holiday coverage absent by design; renewal disabled. Existing production API remains untouched.
- Spatial route ranking, route stops UI, multi-line schedule overlap, complete doc reviewer UX, configurable renewal priority, cancellation policy, admin settings writes, notification campaigns/push, offline/install experience remain incomplete.
- Generic admin list views are not equivalent to finished operational workflows. Screen registry is not completion evidence.

## Phase H — QA
32 independent domain and real PostgreSQL integration tests initially passed, including simultaneous clients. Latest run: 32/32 passed on PostgreSQL 17.11. Typecheck/lint/build passed. Local Playwright could not start Chromium because this runtime denies its Unix socket; this is an environment blocker, not a passed E2E suite. CI includes browser installation and the three UI suites. Type check, lint and build run on new active application. Hosted OTP/provider/mobile acceptance not completed. Test fixtures never uploaded as real routes/bookings.

## Phase I — Preview
Preview deployment pending publication and verification. The hosted migration confirmation expired; a read-back verified sekka_v2 does not exist. No hosted schema or bucket was created. A fresh explicit tool confirmation is required; no execute_sql workaround will bypass it.

## Phases J–K — Not performed
Production cutover, legacy endpoint revocation, data migration and retirement require future explicit resource-specific approval after complete acceptance. Current main and old production deployment remain active.
