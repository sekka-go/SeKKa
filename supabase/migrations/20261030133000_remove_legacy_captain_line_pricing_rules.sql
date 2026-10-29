-- Captains set the passenger-facing fare themselves in the Phase 1 marketplace.
-- Keep the legacy per-kilometre column for compatibility, but stop deriving or
-- validating fares against the retired 7–11 EGP/km setting.
ALTER TABLE public.captain_lines
  DROP CONSTRAINT IF EXISTS captain_lines_price_per_km_check;

CREATE OR REPLACE FUNCTION public.enforce_captain_line_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  allowed_seats integer;
BEGIN
  SELECT capacity_max INTO allowed_seats
  FROM public.vehicle_types
  WHERE id = NEW.vehicle_type_id;

  IF allowed_seats IS NULL OR NEW.seats < 1 OR NEW.seats > allowed_seats THEN
    RAISE EXCEPTION 'seat count exceeds vehicle class capacity' USING ERRCODE = '22023';
  END IF;
  IF NEW.route_distance_km IS NULL OR NEW.route_distance_km <= 0 THEN
    RAISE EXCEPTION 'captain line route distance must be positive' USING ERRCODE = '22023';
  END IF;
  IF NEW.price_per_seat IS NULL OR NEW.price_per_seat < 0.01 THEN
    RAISE EXCEPTION 'captain line seat price must be positive' USING ERRCODE = '22023';
  END IF;
  IF cardinality(NEW.payment_methods) = 0
     OR NOT (NEW.payment_methods <@ ARRAY['cash','instapay']::text[]) THEN
    RAISE EXCEPTION 'unsupported direct payment method' USING ERRCODE = '22023';
  END IF;

  -- This column is retained only for old readers; new fares use price_per_seat.
  NEW.price_per_km := 0;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_captain_line_pricing() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_captain_line_pricing() TO service_role;

CREATE OR REPLACE FUNCTION public.set_captain_line_status(actor_id integer, line_id integer, next_status text)
RETURNS public.captain_lines
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE updated public.captain_lines%ROWTYPE;
BEGIN
  IF next_status NOT IN ('active','paused','cancelled') THEN
    RAISE EXCEPTION 'invalid status' USING ERRCODE='22023';
  END IF;

  PERFORM 1 FROM public.captain_lines
    WHERE id=line_id AND captain_user_id=actor_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.users u JOIN public.captain_profiles c ON c.user_id=u.id
    WHERE u.id=actor_id AND u.role='captain' AND u.verified_at IS NOT NULL
      AND c.verification_status='approved' AND c.status <> 'suspended_grace_expired'
  ) THEN
    RAISE EXCEPTION 'line not found or not owned by captain' USING ERRCODE='42501';
  END IF;

  IF next_status='cancelled' AND (
    EXISTS (
      SELECT 1 FROM public.demand_groups g
      JOIN public.demand_requests r ON r.demand_group_id=g.id
      WHERE g.captain_line_id=line_id AND g.status='matched'
        AND r.status IN ('open','matched')
    ) OR EXISTS (
      SELECT 1 FROM public.captain_line_join_requests AS join_request
      WHERE join_request.line_id=$2 AND (join_request.status='accepted' OR (join_request.status='pending' AND join_request.expires_at > now()))
    )
  ) THEN
    RAISE EXCEPTION 'a rider has requested or joined this line' USING ERRCODE='55000';
  END IF;

  UPDATE public.captain_lines SET status=next_status, updated_at=now()
    WHERE id=line_id AND captain_user_id=actor_id RETURNING * INTO updated;
  RETURN updated;
END $$;

CREATE OR REPLACE FUNCTION public.update_captain_line(
  actor_id integer,
  line_id integer,
  vehicle_id text,
  origin_name text,
  origin_y double precision,
  origin_x double precision,
  destination_name text,
  destination_y double precision,
  destination_x double precision,
  stops jsonb,
  arrival time,
  return_arrives time,
  days smallint[],
  seat_count integer,
  route_km double precision,
  seat_price numeric,
  methods text[]
) RETURNS public.captain_lines
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE
  updated public.captain_lines%ROWTYPE;
  allowed_seats integer;
