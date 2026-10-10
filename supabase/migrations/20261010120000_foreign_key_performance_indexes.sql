-- Cover frequently checked/referenced foreign keys reported by the Supabase
-- performance advisor. The indexes are intentionally additive and do not
-- change RLS, grants, or application query semantics.
CREATE INDEX IF NOT EXISTS audit_log_actor_user_id_idx
  ON public.audit_log (actor_user_id);

CREATE INDEX IF NOT EXISTS commuter_board_campaigns_created_by_admin_idx
  ON public.commuter_board_campaigns (created_by_admin);

CREATE INDEX IF NOT EXISTS direct_messages_sender_user_id_idx
  ON public.direct_messages (sender_user_id);

CREATE INDEX IF NOT EXISTS message_conversations_last_message_sender_id_idx
  ON public.message_conversations (last_message_sender_id);

CREATE INDEX IF NOT EXISTS pool_notification_mutes_group_id_idx
  ON public.pool_notification_mutes (group_id);

CREATE INDEX IF NOT EXISTS pool_notifications_actor_id_idx
  ON public.pool_notifications (actor_id);
