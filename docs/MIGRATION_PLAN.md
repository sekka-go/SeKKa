# Migration and recovery plan

1. Preserve main at `f605e1e` and existing Pages production deployment. Work on `rebuild/subscriptions-20261112`.
2. Use a new private `sekka_v2` schema, with exactly one public RPC wrapper. No destructive migration or production table rewrite.
3. Rehearse on real local PostgreSQL 17. All test identities and credits are generated ONLY in temporary local databases; never run fixture setup on hosted production.
4. Apply only the reviewed v2 additive migration to create an isolated staging namespace. Do not run an unreviewed global db push: historical remote migrations are missing from git.
5. Preview uses explicit VITE_V2 variables; no fallback to legacy sessions or production API. Same hosted database infrastructure is shared, but tables/RPC/Storage namespace are isolated. This is not a separate Supabase project or Auth tenant.
6. Real-money activation, provider credit ingestion, withdrawals, renewals, legal terms and holiday calendar have hard gates. Initial hosted state contains no financial balance or route fixtures.
7. Never interpret public.users numeric IDs as auth.users UUIDs. Require re-verification or an approved identity mapping; migration must retain audit provenance and legal consent. Incompatible records stay in legacy tables; quarantine tracks reviewed mapping decisions, no automatic promotion.
8. Before any production cutover: obtain logical database and private-object backups through an authorized secure channel, restore in an isolated environment, compare table/object counts and ledger reconciliation, validate OTP provider, legal terms, official calendar, priority renewal rules, and ten verified real routes.
9. Present commit SHA, exact config changes and preview acceptance evidence. Request separate explicit production approval. No merge-to-main or DNS change before it.
10. Rollback: redeploy the previous Pages production build/commit; restore its original env configuration and legacy proxy. Keep new schema as inert audit evidence. No down migration or data deletion is necessary. If production v2 bookings ever exist, rollback requires a reconciliation/freeze plan first.
11. Retirement is a separate approval covering exact Edge functions, RPCs, cron jobs, tables, buckets and Pages deployments. Verify call logs and references first. Do not claim retirement while direct old API paths still respond.

No irreversible data transfer or cleanup is performed by this plan.
