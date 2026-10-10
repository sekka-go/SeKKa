-- Account deletion is a privacy-preserving tombstone so financial and trip
-- history remains referentially valid while personal credentials are erased.
ALTER TABLE public.users ADD COLUMN deleted_at timestamptz;
CREATE INDEX users_active_created_idx ON public.users(created_at DESC) WHERE deleted_at IS NULL;

-- Location data is removed from retained trip rows when the linked account is
-- deleted. NULL is the explicit redaction marker; it must not be replaced by
-- fabricated coordinates.
ALTER TABLE public.daily_commute_requests
  ALTER COLUMN pickup_lat DROP NOT NULL,
  ALTER COLUMN pickup_lng DROP NOT NULL,
  ALTER COLUMN dropoff_lat DROP NOT NULL,
  ALTER COLUMN dropoff_lng DROP NOT NULL;
ALTER TABLE public.pool_members
  ALTER COLUMN pickup_lat DROP NOT NULL,
  ALTER COLUMN pickup_lng DROP NOT NULL,
  ALTER COLUMN dropoff_lat DROP NOT NULL,
  ALTER COLUMN dropoff_lng DROP NOT NULL;
ALTER TABLE public.pool_trip_stops
  ALTER COLUMN lat DROP NOT NULL,
  ALTER COLUMN lng DROP NOT NULL;
ALTER TABLE public.trip_stops
  ALTER COLUMN lat DROP NOT NULL,
  ALTER COLUMN lng DROP NOT NULL;
ALTER TABLE public.demand_requests
  ALTER COLUMN pickup_label DROP NOT NULL,
  ALTER COLUMN pickup_lat DROP NOT NULL,
  ALTER COLUMN pickup_lng DROP NOT NULL,
  ALTER COLUMN dropoff_label DROP NOT NULL,
  ALTER COLUMN dropoff_lat DROP NOT NULL,
  ALTER COLUMN dropoff_lng DROP NOT NULL;
ALTER TABLE public.demand_groups
  ALTER COLUMN origin_lat DROP NOT NULL,
  ALTER COLUMN origin_lng DROP NOT NULL,
  ALTER COLUMN destination_lat DROP NOT NULL,
  ALTER COLUMN destination_lng DROP NOT NULL;
ALTER TABLE public.captain_lines
  ALTER COLUMN origin_label DROP NOT NULL,
  ALTER COLUMN origin_lat DROP NOT NULL,
  ALTER COLUMN origin_lng DROP NOT NULL,
  ALTER COLUMN destination_label DROP NOT NULL,
  ALTER COLUMN destination_lat DROP NOT NULL,
  ALTER COLUMN destination_lng DROP NOT NULL;

