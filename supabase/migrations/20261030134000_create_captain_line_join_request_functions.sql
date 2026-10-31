CREATE OR REPLACE FUNCTION public.create_join_request(
  actor_id integer,
  line_id integer,
  trip_date date,
  direction text,
  seats integer,
  note text
)
RETURNS public.captain_line_join_requests
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  rider_role text;
  rider_verified_at timestamptz;
  rider_account_status text;
  line_row public.captain_lines%ROWTYPE;
  request_row public.captain_line_join_requests%ROWTYPE;
  active_request public.captain_line_join_requests%ROWTYPE;
  accepted_total integer;
  service_day smallint;
  start_time time;
  trip_start timestamptz;
  expiry_at timestamptz;
BEGIN
  IF $4 IS NULL OR $4 NOT IN ('outbound', 'return')
      OR $3 IS NULL OR $5 IS NULL OR $5 < 1 OR $5 > 32767
     OR $6 IS NOT NULL AND char_length(trim($6)) > 300 THEN
    RAISE EXCEPTION 'invalid join request fields' USING ERRCODE = 'PJR01';
  END IF;

  SELECT account.role, account.verified_at, COALESCE(control.status, 'active')
  INTO rider_role, rider_verified_at, rider_account_status
  FROM public.users AS account
  LEFT JOIN public.admin_user_controls AS control ON control.user_id = account.id
  WHERE account.id = $1 AND account.deleted_at IS NULL;

  IF NOT FOUND OR rider_role <> 'rider' OR rider_verified_at IS NULL
     OR rider_account_status <> 'active' THEN
    RAISE EXCEPTION 'rider account is not eligible' USING ERRCODE = 'PJR02';
  END IF;

  SELECT captain_line.* INTO line_row
  FROM public.captain_lines AS captain_line
  WHERE captain_line.id = $2
  FOR UPDATE;

  IF NOT FOUND OR line_row.status <> 'active' THEN
    RAISE EXCEPTION 'captain line is unavailable' USING ERRCODE = 'PJR03';
  END IF;
  IF line_row.captain_user_id = $1 THEN
    RAISE EXCEPTION 'rider cannot join own line' USING ERRCODE = 'PJR02';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.users AS captain
    JOIN public.captain_profiles AS profile ON profile.user_id = captain.id
    WHERE captain.id = line_row.captain_user_id
      AND captain.role = 'captain'
      AND captain.verified_at IS NOT NULL
      AND profile.verification_status = 'approved'
      AND profile.status = 'active'
  ) THEN
    RAISE EXCEPTION 'captain line is unavailable' USING ERRCODE = 'PJR03';
  END IF;

  service_day := extract(dow FROM $3::timestamp)::smallint;
  IF NOT (service_day = ANY(line_row.service_days)) THEN
    RAISE EXCEPTION 'trip date is not a service day' USING ERRCODE = 'PJR04';
  END IF;
  IF $4 = 'outbound' THEN
    start_time := line_row.arrival_time;
  ELSE
    IF line_row.return_arrival_time IS NULL THEN
      RAISE EXCEPTION 'return direction is unavailable' USING ERRCODE = 'PJR04';
    END IF;
    start_time := line_row.return_arrival_time;
  END IF;
  IF $3 < timezone('Africa/Cairo', now())::date THEN
    RAISE EXCEPTION 'trip date is in the past' USING ERRCODE = 'PJR04';
  END IF;

  trip_start := timezone('Africa/Cairo', $3 + start_time);
  IF trip_start <= now() THEN
    RAISE EXCEPTION 'trip departure has passed' USING ERRCODE = 'PJR04';
  END IF;

  UPDATE public.captain_line_join_requests AS expired_request
  SET status = 'expired', decided_at = now(), updated_at = now()
  WHERE expired_request.line_id = $2
    AND expired_request.rider_user_id = $1
    AND expired_request.trip_date = $3
    AND expired_request.direction = $4
    AND expired_request.status = 'pending'
    AND expired_request.expires_at <= now();

  SELECT existing_request.* INTO active_request
  FROM public.captain_line_join_requests AS existing_request
  WHERE existing_request.line_id = $2
    AND existing_request.rider_user_id = $1
    AND existing_request.trip_date = $3
    AND existing_request.direction = $4
    AND existing_request.status IN ('pending', 'accepted')
  ORDER BY existing_request.created_at DESC
  LIMIT 1;
  IF FOUND THEN
    RETURN active_request;
  END IF;

  SELECT COALESCE(sum(accepted_request.seats), 0)::integer INTO accepted_total
  FROM public.captain_line_join_requests AS accepted_request
  WHERE accepted_request.line_id = $2
    AND accepted_request.trip_date = $3
    AND accepted_request.direction = $4
    AND accepted_request.status = 'accepted';
  IF line_row.seats - accepted_total < $5 THEN
    RAISE EXCEPTION 'requested seats exceed available capacity' USING ERRCODE = 'PJR05';
  END IF;

  expiry_at := LEAST(now() + interval '48 hours', trip_start);
  INSERT INTO public.captain_line_join_requests (
    line_id, rider_user_id, trip_date, direction, seats, status, note, expires_at
  )
  VALUES ($2, $1, $3, $4, $5, 'pending', NULLIF(trim($6), ''), expiry_at)
  RETURNING * INTO request_row;

  INSERT INTO public.pool_notifications (user_id, group_id, actor_id, type, event_key, payload)
  VALUES (
    line_row.captain_user_id,
    NULL,
    $1,
    'ride',
    'join-request:new:' || request_row.id,
    jsonb_build_object(
      'title', 'طلب انضمام جديد',
      'message', 'طلب جديد من راكب للانضمام إلى عرضك.',
      'line_id', request_row.line_id,
      'request_id', request_row.id,
      'trip_date', request_row.trip_date,
      'direction', request_row.direction,
      'seats', request_row.seats
    )
  )
  ON CONFLICT (user_id, event_key) DO NOTHING;

  RETURN request_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_join_request(
  actor_id integer,
  request_id bigint,
  decision text
)
RETURNS public.captain_line_join_requests
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  request_row public.captain_line_join_requests%ROWTYPE;
  line_row public.captain_lines%ROWTYPE;
  request_line_id integer;
  accepted_total integer;
