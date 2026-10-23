# SeKKa legal, privacy, consent, and policy implementation review

**Review date:** 24 October 2026
**Status:** Product implementation draft; not approved for legal publication.
**Scope:** repository at review time, including `docs/PRD.pdf`, web app, Supabase Edge API, and checked-in migrations. Production settings and live database were not inspected or changed.

## Verified product facts

- SeKKa has Rider, Captain, and Admin roles. Riders search or request shared rides; Captains publish recurring lines and manage ride participation; Admins review accounts, verification documents, complaints, and operational records.
- The PRD describes direct rider-to-captain payment and no platform-held funds in Phase 1. The database/API also has payment declaration/confirmation and calculated balances, so the app records financial workflow state. The checked-in public `terms.html` instead described packages, refunds, and a 20% platform commission. Those statements were unsupported by the PRD and were removed from the active in-app draft.
- Signup collects a name, phone, role, and password. Passwords are hashed by the Edge API. No date of birth or age check was found in the signup flow.
- Captain verification accepts identity, driving/vehicle license, criminal-record, and drug-test document categories. The API stores documents in a private verification bucket and exposes administrative review operations.
- Ride and saved-place features use coordinates; the database also holds route geometry and captain current location. I found no browser geolocation watch/background tracking in the reviewed UI flow. A 30-day cleanup function exists in migrations and schedules itself only if `pg_cron` is available. Its presence or successful production runs were not verified.
- The API defaults to external Photon/Nominatim geocoding and OSRM routing; the web map loads OpenStreetMap tiles directly. Other integrations include Supabase, Cloudflare, Web Push, Telegram password recovery, and Twilio phone verification when enabled. Production regions, contracts, and cross-border transfer arrangements were not verified.
- The browser stores session token/user data in `localStorage`. Push subscription endpoints and encryption keys are stored server-side.
- Account deletion invokes a database redaction procedure, deletes verification/avatar objects and push subscriptions, and preserves some operational/audit data. Object deletion failures are logged while the API can still return success; deletion completion should be monitored and communicated accurately.
- The existing signup consent stored only the latest terms/privacy versions on `users`, and the Edge API required an older fixed version. It did not keep a per-document history or language. No existing-material-update re-acceptance flow was found.

## Policy inventory and implementation

| Policy / control | Product need | Current result |
|---|---|---|
| Terms of Service | Required for the two-sided ride coordination workflow, role-specific obligations, payments, and moderation | Updated in-app Arabic and English draft; available at `/terms`; marked as draft for counsel |
| Privacy Policy | Required for account, location, verification documents, trip history, messages, push, and vendors | Updated in-app Arabic and English draft; available at `/privacy`; identifies unresolved controller and transfer information |
| Contextual location notice | Needed because the app handles precise ride points and device location | Included in the privacy draft and existing location flow; OS permission is requested only in location-related actions according to reviewed UI |
| Safety / incident notice | Needed so users do not mistake matching or reporting for emergency response | Added to Terms draft; no emergency response promise is made |
| Payment, refund, cancellation policy | Needed to explain money exchanged and workflow records | Conflicting PRD/code/public-page claims remain unresolved; revised Terms avoids promising platform payment or refunds |
| Separate marketing consent | Not needed for a feature confirmed in this repository | No marketing opt-in added; no marketing campaign capability confirmed |
| Cookie notice | No non-essential browser-cookie analytics was confirmed in the frontend | No separate banner added; verify any production analytics or Cloudflare cookies before launch |
| In-app support / appeals | A contact path exists in UI, but mailbox monitoring, response SLA, and formal appeal procedure are unknown | Terms do not promise response times, compensation, emergency response, or an appeal process |

## Changes made

- Replaced the generic in-app legal copy with product-specific Arabic and English draft documents, dated 24 October 2026. Added public SPA routes `/terms` and `/privacy` and redirected the old static `.html` files to the current route so stale 20% commission/package claims are not served there.
- Split signup consent into a required Terms agreement and a separate Privacy Notice acknowledgement. Both documents must be opened and scrolled to the end before either control becomes available. No optional marketing or background-location consent is bundled into signup.
- Updated signup policy versions to `2026-10-24`; the Edge API now rejects missing/incorrect versions, missing acceptance/acknowledgement, and invalid locale.
- Added `policy_acceptances`, recording one row per document with user ID, version, locale, and database-generated acceptance time. Client roles have no table access; the trusted API can read but cannot directly insert/update/delete; a narrowly granted `SECURITY DEFINER` RPC creates the account and both acceptance rows atomically. A pgTAP privilege/RLS test was added.
- These migration and API changes are local only. Do not deploy the updated signup function before applying the migration. Existing accounts are not automatically forced to re-accept; a material-change re-consent design is still needed before treating these draft versions as production policy.

## Legal sources and preliminary issue classification

This is issue spotting, not a legal determination. The texts and rules applicable to SeKKa’s exact structure, role, and operations must be confirmed by Egyptian counsel.

