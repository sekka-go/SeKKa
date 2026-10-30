# SeKKa Production Backend Integration — Batches 1–2

Date: 2026-10-30
Scope: custom authentication, rider trip discovery and requests, rider home data, captain dashboard/profile reads, and authenticated messaging/notification reads. No database schema, RLS policy, or production data was changed.

## Verified backend contract

The deployed `sekka-api` Edge Function is active at version 61. The frontend now uses its custom bearer session contract for rider and captain accounts:

- Registration: `POST /auth/register`, with the required terms/privacy acknowledgements and policy version. Registration returns the created user but does not create a login session.
- Login: `POST /auth/login` with `phone_number` and `password`; the returned bearer token is persisted locally.
- Restore and role validation: `GET /auth/me` runs before protected rider/captain routes. The backend remains authoritative for token validity and role.
- Expiry and logout: an API `401` clears the stored session and routes to login; logout calls `POST /auth/logout` and clears the local token even if the network call fails.
- Recovery: the frontend now uses the actual Telegram recovery routes, `POST /auth/password-reset/telegram` and `POST /auth/password-reset/complete`. It no longer assumes Supabase Auth OTP or email recovery.

The session token is stored in local storage with a seven-day client expiry matching the deployed API lifetime. The server-side expiry remains authoritative.

## Integrated screens and flows

| Flow | Status | Evidence |
|---|---|---|
| Registration and rider/captain login | Partially functional | Uses the deployed custom-auth request/response contract; successful account testing still needs test credentials. |
| Session restore, protected routes, role separation, expiry, logout | Integrated | `GET /auth/me`, `/auth/logout`, local token handling, and role-based route guards. |
| Rider home | Partially functional | Name from restored custom session; latest demand request from `GET /rider/demand-requests`. |
| Rider trip search | Integrated | Location suggestions use `POST /locations/search`; search uses `POST /rider/lines/search` with selected coordinates, date, time, and vehicle category. |
| Rider requests and completed trips | Integrated read; demand request submit connected | `/rider/demand-requests`, `/rider/requests`, and `/rider/trips` power account history. A matched result can submit a real `/rider/demand-requests` request using the selected route details; it is a search request, not a reservation or guarantee. |
| Captain home, offers, vehicle list | Partially functional | Reads `/captain/lines`; home also reads `/captain/demand-groups`. Create/edit/status endpoints exist, but the current form does not yet collect validated map coordinates or send those mutations. |
| Captain profile and verification | Partially functional | Reads `/auth/me`, `/captain/profile`, and `/verification`; the UI upload flow is not yet connected to the backend verification document contract. |
| Captain rider requests and groups | Partially functional | Reads actual `/captain/demand-groups`; related membership operations were not integrated in this batch. |
| Rider/captain notifications | Integrated read/update | Uses `/pool/notifications` and `/pool/notifications/{id}/read`. |
| Rider/captain conversations | Partially functional | Uses `/messages/conversations`; conversation history uses the deployed message endpoint where an ID is present. |
| Subscriptions, receipts, proof upload, payment codes, complaints, ratings | Not integrated | These screens were not connected in this batch. Related routes exist for verification documents, trip payment confirmation, and trip disputes; each needs a separate screen-by-screen contract and business-rule review before use. No fake writes are sent. |
| Admin screens | Not audited in this batch | They were not changed; existing admin API/session handling is separate. |

## API routing and CORS

Direct calls from a Cloudflare branch Preview were blocked by the production Edge Function's CORS allowlist (the checked preflight returned HTTP 204 without an `Access-Control-Allow-Origin` header). This branch includes a same-origin Cloudflare Pages Function proxy for `/__sekka-api/*` to the fixed SeKKa Edge Function origin. It forwards the public anon `apikey` and the user's bearer token; it does not contain a service-role key or bypass backend authorization. Local Vite continues to use its development proxy. The deployed Preview proxy passed live checks.

The production CORS configuration was not changed.

## Checks performed

- `npm run typecheck` — passed.
- `npm run build` — passed. Vite reports the existing main JavaScript chunk is above 500 kB; build succeeds.
- Production API `GET /health` with the configured public anon key — HTTP 200.
- Production API `GET /auth/me` without a session — HTTP 401, as expected.
- Preview proxy `GET /__sekka-api/health` — HTTP 200.
- Preview proxy `GET /__sekka-api/auth/me` without a session — HTTP 401, as expected.
- Preview loaded at a mobile viewport without console errors or horizontal overflow.
- No real registration or login was attempted because no test accounts were provided.
- `/requests/new` routes into the rider search flow. The result details screen can submit a real demand request; a real account is required to verify API permission and identity-verification gates.
- No Supabase product-table reads remain in `RiderHomeScreen`, `RiderTripsScreen`, `RiderJourneyScreen`, or `CaptainJourneyScreen`.
- There is no test script in `web/package.json`.

## Remaining work

1. Run rider/captain happy-path and role-separation checks with designated test accounts.
2. Connect captain line create/edit/status through the actual API and validated map selections.
3. Continue screen-by-screen review of the remaining 78-screen map. A discovered endpoint alone does not mean a screen is integrated; validate its payload, authorization, and business rules first.
4. Review whether the current UI passenger-count selector accurately reflects the API's `seats_available` field for every result type.

## Delivery

- Commit: `ad52cd9` — `Connect rider search to real demand requests`
- Preview: https://0d22a0be.sekka-go.pages.dev
- Cloudflare deployment ID: `0d22a0be-deb7-45c5-a9c6-5daa394bec26` (build and deploy succeeded).
