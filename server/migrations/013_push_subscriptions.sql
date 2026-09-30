-- Phase 14 — Web Push subscriptions. VAPID secrets stay in server environment only.
CREATE TABLE push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE CHECK (length(endpoint) BETWEEN 12 AND 4096),
  p256dh TEXT NOT NULL CHECK (length(p256dh) BETWEEN 16 AND 256),
  auth TEXT NOT NULL CHECK (length(auth) BETWEEN 8 AND 128),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id,id);
