# SeKKa Functional Completion Matrix

Updated: 2026-10-31
Scope: deployed `sekka-api` version 61 and the current web client. This is an implementation and contract inventory, not a claim of authenticated end-to-end validation.

## Status meaning

- **NOT STARTED**: no implementation found.
- **IN PROGRESS**: partial implementation or unresolved behavior remains.
- **IMPLEMENTED**: client path exists; backend behavior has not necessarily been verified.
- **API VERIFIED**: client use and the deployed API contract were checked against function source. This does not mean a real authenticated operation was executed.
- **E2E VERIFIED**: completed using real test accounts and persisted results. No row currently has this status.
- **BLOCKED**: implementation depends on an unavailable API operation, decision, or test environment.

“Read/Write status” records the status for each side. For read-only screens, write is N/A. A status shown on screen is not considered proof that an operation succeeded.

## Public and account access

| Screen / action | Route | API endpoint | Read status | Write status | Auth | Test result | Remaining issues |
|---|---|---|---|---|---|---|---|
| Welcome / public entry | `/` | none | IMPLEMENTED | N/A | No | Local routing smoke check only | Authenticated users redirect by role; no E2E login redirect test |
| Rider registration | `/register` | `POST /auth/register` | N/A | API VERIFIED | No | Contract/source inspected; positive signup not tested | Requires disposable staging rider account and phone verification setup |
| Captain registration | `/register?role=captain` | `POST /auth/register` | N/A | API VERIFIED | No | Contract/source inspected; positive signup not tested | Requires disposable staging captain account |
| Login and role redirect | `/login` | `POST /auth/login`, `GET /auth/me` | API VERIFIED | API VERIFIED | No / session | Anonymous route check only; no valid credentials available | E2E for rider, captain, admin role routing |
| Logout | `/login` | `POST /auth/logout` | N/A | API VERIFIED | Yes | Contract/source inspected; no authenticated request | Test session invalidation in staging |
| Password recovery/reset | `/forgot-password` | `POST /auth/password-reset/telegram`, `POST /auth/password-reset/complete` | N/A | API VERIFIED | No | Contract/source inspected; no real reset code tested | Requires staging phone and Telegram OTP flow |
| Terms / privacy | `/terms`, `/privacy` | none | IMPLEMENTED | N/A | No | Static render/build only | None for API integration |

## Rider core journey

