# SeKKa Production Backend Integration — Batches 1–5

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
| Captain home and offers | Partially functional; line writes connected | Reads `/captain/lines`; home also reads `/captain/demand-groups`. Create/edit now submit selected Cairo map-search locations to `/captain/lines` and `/captain/lines/{id}`; pause/resume uses `/captain/lines/{id}/status`. Backend approval and phone-verification requirements remain enforced. |
| Captain profile and verification | Read and upload integrated | Reads `/auth/me`, `/captain/profile`, and `/verification`. Captains can submit the eight supported document kinds through multipart `POST /verification/documents/{kind}`; the UI validates file type and the 8 MB limit, shows pending review only after a successful response, and preserves API errors. |
| Captain rider requests and groups | Partially functional | Reads actual `/captain/demand-groups`; related membership operations were not integrated in this batch. |
| Rider/captain notifications | Integrated read/update | Uses `/pool/notifications` and `/pool/notifications/{id}/read`. |
| Captain conversations | Integrated read, mark-read, and send | Uses `/messages/conversations`, the participant-scoped `/messages/conversations/{id}/messages` read/send endpoints, and `/messages/conversations/{id}/read`. Contact name, unread counts, message ownership styling, 2,000-character validation, and success/error states come from the real API flow. |
| Captain completed-trip receipts | Integrated | `/captain/earnings` supplies completed trips and payment records. The UI now reads the nested response correctly and submits the captain’s actual received amount to `POST /captain/trips/{id}/confirm-payment`; backend ownership and trip-state checks remain authoritative. |
| Subscriptions, subscription receipts, proof upload, payment codes, complaints, ratings | Not integrated | No deployed API route was verified for these subscription/payment-code flows. The UI does not claim these actions succeeded. |
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
- Captain line create/edit and pause/resume controls now call the verified line mutation endpoints; test accounts with approved captain profiles are needed to confirm the positive write path.
- Captain verification documents use multipart upload with the authenticated custom bearer session. Client-side file checks match the deployed contract (JPEG, PNG, WebP, PDF; max 8 MB). The positive-path upload was not executed because no designated test captain account or test documents were provided.
- Cloudflare Preview for the captain document upload commit completed successfully: deployment `cea73b4c-e465-4f05-9cfd-03b8e5ccd848`; `/` and `/captain/journey/documents` returned HTTP 200, `/__sekka-api/health` returned HTTP 200, and unauthenticated `/__sekka-api/auth/me` returned the expected HTTP 401.
- Captain earnings/payment reads were matched against the deployed function’s nested `{ trip, stops, payment }` response. Confirm-receipt uses the deployed RPC-backed API endpoint and prevents duplicate client submissions. No payment write was attempted without a designated test captain account.
- Cloudflare Preview for captain payment confirmation completed successfully: deployment `f1e4b718-f1e6-4da7-a608-665531ed5b26`; `/` and `/captain/journey/documents` returned HTTP 200, `/__sekka-api/health` returned HTTP 200, and unauthenticated `/__sekka-api/auth/me` returned the expected HTTP 401.
- Captain conversations now display the actual contact and history, mark messages read, and submit messages through the deployed participant-checked endpoint. Authenticated messaging was not exercised without an account available for test use.
- Cloudflare Preview for captain messaging completed successfully: deployment `d13141b5-60c3-4f03-9793-135ab48fdd6d`; `/` and `/captain/journey/conversations` returned HTTP 200, `/__sekka-api/health` returned HTTP 200, unauthenticated `/__sekka-api/auth/me` returned the expected HTTP 401, and the browser redirected the protected conversation route to login with no console errors.
- Unread-count refinement deployment `715ca82c-0f26-4793-a813-c42eefe46b90` completed successfully; the conversation route and API health checks returned HTTP 200, while unauthenticated identity remained HTTP 401.
- No Supabase product-table reads remain in `RiderHomeScreen`, `RiderTripsScreen`, `RiderJourneyScreen`, or `CaptainJourneyScreen`.
- There is no test script in `web/package.json`.

## Remaining work

1. Run rider/captain happy-path and role-separation checks with designated test accounts.
2. Run captain line create/edit/pause/resume checks with an approved test captain account.
3. Continue screen-by-screen review of the remaining 78-screen map. A discovered endpoint alone does not mean a screen is integrated; validate its payload, authorization, and business rules first.
4. Review whether the current UI passenger-count selector accurately reflects the API's `seats_available` field for every result type.

## Delivery — current functional batch

- Commit: [`37dbeb5`](https://github.com/sekka-go/SeKKa/commit/37dbeb5e97fc3b22d691ddfb301ec3e15b20c17a) — `Show unread captain conversation counts`
- Preview: [https://715ca82c.sekka-go.pages.dev](https://715ca82c.sekka-go.pages.dev)
- Cloudflare deployment ID: `715ca82c-0f26-4793-a813-c42eefe46b90` (build and deploy succeeded).
