ALTER TABLE pool_notifications ADD COLUMN actor_id INTEGER REFERENCES users(id);
ALTER TABLE pool_notifications ADD COLUMN type TEXT NOT NULL DEFAULT 'ride'
  CHECK (type IN ('ride','chat','rating','alert','system'));
ALTER TABLE pool_notifications ADD COLUMN deleted_at TEXT;

UPDATE pool_notifications
SET type = CASE
  WHEN event_key LIKE '%chat%' THEN 'chat'
  WHEN event_key LIKE '%rating%' OR event_key LIKE '%feedback%' THEN 'rating'
  WHEN event_key LIKE 'broadcast:%' OR event_key LIKE '%verification%' OR event_key LIKE 'admin-%' THEN 'system'
  WHEN event_key LIKE '%cancel%' OR event_key LIKE '%delay%' OR event_key LIKE '%route%'
    OR event_key LIKE '%no-captain%' OR event_key LIKE '%expired%' OR event_key LIKE '%replacement%'
    OR event_key LIKE '%price%' THEN 'alert'
  ELSE 'ride'
END;

CREATE INDEX idx_pool_notifications_visible ON pool_notifications(user_id,deleted_at,created_at DESC);

CREATE TABLE pool_notification_mutes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES pool_groups(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id,group_id)
);
