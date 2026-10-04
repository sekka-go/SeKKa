# SeKKa Super Admin Control Panel

The admin console is implemented in the existing React/Vite app and calls the authenticated `sekka-api` Supabase Edge Function. It does not ship a service key to the browser and does not use Next.js routes because this repository is a Vite SPA.

## Security and database

Apply migration `20261004074251_admin_control_panel.sql`, `20261004075039_admin_control_panel_fk_indexes.sql`, and `20261004083050_verification_documents_and_captain_grace_period.sql` before deploying the API or web bundle. The earlier migrations create an explicit `public.super_admins` allow-list, account status controls, append-only audit and financial adjustment tables, plus narrowly scoped service-role RPCs. They bootstrap `01101002429` (including canonical `201101002429`) only if the matching account exists with the `admin` role. The verification migration creates the private document bucket and metadata, Telegram phone challenges, captain grace-period fields, admin review RPC, and hourly suspension job.

This app uses its own hashed bearer sessions in `public.sessions`, not Supabase Auth JWTs. Therefore RLS denies direct `anon` and `authenticated` access to every control-plane table, while the Edge Function authenticates the session, requires `public.super_admins` membership for every `/admin/*` endpoint, and calls database procedures with the server-only service-role key. RPCs independently check the actor against the allow-list. Do not expose the service-role key in Vite variables, source files, or client requests.

Verification documents use that same custom-session boundary: direct browser reads/writes to `user_verifications` and Storage are denied by RLS. Uploads go through the authenticated Edge Function, which scopes each file to the signed-in account; admins receive a 60-second signed preview URL. The client reads document state only through `GET /verification`. Rider booking actions require a verified phone and approved National ID front/back. Captain trip actions additionally require all six immediate-review documents and an active, approved captain profile. The criminal record and drug test can be reviewed within 30 days; an hourly `pg_cron` job suspends the profile if both are not approved before expiry.

Free phone verification uses a Telegram bot that asks the user to share their own contact and compares it with the account phone number. Configure Edge Function secrets `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, and a random `TELEGRAM_WEBHOOK_SECRET` of 32–256 URL-safe characters, then call `POST /admin/verification/telegram-webhook` as a Super Admin to register the webhook. If the bot is not configured, the verification screen reports that state and keeps activation gated.

The audit log and adjustment history are append-only. Account suspension/ban blocks authenticated API use, and user status changes create in-app notifications. Financial adjustments are separate signed records; they do not rewrite the existing append-only `pool_ledger` or charge/refund payments.

## Admin API

All paths below are under `/api`, require `Authorization: Bearer <session-token>`, and are Super Admin only.

| Method and path | Purpose |
| --- | --- |
| `GET /admin/users?q=&role=&limit=` | Search riders/captains with account status and vehicle/license/verification details. |
| `PATCH /admin/users/:id` | Edit allow-listed name/phone fields; requires an audit reason. |
| `PATCH /admin/users/:id/status` | Set `active`, `suspended`, or `banned`; requires a reason and notifies the account. |
| `GET /admin/captains?status=pending\|approved\|rejected` | Verification queue. |
| `POST /admin/captains/:id/verification` | Change verification state; requires reason, audits, and notifies captain. |
| `PATCH /admin/captains/:id` | Edit vehicle type, license, plate, and optionally verification status with reason. |
| `GET /admin/trips` | List recent daily and pooled trips. |
| `POST /admin/trips/:daily\|pool/:id/cancel` | Cancel eligible trips using `{ reason_tag, reason }`; sends in-app notices. Started pooled trips cannot be cancelled from admin. |
| `POST /admin/trips/:daily\|pool/:id/captain` | Reassign an eligible trip to an approved captain using `{ captain_user_id, reason }`. |
| `GET /admin/disputes` | List unresolved payment objections and their history. |
| `POST /admin/payments/:id/resolve\|adjust\|void` | Decide an open objection using `{ reason }`; adjustments also require `adjusted_amount`. |
| `GET /admin/settings` | Read trip pricing, pool-category pricing, and commission. |
| `PATCH /admin/pricing/:vehicleTypeId` | Change daily fare parameters; requires `reason`. |
| `PATCH /admin/settings/pool-categories/:id` | Change shared-ride fare parameters; requires `reason`. |
| `PATCH /admin/settings/commission` | Change future shared-ride commission using `{ rate, reason }`; old ledger rows are unchanged. |
| `POST /admin/ledger/adjustments` | Append a signed ledger adjustment using `{ trip_kind, trip_id, member_id?, amount, reason }`. |
| `GET /admin/audit?limit=` | Read the newest audit events. |
| `POST /admin/notifications/broadcast` | Idempotently send an in-app notification to all users using `{ title, message, request_id }`. |
| `GET/PATCH /admin/settings/otp` | Read or change captain phone OTP state; toggle is audited. |
| `GET /admin/verifications?status=` | List identity documents for review (`pending`, `approved`, `rejected`, or `all`). |
| `GET /admin/verifications/:id/file` | Create a private 60-second signed preview URL. |
| `POST /admin/verifications/:id/review` | Approve or reject a document; rejection requires `{ reason }`, and decisions are audited and notified. |
| `POST /admin/verification/telegram-webhook` | Register the configured Telegram bot webhook. |

Authenticated user verification routes (not admin-only): `GET /verification`, `POST /verification/phone/telegram`, and `POST /verification/documents/:documentType` with multipart field `file` (JPEG, PNG, WebP, or PDF up to 8 MiB).

## UI modules

- `web/src/components/AdminControlPanel.tsx` contains user/captain management, trip operations, dispute handling, financial controls, fare/commission forms, and audit table.
- `web/src/components/VerificationCenter.tsx` shows phone/document states, uploads, progress, rejection reasons, and the captain's remaining deferred-document time.
- `web/src/screens/AdminWorkspace.tsx` retains the existing dashboard and broadcast workflow, and hosts the new control panel.
- `web/src/styles.css` loads Tailwind theme/utilities only (no preflight reset) to keep legacy screen behavior intact. Theme surfaces use charcoal `#121212` and amber `#EAB308`.

