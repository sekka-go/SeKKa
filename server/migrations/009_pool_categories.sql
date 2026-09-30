-- Phase 10 — فئات Commute Pool (Proposal رقم 6، معتمد من المالك).
-- جدول جديد مستقل تمامًا (مفيش لمس لـ pricing_config/matches/trip_stops).
-- 4 فئات: Faster (3 مقاعد) / Saver (4 مقاعد) × مكيف / غير مكيف. الأرقام EGP،
-- قابلة للتعديل لاحقًا (updated_at) — مش Hardcoded في الكود.
CREATE TABLE pool_categories (
  id            TEXT PRIMARY KEY,
  speed_tier    TEXT NOT NULL CHECK (speed_tier IN ('faster', 'saver')),
  has_ac        INTEGER NOT NULL CHECK (has_ac IN (0, 1)),
  seats         INTEGER NOT NULL CHECK (seats >= 1),
  base_fee      REAL NOT NULL CHECK (base_fee >= 0),
  rate_per_km   REAL NOT NULL CHECK (rate_per_km >= 0),
  rate_per_min  REAL NOT NULL CHECK (rate_per_min >= 0),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO pool_categories (id, speed_tier, has_ac, seats, base_fee, rate_per_km, rate_per_min) VALUES
  ('faster_non_ac', 'faster', 0, 3, 10.0, 7.3, 0.50),
  ('faster_ac',     'faster', 1, 3, 12.0, 8.2, 0.60),
  ('saver_non_ac',  'saver',  0, 4, 15.0, 7.3, 0.75),
  ('saver_ac',      'saver',  1, 4, 17.0, 8.2, 0.85);