| Screen / action | Route | API endpoint | Read status | Write status | Auth | Test result | Remaining issues |
|---|---|---|---|---|---|---|---|
| Rider home/profile snapshot | `/home` | `GET /auth/me`, rider home data | API VERIFIED | N/A | Rider | Protected route/unauthorized behavior checked; no rider token | Authenticated data assertions pending |
| Search location suggestions | `/trips` | `POST /locations/search` | API VERIFIED | N/A | Public/API policy | Contract inspected; no live query test recorded | Confirm suggestions under staging network conditions |
| Search trip offers | `/trips` | `POST /rider/lines/search` | API VERIFIED | N/A | Rider | Contract inspected; local eligibility-filter unit tests pass; no authenticated search E2E | Deployed API must filter unapproved/inactive captains before returning details; ranking/max-results policy needs approval; requires staging rider and active offer fixtures |
| Search results / trip details | `/trips` | `POST /rider/lines/search` | API VERIFIED | N/A | Rider | UI/API mapping inspected; client hides unapproved and insufficient-seat candidates and deduplicates line IDs | No separate persisted trip-detail route. Existing detail is an offer view, not a booking guarantee |
| Request contact for a displayed captain offer | `/trips` offer details, `/my-trips`, captain requests | Local only: `POST /rider/lines/{id}/contact`, `GET /rider/line-contact-requests`, `GET /captain/line-contact-requests` | IN PROGRESS | IN PROGRESS | Verified rider creates; rider and offer-owning captain read | PRD open-market/direct-contact model used: saved state is `contact_requested`; idempotent retry returns same request/conversation; SQL acceptance test authored, not run; UI typecheck/build only | New migration `20261031230000_sekka_line_contact_requests.sql` is not applied. The operation opens direct contact, never reserves a seat or guarantees the trip. Verify paused/unqualified offer rejection, duplicate retry, and only the two parties can message on free staging |
| Create/share/join an open-market ride group | `/journey/group`, offer details | No compatible deployed open-market group API. `POST /rider/pool/groups` returns HTTP 410 and old `/rider/pool/*` routes use a separate pool/subscription schema | BLOCKED | BLOCKED | Rider | Source inspected; no writes attempted | A new atomic group schema and safe share-token contract are needed. Current local untracked schema reset migration uses UUID profiles/lines, while live project uses integer `users`/`captain_lines`; neither has a staging branch to validate against |
| Create daily travel request | `/requests/new` | `GET /config`, `POST /rider/requests` | API VERIFIED | API VERIFIED | Verified rider | Contract and live public config response checked; authenticated create not executed | UI sends service category and endpoint-supported coordinates only; date, time, and passenger count are not accepted by this operation. Product decision required before schema/API expansion |
| Create demand request from offer | `/trips` | `POST /rider/demand-requests` | N/A | API VERIFIED | Verified rider | Contract inspected; write not executed | Requires verified staging rider and route fixture |
| Request history and completed trips | `/my-trips` | `GET /rider/requests`, `GET /rider/demand-requests`, `GET /rider/trips` | API VERIFIED | N/A | Rider | Contract inspected; no authenticated response checked | Verify status and nested response rendering in staging |
| Request details | `/my-trips` | No dedicated request-by-ID endpoint; history includes request records and linked group/match data | IN PROGRESS | N/A | Rider | Contract/source inspected; no authenticated read | Add an authorized detail endpoint only if product needs a distinct detail resource; current UI presents available history data |
| Update daily request match status | `/my-trips` | `POST /rider/requests/{id}/match` | API VERIFIED | IMPLEMENTED | Owner of daily request, rider | Route checked for owner validation and read-only behavior; repeated click guard implemented; no live account request | Although HTTP method is POST, handler only reads the owned request/match; repeated calls do not create a match or mutate state. Requires owned staging request to test |
| Perform daily request matching / transition `open` → `matched` | Backend operation; visible in `/my-trips` | No deployed API matcher/write endpoint found; `/rider/requests/{id}/match` only reads current status and match | BLOCKED | BLOCKED | Must be defined by backend contract | Edge Function, database trigger/function metadata, and RLS policies inspected read-only; no write test | Insert trigger on `matches` creates a trip/stops and changes request to `matched`, but no authorized API operation to insert a match was found. Both tables have backend-only `service_role` RLS policies. Add a captain-authorized API operation; never write directly from the client |
| Cancel open daily request | `/my-trips` | `POST /rider/requests/{id}/cancel` | N/A | API VERIFIED | Request owner, rider | Contract/source inspected; not executed | Test only an open staging request; API rejects non-open requests |
| Dispute confirmed completed-trip payment | `/my-trips` | `POST /rider/trips/{id}/dispute` | API VERIFIED | API VERIFIED | Trip owner, rider | Contract/source inspected; not executed | Requires confirmed staging payment; no production payment/dispute writes |

## Captain core journey

