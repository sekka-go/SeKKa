CREATE INDEX account_deletion_events_actor_idx
  ON public.account_deletion_events(actor_user_id, created_at DESC);
CREATE INDEX account_deletion_events_target_idx
  ON public.account_deletion_events(target_user_id, created_at DESC);