BEGIN
  PERFORM 1 FROM public.captain_lines
    WHERE id=line_id AND captain_user_id=actor_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.users u JOIN public.captain_profiles c ON c.user_id=u.id
    WHERE u.id=actor_id AND u.role='captain' AND u.verified_at IS NOT NULL
      AND c.verification_status='approved' AND c.status <> 'suspended_grace_expired'
      AND c.vehicle_type_id=vehicle_id
  ) THEN
    RAISE EXCEPTION 'line not found or not owned by captain' USING ERRCODE='42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.demand_groups g
    JOIN public.demand_requests r ON r.demand_group_id=g.id
    WHERE g.captain_line_id=line_id AND g.status='matched'
      AND r.status IN ('open','matched')
  ) OR EXISTS (
    SELECT 1 FROM public.captain_line_join_requests AS join_request
    WHERE join_request.line_id=$2 AND (join_request.status='accepted' OR (join_request.status='pending' AND join_request.expires_at > now()))
  ) THEN
    RAISE EXCEPTION 'a rider has requested or joined this line' USING ERRCODE='55000';
  END IF;

  SELECT capacity_max INTO allowed_seats FROM public.vehicle_types WHERE id=vehicle_id;
  IF allowed_seats IS NULL OR seat_count < 1 OR seat_count > allowed_seats
     OR route_km IS NULL OR route_km <= 0 OR route_km > 1000
     OR seat_price IS NULL OR seat_price < 0.01 OR seat_price > 99999999.99
     OR jsonb_typeof(coalesce(stops,'[]'::jsonb)) <> 'array'
     OR jsonb_array_length(coalesce(stops,'[]'::jsonb)) > 10
     OR cardinality(days) NOT BETWEEN 1 AND 7
     OR cardinality(days) <> (SELECT count(DISTINCT value)::integer FROM unnest(days) AS day_value(value))
     OR NOT (days <@ ARRAY[0,1,2,3,4,5,6]::smallint[])
     OR cardinality(methods)=0
     OR NOT (methods <@ ARRAY['cash','instapay']::text[]) THEN
    RAISE EXCEPTION 'captain line details are invalid' USING ERRCODE='22023';
  END IF;

  UPDATE public.captain_lines SET
    vehicle_type_id=vehicle_id,
    origin_label=origin_name, origin_lat=origin_y, origin_lng=origin_x,
    destination_label=destination_name, destination_lat=destination_y, destination_lng=destination_x,
    intermediate_stops=coalesce(stops,'[]'::jsonb), arrival_time=arrival,
    return_arrival_time=return_arrives, service_days=days, seats=seat_count,
    route_distance_km=route_km, price_per_km=0, price_per_seat=seat_price,
    payment_methods=methods, updated_at=now()
  WHERE id=line_id AND captain_user_id=actor_id
  RETURNING * INTO updated;
  RETURN updated;
END $$;