BEGIN
  IF $3 IS NULL OR $3 NOT IN ('accept', 'reject') THEN
    RAISE EXCEPTION 'invalid join request decision' USING ERRCODE = 'PJR01';
  END IF;

  SELECT join_request.line_id INTO request_line_id
  FROM public.captain_line_join_requests AS join_request
  WHERE join_request.id = $2;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'join request not found' USING ERRCODE = 'PJR06';
  END IF;

  SELECT captain_line.* INTO line_row
  FROM public.captain_lines AS captain_line
  WHERE captain_line.id = request_line_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'captain line is unavailable' USING ERRCODE = 'PJR03';
  END IF;

  SELECT join_request.* INTO request_row
  FROM public.captain_line_join_requests AS join_request
  WHERE join_request.id = $2
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'join request not found' USING ERRCODE = 'PJR06';
  END IF;
  IF line_row.captain_user_id <> $1 THEN
    RAISE EXCEPTION 'captain does not own this line' USING ERRCODE = 'PJR07';
  END IF;
  IF request_row.status = 'pending' AND request_row.expires_at <= now() THEN
    UPDATE public.captain_line_join_requests
    SET status = 'expired', decided_at = now(), updated_at = now()
    WHERE id = request_row.id
    RETURNING * INTO request_row;
    RETURN request_row;
  END IF;
  IF request_row.status <> 'pending' THEN
    RAISE EXCEPTION 'join request is no longer pending' USING ERRCODE = 'PJR08';
  END IF;

  IF $3 = 'accept' THEN
    IF line_row.status <> 'active' OR NOT EXISTS (
      SELECT 1
      FROM public.users AS captain
      JOIN public.captain_profiles AS profile ON profile.user_id = captain.id
      WHERE captain.id = line_row.captain_user_id
        AND captain.role = 'captain'
        AND captain.verified_at IS NOT NULL
        AND profile.verification_status = 'approved'
        AND profile.status = 'active'
    ) THEN
      RAISE EXCEPTION 'captain line is unavailable' USING ERRCODE = 'PJR03';
    END IF;

    SELECT COALESCE(sum(accepted_request.seats), 0)::integer INTO accepted_total
    FROM public.captain_line_join_requests AS accepted_request
    WHERE accepted_request.line_id = request_row.line_id
      AND accepted_request.trip_date = request_row.trip_date
      AND accepted_request.direction = request_row.direction
      AND accepted_request.status = 'accepted'
      AND accepted_request.id <> request_row.id;
    IF line_row.seats - accepted_total < request_row.seats THEN
      RAISE EXCEPTION 'requested seats exceed remaining capacity' USING ERRCODE = 'PJR05';
    END IF;

    UPDATE public.captain_line_join_requests
    SET status = 'accepted', decided_at = now(), updated_at = now()
    WHERE id = request_row.id
    RETURNING * INTO request_row;
    INSERT INTO public.message_conversations (participant_low_id, participant_high_id)
    VALUES (
      LEAST(line_row.captain_user_id, request_row.rider_user_id),
      GREATEST(line_row.captain_user_id, request_row.rider_user_id)
    )
    ON CONFLICT (participant_low_id, participant_high_id) DO NOTHING;
    INSERT INTO public.pool_notifications (user_id, group_id, actor_id, type, event_key, payload)
    VALUES (
      request_row.rider_user_id, NULL, $1, 'ride',
      'join-request:accepted:' || request_row.id,
      jsonb_build_object(
        'title', 'تم قبول طلبك',
        'message', 'قبل الكابتن طلب انضمامك للعرض.',
        'request_id', request_row.id,
        'status', 'accepted'
      )
    )
    ON CONFLICT (user_id, event_key) DO NOTHING;
  ELSE
    UPDATE public.captain_line_join_requests
    SET status = 'rejected', decided_at = now(), updated_at = now()
    WHERE id = request_row.id
    RETURNING * INTO request_row;
    INSERT INTO public.pool_notifications (user_id, group_id, actor_id, type, event_key, payload)
    VALUES (
      request_row.rider_user_id, NULL, $1, 'ride',
      'join-request:rejected:' || request_row.id,
      jsonb_build_object(
        'title', 'اترفض طلب الانضمام',
        'message', 'الكابتن رفض طلب انضمامك للعرض.',
        'request_id', request_row.id,
        'status', 'rejected'
      )
    )
    ON CONFLICT (user_id, event_key) DO NOTHING;
  END IF;

  RETURN request_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.direct_message_contact_ids(p_user_id integer)