| Topic | Preliminary status | Verified source / reason |
|---|---|---|
| Personal data processing | Clearly relevant; exact controller obligations need counsel | Egypt’s Law 151/2020 addresses electronic processing of personal data held by controllers/processors: [official SIS notice](https://sis.gov.eg/ar/%D8%A7%D9%84%D8%B1%D8%A6%D8%A7%D8%B3%D8%A9/%D8%B4%D8%A6%D9%88%D9%86-%D8%AF%D8%A7%D8%AE%D9%84%D9%8A%D8%A9/%D8%A7%D9%84%D9%82%D8%B1%D8%A7%D8%B1%D8%A7%D8%AA-%D8%A7%D9%84%D8%B1%D8%A6%D8%A7%D8%B3%D9%8A%D8%A9/%D8%A7%D9%84%D8%B1%D8%A6%D9%8A%D8%B3-%D8%A7%D9%84%D8%B3%D9%8A%D8%B3%D9%89-%D9%8A-%D8%B5%D8%AF-%D9%82-%D8%B9%D9%84%D9%89-%D9%82%D8%A7%D9%86%D9%88%D9%86-%D8%AD%D9%85%D8%A7%D9%8A%D8%A9-%D8%A7%D9%84%D8%A8%D9%8A%D8%A7%D9%86%D8%A7%D8%AA-%D8%A7%D9%84%D8%B4%D8%AE%D8%B5%D9%8A%D8%A9); [MCIT text of Law 151/2020](https://mcit.gov.eg/Upcont/Documents/Reports%20and%20Documents_1232021000_Law_No_151_2020_Personal_Data_Protection.pdf). |
| Executive data-protection requirements | Potentially applicable; verify current regulation and transitional status | The official [PDPC portal](https://pdpc.gov.eg/) and its regulation text must be checked by counsel. Secondary legal summaries identify Ministerial Decision 816/2025; this review does not rely on those summaries to assert a particular compliance deadline or licensing requirement. |
| Consumer / electronic service disclosures | Potentially applicable | Law 181/2018 is identified in the [WIPO Lex legislation record](https://www.wipo.int/wipolex/ar/legislation/details/19866). Whether and how its provider/platform duties apply to SeKKa depends on the finalized business model and contracting parties. |
| Electronic agreement and signature | Potentially relevant; do not characterize a checkbox as a certified digital signature | [ITIDA’s official overview](https://itida.gov.eg/Arabic/Pages/E-Signature.aspx) explains the regulated e-signature framework under Law 15/2004 and licensed providers. This app records click acceptance and timestamp; it does not implement a qualified signature certificate or trusted timestamp service. |
| Ride-sharing / road passenger licensing | Unresolved and potentially critical before paid operation | Law 87/2018 is specifically titled as regulating road passenger transport services through information technology. [Legislation record and text](https://manshurat.org/node/31510). Counsel must decide whether this recurring shared-ride marketplace is in scope, and identify permits, vehicle/driver rules, taxes, insurance, and recordkeeping obligations before launch. |
| Minor eligibility | Unresolved business/legal input | Signup has no age field or guardian-consent flow. Do not permit minors based on the current UI until counsel determines eligibility and safeguards. |
| International processing / transfer | Unresolved | Supabase, Cloudflare, and public mapping services are called, but production region, subprocessor and transfer terms were not available in the repository. |

## Prioritized legal and operational blockers before publication

1. **P0 — Identify operator/controller:** provide legal entity/person name, registered address, registration identifiers, privacy contact, and any representative/DPO details required after counsel review.
2. **P0 — Transport classification:** obtain written Egyptian transport counsel opinion on Law 87/2018 and applicable permits for this operating model; do this before paid commercial rides.
3. **P0 — Resolve product money flow:** decide whether riders pay captains directly, the platform collects/holds funds, charges fees/commission, or records only accounting entries. Reconcile PRD, UI, database logic, and terms.
4. **P0 — Verify privacy regulatory status:** counsel to assess Law 151/2020 and current executive rules, registration/licensing, DPO, sensitive data, breach handling, and vendor/data-transfer requirements.
5. **P1 — Verify 30-day deletion in production:** confirm `pg_cron` availability, scheduled job, successful run logs, and actual table coverage. Current migration only schedules when `pg_cron` exists.
6. **P1 — Specify eligibility and safety operations:** set minimum age, document access/retention, incident escalation, reporting ownership, and whether any support/appeals SLA exists. Do not advertise emergency assistance until staffed and tested.
7. **P1 — Publish a retention schedule:** include trip, message, complaint, admin audit, consent, backup, push, and verification records. Decide if consent history may remain linked after account deletion and for how long.
8. **P1 — Confirm contact channel:** verify who controls and monitors `sekkago.app@gmail.com`, establish request intake/response ownership, and publish a monitored privacy-rights path.
9. **P1 — Review data visibility and vendors:** inspect production role responses, storage bucket access, RLS, admin audit access, vendor contracts/regions, transfer safeguards, and map-provider disclosures.
10. **P2 — Re-consent and language precedence:** implement a non-coercive material-update gate and a process for users to leave/delete/export without accepting new optional processing. Counsel to approve authoritative language for Arabic and English.

## Verification gaps / limitations

- The active deployed Supabase schema and cron job were not queried. Migration history, RLS, storage configuration, vendor regions, and production logs remain unverified.
- The user-facing legal copies are drafts and contain explicit warnings about unresolved information; they are not ready for silent publication as final terms.
- This work does not establish licensing, legal compliance, liability allocation, insurance, or regulatory approval.
- The new acceptance table and Edge API must be deployed together. The migration has not been applied, and the updated registration API will fail until it is.
- Prior accounts keep their previous recorded versions. Renewed acceptance for already-registered users is not implemented.
- The browser reports no form of user-visible revision history yet; prior versions should be retained in source control and any approved policy archive.

## Read-only production follow-up — 24 October 2026

- The configured Supabase project is active and healthy. Its migration history ends at `20261010185858`; the new `policy_acceptances` table and `sekka_register_with_policy_acceptance_v1` RPC are absent.
- The deployed `sekka-api` function is version 55. Do not deploy the changed signup handler independently; it requires the absent migration.
- No Supabase development branches were available. No schema, data, secrets, or functions were changed during this follow-up.