REVOKE ALL ON FUNCTION public.set_captain_line_status(integer,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_captain_line_status(integer,integer,text) TO service_role;
REVOKE ALL ON FUNCTION public.update_captain_line(
  integer,integer,text,text,double precision,double precision,text,double precision,double precision,
  jsonb,time,time,smallint[],integer,double precision,numeric,text[]
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_captain_line(
  integer,integer,text,text,double precision,double precision,text,double precision,double precision,
  jsonb,time,time,smallint[],integer,double precision,numeric,text[]
) TO service_role;

-- A rider's fallback demand is a request for suggestions. Publishing a
-- suitable ride may notify the rider, but never assigns the captain or marks
-- the demand as matched. The rider opens the published ride and requests to
-- join it explicitly.
CREATE OR REPLACE FUNCTION public.sekka_match_demand_group(group_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  demand public.demand_groups%ROWTYPE;
  candidate record;
  request_row record;
  radius_km numeric;
  time_window numeric;
BEGIN
  SELECT * INTO demand
  FROM public.demand_groups
  WHERE id = group_id AND status = 'open';
  IF NOT FOUND THEN RETURN; END IF;

  SELECT numeric_value INTO radius_km FROM public.app_config WHERE config_key = 'demand_route_radius_km';
  SELECT numeric_value INTO time_window FROM public.app_config WHERE config_key = 'demand_arrival_window_minutes';
  IF radius_km IS NULL OR time_window IS NULL THEN RETURN; END IF;

  FOR candidate IN
    SELECT l.id, direction.kind AS ride_direction,
      public.sekka_geo_km(direction.origin_lat, direction.origin_lng, demand.origin_lat, demand.origin_lng)
        + public.sekka_geo_km(direction.destination_lat, direction.destination_lng, demand.destination_lat, demand.destination_lng) AS route_distance
    FROM public.captain_lines AS l
    CROSS JOIN LATERAL (VALUES
      ('outbound'::text, l.origin_lat, l.origin_lng, l.destination_lat, l.destination_lng, l.arrival_time),
      ('return'::text, l.destination_lat, l.destination_lng, l.origin_lat, l.origin_lng, l.return_arrival_time)
    ) AS direction(kind, origin_lat, origin_lng, destination_lat, destination_lng, arrival_time)
    WHERE l.status = 'active'
      AND l.vehicle_type_id = demand.vehicle_type_id
      AND extract(dow FROM demand.trip_date)::smallint = ANY(l.service_days)
      AND direction.arrival_time IS NOT NULL
      AND least(
        abs(extract(epoch FROM (direction.arrival_time - demand.arrival_time)) / 60),
        1440 - abs(extract(epoch FROM (direction.arrival_time - demand.arrival_time)) / 60)
      ) <= time_window
      AND public.sekka_geo_km(direction.origin_lat, direction.origin_lng, demand.origin_lat, demand.origin_lng) <= radius_km
      AND public.sekka_geo_km(direction.destination_lat, direction.destination_lng, demand.destination_lat, demand.destination_lng) <= radius_km
      AND l.seats > coalesce((
        SELECT sum(join_request.seats)
        FROM public.captain_line_join_requests AS join_request
        WHERE join_request.line_id = l.id
          AND join_request.trip_date = demand.trip_date
          AND join_request.direction = direction.kind
          AND join_request.status = 'accepted'
      ), 0)
    ORDER BY route_distance, l.id
    LIMIT 3
  LOOP
    FOR request_row IN
      SELECT id, rider_user_id
      FROM public.demand_requests
      WHERE demand_group_id = demand.id AND status = 'open'
    LOOP
      INSERT INTO public.pool_notifications(user_id, group_id, event_key, payload)
      VALUES (
        request_row.rider_user_id,
        NULL,
        'demand-suggestion:' || request_row.id || ':' || candidate.id,
        jsonb_build_object(
          'title', 'رحلة منشورة تناسب طلبك',
          'message', 'نشر كابتن رحلة قد تناسب طلبك. راجع الرحلات واختر الرحلة التي تريد طلب الانضمام إليها.',
          'line_id', candidate.id,
          'request_id', request_row.id,
          'ride_direction', candidate.ride_direction
        )
      ) ON CONFLICT (user_id, event_key) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.sekka_match_demand_group(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sekka_match_demand_group(integer) TO service_role;

-- Keep new fallback requests clustered only with other open requests. Old
-- matched groups remain readable as historical records but are not a route
-- for assigning newly created rider demand to a captain.
CREATE OR REPLACE FUNCTION public.sekka_cluster_demand_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  selected_group integer;
  radius_km numeric;
  time_window numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.vehicle_type_id), NEW.trip_date - DATE '2000-01-01');
  SELECT numeric_value INTO radius_km FROM public.app_config WHERE config_key = 'demand_route_radius_km';
  SELECT numeric_value INTO time_window FROM public.app_config WHERE config_key = 'demand_arrival_window_minutes';

  SELECT g.id INTO selected_group
  FROM public.demand_groups AS g
  WHERE g.status = 'open'
    AND g.vehicle_type_id = NEW.vehicle_type_id
    AND g.trip_date = NEW.trip_date
    AND least(
      abs(extract(epoch FROM (g.arrival_time - NEW.arrival_time)) / 60),
      1440 - abs(extract(epoch FROM (g.arrival_time - NEW.arrival_time)) / 60)
    ) <= time_window
    AND ((g.return_arrival_time IS NULL AND NEW.return_arrival_time IS NULL)
      OR (g.return_arrival_time IS NOT NULL AND NEW.return_arrival_time IS NOT NULL
        AND least(
          abs(extract(epoch FROM (g.return_arrival_time - NEW.return_arrival_time)) / 60),
          1440 - abs(extract(epoch FROM (g.return_arrival_time - NEW.return_arrival_time)) / 60)
        ) <= time_window))
    AND public.sekka_geo_km(g.origin_lat, g.origin_lng, NEW.pickup_lat, NEW.pickup_lng) <= radius_km
    AND public.sekka_geo_km(g.destination_lat, g.destination_lng, NEW.dropoff_lat, NEW.dropoff_lng) <= radius_km
  ORDER BY g.created_at, g.id
  LIMIT 1
  FOR UPDATE OF g;

  IF selected_group IS NULL THEN
    INSERT INTO public.demand_groups(
      vehicle_type_id, origin_lat, origin_lng, destination_lat, destination_lng,
      trip_date, arrival_time, return_arrival_time
    ) VALUES (
      NEW.vehicle_type_id, NEW.pickup_lat, NEW.pickup_lng, NEW.dropoff_lat, NEW.dropoff_lng,
      NEW.trip_date, NEW.arrival_time, NEW.return_arrival_time
    ) RETURNING id INTO selected_group;
  END IF;

  NEW.demand_group_id := selected_group;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sekka_cluster_demand_request() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sekka_cluster_demand_request() TO service_role;

-- Trigger invocations use the function owner; retain the existing trigger
-- binding while making execution unavailable to client roles.

NOTIFY pgrst, 'reload schema';
