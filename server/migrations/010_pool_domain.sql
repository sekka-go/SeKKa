-- Phase 11 — Commute Pool domain. Kept separate from matches/trips/trip_stops.
PRAGMA foreign_keys = ON;

CREATE TABLE pool_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_by_user_id INTEGER NOT NULL REFERENCES users(id),
  category_id TEXT NOT NULL REFERENCES pool_categories(id),
  package_type TEXT NOT NULL CHECK (package_type IN ('daily','weekly','monthly')),
  service_dates TEXT NOT NULL,
  morning_departure TEXT NOT NULL CHECK (morning_departure GLOB '[0-2][0-9]:[0-5][0-9]'),
  return_departure TEXT NOT NULL CHECK (return_departure GLOB '[0-2][0-9]:[0-5][0-9]'),
  status TEXT NOT NULL CHECK (status IN ('waiting','minimum_met','active','price_review','needs_captain','cancelled','completed')) DEFAULT 'waiting',
  route_distance_km REAL CHECK (route_distance_km IS NULL OR route_distance_km >= 0),
  route_duration_min REAL CHECK (route_duration_min IS NULL OR route_duration_min >= 0),
  seat_day_fare REAL CHECK (seat_day_fare IS NULL OR seat_day_fare >= 0),
  route_geometry TEXT,
  route_version INTEGER NOT NULL DEFAULT 0,
  fixed_captain_user_id INTEGER REFERENCES users(id),
  waiting_since TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE pool_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES pool_groups(id),
  rider_user_id INTEGER NOT NULL REFERENCES users(id),
  pickup_lat REAL NOT NULL CHECK (pickup_lat BETWEEN -90 AND 90),
  pickup_lng REAL NOT NULL CHECK (pickup_lng BETWEEN -180 AND 180),
  dropoff_lat REAL NOT NULL CHECK (dropoff_lat BETWEEN -90 AND 90),
  dropoff_lng REAL NOT NULL CHECK (dropoff_lng BETWEEN -180 AND 180),
  seats_reserved INTEGER NOT NULL DEFAULT 1 CHECK (seats_reserved >= 1),
  status TEXT NOT NULL CHECK (status IN ('awaiting_confirmation','active','cancelled')) DEFAULT 'active',
  price_decision TEXT NOT NULL CHECK (price_decision IN ('pending','accepted')) DEFAULT 'pending',
  pickup_order INTEGER NOT NULL DEFAULT 0 CHECK (pickup_order >= 0),
  joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  cancelled_at TEXT,
  UNIQUE(group_id, rider_user_id)
);
CREATE INDEX idx_pool_members_group_status ON pool_members(group_id,status);
CREATE INDEX idx_pool_members_rider ON pool_members(rider_user_id,status);

CREATE TABLE pool_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES pool_groups(id),
  member_id INTEGER NOT NULL UNIQUE REFERENCES pool_members(id),
  package_type TEXT NOT NULL CHECK (package_type IN ('daily','weekly','monthly')),
  seat_day_fare REAL NOT NULL CHECK (seat_day_fare >= 0),
  discount_rate REAL NOT NULL CHECK (discount_rate BETWEEN 0 AND 0.10),
  service_days INTEGER NOT NULL CHECK (service_days >= 1),
  seats_reserved INTEGER NOT NULL CHECK (seats_reserved >= 1),
  amount_due REAL NOT NULL CHECK (amount_due >= 0),
  cancelled_at TEXT,
  refund_amount REAL NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE pool_trips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES pool_groups(id),
  service_date TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('outbound','return')),
  departure_at TEXT NOT NULL,
  estimated_arrival_at TEXT,
  captain_user_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('scheduled','assigned','in_progress','completed','cancelled','needs_captain')) DEFAULT 'scheduled',
  started_at TEXT,
  completed_at TEXT,
  UNIQUE(group_id,service_date,direction)
);
CREATE INDEX idx_pool_trips_captain_time ON pool_trips(captain_user_id,departure_at,status);
CREATE INDEX idx_pool_trips_status_time ON pool_trips(status,departure_at);

CREATE TABLE pool_trip_stops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL REFERENCES pool_trips(id),
  member_id INTEGER NOT NULL REFERENCES pool_members(id),
  stop_type TEXT NOT NULL CHECK (stop_type IN ('pickup','dropoff')),
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  lat REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng REAL NOT NULL CHECK (lng BETWEEN -180 AND 180),
  reached_at TEXT,
  UNIQUE(trip_id,sequence),
  UNIQUE(trip_id,member_id,stop_type)
);

CREATE TABLE pool_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL REFERENCES pool_trips(id),
  member_id INTEGER NOT NULL REFERENCES pool_members(id),
  list_amount REAL NOT NULL CHECK (list_amount >= 0),
  rider_amount REAL NOT NULL CHECK (rider_amount >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(trip_id,member_id)
);

CREATE TABLE pool_trip_cancellations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL REFERENCES pool_trips(id),
  member_id INTEGER NOT NULL REFERENCES pool_members(id),
  charge_amount REAL NOT NULL CHECK (charge_amount >= 0),
  refund_amount REAL NOT NULL CHECK (refund_amount >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(trip_id,member_id)
);

CREATE TABLE pool_captain_stats (
  captain_user_id INTEGER PRIMARY KEY REFERENCES users(id),
  absences INTEGER NOT NULL DEFAULT 0 CHECK (absences >= 0),
  search_radius_km REAL NOT NULL DEFAULT 4 CHECK (search_radius_km BETWEEN 4 AND 10)
);

CREATE TABLE pool_captain_capabilities (
  captain_user_id INTEGER PRIMARY KEY REFERENCES users(id),
  has_ac INTEGER NOT NULL CHECK (has_ac IN (0,1)),
  accepts_faster INTEGER NOT NULL DEFAULT 1 CHECK (accepts_faster IN (0,1)),
  accepts_saver INTEGER NOT NULL DEFAULT 1 CHECK (accepts_saver IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (accepts_faster=1 OR accepts_saver=1)
);

CREATE TABLE pool_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  group_id INTEGER REFERENCES pool_groups(id),
  event_key TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  read_at TEXT,
  UNIQUE(user_id,event_key)
);
CREATE INDEX idx_pool_notifications_user ON pool_notifications(user_id,read_at,id);

CREATE TRIGGER trg_pool_groups_creator_role BEFORE INSERT ON pool_groups
FOR EACH ROW WHEN (SELECT role FROM users WHERE id=NEW.created_by_user_id) NOT IN ('rider','captain')
BEGIN SELECT RAISE(ABORT,'pool group creator must be rider or captain'); END;
CREATE TRIGGER trg_pool_members_rider_role BEFORE INSERT ON pool_members
FOR EACH ROW WHEN (SELECT role FROM users WHERE id=NEW.rider_user_id) <> 'rider'
BEGIN SELECT RAISE(ABORT,'pool member must be a rider'); END;
CREATE TRIGGER trg_pool_trips_captain_role BEFORE UPDATE OF captain_user_id ON pool_trips
FOR EACH ROW WHEN NEW.captain_user_id IS NOT NULL AND (SELECT role FROM users WHERE id=NEW.captain_user_id) <> 'captain'
BEGIN SELECT RAISE(ABORT,'pool trip captain must be a captain'); END;
CREATE TRIGGER trg_pool_ledger_no_update BEFORE UPDATE ON pool_ledger
BEGIN SELECT RAISE(ABORT,'pool ledger is append-only'); END;
CREATE TRIGGER trg_pool_ledger_no_delete BEFORE DELETE ON pool_ledger
BEGIN SELECT RAISE(ABORT,'pool ledger is append-only'); END;
