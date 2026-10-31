# SeKKa Staging Runbook

Date: 2026-10-31
Scope: staging-only setup and validation plan. This runbook intentionally does not perform any production write. It focuses on a new staging project and a staging-only Telegram bot, secrets, and Preview Pages config.

## Hard guardrails

- Never run `db reset` against a linked project.
- Prefer `db push --linked` for a linked project; do not use `--project-ref` for `db push`, `db dump`, or `migration list` when the project is already linked.
- For `functions deploy` and `secrets set`, `--project-ref` is valid and required.
- Before any `db push`, confirm the linked project is not `uorxfakceqnhxqnaawdy`.
- Use a separate Telegram bot for staging and separate Twilio/VAPID credentials for staging.
- Do not reuse production secrets or tokens.
- Do not move real data from production to staging.

---

## Correct commands for staging

### 1) Unlink from any currently linked project and re-link to staging

```bash
cd /workspaces/SeKKa
npx supabase unlink
npx supabase link --project-ref <STAGING_REF>
cat supabase/.temp/project-ref
```

Expected check:
- The file must show the staging project ref, not `uorxfakceqnhxqnaawdy`.
- If it still shows the production project ref, stop and fix the repo linkage before any database command.

### 2) Validate the staging link before any write

```bash
npx supabase status --linked
npx supabase migration list --linked
npx supabase db dump --linked --schema public > /tmp/staging_schema_before.sql
```

### 3) Dry run before applying migrations

```bash
npx supabase db push --linked --dry-run
```

This is the required safety check before the real write.

### 4) Apply the staging migration set

```bash
npx supabase db push --linked
```

### 5) Deploy the Edge Function to staging

```bash
npx supabase functions deploy sekka-api --project-ref <STAGING_REF>
```

### 6) Set staging secrets

```bash
npx supabase secrets set --project-ref <STAGING_REF> NAME=value
```

Example names only; no values are included here.

---

## Baseline first step (must be done before staging deployment)

This is the required first action before any staging database push:

1. Build the baseline migration plan for the current schema drift.
2. Decide whether `20261030133000_remove_legacy_captain_line_pricing_rules.sql` is part of the baseline or must be rebased/excluded.
3. Prepare the migration table strategy for `captain_line_join_requests`.
4. Run a local no-production experiment for the `db reset` risk, but only in a local disposable database or a temporary local project; never against a linked or production project.

The baseline work is required because the current live schema and local migrations do not align cleanly. Without this, staging will not be built on a safe schema baseline.

---

## Staging project creation

1. Create a new Supabase project named `sekka-staging` in the same region as production.
2. Record the project ref.
3. Re-link the repo to the staging project using:

```bash
npx supabase unlink
npx supabase link --project-ref <STAGING_REF>
cat supabase/.temp/project-ref
```

4. Confirm the ref is not `uorxfakceqnhxqnaawdy` before using it for any `db push`.

---

## Telegram staging bot

Create a separate staging Telegram bot using BotFather.

Required separation:
- Do not reuse the production Telegram bot token.
- Do not reuse the production webhook secret.
- Do not reuse the production reset flow links.

Recommended staging variable names:
- `TELEGRAM_BOT_TOKEN_STAGING`
- `TELEGRAM_WEBHOOK_SECRET_STAGING`
- `TELEGRAM_BOT_USERNAME_STAGING`

You may map the application variable names to staging values in the Supabase secrets configuration. The runbook intentionally avoids writing actual secret values here.

---

## Secret names per environment (no values)

### Shared app environment names
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SEKKA_API_ORIGIN`
- `SEKKA_ALLOWED_ORIGINS`
- `PHOTON_API_BASE_URL`
- `NOMINATIM_API_BASE_URL`
- `SEKKA_ROUTING_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Telegram / auth related
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_BOT_USERNAME`

### Twilio / verification
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`

### VAPID / push
- `SEKKA_VAPID_PUBLIC_KEY`
- `SEKKA_VAPID_PRIVATE_KEY`
- `SEKKA_VAPID_SUBJECT`

### Any other env names discovered in code
- `SEKKA_ALLOWED_ORIGINS`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`
- `SEKKA_VAPID_PUBLIC_KEY`
- `SEKKA_VAPID_PRIVATE_KEY`
- `SEKKA_VAPID_SUBJECT`
- `PHOTON_API_BASE_URL`
- `NOMINATIM_API_BASE_URL`
- `SEKKA_ROUTING_URL`

This table is intentionally limited to names only, without values.

---

## Cloudflare Pages preview configuration

Set the following in the preview project environment only:

- `SEKKA_API_ORIGIN` → staging Edge Function URL
- `VITE_SUPABASE_URL` → staging Supabase URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` → staging anon key

Do not use production values in staging. Do not reuse production secrets.

---

## Test-account policy

- Use only testing accounts on staging.
- Never copy production data into staging.
- Never reuse real user numbers or real Telegram accounts in staging.
- Keep a short list of sample riders and captains for smoke tests.

---

## Smoke checklist for staging

After deployment, run the staging suite in order:

1. register
2. login
3. `/auth/me`
4. create line
5. search
6. join request
7. accept/reject
8. messages
9. notifications
10. password reset

Results must be recorded in `docs/STAGING_SMOKE_RESULTS.md`.

---

## Critical stop conditions

Stop immediately if any of the following occurs:

- linked project ref is still the production project ref
- `db push` is run against a linked production project
- `db reset` is attempted on a linked project
- Telegram staging bot is not separate from production
- any production secret is used in staging
- any real production data is copied to staging

---

## Final staging gate

The staging setup is ready only when all of the following are true:

- `cat supabase/.temp/project-ref` shows the staging ref
- `db push --linked --dry-run` passes on staging
- `db push --linked` succeeds without touching production
- `functions deploy` succeeds on the staging project ref
- Telegram bot and Twilio/VAPID secrets are all staging-specific
- Cloudflare Pages preview uses staging-origin env values only

Only then should smoke testing begin.

When staging is ready and smoke results are complete, send the results for review before moving to any production step.
