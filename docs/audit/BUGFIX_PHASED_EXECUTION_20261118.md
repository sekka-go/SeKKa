# seKKa — Four-phase owner-ordered real-device bugfix program

**Date:** 18 November 2026  
**Work branch:** `feat/real-app-google-auth-foundation-20261115` / Draft PR #185  
**Environments:** Staging Supabase `zgcvumykzivsvnlflbyp` + Cloudflare staging preview only. Production Supabase is protected.  
**Non-goals:** no OTP, payment gateway, wallets, Production merge, re-creation of 73 approved screens, or fabricated bookings.

## Phase 01 — P0: Passenger trip-request correctness (IMPLEMENTED IN BRANCH / STAGING; awaiting acceptance)
- Add real persisted `direction` (outbound / return / round_trip) and optional `return_time`. For return-only trips, `outbound_time` is null rather than misleading duplicate data.
- Preserve current 1–2-seat restriction and existing requests as-is. Do not rewrite historical rows or delete duplicates.
- Save all fields from the actual Rider search/request form, show them after refresh, verify read-after-write.
- Detect open identical requests (same account, areas, period, direction, go/return times; seat quantity is deliberately excluded). Client shows existing-request feedback; a per-rider transactional PostgreSQL advisory lock rejects concurrent duplicates. Legacy duplicates remain.
- Accept Captain offers only if BOTH legs' times and direction match the request. Preserve owner checks, stop order, vehicle/capacity locks, idempotency, and RLS.
- Staging migrations: `20261118015000_v31_rider_request_direction_and_duplicate_guard.sql`, `20261118015500_v31_rider_duplicate_guard_alias_fix.sql` (the latter resolves a PostgreSQL trigger OLD-record collision discovered during real DB testing).
- Automated tests: `supabase/tests/v31_rider_request_schedule_and_duplicate.test.mjs`, updated browser MOCKED rider no-match journey; and a transaction-rolled-back authenticated Staging DB proof of 1) existing outbound duplicate rejection; 2) round-trip + both times stored; 3) new duplicate rejection; no persistent test rows.
- **Phase acceptance:** exact-HEAD CI passes, actual Google-authenticated Android request returns server row with expected times after refresh, and duplicate submission does not add a second row. Separate browser tests and real-auth tests.

## Phase 02 — P0: Captain document-upload reliability (NOT STARTED IN THIS EXECUTION)
- Reproduce from owner's Android device; capture sanitized Storage/RPC error code without IDs, JWTs, or real document contents.
- Fix picker, Android file MIME/provider anomalies, Storage path and `v31_register_captain_document` readback; ensure draft auto-save before upload, progress and retry states.
- Confirm 1/4 → 4/4 persists on refresh in the private staging bucket with Google-authenticated captain. Test denied/expired session, >5 MB/unsupported format, refresh, and retry. Avoid real sensitive identity photos in Staging.

## Phase 03 — P1: Clear Rider/Captain navigation and status (NOT STARTED IN THIS EXECUTION)
- Make “Trip requests” clearly reachable via physical-left menu and My Bookings, separate from actual booked seats.
- Localize all user-facing states (Open, Offered, Accepted, Cancelled), give actionable empty/error states, fix `[object Object]` vehicle display if still reproducible on new preview.
- Verify AR/EN, RTL/LTR, Light/Dark, role-gated menus and deep links, including browser Back/Forward.

## Phase 04 — P2: Form guardrails and visual audit (NOT STARTED IN THIS EXECUTION)
- Improve Captain years-of-experience guidance and input ergonomics while preserving existing 0–30 validation, show Egyptian plate examples and progressive inline feedback.
- Replace free-form seat entry with an accessible 1/2 choice where appropriate, preserve keyboard input and server cap.
- Inspect original 73-screen geometry, logo sizes, mobile safe areas, buttons and vertical scrolling at 320/360/390/412 widths. Do not rebuild or redesign approved gallery.

## Acceptance and safety rules
No phase is marked fully accepted by green CI alone. Use isolated **real Google accounts** for Rider, Captain and Admin; do not request or expose passwords, JWTs or sensitive documents. Report test evidence, exact SHA, failures and remaining blockers. Keep Draft PR #185 open; no Production writes, no merge.
