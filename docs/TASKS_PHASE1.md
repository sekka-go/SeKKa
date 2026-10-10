# SeKKa Phase 1 Task Plan

Work on one task per PR. Tasks follow the PRD phases in section 13; each task has an acceptance criterion.

## Phase 0 — Foundation

### P0-01: Repository structure

Establish the monorepo layout (`apps/web`, `supabase`, `workers`, `docs`), with Vite, React, TypeScript, Tailwind, a default Arabic i18n file, and RTL defaults.

**Acceptance:** `pnpm dev` opens the Arabic, RTL page and the layout works at 360px width.

### P0-02: CI

Add GitHub Actions for lint, typecheck, tests, `supabase db reset`, and `supabase test db`.

**Acceptance:** a failing check blocks the PR.

### P0-03: Supabase foundation and seed data

Add the initial schema as a migration and `supabase/seed.sql` with development-only admin, rider, captain, and Cairo-area line data.

**Acceptance:** `supabase db reset` succeeds.

### P0-04: Cloudflare deployment

Configure Cloudflare Pages preview deployments for PRs and production deployments, with documented environment variables in `.env.example`.

### P0-05: Email

Configure custom Resend or Brevo SMTP for Supabase Auth and verify Arabic confirmation email delivery.

## Phase 1 — Accounts and captain review (3 weeks)

### P1-01: Registration

Support email/password, email confirmation, Turnstile, account type, gender, and explicit terms/privacy consent.

**Acceptance:** users cannot sign in before email confirmation; API and pgTAP tests reject account-type changes.

### P1-02: Routes and guards

Provide separate rider and captain journeys after sign-in. Enforce account type through RLS and server authorization.

### P1-03: Rider profile

Support profile photo and emergency contact details; require the emergency contact before a first ride.

### P1-04: Captain profile

Support vehicle details and private document uploads through a Worker-issued upload link to R2.

**Acceptance:** non-captains cannot access documents, and captains cannot read another captain's documents.

### P1-05: Admin captain review

Provide a review queue with document viewing, approval and a four-week probation, or rejection with a reason. Record every action in `audit_log`.

**Acceptance:** only an admin review RPC can change captain status; a trigger prevents unauthorized changes.

### P1-06: Publish a line

Let captains publish origin, destination, intermediate map stops, arrival time, days, seats, price, and payment methods. Use a Worker to calculate stop times with ORS.

**Acceptance:** unapproved captains cannot publish; only women captains can publish women-only lines.

### P1-07: Egypt map

Use MapLibre and Egypt PMTiles hosted on R2, with a cached Photon/Geoapify geocoding proxy through a Worker.

### P1-08: Line management

Allow a captain to pause, edit, or cancel a line, with a reason and notification. Do not allow a schedule change inside 48 hours without notice.

## Phase 2 — Search and requests (2 weeks)

### P2-01: Search screen

Filter by origin/destination, 15-minute arrival windows, days, vehicle type, women-only lines, and maximum walking distance.

### P2-02: Search RPC and tests

Implement `search_lines` and test direction, walking radius, arrival windows, and gender visibility.

**Acceptance:** male riders cannot retrieve women-only lines.

### P2-03: Walking distance

Use an Edge Function with ORS for the top 10 results only, with cached actual walking distances.

### P2-04: No-results suggestions

Explain when no line matches and offer a way to register interest for a matching line.

### P2-05: Line results and details

Show distinct pickup/drop-off points, captain, vehicle, price, seats, and intermediate stops.

### P2-06: Join request

Implement `request_join`; limit riders to 3 pending requests, with a 12-hour reply window for trial and weekly requests.

### P2-07: Captain request inbox

Show rider details, rating, pickup/drop-off, and extra time. Accept or reject using `decide_request`.

### P2-08: Expire requests

Run `expire_requests()` on pg_cron and notify the rider with a suggestion for a nearby line.

### P2-09: Demand requests

Add `demand_requests` and a trigger to match a newly published line and notify interested riders.

## Phase 3 — Direct payment and ride-day notifications (2 weeks)

### P3-01: Direct payment

Implement `declare_payment` and `confirm_payment`, plus the weekly amount, payment method, and dispute status.

### P3-02: Web Push

Add device subscription and a Worker/Edge Function for notifications, with email fallback.

### P3-03: Ride-day notifications

Notify the prior evening, allow the rider to mark boarding or not boarding, send a 30-minute departure reminder, and record arrival.

### P3-04: Ride sharing and SOS

Share a live ride link with emergency contacts; delete detailed location after 30 days.

### P3-05: In-app chat

Provide chat without exposing phone numbers.

### P3-06: Reports and ratings

Add reports and post-ride ratings. A safety report immediately flags the captain for review.

### P3-07: Admin monitoring

Show reports and unmasked-demand heatmaps to admins.

## Phase 4 — Closed beta

### P4-01: Monitoring

Add Sentry and PRD section 12 events.

### P4-02: Security tests

Test RLS and RPC boundaries across multiple users.

### P4-03: Privacy and consent

Provide Arabic privacy and terms documents and an explicit consent screen.

### P4-04: Search load test

Load test search with 1,000 lines and a 2-second response target.

## Before the first real ride

- Get legal advice on transportation licensing and the Egyptian transport-app regulations.
- Confirm Supabase free-tier limits, email delivery needs, and the cost of storing route tiles in R2.
