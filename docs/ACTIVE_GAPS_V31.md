# seKKa — PRD v3.1 gap register (2026-11-14)

Authority: [docs/PRD.md](PRD.md), exactly **73 public screens across eight stages**. This register distinguishes actual frontend behavior, tested simulations, and missing backend dependencies. Do not treat a rendered screen, existing control or green CI as full release acceptance.

## Concrete frontend audit findings

| Area | Current evidence | Outcome / next action |
|---|---|---|
| 73 routes and eight stages | `web/src/v2/screenMap.ts`; Playwright iterates all public IDs, Arabic/English phase previews | Route coverage verified, **not** individual control or visual approval |
| Registration, role/profile prerequisites | Shared sign-in/profile guard and return path, PR #174, Playwright | UI routing tested; OTP, identity and role grants still **not connected** |
| Route search and unmatched request | Search selection, eligible ordered stops, review/retry; domain/Playwright tests | Frontend preview; real search/matching and durable demand still require backend |
| Captain route publication | Local stops, dates, fixed price/period/direction, approval gate, pause/resume; tested | Local preview; real listing, review, inventory approval and concurrency unavailable |
| Booking/security | Session snapshot of offer, quote, stops; virtual EGP 100, two acknowledgements; tests | No real wallet or money movements, no server-side atomic seat allocation |
| Rider wallet / captain subscriber list | `readPreviewBookings()` and subscriber/receipt projections | Shared preview ledger only; no production persistent account history |
| **Admin booking, wallet, transactions** | Previously independent fixed fixtures despite interactive booking; PR #176 derives those three views from the shared session ledger when an interactive booking exists | Cross-stage E2E checks before and after both acknowledgements; fixed examples remain when no interactive session exists |
| Warning, empty states and back navigation | Dedicated PRs #170, #174 and #175; source inventory ~359 controls | Targeted paths tested; still need exhaustive control-by-control mobile acceptance |
| Localization and accessibility | Arabic/English catalog, RTL/LTR, system/manual preferences, mobile route test | All-screen visual/text overflow, dynamic data copy, keyboard/screen-reader acceptance **not complete** |
| Documentation | The canonical v3.1 document is authoritative; historical 74/78-screen docs removed from active tree | Do not revive old requirements from Git history |

## Open release blockers — not safe to invent or switch on

1. **Real services:** OTP/auth, profile and role permissions, captain documents/approval, real matching/demand, concurrent seat reservations, durable bookings and chat, push/notification delivery, admin audit and financial ledger.
2. **Payments and EGP 100 security:** bank/payment provider, actual credit/debit, refunds, idempotency and reconciliation; the UI uses explicit non-financial mock state.
3. **Unapproved policy inputs:** official Egyptian holiday calendar and its operating coverage, weekly cycle anchor/proration default, cancellation/renewal details and other PRD open decisions. Real calculations must fail closed when policy is unapproved.
4. **Product acceptance:** bilingual light/dark visual audit at mobile widths; screen-reader/keyboard testing; complete rider/captain/admin failure/retry/back journeys; screenshots and control inventory evidence per screen.
5. **Platform scope:** the current deliverable is a web PWA, not a verified Android/iOS native app.

## Release discipline

Current code is on `main` and Cloudflare Pages auto-deploys it. Every further change requires CI typecheck, lint, domain/historical tests, structure guard, production build and Playwright before production merge. **A mock booking or payment confirmation is never a real financial transaction.**

Project checklist: [Implementation status](IMPLEMENTATION_STATUS.md), [Screen inventory](product/SCREEN_INVENTORY.md), [UX actionability review](UX_ACTIONABILITY_PROGRESS.md).