RETURNS TABLE(contact_user_id integer)
LANGUAGE sql
SET search_path = ''
AS $$
  WITH contacts AS (
    SELECT trip.captain_user_id AS user_id
    FROM public.pool_members AS member
    JOIN public.pool_trips AS trip ON trip.group_id = member.group_id
    WHERE member.rider_user_id = p_user_id
      AND member.status <> 'cancelled'
      AND trip.captain_user_id IS NOT NULL
    UNION
    SELECT group_row.fixed_captain_user_id
    FROM public.pool_members AS member
    JOIN public.pool_groups AS group_row ON group_row.id = member.group_id
    WHERE member.rider_user_id = p_user_id
      AND member.status <> 'cancelled'
      AND group_row.fixed_captain_user_id IS NOT NULL
    UNION
    SELECT member.rider_user_id
    FROM public.pool_trips AS trip
    JOIN public.pool_members AS member ON member.group_id = trip.group_id
    WHERE trip.captain_user_id = p_user_id
      AND member.status <> 'cancelled'
    UNION
    SELECT matched_ride.captain_user_id
    FROM public.daily_commute_requests AS request
    JOIN public.matches AS matched_ride ON matched_ride.daily_commute_request_id = request.id
    WHERE request.rider_user_id = p_user_id
    UNION
    SELECT request.rider_user_id
    FROM public.matches AS matched_ride
    JOIN public.daily_commute_requests AS request ON request.id = matched_ride.daily_commute_request_id
    WHERE matched_ride.captain_user_id = p_user_id
    UNION
    SELECT captain_line.captain_user_id
    FROM public.captain_line_join_requests AS join_request
    JOIN public.captain_lines AS captain_line ON captain_line.id = join_request.line_id
    WHERE join_request.rider_user_id = p_user_id
      AND join_request.status = 'accepted'
    UNION
    SELECT join_request.rider_user_id
    FROM public.captain_line_join_requests AS join_request
    JOIN public.captain_lines AS captain_line ON captain_line.id = join_request.line_id
    WHERE captain_line.captain_user_id = p_user_id
      AND join_request.status = 'accepted'
  )
  SELECT DISTINCT contacts.user_id
  FROM contacts
  JOIN public.users AS contact ON contact.id = contacts.user_id
  WHERE contacts.user_id <> p_user_id
    AND contact.role IN ('rider', 'captain');
