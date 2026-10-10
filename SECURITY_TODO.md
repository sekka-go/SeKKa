# Security TODO — deployment owner actions

No secret values are recorded here. Rotate any credential that GitHub secret scanning, Gitleaks, or provider audit logs identify as exposed.

The repository-wide Gitleaks scan of 510 commits found two historical JWT-shaped values in `server/.env.example`; both were decoded without logging values and contained the public `anon` role, not `service_role`. The current examples are empty, and the exact historical fingerprints are allowlisted. No private service-role credential was identified by that scan. If provider logs show that any server-only secret was exposed, rotate it immediately in Supabase and redeploy.

## Supabase Dashboard

1. Open **Project Settings → API**. Confirm only the publishable/anon key is configured in frontend build variables. Keep `service_role`/secret keys exclusively in Edge Function secrets; rotate them if they were ever exposed in a bundle, log, ticket, or Git history.
2. Open **Authentication → URL Configuration**. Set the exact production Site URL and explicit redirect URL allowlist; remove unused wildcard redirects.
3. Open **Authentication → Providers**. Disable unused providers; enable phone/email confirmation and leaked-password protection where supported by the configured provider.
4. Open **Authentication → Rate Limits** and **Bot and Abuse Protection**. Set production auth limits and enable CAPTCHA/Turnstile if configured for the app’s auth flow.
5. Open **Storage → Buckets**. Confirm verification documents are private and review avatar visibility against intended logged-in-user access. Review `storage.objects` policies; deny direct access to identity documents.
6. Open **Database → Advisors** after deploying migrations. Review both Security and Performance findings. Confirm the backend-only RLS tables have no `anon`/`authenticated` table grants and are accessed through the authenticated Edge Function only.
7. Open **Database → Backups** and **Billing → Usage**. Confirm backup/PITR coverage and configure usage/billing alerts appropriate to the plan.
8. Confirm database SSL enforcement and rotate database credentials if previously shared.

## GitHub

1. Repository **Settings → Security → Secret scanning**: enable secret scanning and push protection where available; review historical findings and rotate affected credentials.
2. **Settings → Branches / Rulesets**: protect `main`; require pull requests, required CI status checks, and prevent force pushes/deletion. Require review where team size permits.
3. Enable organization/user 2FA under **Settings → Password and authentication**.
4. Add repository security contacts and review Dependabot alerts under **Security**.
5. Keep deployment secrets in protected GitHub Environments, scoped to the production deployment branch/environment.
6. Replace the comment-only `.github/CODEOWNERS` template with the approved maintainer username/team handle before requiring code-owner review; the repository did not provide a verified team handle to use.

## Cloudflare

1. **Websites → sekka-go.pages.dev / domain → SSL/TLS → Overview**: use Full (strict) when an origin is configured; enable Always Use HTTPS and minimum TLS 1.2.
2. **SSL/TLS → Edge Certificates**: configure HSTS only after HTTPS is verified for all subdomains; choose a deliberate max-age and include-subdomains setting.
3. **DNS → Records**: proxy supported public records and keep origin access restricted to Cloudflare; enable DNSSEC at the registrar/Cloudflare DNS if the domain supports it.
4. **Security → WAF → Managed rules**: enable an appropriate managed ruleset; configure rate limiting for `/api/*`, login, registration, OTP and reset routes. Tune thresholds against real traffic.
5. Set environment-specific API secrets using the Cloudflare/Supabase secret manager, never plain build variables. Add exact preview origins only when required.
6. Set provider spending/usage alerts for Supabase, Cloudflare and any map/geocoding service. This repository does not identify an LLM or payment-provider API.
7. If a trusted preview origin is needed for the API, set only exact origins (comma-separated) with `supabase secrets set SEKKA_ALLOWED_ORIGINS="https://<approved-preview-origin>" --project-ref uorxfakceqnhxqnaawdy`.

## OSM / location services

1. Migrate production tiles away from `tile.openstreetmap.org` to the approved PMTiles-on-R2 architecture or select a compliant provider; preserve visible OpenStreetMap attribution when OSM data is used. The current browser map sends tile requests directly to the public OSM tile host.
2. Configure domain restrictions and usage caps for any client-visible map key. Keep geocoding/routing through the fixed-host backend proxy and review per-user/IP quotas.
3. Review location-consent copy, retention/deletion jobs and access to precise locations against the privacy policy.

## Release checks

- Deploy only from `security-hardening` through a reviewed PR; do not push this branch directly to `main`.
- After deployment, verify response headers and CORS from the production origin and a non-allowlisted origin.
- Run Gitleaks against all refs/history in CI, then inspect results without copying secret values into tickets or logs.