### Reusable component shape

The current Vite/React implementation keeps the control-panel sections in `AdminControlPanel.tsx` so existing app routing stays unchanged. These components share the authenticated API client and charcoal/amber tokens:

```tsx
type AdminControlPanelProps = {
  session: Session;
  notify: (message: string, tone?: Toast["tone"]) => void;
};

export default function AdminControlPanel({ session, notify }: AdminControlPanelProps) {
  // Tabs load only their data; each operation includes an audit reason.
  // Sections: Users, Trips, Disputes, Finance/Settings, Audit.
  return (
    <section dir="rtl" className="mx-auto w-full max-w-7xl space-y-5 bg-[#121212] px-4 py-5 text-[#f5f0e3]">
      {/* Shared header, tab navigation, and one active section */}
    </section>
  );
}
```

The existing component-local modules are `Dispute`, `Commission`, `Ledger`, `Pricing`, and `Empty`. If the panel grows, move them into `web/src/components/admin/` without changing API contracts.

### Database/RLS pattern

Each control-plane table has RLS enabled, client roles revoked, and an explicit deny policy. Privileged Edge Function RPCs call `sekka_require_super_admin(actor_id)` before writing. Example from the deployed migration:

```sql
CREATE POLICY admin_audit_logs_deny_client_access
  ON public.admin_audit_logs FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.admin_write_audit(
  p_actor_user_id integer, p_action text, p_resource_type text,
  p_resource_id text DEFAULT NULL, p_reason text DEFAULT NULL,
  p_before jsonb DEFAULT '{}'::jsonb, p_after jsonb DEFAULT '{}'::jsonb,
  p_request_id uuid DEFAULT NULL
) RETURNS bigint
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE audit_id bigint;
BEGIN
  PERFORM public.sekka_require_super_admin(p_actor_user_id);
  INSERT INTO public.admin_audit_logs(
    actor_user_id, action, resource_type, resource_id, reason,
    before_state, after_state, request_id
  ) VALUES (
    p_actor_user_id, left(p_action, 100), left(p_resource_type, 80),
    p_resource_id, left(p_reason, 1000), coalesce(p_before, '{}'::jsonb),
    coalesce(p_after, '{}'::jsonb), p_request_id
  ) RETURNING id INTO audit_id;
  RETURN audit_id;
END;
$$;
```

See the migration itself for complete table definitions, checks, indexes, grants, triggers, and function bodies. Keep service-role credentials exclusively in the Edge Function environment.

### API handler pattern

`supabase/functions/sekka-api/index.ts` routes every `/admin/*` request through one Super Admin gate before dispatch:

```ts
const adminGate = path.startsWith("/admin/")
  ? await requireSuperAdmin(user, origin)
  : null;
if (adminGate) return adminGate;

if (req.method === "PATCH" && path === "/admin/settings/commission") {
  // Validate inputs, then invoke an RPC that independently checks the actor
  // and writes both the setting and audit event.
  const { data, error } = await db.rpc("admin_set_commission_rate", {
    p_actor_user_id: user!.id,
    p_rate: body.rate,
    p_reason: body.reason.trim(),
  });
  if (error) throw error;
  return reply({ setting: data }, 200, origin);
}
```

Trip, captain, dispute, pricing, account, ledger, broadcast, and audit route definitions are listed above and implemented in the same Edge Function. Every new admin route must be added after the shared gate and must validate identifiers, allowed values, and reason text on the server.

## Security boundary

Use the database migration and Edge Function together. Deploying only the frontend does not enable admin operations, and deploying the Edge Function without the migration fails closed because user status lookup and Super Admin checks cannot complete. Native Web Push delivery is not implemented by this API yet; the existing notification tool writes durable in-app inbox notifications.
