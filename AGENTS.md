# SeKKa Repository Guidance

SeKKa is an Arabic, RTL-first marketplace for regular shared rides in Egypt. Captains publish a route (line), arrival time, service days, seat count, and price. Riders search with filters and request to join. In Phase 1, payment is direct between rider and captain; the app must not hold funds.

## Source of truth

- Product behavior: [`docs/PRD.pdf`](docs/PRD.pdf).
- If existing code, database behavior, and the PRD conflict, stop and ask before changing the data model or user flows.
- Follow one task at a time from [`docs/TASKS_PHASE1.md`](docs/TASKS_PHASE1.md). Do not begin another task unless asked.

## Approved stack

Use free tiers and open source dependencies. Do not introduce a paid dependency without asking first.

- Frontend: React, TypeScript, Vite, PWA, Tailwind; Arabic RTL, mobile-first, and tolerant of weak networks.
- Backend: Supabase Postgres with PostGIS, Auth, RLS, Realtime, Edge Functions, and pg_cron.
- Hosting: Cloudflare Pages, Workers, and R2. Use Turnstile for CAPTCHA.
- Maps: MapLibre GL and OpenStreetMap data served through PMTiles on R2. Geocoding may use Photon or Geoapify. Use OpenRouteService for walking distance and only for the top 10 results. Never use `tile.openstreetmap.org` in production.
- Email: custom SMTP through Resend or Brevo; do not use Supabase's default email service.
- Monitoring: Sentry. Analytics use the `events` table; PostHog is optional.

## Target repository layout

```text
/apps/web              React PWA for riders, captains, and /admin
/supabase/migrations   Numbered SQL migrations; never edit an applied migration
/supabase/tests        pgTAP tests for RLS and RPC behavior
/supabase/functions    Supabase Edge Functions
/workers               Cloudflare Workers for cron and rate limits
/docs                  PRD, task plan, and architecture decisions
```

When migrating an existing folder or deployment configuration, preserve the current production build until its replacement is verified.

## Hard rules

1. Account type is fixed at signup (`rider` or `captain`), enforced by a database trigger and RLS. Admin status must never be user-selectable. Do not add role switching or trust the UI for authorization.
2. Enable RLS on every application table. Default to deny.
3. Mutate workflow state only through RPCs such as `request_join`, `decide_request`, `declare_payment`, and `confirm_payment`. Do not grant direct `UPDATE` policies on `join_requests`, `payments`, or `captain_profiles.status`.
4. Women-only lines must be invisible to male riders at the database/RLS layer, not only filtered in the UI.
5. Do not expose phone numbers to other users. Captain phone numbers are admin-only; user contact stays in in-app chat.
6. Store tunable values in `config`, including 15-minute time tolerance, 12-hour request TTL, 3 pending requests, 4-week probation, and 30-day location retention. Do not hardcode these values.
7. Keep secrets in environment variables. Never commit `.env`, service-role keys, or R2 credentials. Never ship a service-role key to the client.
8. Every new table or RPC needs a migration and a pgTAP test proving an unauthorized user is denied.
9. Keep user-facing Arabic strings in one i18n file; do not hardcode copy in components.
10. Follow Egypt Personal Data Protection Law 151/2020: obtain explicit consent, provide an Arabic privacy policy, and delete detailed location data after its retention period.

## Definition of done

For each task:

- `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.
- `supabase db reset` and `supabase test db` pass.
- Check RTL at 360px width.
- Emit PRD section 12 events where relevant.
- Keep the change to one concern and link the relevant PRD section in its PR.

## Commands

```sh
pnpm i
pnpm dev
supabase start
supabase db reset
supabase test db
```

## Working style

- Prefer explicit, straightforward code. Avoid abstractions before a second use.
- If a requirement is ambiguous, describe the options in the PR and choose the safest one.
- Keep PRs small and focused.
