CREATE INDEX IF NOT EXISTS users_role_idx
  ON public.users(role);

CREATE INDEX IF NOT EXISTS captain_profiles_verification_status_idx
  ON public.captain_profiles(verification_status);

CREATE INDEX IF NOT EXISTS trips_status_idx
  ON public.trips(status);

CREATE INDEX IF NOT EXISTS pool_groups_status_idx
  ON public.pool_groups(status);

CREATE INDEX IF NOT EXISTS captain_lines_active_created_idx
  ON public.captain_lines(created_at DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS demand_groups_captain_line_status_idx
  ON public.demand_groups(captain_line_id, status, trip_date, arrival_time);

CREATE INDEX IF NOT EXISTS payment_status_events_disputed_recent_idx
  ON public.payment_status_events(created_at DESC, id DESC, payment_id)
  WHERE to_status = 'disputed';
