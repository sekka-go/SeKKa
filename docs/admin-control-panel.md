# SeKKa Super Admin Control Panel

The admin console is implemented in the existing React/Vite app and calls the authenticated `sekka-api` Supabase Edge Function. It does not ship a service key to the browser and does not use Next.js routes because this repository is a Vite SPA.

## Security and database

Apply migration `20261004062818_admin_control_panel.sql` before deploying the API or web bundle. It creates an explicit `public.super_admins` allow-list, account status controls, append-only audit and financial adjustment tables, plus narrowly scoped service-role RPCs. The migration bootstraps `01101002429` (including canonical `201101002429`) only if the matching account exists with the `admin` role.

This app uses its own hashed bearer sessions in `public.sessions`, not Supabase Auth JWTs. Therefore RLS denies direct `anon` and `authenticated` access to every control-plane table, while the Edge Function authenticates the session, requires `public.super_admins` membership for every `/admin/*` endpoint, and calls database procedures with the server-only service-role key. RPCs independently check the actor against the allow-list. Do not expose the service-role key in Vite variables, source files, or client requests.

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

## UI modules

- `web/src/components/AdminControlPanel.tsx` contains user/captain management, trip operations, dispute handling, financial controls, fare/commission forms, and audit table.
- `web/src/screens/AdminWorkspace.tsx` retains the existing dashboard and broadcast workflow, and hosts the new control panel.
- `web/src/styles.css` loads Tailwind theme/utilities only (no preflight reset) to keep legacy screen behavior intact. Theme surfaces use charcoal `#121212` and amber `#EAB308`.

## Security boundary

Use the database migration and Edge Function together. Deploying only the frontend does not enable admin operations, and deploying the Edge Function without the migration fails closed because user status lookup and Super Admin checks cannot complete. Native Web Push delivery is not implemented by this API yet; the existing notification tool writes durable in-app inbox notifications.