| Screen / action | Route | API endpoint | Read status | Write status | Auth | Test result | Remaining issues |
|---|---|---|---|---|---|---|---|
| Captain dashboard and offers | `/captain/home`, `/captain/journey/offers` | `GET /auth/me`, `GET /verification`, `GET /captain/lines`, `GET /captain/demand-groups` | API VERIFIED | N/A | Captain | Contract/source and role guard inspected | No authenticated data E2E |
| Verification status | `/captain/journey/approval` | `GET /verification` | API VERIFIED | N/A | Captain | Contract/source inspected | Review metadata is not fully exposed by current API response |
| Upload verification documents | `/captain/journey/documents` | `POST /verification/documents/{kind}` multipart | API VERIFIED | API VERIFIED | Captain | Contract and client file checks inspected; upload not executed | Needs staging captain and non-sensitive test documents |
| Captain vehicle profile | `/captain/journey/vehicle` | `GET /captain/profile`, `POST /captain/profile` | API VERIFIED | API VERIFIED | Captain | Create-only contract inspected; no write run | No profile update endpoint; do not imply editing persisted data |
| Publish offer | `/captain/journey/new-offer` | `POST /captain/lines` | API VERIFIED | API VERIFIED | Captain | Contract/source and form wiring inspected; no write run | Requires staging captain with approved verification and valid Cairo coordinates |
| Edit offer | `/captain/journey/edit-offer` | `PUT /captain/lines/{id}` | API VERIFIED | API VERIFIED | Offer owner, captain | Contract/source inspected; no write run | Verify owner-scoped update in staging |
| Pause/resume offer | `/captain/journey/offers` | `PATCH /captain/lines/{id}/status` | API VERIFIED | API VERIFIED | Offer owner, captain | Contract/source inspected; no write run | Cancel/delete operation not verified; UI currently pauses/resumes only |
| Receive rider requests / request details | `/captain/journey/rider-requests`, `/captain/journey/rider-request` | `GET /captain/demand-groups` | API VERIFIED | N/A | Captain; query scoped to owned lines | Contract/source inspected; no authenticated response test | Endpoint returns groups in `matched` state and their demand requests with `open` or `matched` status. Daily commute requests (`/rider/requests`) are not exposed to captains; there is no request-by-ID detail endpoint |
| Accept/reject request | `/captain/journey/rider-request` | No verified endpoint | BLOCKED | BLOCKED | Captain | Not testable | Removed the implied action button. API exposes no accept/reject operation; captain sees server-returned status and an explicit availability note |
| Manage active trips / trip lifecycle | `/captain/journey/groups` and journey screens | No verified captain trip lifecycle endpoint | BLOCKED | BLOCKED | Captain | Not testable | Do not equate offer pause with active-trip management |
| Captain conversations / send message | `/captain/journey/conversations` | `GET /messages/conversations`, `GET /messages/conversations/{id}/messages`, `POST /messages/conversations/{id}/read`, `POST /messages/conversations/{id}/messages` | API VERIFIED | API VERIFIED | Conversation participant | Contract and client wiring inspected; no real message sent | Requires two staging participants to validate delivery/read state |
| Captain unread counters | `/captain/journey/conversations` | `GET /messages/conversations` | API VERIFIED | N/A | Captain | Response mapping inspected | Verify counts using rider/captain staging pair |
| Captain earnings / actual receipt confirmation | `/captain/journey/payments` | `GET /captain/earnings`, `POST /captain/trips/{id}/confirm-payment` | API VERIFIED | API VERIFIED | Trip’s captain | Nested response and write contract inspected; no write performed | Requires a staging completed trip and actual test receipt only |

## Shared, subscription, and support