$$;

REVOKE ALL ON FUNCTION public.direct_message_contact_ids(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.direct_message_contact_ids(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_join_request(
  actor_id integer,
  request_id bigint
)
RETURNS public.captain_line_join_requests
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  request_row public.captain_line_join_requests%ROWTYPE;
  request_line_id integer;
  captain_id integer;
BEGIN
  SELECT join_request.line_id INTO request_line_id
  FROM public.captain_line_join_requests AS join_request
  WHERE join_request.id = $2;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'join request not found' USING ERRCODE = 'PJR06';
  END IF;

  SELECT captain_line.captain_user_id INTO captain_id
  FROM public.captain_lines AS captain_line
  WHERE captain_line.id = request_line_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'captain line is unavailable' USING ERRCODE = 'PJR03';
  END IF;

  SELECT join_request.* INTO request_row
  FROM public.captain_line_join_requests AS join_request
  WHERE join_request.id = $2
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'join request not found' USING ERRCODE = 'PJR06';
  END IF;
  IF request_row.rider_user_id <> $1 THEN
    RAISE EXCEPTION 'only the request owner can cancel it' USING ERRCODE = 'PJR07';
  END IF;
  IF request_row.status = 'pending' AND request_row.expires_at <= now() THEN
    UPDATE public.captain_line_join_requests
    SET status = 'expired', decided_at = now(), updated_at = now()
    WHERE id = request_row.id
    RETURNING * INTO request_row;
    RETURN request_row;
  END IF;
  IF request_row.status NOT IN ('pending', 'accepted') THEN
    RAISE EXCEPTION 'request cannot be cancelled in its current state' USING ERRCODE = 'PJR08';
  END IF;

  UPDATE public.captain_line_join_requests
  SET status = 'cancelled', decided_at = now(), updated_at = now()
  WHERE id = request_row.id
  RETURNING * INTO request_row;
  INSERT INTO public.pool_notifications (user_id, group_id, actor_id, type, event_key, payload)
  VALUES (
    captain_id, NULL, $1, 'ride',
    'join-request:cancelled-by-rider:' || request_row.id,
    jsonb_build_object(
      'title', 'الراكب ألغى طلب الانضمام',
      'message', 'ألغى الراكب طلب الانضمام لعرضك.',
      'request_id', request_row.id,
      'status', 'cancelled'
    )
  )
  ON CONFLICT (user_id, event_key) DO NOTHING;

  RETURN request_row;
END;
$$;

REVOKE ALL ON FUNCTION public.create_join_request(integer, integer, date, text, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decide_join_request(integer, bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_join_request(integer, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_join_request(integer, integer, date, text, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decide_join_request(integer, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_join_request(integer, bigint) TO service_role;
