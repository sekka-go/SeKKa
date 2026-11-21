# seKKa — Captain enrollment owner-approved correction (15 November 2026)

**Authority:** latest explicit owner decisions for Captain registration; this document overrides conflicting optional fields and manual category/seat selection in existing PRD v3.1 and frontend previews. Implement in the existing PR #185. Keep the total 73 approved screens and eight stages unchanged.

## 1. Vehicle type, automatic service eligibility, and fixed capacity

- Captain registers a **physical vehicle type** first: **Private car (ملاكي)** or **Hiace (هايس)**.
- **Private car automatically enables BOTH PRIME and SAVER.** These are not mutually exclusive registration choices, and there must be no "pick one category" selector in Captain vehicle enrollment.
- Existing approved category capacities are **PRIME = 3 passenger seats**, **SAVER = 4**, **SPACE = 9**, **MAX = 13**.
- Never let the Captain type, increment, decrement, or otherwise override a category's passenger capacity. Derive seat count **server-side** from the service category; display it as read-only information.
- Preserve SPACE and MAX as Hiace service categories with their fixed capacities; do not invent an automatic activation policy for Hiace beyond the current approved product rules.
- When building route offerings, allow only a category enabled for the actual registered vehicle. A vehicle can support multiple service categories but a given route offering has one category. Prevent double-selling the same physical seats across concurrent overlapping services using that vehicle; a UI-only capacity check is insufficient.
- Vehicle approval and suitability are determined by an authorized reviewer, not by a client-side toggle. A newly uploaded application is not an approved active fleet vehicle.

## 2. Required Captain fields

- Real full name, Egyptian mobile number, professional background, and years of experience are required before completing the personal-details stage. Explicit **0 years** is an entered value and is distinct from an absent value.
- Mobile phone is **required but unverified** until real phone verification exists; do NOT turn OTP on.
- Every currently required identity/vehicle document in the onboarding flow must be present before final submission: identity, driving license, vehicle license, and vehicle photo. Keep files private and enforce access rules in Supabase Storage.
- Save incomplete drafts and keep previously entered data on navigation; **do not permit moving to the next step or submitting/approving an incomplete application**. The *final-submit RPC* must independently enforce completeness.
- Never auto-approve; Admin must use server-owned authorization and review the application and its documents.

## 3. Required vehicle fields

- Vehicle type, manufacturer/make, specific model, manufacture year, color, and Egyptian license plate are **required**.
- Make must use a maintained selectable manufacturer catalog; model options depend on the selected make. Do not confuse the vehicle's model with its manufacturing year (e.g. Cerato / 2010).
- Use a valid, versioned model catalog that can be extended by Admin. Do not hardcode a tiny incomplete list as the only valid vehicle makes/models.
- Year must be selected from valid years; color must be selected from a bilingual catalog (with a validated Other/custom path if needed). No placeholder or blank value can be submitted.
- Vehicle details must persist in Supabase, not just component state or mock state.
- Avoid adding duplicate vehicles for the same license plate. Preserve existing draft records through backward-compatible schema migrations.

## 4. Database and authorization acceptance

- Inspect the current schemas and SQL functions: `v31_captain_applications`, `v31_vehicles`, `v31_save_captain_vehicle_intent`, `v31_save_captain_application`, `v31_submit_captain_application`, and Admin approval RPCs.
- Implement versioned, reviewable migrations on **Staging only**. Preserve existing users/applications. Restrict any additional personal columns through RLS. Validate required fields and allowed service categories at the database boundary.
- Final submission must fail closed on missing personal details, vehicle fields, invalid phone, and missing document kinds. Admin approval must not bypass completeness checks.
- Do not allow clients to fabricate category eligibility or passenger capacity. Verify both category activation and seat capacity on the backend where the route is created/published/booked.
- Existing stored drafts with missing fields remain drafts and require completion; do not silently approve them.

## 5. User interface (screens S035–S041, related fleet and route screens)

- Keep original approved design language and full mobile viewport, but use correct scrollable form layout with no overlapping controls.
- Vehicle type first; display automatically enabled Private categories **PRIME + SAVER** together as informative badges/text rather than a single-choice selector.
- No editable `planned seats` field; show fixed passenger seats for each eligible service category.
- Dependent selectors for make -> model, then year and color; required plate.
- Remove all "optional" labels from required Captain and vehicle inputs and provide accessible bilingual/RTL/LTR error messages.
- The next-step action must validate and persist before navigating. No cross-role navigation.
- Review screen should display all required information and document completion status, and block final submission when incomplete.

## 6. Verification and boundaries

- Unit/contract tests for fixed category capacities, automatic PRIME+SAVER eligibility, required data, model selection, missing documents, role guards and idempotency.
- Playwright at 320/360/390/412px Arabic/English Light/Dark, including keyboard, scroll, Back and data persistence.
- Authenticated Staging: actual Captain draft -> fill required fields -> upload documents -> submit -> Admin review -> approve -> approved fleet vehicle -> route with correct category/capacity. Reject incomplete and unauthorized attempts.
- Keep Google OAuth, PR #185, 73 screens, and existing staged data. **No Production Supabase writes, Production deployment, merge, OTP, payment or wallet reactivation.**
- Do not claim real-world end-to-end success from mocked sessions or merely green CI.