CREATE TABLE public.account_deletion_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id integer NOT NULL REFERENCES public.users(id),
  target_user_id integer NOT NULL REFERENCES public.users(id),
  deletion_type text NOT NULL CHECK (deletion_type IN ('self_service','admin')),
  reason text CHECK (reason IS NULL OR char_length(reason) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_deletion_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletion_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.account_deletion_events TO service_role;

CREATE OR REPLACE FUNCTION public.sekka_delete_account_v1(
  p_actor_user_id integer,
  p_target_user_id integer,
  p_reason text DEFAULT NULL
) RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor_role text;
  deleted_on timestamptz := now();
  is_admin_deletion boolean := p_actor_user_id <> p_target_user_id;
BEGIN
  IF p_actor_user_id IS NULL OR p_target_user_id IS NULL OR p_actor_user_id < 1 OR p_target_user_id < 1 THEN
    RAISE EXCEPTION 'invalid account identifier' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NOT NULL AND char_length(btrim(p_reason)) > 1000 THEN
    RAISE EXCEPTION 'deletion reason is too long' USING ERRCODE = '22023';
  END IF;

  SELECT role INTO actor_role FROM public.users WHERE id = p_actor_user_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'actor account not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM 1 FROM public.users WHERE id = p_target_user_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'target account not found or already deleted' USING ERRCODE = 'P0002'; END IF;

  -- Bootstrap and explicitly granted super administrators cannot be removed,
  -- preserving the only operational recovery path for privileged controls.
  IF EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = p_target_user_id) THEN
    RAISE EXCEPTION 'protected super administrator account' USING ERRCODE = '42501';
  END IF;
  IF is_admin_deletion THEN
    IF actor_role <> 'admin' THEN RAISE EXCEPTION 'administrator role required' USING ERRCODE = '42501'; END IF;
    PERFORM public.sekka_require_super_admin(p_actor_user_id);
    IF char_length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 1 AND 1000 THEN
      RAISE EXCEPTION 'admin deletion reason is required' USING ERRCODE = '22023';
    END IF;
  ELSIF p_reason IS NOT NULL THEN
    RAISE EXCEPTION 'self deletion does not accept an admin reason' USING ERRCODE = '22023';
  END IF;

  -- Do not erase a location while the service is actively in progress.
  IF EXISTS (
    SELECT 1 FROM public.pool_trips t
    WHERE t.status IN ('scheduled','assigned','in_progress') AND t.departure_at >= now() AND (
      t.captain_user_id = p_target_user_id OR EXISTS (
        SELECT 1 FROM public.pool_members m WHERE m.group_id = t.group_id AND m.rider_user_id = p_target_user_id
      )
    )
  ) OR EXISTS (
    SELECT 1 FROM public.trips t JOIN public.matches m ON m.id = t.match_id
    JOIN public.daily_commute_requests r ON r.id = m.daily_commute_request_id
    WHERE t.status = 'in_progress' AND (r.rider_user_id = p_target_user_id OR m.captain_user_id = p_target_user_id)
  ) THEN
    RAISE EXCEPTION 'finish or cancel active trips before deleting this account' USING ERRCODE = '55000';
  END IF;

  DELETE FROM public.sessions WHERE user_id = p_target_user_id;
  DELETE FROM public.otp_challenges WHERE user_id = p_target_user_id;
  DELETE FROM public.telegram_phone_verification_challenges WHERE user_id = p_target_user_id;
  DELETE FROM public.user_verifications WHERE user_id = p_target_user_id;
  DELETE FROM public.rider_saved_places WHERE user_id = p_target_user_id;
  DELETE FROM public.rider_preferred_routes WHERE user_id = p_target_user_id;
  DELETE FROM public.rider_commuter_preferences WHERE user_id = p_target_user_id;
  DELETE FROM public.user_location_searches WHERE user_id = p_target_user_id;
  DELETE FROM public.push_subscriptions WHERE user_id = p_target_user_id;
  DELETE FROM public.pool_notification_mutes WHERE user_id = p_target_user_id;
  DELETE FROM public.pool_notifications WHERE user_id = p_target_user_id OR actor_id = p_target_user_id;
  DELETE FROM public.direct_messages WHERE sender_user_id = p_target_user_id;
  DELETE FROM public.message_conversations
    WHERE participant_low_id = p_target_user_id OR participant_high_id = p_target_user_id;
  DELETE FROM public.admin_user_controls WHERE user_id = p_target_user_id;

  UPDATE public.daily_commute_requests SET
    pickup_lat = NULL, pickup_lng = NULL, dropoff_lat = NULL, dropoff_lng = NULL,
    status = CASE WHEN status = 'open' THEN 'cancelled' ELSE status END
    WHERE rider_user_id = p_target_user_id;
  UPDATE public.pool_members SET
    pickup_lat = NULL, pickup_lng = NULL, dropoff_lat = NULL, dropoff_lng = NULL,
    status = 'cancelled', cancelled_at = coalesce(cancelled_at, deleted_on)
    WHERE rider_user_id = p_target_user_id;
  UPDATE public.pool_groups g SET route_geometry = NULL
    WHERE EXISTS (SELECT 1 FROM public.pool_members m WHERE m.group_id = g.id AND m.rider_user_id = p_target_user_id);
  UPDATE public.pool_trip_stops s SET lat = NULL, lng = NULL
    FROM public.pool_members m WHERE s.member_id = m.id AND m.rider_user_id = p_target_user_id;
  UPDATE public.demand_requests SET
    pickup_label = NULL, pickup_lat = NULL, pickup_lng = NULL,
    dropoff_label = NULL, dropoff_lat = NULL, dropoff_lng = NULL,
    status = CASE WHEN status = 'open' THEN 'cancelled' ELSE status END
    WHERE rider_user_id = p_target_user_id;
  UPDATE public.demand_groups g SET
    origin_lat = NULL, origin_lng = NULL, destination_lat = NULL, destination_lng = NULL,
    status = CASE WHEN status = 'open' THEN 'cancelled' ELSE status END
    WHERE EXISTS (SELECT 1 FROM public.demand_requests r WHERE r.demand_group_id = g.id AND r.rider_user_id = p_target_user_id);
  UPDATE public.captain_lines SET
    origin_label = NULL, origin_lat = NULL, origin_lng = NULL,
    destination_label = NULL, destination_lat = NULL, destination_lng = NULL,
    intermediate_stops = '[]'::jsonb, status = 'cancelled', updated_at = deleted_on
    WHERE captain_user_id = p_target_user_id;
  -- The legacy guard rejects no-op verification updates, so move an already
  -- rejected profile through pending before its final redacted state.
  UPDATE public.captain_profiles SET verification_status = 'pending'
    WHERE user_id = p_target_user_id AND verification_status = 'rejected';
  UPDATE public.captain_profiles SET
    license_number = 'REDACTED', vehicle_plate = 'REDACTED',
    current_lat = NULL, current_lng = NULL,
    verification_status = 'rejected', status = 'suspended_grace_expired'
    WHERE user_id = p_target_user_id;
  UPDATE public.trip_stops s SET lat = NULL, lng = NULL
    FROM public.trips t JOIN public.matches m ON m.id = t.match_id
    JOIN public.daily_commute_requests r ON r.id = m.daily_commute_request_id
    WHERE s.trip_id = t.id AND (r.rider_user_id = p_target_user_id OR m.captain_user_id = p_target_user_id);
  UPDATE public.users SET
    full_name = 'حساب محذوف',
    phone_number = 'deleted:' || id::text || '@account.invalid',
    password_hash = crypt(gen_random_uuid()::text, gen_salt('bf')),
    avatar_path = NULL, verified_at = NULL, deleted_at = deleted_on
    WHERE id = p_target_user_id;

  INSERT INTO public.account_deletion_events(actor_user_id, target_user_id, deletion_type, reason)
  VALUES (p_actor_user_id, p_target_user_id, CASE WHEN is_admin_deletion THEN 'admin' ELSE 'self_service' END,
    CASE WHEN is_admin_deletion THEN btrim(p_reason) ELSE NULL END);
  IF is_admin_deletion THEN
    PERFORM public.admin_write_audit(
      p_actor_user_id, 'user.account_deleted', 'user', p_target_user_id::text, btrim(p_reason),
      jsonb_build_object('deleted', false), jsonb_build_object('deleted', true)
    );
  END IF;
  RETURN deleted_on;
END;
$$;
REVOKE ALL ON FUNCTION public.sekka_delete_account_v1(integer, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sekka_delete_account_v1(integer, integer, text) TO service_role;