| Screen / action | Route | API endpoint | Read status | Write status | Auth | Test result | Remaining issues |
|---|---|---|---|---|---|---|---|
| Notifications list | `/journey/notifications`, `/captain/journey/notifications` | `GET /pool/notifications` | API VERIFIED | N/A | Authenticated user | Contract and UI mapping inspected | Authenticated result not tested |
| Mark notification read | Same | `POST /pool/notifications/{id}/read` | N/A | API VERIFIED | Authenticated notification owner | Rider and captain UIs update read state only after the API succeeds; no live write | Verify read state on staging notification |
| Delete own notification | Same | `POST /pool/notifications/{id}/delete` | N/A | API VERIFIED | Authenticated notification owner; server scopes update by user_id | Rider and captain UIs remove item only after `{deleted:true}` from API; no live write | Verify soft-delete and list filtering on staging |
| Mute group notifications | Same | `POST /pool/notifications/{id}/mute` | N/A | API VERIFIED | Authenticated owner; server requires notification to reference a group | Rider and captain UIs offer action only for notifications with group_id and confirm only `{muted:true}`; no live write | Verify future group notifications stay muted on staging |
| Rider conversations / messages | `/journey/conversations`, `/journey/conversation` | `GET /messages/conversations`, `GET /messages/conversations/{id}/messages`, `POST /messages/conversations/{id}/read`, `POST /messages/conversations/{id}/messages` | API VERIFIED | API VERIFIED | Signed-in conversation participant | Rider UI now loads the participant thread, marks it read, and posts messages; appends only the server-returned message. Typecheck/build/unit tests only; no real message sent | Paired staging E2E pending; verify unauthorized thread access, send/read/unread state, rate limit, and delivery with rider/captain test accounts |
| Rider profile / sign out | `/journey/profile` | `GET /auth/me`, `POST /auth/logout` | API VERIFIED | API VERIFIED | Rider | Contract and local route guard inspected | Profile edit endpoint is not verified; editable fields must remain unavailable |
| Monthly subscription and group details | `/journey/group`, `/journey/subscriptions`, `/journey/subscription`, `/journey/renewal` | `GET /rider/pool/groups`, `GET /captain/pool/groups`, `GET /captain/earnings` (only where applicable) | API VERIFIED | BLOCKED | Rider/captain | Read contracts inspected; no payment action tested | Preserve monthly model. No verified subscription request/confirmation/payment-proof/code endpoint. Do not infer payment from subscription amount or payment receipt |
| Payment method / receipt / proof / payment code / activation | `/journey/payment-method`, `/journey/receipt`, `/journey/proof`, `/journey/payment-code`, `/journey/payment-result` | No verified subscription payment endpoints | BLOCKED | BLOCKED | Rider/captain | Not testable | UI must not claim a subscription payment was sent or activated |
| Rider report submit/status | `/journey/complaint`, `/journey/complaint-status` | Local, not-deployed: `POST /reports` (multipart), `GET /reports/mine` | IN PROGRESS | IN PROGRESS | Authenticated rider/captain | Source and UI implemented locally; typecheck/build/Edge check pass; no DB migration or authenticated request executed | New migration `20261030222143_sekka_mvp_reports.sql` is prepared but not applied. Evidence uses a private bucket; validate private upload and cleanup behavior in isolated staging |
| Admin report review and evidence | `/admin/complaints` | Local, not-deployed: `GET /admin/reports`, `GET /admin/reports/{id}/evidence/{evidenceId}`, `POST /admin/reports/{id}/review` | IN PROGRESS | IN PROGRESS | Super Admin | Local review screen and atomic DB RPC are implemented; pgTAP acceptance test authored but not run | Migration must be tested on an isolated copy of the correct schema. Real evidence upload, signed-link expiry, authorization, and audit persistence remain unverified |
| Ratings | `/journey/ratings`, `/captain/journey/ratings-reports` | No verified user rating endpoint | BLOCKED | BLOCKED | Rider/captain | No rating write implemented | Rating eligibility and moderation remain separate product decisions; reports are not ratings |
| Shared error/empty/offline/denied/404 states | `/shared/*`, unknown route | Existing API error responses / none | IMPLEMENTED | N/A | Varies | Build and route smoke checks | Not a business write; improve from real-user feedback later |

## Write-operation test plan and staging gates

No valid test accounts or isolated staging backend credentials were supplied. Therefore no authenticated positive-path write has been executed and no operation is **E2E VERIFIED**. Anonymous health/authorization checks are not end-to-end business tests.

| Write operation | Required test identity/data | Safe staging procedure | Assertions |
|---|---|---|---|
| Signup/login/logout/password reset | Disposable rider and captain phones; controlled OTP/Telegram test channel | Use dedicated staging project and phone numbers; never reset a real user | Correct role/session, invalid password error, logout invalidation, one-time reset code |
| Daily request creation | Verified staging rider, actual `service_categories` option, two Greater Cairo points | Create one daily request with a selected config category and unique points; check in own account only | API persists owner/category/coordinates and initial status; reject invalid category/points; do not assert date/time/seats because endpoint accepts none |
| Demand request creation | Verified staging rider, active captain offer/route fixture | Create one demand request with unique route/date; check in own account only | API persists owner, route, date, seats/status; no false match; reject invalid/out-of-region request |
| Request status refresh/cancel | Rider owning an open staging daily request | Refresh status then cancel that specific request; repeat refresh to check idempotent reads; do not reuse production IDs | Match response reflects stored state without mutation; cancel changes only open owned request; repeated/non-open cancel is rejected |
| Payment dispute | Rider-owned completed test trip with payment status confirmed | Use a synthetic staging trip/payment; submit a test reason | Owner/state validation, dispute persistence, duplicate behavior, no real payment/refund |
| Captain offer create/edit/pause | Verified staging captain and test vehicle profile | Create route in Greater Cairo with future date/time; update then pause/resume | Ownership, valid fields, state changes and search visibility; reject another captain’s ID |
| Vehicle profile/document upload | Staging captain and synthetic documents only | Upload supported non-sensitive fixtures under 8 MB; create profile once | Type/size validation, owner isolation, resulting document/profile state |
| Captain receipt confirmation | Captain-owned completed test trip and physically simulated/test receipt | Confirm the exact staging amount only; never enter a live receipt amount | Server records amount/payment event; reject invalid amount and non-owned/non-completed trip |
| Messages/read state | Staging rider + captain linked to same conversation | Send one test message, read from other account, then inspect unread count | Participant checks, body limit/rate limits, persistence, unread decrement |
| Notification read | User-owned staging notification | Mark one notification read and reload | Only owner’s notification changes; persisted `read_at` returned |
| Create report with and without evidence | Disposable staging rider/captain; test user and test offer | Apply the reviewed migration only to isolated staging; submit a report with a safe synthetic file and another without evidence | Correct target/type/description persisted; evidence bytes and metadata saved privately; invalid type/size/target rejected; owner sees only own reports |
| Admin report review | Staging Super Admin + report created above | Move submitted → in_review → reviewed → closed; inspect audit row and attempt invalid/repeated transitions | Every valid state change and reason is recorded atomically; unauthorized role rejected; report arrival alone never changes account status |
| Group creation, capacity, duplicate join, share | Staging riders and active offer fixture | Pending until the market-group contract/migration is approved and a no-cost isolated database is available | Verify atomic seat capacity, duplicate membership prevention, safe public fields, token entropy, and authenticated join |
| Offer contact request | Staging rider/captain and active offer | Apply the reviewed migration only in an already available isolated environment; create one request then retry the same offer | Same request and conversation returned on retry; captain sees the request; no seat count change or trip creation; paused offer and non-rider rejected; messages remain private to both participants |

