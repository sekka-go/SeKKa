# PRD v3.1 — 73-screen implementation audit

Authority: [PRD v3.1](../PRD.md). This is implementation evidence, not an alternative specification. No screen is marked fully compliant while complete bilingual acceptance remains outstanding. Internal view IDs are implementation details; public URLs follow these IDs.

| ID | Functional screen | Classification | Implementation | Remaining validation / gap |
|---|---|---|---|---|
| 1 | Splash | Implemented but needs modification | `web/src/v2/Onboarding.tsx` | OTP and session integration disabled; English copy and live-state acceptance pending. |
| 2 | Welcome | Implemented but needs modification | `web/src/v2/Onboarding.tsx` | OTP and session integration disabled; English copy and live-state acceptance pending. |
| 3 | Account Type | Implemented but needs modification | `web/src/v2/Onboarding.tsx` | OTP and session integration disabled; English copy and live-state acceptance pending. |
| 4 | Phone Number | Implemented but needs modification | `web/src/v2/Onboarding.tsx` | OTP and session integration disabled; English copy and live-state acceptance pending. |
| 5 | OTP | Implemented but needs modification | `web/src/v2/Onboarding.tsx` | OTP and session integration disabled; English copy and live-state acceptance pending. |
| 6 | Complete Profile | Implemented but needs modification | `web/src/v2/Onboarding.tsx` | OTP and session integration disabled; English copy and live-state acceptance pending. |
| 7 | Permissions | Implemented but needs modification | `web/src/v2/Onboarding.tsx` | OTP and session integration disabled; English copy and live-state acceptance pending. |
| 8 | Rider Home | Implemented but needs modification | `web/src/v2/Discovery.tsx` | Stops/request corrections implemented; matching alternatives, mock persistence and complete English copy pending. |
| 9 | Route Search | Implemented but needs modification | `web/src/v2/Discovery.tsx` | Stops/request corrections implemented; matching alternatives, mock persistence and complete English copy pending. |
| 10 | Filters | Implemented but needs modification | `web/src/v2/Discovery.tsx` | Stops/request corrections implemented; matching alternatives, mock persistence and complete English copy pending. |
| 11 | Search Results / No Results | Implemented but needs modification | `web/src/v2/Discovery.tsx` | Stops/request corrections implemented; matching alternatives, mock persistence and complete English copy pending. |
| 12 | Offer Details & Route Stops | Implemented but needs modification | `web/src/v2/Discovery.tsx` | Stops/request corrections implemented; matching alternatives, mock persistence and complete English copy pending. |
| 13 | Favorites | Implemented but needs modification | `web/src/v2/Discovery.tsx` | Stops/request corrections implemented; matching alternatives, mock persistence and complete English copy pending. |
| 14 | Route Request Review & Confirmation | Implemented but needs modification | `web/src/v2/Discovery.tsx` | Stops/request corrections implemented; matching alternatives, mock persistence and complete English copy pending. |
| 15 | Booking Summary | Implemented but needs modification | `web/src/v2/BookingFlow.tsx` | Monthly rule corrected; immutable preview snapshot and selected-stop recovery across reload pending. |
| 16 | Booking Security | Implemented but needs modification | `web/src/v2/BookingFlow.tsx` | Monthly rule corrected; immutable preview snapshot and selected-stop recovery across reload pending. |
| 17 | Booking Confirmation | Implemented but needs modification | `web/src/v2/BookingFlow.tsx` | Monthly rule corrected; immutable preview snapshot and selected-stop recovery across reload pending. |
| 18 | Subscription Details & Captain/Vehicle Information | Implemented but needs modification | `web/src/v2/BookingFlow.tsx` | Monthly rule corrected; immutable preview snapshot and selected-stop recovery across reload pending. |
| 19 | Rider Payment Confirmation | Implemented but needs modification | `web/src/v2/BookingFlow.tsx` | Monthly rule corrected; immutable preview snapshot and selected-stop recovery across reload pending. |
| 20 | Captain Receipt Confirmation / Security Status | Implemented but needs modification | `web/src/v2/BookingFlow.tsx` | Monthly rule corrected; immutable preview snapshot and selected-stop recovery across reload pending. |
| 21 | Subscription Management & Renewal | Implemented but needs modification | `web/src/v2/BookingFlow.tsx` | Monthly rule corrected; immutable preview snapshot and selected-stop recovery across reload pending. |
| 22 | Wallet | Implemented but needs modification | `web/src/v2/WalletFlow.tsx` | Simulated balances only; complete English copy pending. |
| 23 | Top Up | Implemented but needs modification | `web/src/v2/WalletFlow.tsx` | Simulated balances only; complete English copy pending. |
| 24 | Top-Up Result | Implemented but needs modification | `web/src/v2/WalletFlow.tsx` | Simulated balances only; complete English copy pending. |
| 25 | Withdraw | Implemented but needs modification | `web/src/v2/WalletFlow.tsx` | Simulated balances only; complete English copy pending. |
| 26 | Transactions | Implemented but needs modification | `web/src/v2/WalletFlow.tsx` | Simulated balances only; complete English copy pending. |
| 27 | My Subscriptions | Implemented but needs modification | `web/src/v2/AccountFlow.tsx` | Preference controls at 32; complete English copy and end-to-end flow review pending. |
| 28 | Past Subscriptions | Implemented but needs modification | `web/src/v2/AccountFlow.tsx` | Preference controls at 32; complete English copy and end-to-end flow review pending. |
| 29 | Chats | Implemented but needs modification | `web/src/v2/AccountFlow.tsx` | Preference controls at 32; complete English copy and end-to-end flow review pending. |
| 30 | Captain Chat | Implemented but needs modification | `web/src/v2/AccountFlow.tsx` | Preference controls at 32; complete English copy and end-to-end flow review pending. |
| 31 | Notifications | Implemented but needs modification | `web/src/v2/AccountFlow.tsx` | Preference controls at 32; complete English copy and end-to-end flow review pending. |
| 32 | My Account & Settings | Implemented but needs modification | `web/src/v2/AccountFlow.tsx` | Preference controls at 32; complete English copy and end-to-end flow review pending. |
| 33 | Edit Profile | Implemented but needs modification | `web/src/v2/AccountFlow.tsx` | Preference controls at 32; complete English copy and end-to-end flow review pending. |
| 34 | Help & Support | Implemented but needs modification | `web/src/v2/AccountFlow.tsx` | Preference controls at 32; complete English copy and end-to-end flow review pending. |
| 35 | Captain Registration | Implemented but needs modification | `web/src/v2/CaptainOnboarding.tsx` | Local previews only; full localization and dual-role journey review pending. |
| 36 | Personal Details | Implemented but needs modification | `web/src/v2/CaptainOnboarding.tsx` | Local previews only; full localization and dual-role journey review pending. |
| 37 | Vehicle & Category | Implemented but needs modification | `web/src/v2/CaptainOnboarding.tsx` | Local previews only; full localization and dual-role journey review pending. |
| 38 | Documents | Implemented but needs modification | `web/src/v2/CaptainOnboarding.tsx` | Local previews only; full localization and dual-role journey review pending. |
| 39 | Review Submission | Implemented but needs modification | `web/src/v2/CaptainOnboarding.tsx` | Local previews only; full localization and dual-role journey review pending. |
| 40 | Approval Status | Implemented but needs modification | `web/src/v2/CaptainOnboarding.tsx` | Local previews only; full localization and dual-role journey review pending. |
| 41 | Activation | Implemented but needs modification | `web/src/v2/CaptainOnboarding.tsx` | Local previews only; full localization and dual-role journey review pending. |
| 42 | My Routes | Implemented but needs modification | `web/src/v2/CaptainRoutes.tsx` | Route wizard now provides ordered stop authoring, fixed offer, capacity/approval validation and local publication. English titles and full acceptance pending. |
| 43 | Create Route | Implemented but needs modification | `web/src/v2/CaptainRoutes.tsx` | Route wizard now provides ordered stop authoring, fixed offer, capacity/approval validation and local publication. English titles and full acceptance pending. |
| 44 | Origin, Destination & Stops | Implemented but needs modification | `web/src/v2/CaptainRoutes.tsx` | Route wizard now provides ordered stop authoring, fixed offer, capacity/approval validation and local publication. English titles and full acceptance pending. |
| 45 | Outbound/Return Schedule | Implemented but needs modification | `web/src/v2/CaptainRoutes.tsx` | Route wizard now provides ordered stop authoring, fixed offer, capacity/approval validation and local publication. English titles and full acceptance pending. |
| 46 | Direction & Duration | Implemented but needs modification | `web/src/v2/CaptainRoutes.tsx` | Route wizard now provides ordered stop authoring, fixed offer, capacity/approval validation and local publication. English titles and full acceptance pending. |
| 47 | Price & Capacity | Implemented but needs modification | `web/src/v2/CaptainRoutes.tsx` | Route wizard now provides ordered stop authoring, fixed offer, capacity/approval validation and local publication. English titles and full acceptance pending. |
| 48 | Review & Publish | Implemented but needs modification | `web/src/v2/CaptainRoutes.tsx` | Route wizard now provides ordered stop authoring, fixed offer, capacity/approval validation and local publication. English titles and full acceptance pending. |
| 49 | Edit/Pause/Manage Route | Implemented but needs modification | `web/src/v2/CaptainRoutes.tsx` | Route wizard now provides ordered stop authoring, fixed offer, capacity/approval validation and local publication. English titles and full acceptance pending. |
| 50 | Captain Home | Implemented but needs modification | `web/src/v2/CaptainOperations.tsx` | Local previews; preferences at 60; selected rider stop snapshots and complete English copy pending. |
| 51 | New Bookings | Implemented but needs modification | `web/src/v2/CaptainOperations.tsx` | Local previews; preferences at 60; selected rider stop snapshots and complete English copy pending. |
| 52 | Subscribers | Implemented but needs modification | `web/src/v2/CaptainOperations.tsx` | Local previews; preferences at 60; selected rider stop snapshots and complete English copy pending. |
| 53 | Subscription Details | Implemented but needs modification | `web/src/v2/CaptainOperations.tsx` | Local previews; preferences at 60; selected rider stop snapshots and complete English copy pending. |
| 54 | Daily Operations | Implemented but needs modification | `web/src/v2/CaptainOperations.tsx` | Local previews; preferences at 60; selected rider stop snapshots and complete English copy pending. |
| 55 | Confirm Payment Received | Implemented but needs modification | `web/src/v2/CaptainOperations.tsx` | Local previews; preferences at 60; selected rider stop snapshots and complete English copy pending. |
| 56 | Chats | Implemented but needs modification | `web/src/v2/CaptainOperations.tsx` | Local previews; preferences at 60; selected rider stop snapshots and complete English copy pending. |
| 57 | Rider Chat | Implemented but needs modification | `web/src/v2/CaptainOperations.tsx` | Local previews; preferences at 60; selected rider stop snapshots and complete English copy pending. |
| 58 | Notifications | Implemented but needs modification | `web/src/v2/CaptainOperations.tsx` | Local previews; preferences at 60; selected rider stop snapshots and complete English copy pending. |
| 59 | Payment Acknowledgment Records | Implemented but needs modification | `web/src/v2/CaptainOperations.tsx` | Local previews; preferences at 60; selected rider stop snapshots and complete English copy pending. |
| 60 | Captain Profile & Settings | Implemented but needs modification | `web/src/v2/CaptainOperations.tsx` | Local previews; preferences at 60; selected rider stop snapshots and complete English copy pending. |
| 61 | Support | Implemented but needs modification | `web/src/v2/CaptainOperations.tsx` | Local previews; preferences at 60; selected rider stop snapshots and complete English copy pending. |
| 62 | Admin Dashboard | Implemented but needs modification | `web/src/v2/AdminDashboard.tsx` | Local previews only; full English copy and cross-stage shared mock data pending. |
| 63 | Users | Implemented but needs modification | `web/src/v2/AdminDashboard.tsx` | Local previews only; full English copy and cross-stage shared mock data pending. |
| 64 | Captains | Implemented but needs modification | `web/src/v2/AdminDashboard.tsx` | Local previews only; full English copy and cross-stage shared mock data pending. |
| 65 | Document Review | Implemented but needs modification | `web/src/v2/AdminDashboard.tsx` | Local previews only; full English copy and cross-stage shared mock data pending. |
| 66 | Vehicles & Categories | Implemented but needs modification | `web/src/v2/AdminDashboard.tsx` | Local previews only; full English copy and cross-stage shared mock data pending. |
| 67 | Routes | Implemented but needs modification | `web/src/v2/AdminDashboard.tsx` | Local previews only; full English copy and cross-stage shared mock data pending. |
| 68 | Bookings | Implemented but needs modification | `web/src/v2/AdminDashboard.tsx` | Local previews only; full English copy and cross-stage shared mock data pending. |
| 69 | Wallets & Security | Implemented but needs modification | `web/src/v2/AdminDashboard.tsx` | Local previews only; full English copy and cross-stage shared mock data pending. |
| 70 | Financial Transactions | Implemented but needs modification | `web/src/v2/AdminDashboard.tsx` | Local previews only; full English copy and cross-stage shared mock data pending. |
| 71 | Complaints & Support | Implemented but needs modification | `web/src/v2/AdminDashboard.tsx` | Local previews only; full English copy and cross-stage shared mock data pending. |
| 72 | Announcements | Implemented but needs modification | `web/src/v2/AdminDashboard.tsx` | Local previews only; full English copy and cross-stage shared mock data pending. |
| 73 | Settings & Permissions | Implemented but needs modification | `web/src/v2/AdminDashboard.tsx` | Local previews only; full English copy and cross-stage shared mock data pending. |

Redundant: former standalone captain/vehicle view 13 is removed from discovery and maps to subscription details, public 18. Existing historical source files are not additional active screens.
