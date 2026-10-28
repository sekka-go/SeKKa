# SeKKa Rename — External and Deferred Work

## Staging and database inventory

- The only connected Supabase project is `uorxfakceqnhxqnaawdy` (listed as active `seKKa`); it currently has no development branches. Read-only catalog inspection found no legacy `sikka` object names or routine-source references, and all 52 public tables have RLS enabled. No production changes were made.
- Before any database mutation or staged migration test, create/provide a dedicated staging project or branch. Use it to review detailed RLS policies, Storage policies and contents, Realtime publications, cron jobs, and Edge Function behavior. Record the staging ref and results in `RENAME_RUNBOOK.md`.
- The repo's SQL migration sources already use lowercase `sekka_*` names for functions and scheduled jobs. This is only a source inspection; it does not prove that the hosted database matches migration files.
- If the staging catalog reveals an object with an old or quoted mixed-case name, create a forward migration under `supabase/migrations/` and its paired script under `supabase/rollback/`. Update dynamic SQL, function bodies, policy expressions, client `.from()` / `.rpc()` calls and tests explicitly. Never rename an object manually in a dashboard.

## Environment variable names intentionally unchanged

The task explicitly excludes environment variable names. Preserve these names; no values are recorded here:

- `SEKKA_ALLOWED_ORIGINS`
- `SEKKA_DB_PATH`
- `SEKKA_DOMAIN`
- `SEKKA_ROUTING_URL`
- `SEKKA_VAPID_PRIVATE_KEY`
- `SEKKA_VAPID_PUBLIC_KEY`
- `SEKKA_VAPID_SUBJECT`
- `SEKKA_WEB_DIST`

These already use the required `SEKKA_` prefix. Renaming them later would require coordinated changes in the hosting secret stores, Docker/Compose, CI and operator environments; it is not part of this rename.

## External dashboards to inspect

No external dashboard changes were made. These checks need an operator with access and must not alter the production domain:

1. **Supabase project name** — project currently appears as mixed-case `seKKa`. After a distinct staging target exists, review **Supabase Dashboard → Project Settings → General** and set the project display/technical name to `sekka` if supported. Keep the project ref/URL unchanged; update no client keys unless Supabase rotates them.
2. **Supabase Auth URLs** — **Authentication → URL Configuration**: review Site URL, redirect allow-list, OAuth callbacks and password-reset links for old brand spellings. Keep existing production hostnames exactly as they are; `sekka-go.pages.dev` is explicitly out of scope for renaming.
3. **Supabase Auth email templates** — **Authentication → Email Templates**: keep display branding exactly `SeKKa` and Arabic branding as currently written; check that no obsolete `Sikka`/`SIKKA` user-facing copy remains.
4. **Supabase Storage** — **Storage → Buckets** and **Storage → Policies**: inventory bucket names, public/private flags, size and MIME limits, objects/counts/bytes and owner-folder policies on staging. Do not delete the old bucket before a server-side copy and count/size verification. No bucket change is planned from source inspection alone.
5. **Supabase Edge Functions** — **Edge Functions → Functions**: `sekka-api` is already lowercase kebab-case and `verify_jwt = false` is currently set in `supabase/config.toml`. Verify deployed function name, CORS, secret names and all API URLs on staging; preserve JWT behavior and secrets. Do not deploy/remove production functions from this branch.
6. **Cloudflare Pages** — **Workers & Pages → sekka-go → Settings → Domains & Routes** and **Settings → Builds & deployments**: `sekka-go` is already lowercase and the production domain must not change. Check project/build names and custom-domain aliases for old spelling; list any non-production adjustment before changing it.
7. **GitHub repository and Actions** — the local origin is `https://github.com/sekka-go/SeKKa.git`; if the owner wants the GitHub repository slug normalized, do this as a separate external change and update local/CI remotes only after confirming redirect behavior. **Settings → Actions → General** and repository secrets/variables: audit naming without renaming secrets in this task.
8. **Payment provider / webhook service** — no provider dashboard or webhook endpoint was identified from local configuration. Identify the provider first, then inspect **Developers / Webhooks** for callback URLs and signing-secret names. The production domain and active webhook endpoint must remain unchanged until a verified staged endpoint is available.
9. **Email/notification integrations** — inspect the configured email provider, push provider and templates for sender/display labels. Keep user-visible brand `SeKKa` and Arabic brand text; technical sender IDs should be lowercase `sekka` when the provider permits a non-breaking update.

## Intentional occurrences in a final repository-wide search

- `SeKKa` in UI, manifest, HTML page/OG titles, user notifications, email copy, README, icons and design mockups is the required display brand.
- Arabic `سِكّة`/`سِكَّة` is retained where it already appears.
- `SEKKA_*` environment variable names and the protected production hostname/repository URL are explicitly left unchanged.
- `RENAME_PLAN.md`, this file, and `RENAME_RUNBOOK.md` describe the old spellings as audit evidence/instructions.

Any remaining old spelling outside these intentional cases must be reviewed before sign-off.