### Release verification rules

1. Obtain a dedicated staging API project and disposable rider/captain accounts before running positive-path writes.
2. Use only staging-created users, offers, requests, trips, payments, conversations, and notifications. Confirm API base URL before every write batch.
3. Capture request ID, response status, and resulting staging state without storing credentials or personal data in the report.
4. Cleanup may only remove the test entities created for the run, using an approved staging cleanup procedure. Never run a database reset or delete production data.
5. For daily matching, assert in staging that a backend-authorized match insertion changes the request to `matched` and the database trigger creates the linked trip and two stops. Verify captain/request ownership and state guards.
6. Mark a row **E2E VERIFIED** only after the persisted result and owner/state restrictions have been checked with real staging accounts.

## Current batch results

- Deployed API contract inspected read-only: `sekka-api` version 61.
- Rider daily request creation now loads real service categories from `GET /config` and sends the exact `POST /rider/requests` payload accepted by the deployed API. The API does not accept a schedule or seat count on this route, so the form does not claim those values were registered.
- Rider daily request status action is wired to the owner-checked `POST /rider/requests/{id}/match` route. The API returns the current request and a match only when the backend state is `matched`; otherwise it reports the request is still open.
- No daily commute matcher write was found in the deployed function source. The status endpoint only reads the request and existing match row; it cannot cause an `open` request to become `matched`.
- Read-only production metadata inspection found `trg_matches_create_trip` (creates the linked trip/stops and updates the daily request on match insertion) and backend-only RLS policies on `matches` and `daily_commute_requests`. No data or policy was changed. The missing piece is the authorized API operation that decides and inserts a match.
- The match-status handler is read-only despite using POST: source inspection found owner validation and SELECT operations only, with no insert/update/RPC. The client locks request actions synchronously to prevent duplicate clicks and serializes match refresh/cancel; demand-request creation has its own synchronous duplicate guard.
- Rider and captain demand-request cards now share the same labels for API request states (`open`, `matched`, `cancelled`). Removed the captain accept/reject button because no such authorized API operation exists.
- Request-specific history, match refresh, and cancellation are distinct; no dedicated request-by-ID detail endpoint or captain accept/reject endpoint was found in the deployed function. Captain reads are scoped to requests in matched demand groups; daily commute requests have no captain-facing read route.
- Authenticated E2E: **not run** (no test accounts/staging write credentials supplied).
- `npm run typecheck`: **passed**.
- `npm run build`: **passed**, with the existing Vite warning that the main minified chunk is over 500 kB.
- `npm test`: **unavailable**; `web/package.json` has no test script. No test runner or isolated frontend test suite is configured.
- Production data/schema: no changes made in this batch.
- Deployment target: Cloudflare Preview only; production deployment is out of scope without explicit approval.
