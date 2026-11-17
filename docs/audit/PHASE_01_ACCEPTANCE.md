# seKKa Phase 01 — Acceptance report

Audited source SHA: `97d534a6d231948212fd8b5c56b322f89d37d997`. PASS means only the stated check/environment passed; it does not promote mock or anonymous evidence into real Staging acceptance.

## Acceptance requirements and evidence

| Requirement / check | Environment | Expected result | Actual result | Status | Evidence | Follow-up |
|---|---|---|---|---|---|---|
| PR branch/HEAD and worktree | Codespace + GitHub | Work on latest PR branch; preserve local state | Branch/PR/local/remote matched at `97d534a`; untracked PNGs untouched | PASS | PR #185 and report header | Audit-only commit must remain on same branch |
| Governing documentation and conflicts | Repository | Read all seven required docs; honor newer owner decisions | Read in full; OTP/payment conflict and mandatory Captain requirements recorded | PASS | Baseline report “Controlling requirements” | Keep later phases aligned |
| Exactly 73 canonical public screens | Source + structure test | 73, no obsolete 74th inventory | `canonicalTitles` contains 73; matrix has S001–S073 | PASS | `screenMap.ts`; `npm run test:structure` | Maintain canonical list |
| Real vs mock vs preview vs deferred | Source audit | Distinguish backend wiring from rendered UI | 32 partial-real, 14 mock-only, 14 UI-only, 13 owner-deferred; 0 verified-real | PASS | [Screen status](./PHASE_01_73_SCREEN_STATUS.md) | Phases 02–11 |
| Production action inventory | AST + source review | Important live CTAs include expected action, handler, persistence/error/test state | 504 JSX declarations indexed; primary production paths manually classified; not all 504 behaviors individually exercised | PASS (inventory) | [Action inventory](./PHASE_01_ACTION_INVENTORY.md), [CONTROL_INVENTORY.json](../CONTROL_INVENTORY.json) | Exhaustive human action acceptance belongs to Phase 11 |
| Staging project identity/provider | Current PR Staging preview + anonymous API | Target Staging only; Google available | Bundle targets `zgcvumykzivsvnlflbyp`, not Production; Auth settings HTTP 200 and Google enabled | PASS (public config only) | Current deployment status in PR #185; baseline report | Real Google sessions still required |
| Staging schema, RLS, functions, storage, migrations, advisors | Read-only public API | Validate expected schema/relationships/policies/grants and drift | Public aggregate probes done. 9 service areas; 0 anonymous-visible active make/model/color rows (source migration intentionally grants catalog reads to `authenticated`, so this is not evidence tables are empty); protected application/document/audit tables deny anon (`42501`); migration ledger/advisors/authenticated RLS/storage review unavailable | BLOCKED | Baseline report “Staging read-only evidence”; no data payloads captured | Authorized Staging operator must inspect migration ledger, authenticated catalog reads, RLS, Storage, advisors; never run writes in this phase |
| Staging write safety | Codespace | No writes, approvals, test rows, or Production operations | Only GET/HEAD reads of public config, aggregate counts, and read-only STABLE functions. Mutation scripts not run. | PASS | Baseline report; scripts inspected | Keep mutation acceptance out of Phase 01 |
| `npm ci` | `web/`, Node 24/npm 11 | Locked clean install | Completed; npm reported 9 moderate advisories, 0 high/critical | PASS (install); advisories remain | Local output; dependency audit aggregate in defect register | Review separately; no `npm audit fix` |
| `npm run typecheck` | `web/` local | TypeScript pass | Pass | PASS | Current-head CI run and local command | None |
| `npm run lint` | `web/` local | ESLint pass | Pass | PASS | Current-head CI run and local command | None |
| `npm test` | `web/` local | Existing tests pass | 78 passed, 0 failed, including the 9 new visual-evidence provenance tests | PASS | Local command on the current worktree | Unit tests are not Staging acceptance |
| `npm run test:structure` | `web/` local | Active frontend boundary passes | Pass; no retired-source dependency | PASS | Current-head CI run and local command | None |
| `npm run build` | `web/` local | Production build completes | Pass; 631 kB main JS chunk warning | PASS with warning | Current-head CI run and local command | Track chunk/startup size in later UI performance review |
| `npm run test:e2e` | Exact-HEAD clean source copy; local Vite preview | Test public navigation, guest gates, visual layouts; never hit Staging | 258 passed in 10.0 minutes; 0 failed | PASS (synthetic/local) | Local Playwright result; matching [current-head CI run](https://github.com/sekka-go/SeKKa/actions/runs/43740353641) | Real authenticated Staging journeys remain blocked |
| Critical guest entry routes | CI Playwright, synthetic/unauthenticated | Welcome → role → Google UI; Back; refresh; guest gates; unknown bookings safe | Current-head workflow passed public entry, browser history, refresh, booking guest gate, Admin guest gate, Captain gate, no fake results | PASS (guest/UI only) | Current-head [verify run](https://github.com/sekka-go/SeKKa/actions/runs/43740353641) | No authenticated acceptance |
| 360×800 / 390×844, AR/EN, Light/Dark screenshots | Current-head CI; guest/reference comparison | Capture requested focus states; distinguish mocks | S002/S003/S009/S010 references and production screenshots plus login/gate screenshots captured; geometry assertions pass. Selected artifact images reviewed. No full 73-screen approval. | PASS (focused guest baseline) | Artifacts `sekka-original-vs-integrated-layout` and `subscription-ui-evidence` on [run 43740353641](https://github.com/sekka-go/SeKKa/actions/runs/43740353641) | Phase 10 visual acceptance |
| 73-screen visual workflow source SHA | Workflow source + focused provenance tests | Evidence must match the workflow's exact source SHA | Workflow now resolves the Staging check for that SHA and the collector verifies deployed `build-info.json`; stale, missing, or redirected deployments fail. Focused provenance tests and local build pass; a Cloudflare run of this change is pending. Older captures remain stale. | PENDING CI | `.github/workflows/visual-evidence-73.yml`; `web/scripts/visual-evidence-provenance.test.mjs` | Confirm a successful post-change 584-pair artifact before citing it |
| Cloudflare preview deployment | GitHub Cloudflare checks + public GET | Preview corresponds to audited commit | Staging check says deployed successfully at `97d534a`; commit-specific and branch URLs returned HTTP 200 | PASS | PR #185 Cloudflare Staging check | Reconfirm after audit-only push |
| Production / approved assets / data preservation | Git/GitHub and operation log | No production deploy, DB changes, data reset, or asset change | None performed; docs/index only planned for commit; initial untracked images preserved | PASS | Worktree and Actions evidence | Do not merge/deploy |
| P0/P1 ownership | Defect review | Every P0/P1 issue has next action | No P0; three P1 entries have explicit owners/phases/actions | PASS | [Defect register](./PHASE_01_DEFECT_REGISTER.md) | Resolve Staging catalog blocker and evidence workflow before acceptance |
| Required Phase 01 documents | Repository | Five reports exist with actual findings | Baseline, 73-screen, defect, action, acceptance reports created | PASS | Links below | None |

## Local Playwright result

`npm run test:e2e` was launched from a clean archive of source SHA `97d534a6d231948212fd8b5c56b322f89d37d997`, with the already-installed dependencies linked read-only. Result: **258 passed, 0 failed, 10.0 minutes**. This kept Playwright-generated screenshots out of the user's worktree. The local Vite/browser suite is synthetic and does not authenticate against or write to Staging. CI independently ran the full E2E suite at the same SHA and passed.

## Phase 01 gates

| Gate | Decision |
|---|---|
| 1. Latest PR HEAD confirmed and worktree preserved | PASS |
| 2. Governing documents reviewed and conflicts identified | PASS |
| 3. All 73 screens inventoried individually | PASS |
| 4. Live/preview/deferred distinctions recorded | PASS |
| 5. Important production CTAs inventoried | PASS (source index plus key live-flow review; not a claim every click was exercised) |
| 6. Staging schema/security review without destructive operations | BLOCKED — authenticated migration/RLS/storage/advisor catalogs unavailable; empty public catalogs observed |
| 7. Existing tests executed and accurately reported | PASS — unit 69/69, Playwright 258/258, typecheck/lint/structure/build passed; all browser journeys are synthetic |
| 8. CI/deployment linked to actual SHA | PASS for the existing verification deployment; visual-evidence SHA enforcement is implemented and locally tested, with its post-change Cloudflare run pending |
| 9. Focused baseline screenshots collected | PASS for unauthenticated focus states only |
| 10. P0/P1 accountable next steps | PASS |
| 11. Five required deliverables exist | PASS |
| 12. No project data, Production resources, or approved assets altered | PASS |

## Decision

**BLOCKED.** Phase 01 is not a PASS while the authenticated Staging schema/security review remains unavailable and real Google/Captain/Admin acceptance is absent. The stale-preview workflow defect has a source-level fix with passing focused tests, but the post-change Cloudflare evidence run is still pending. Anonymous catalog counts are not evidence of empty Captain catalogs.

## Deliverables

- [Baseline report](./PHASE_01_BASELINE_REPORT.md)
- [73-screen status](./PHASE_01_73_SCREEN_STATUS.md)
- [Defect register](./PHASE_01_DEFECT_REGISTER.md)
- [Action/control inventory](./PHASE_01_ACTION_INVENTORY.md)
- [Acceptance report](./PHASE_01_ACCEPTANCE.md)
