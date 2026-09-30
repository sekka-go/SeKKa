-- Phase 12 — Deferred company/captain settlement fields for Commute Pool.
-- Payment capture and payout execution remain intentionally deferred.
ALTER TABLE pool_ledger ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0 CHECK (discount_amount >= 0);
ALTER TABLE pool_ledger ADD COLUMN company_share_amount REAL NOT NULL DEFAULT 0 CHECK (company_share_amount >= 0);
ALTER TABLE pool_ledger ADD COLUMN captain_share_amount REAL NOT NULL DEFAULT 0 CHECK (captain_share_amount >= 0);
ALTER TABLE pool_ledger ADD COLUMN company_commission_rate REAL NOT NULL DEFAULT 0.20 CHECK (company_commission_rate BETWEEN 0 AND 1);
ALTER TABLE pool_ledger ADD COLUMN settlement_status TEXT NOT NULL DEFAULT 'pending' CHECK (settlement_status IN ('pending','settled','voided'));
