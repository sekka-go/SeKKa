-- Phase 13 — سجل احتياطي الكابتن الثابت وحركات بديله.
-- السجل حسابي فقط؛ لا تُحجز أموال ولا تُنفذ تحويلات قبل ربط بوابة الدفع.
CREATE TABLE pool_captain_escrows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL UNIQUE REFERENCES pool_groups(id),
  original_captain_user_id INTEGER NOT NULL REFERENCES users(id),
  package_type TEXT NOT NULL CHECK (package_type IN ('weekly','monthly')),
  service_days INTEGER NOT NULL CHECK (service_days BETWEEN 1 AND 22),
  daily_captain_share_amount REAL NOT NULL CHECK (daily_captain_share_amount >= 0),
  reserved_amount REAL NOT NULL CHECK (reserved_amount >= 0),
  used_amount REAL NOT NULL DEFAULT 0 CHECK (used_amount >= 0 AND used_amount <= reserved_amount),
  released_amount REAL NOT NULL DEFAULT 0 CHECK (released_amount >= 0),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','released')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  closed_at TEXT
);

CREATE TABLE pool_captain_escrow_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  escrow_id INTEGER NOT NULL REFERENCES pool_captain_escrows(id),
  trip_id INTEGER NOT NULL UNIQUE REFERENCES pool_trips(id),
  original_captain_user_id INTEGER NOT NULL REFERENCES users(id),
  replacement_captain_user_id INTEGER NOT NULL REFERENCES users(id),
  amount_due REAL NOT NULL CHECK (amount_due >= 0),
  escrow_funded_amount REAL NOT NULL CHECK (escrow_funded_amount >= 0 AND escrow_funded_amount <= amount_due),
  unfunded_amount REAL NOT NULL CHECK (unfunded_amount >= 0),
  transfer_status TEXT NOT NULL DEFAULT 'pending' CHECK (transfer_status IN ('pending','transferred')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (ABS(amount_due - escrow_funded_amount - unfunded_amount) < 0.01)
);
CREATE INDEX idx_pool_escrows_status ON pool_captain_escrows(status,group_id);
CREATE INDEX idx_pool_escrow_transfers_replacement ON pool_captain_escrow_transfers(replacement_captain_user_id,transfer_status);

-- Backfill الباقات الثابتة الموجودة قبل إضافة سجل الاحتياطي.
INSERT INTO pool_captain_escrows(
  group_id,original_captain_user_id,package_type,service_days,
  daily_captain_share_amount,reserved_amount
)
SELECT g.id,g.fixed_captain_user_id,g.package_type,json_array_length(g.service_dates),
  ROUND(g.seat_day_fare*COALESCE(SUM(m.seats_reserved),0)*0.8,2),
  ROUND(g.seat_day_fare*COALESCE(SUM(m.seats_reserved),0)*0.8*MIN(4,json_array_length(g.service_dates)),2)
FROM pool_groups g
LEFT JOIN pool_members m ON m.group_id=g.id AND m.status='active'
WHERE g.fixed_captain_user_id IS NOT NULL
  AND g.package_type IN ('weekly','monthly')
  AND g.seat_day_fare IS NOT NULL
GROUP BY g.id;

CREATE TRIGGER trg_pool_escrow_transfers_no_update BEFORE UPDATE ON pool_captain_escrow_transfers
BEGIN SELECT RAISE(ABORT,'pool escrow transfers are append-only'); END;
CREATE TRIGGER trg_pool_escrow_transfers_no_delete BEFORE DELETE ON pool_captain_escrow_transfers
BEGIN SELECT RAISE(ABORT,'pool escrow transfers are append-only'); END;
