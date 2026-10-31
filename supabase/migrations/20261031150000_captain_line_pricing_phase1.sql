-- SeKKa Phase 1 only: captain-set per-seat price and direct payment methods.
-- No data is rewritten and no matching/group/report/contact objects are created.

DO $$
BEGIN
  IF to_regclass('public.captain_lines') IS NULL
     OR to_regclass('public.vehicle_types') IS NULL
     OR to_regclass('public.users') IS NULL
     OR to_regclass('public.captain_profiles') IS NULL THEN
    RAISE EXCEPTION 'Phase 1 pricing migration requires the live SeKKa captain schema';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'captain_lines'
      AND column_name = 'price_per_seat'
  ) THEN
    RAISE EXCEPTION 'Phase 1 pricing migration requires captain_lines.price_per_seat';
  END IF;

  IF to_regprocedure('public.enforce_captain_line_pricing()') IS NULL
     OR to_regprocedure('public.update_captain_line(integer,integer,text,text,double precision,double precision,text,double precision,double precision,jsonb,time without time zone,time without time zone,smallint[],integer,double precision,numeric,text[])') IS NULL
     OR to_regprocedure('public.publish_captain_line(integer,text,text,double precision,double precision,text,double precision,double precision,jsonb,time without time zone,smallint[],integer,double precision,text[],time without time zone)') IS NULL
     OR to_regprocedure('public.publish_captain_line(integer,text,text,double precision,double precision,text,double precision,double precision,jsonb,time without time zone,smallint[],integer,double precision,numeric,text[],time without time zone)') IS NULL
     OR to_regprocedure('public.publish_captain_line(integer,text,text,double precision,double precision,text,double precision,double precision,jsonb,time without time zone,smallint[],integer,numeric,text[],time without time zone)') IS NULL THEN
    RAISE EXCEPTION 'Phase 1 pricing migration RPC signatures do not match the inspected live schema';
  END IF;

  IF EXISTS (SELECT 1 FROM public.captain_lines WHERE price_per_seat IS NULL OR price_per_seat <= 0) THEN
    RAISE EXCEPTION 'captain_lines contains missing or non-positive seat prices; review data before applying this migration';
  END IF;

END;
$$;

-- The per-kilometre limit is retired. Keep the legacy column for compatibility;
-- new writes set it to zero while the passenger-facing amount is price_per_seat.
ALTER TABLE public.captain_lines
  DROP CONSTRAINT IF EXISTS captain_lines_price_per_km_check,
  DROP CONSTRAINT IF EXISTS captain_lines_price_per_seat_check;

ALTER TABLE public.captain_lines
  ADD CONSTRAINT captain_lines_price_per_seat_check CHECK (price_per_seat > 0);

ALTER TABLE public.captain_lines
  ALTER COLUMN price_per_seat SET NOT NULL;

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
  IF NEW.price_per_seat IS NULL OR NEW.price_per_seat < 0.01 OR NEW.price_per_seat > 99999999.99 THEN
    RAISE EXCEPTION 'captain line seat price must be positive and within range' USING ERRCODE = '22023';
  END IF;
  IF NEW.payment_methods IS NULL OR cardinality(NEW.payment_methods) = 0
     OR NOT (NEW.payment_methods <@ ARRAY['cash','instapay','wallet']::text[]) THEN
    RAISE EXCEPTION 'unsupported direct payment method' USING ERRCODE = '22023';
  END IF;

  NEW.price_per_km := 0;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_captain_line_pricing() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_captain_line_pricing() TO service_role;

DROP TRIGGER IF EXISTS trg_captain_line_pricing ON public.captain_lines;
CREATE TRIGGER trg_captain_line_pricing
BEFORE INSERT OR UPDATE OF vehicle_type_id, seats, route_distance_km, price_per_km, price_per_seat, payment_methods
ON public.captain_lines
FOR EACH ROW EXECUTE FUNCTION public.enforce_captain_line_pricing();

-- Keep every deployed signature. The legacy signature without an explicit
-- seat price fails safely instead of creating a derived or zero-priced offer.
CREATE OR REPLACE FUNCTION public.publish_captain_line(
  actor_id integer, vehicle_id text, origin_name text,
  origin_y double precision, origin_x double precision,
  destination_name text, destination_y double precision, destination_x double precision,
  stops jsonb, arrival time, days smallint[], seat_count integer,
  route_km double precision, methods text[], return_arrives time DEFAULT NULL
) RETURNS public.captain_lines
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'seat_price is required; call the publish_captain_line overload that accepts an explicit seat_price'
    USING ERRCODE = '22023';
END;
$$;

-- Retain the legacy overload that calculates distance from the supplied route,
-- while accepting the captain's explicit price and never pricing by distance.
CREATE OR REPLACE FUNCTION public.publish_captain_line(
  actor_id integer, vehicle_id text, origin_name text,
  origin_y double precision, origin_x double precision,
  destination_name text, destination_y double precision, destination_x double precision,
  stops jsonb, arrival time, days smallint[], seat_count integer,
  seat_price numeric, methods text[], return_arrives time DEFAULT NULL
) RETURNS public.captain_lines
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public
AS $$
DECLARE route_km double precision; allowed_seats integer; created public.captain_lines%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id=actor_id AND role='captain' AND verified_at IS NOT NULL)
     OR NOT EXISTS (SELECT 1 FROM public.captain_profiles WHERE user_id=actor_id AND verification_status='approved' AND vehicle_type_id=vehicle_id) THEN
    RAISE EXCEPTION 'approved verified captain profile required' USING ERRCODE='42501';
  END IF;
  SELECT capacity_max INTO allowed_seats FROM public.vehicle_types WHERE id=vehicle_id;
  route_km := public.sekka_geo_km(origin_y, origin_x, destination_y, destination_x);
  IF allowed_seats IS NULL OR seat_count NOT BETWEEN 1 AND allowed_seats
     OR route_km IS NULL OR route_km NOT BETWEEN 0.01 AND 1000
     OR seat_price IS NULL OR seat_price NOT BETWEEN 0.01 AND 99999999.99
     OR days IS NULL OR cardinality(days) NOT BETWEEN 1 AND 7
     OR cardinality(days) <> (SELECT count(DISTINCT value)::integer FROM unnest(days) AS d(value))
     OR NOT (days <@ ARRAY[0,1,2,3,4,5,6]::smallint[])
     OR methods IS NULL OR cardinality(methods) = 0
     OR NOT (methods <@ ARRAY['cash','instapay','wallet']::text[])
     OR stops IS NOT NULL AND (jsonb_typeof(stops) <> 'array' OR jsonb_array_length(stops) > 10) THEN
    RAISE EXCEPTION 'captain line details are invalid' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.captain_lines (
    captain_user_id, vehicle_type_id, origin_label, origin_lat, origin_lng,
    destination_label, destination_lat, destination_lng, intermediate_stops,
    arrival_time, return_arrival_time, service_days, seats, route_distance_km,
    price_per_km, price_per_seat, payment_methods
  ) VALUES (
    actor_id, vehicle_id, origin_name, origin_y, origin_x,
    destination_name, destination_y, destination_x, coalesce(stops,'[]'::jsonb),
    arrival, return_arrives, days, seat_count, route_km, 0, seat_price, methods
  ) RETURNING * INTO created;
  RETURN created;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_captain_line(integer,text,text,double precision,double precision,text,double precision,double precision,jsonb,time,smallint[],integer,double precision,text[],time) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_captain_line(integer,text,text,double precision,double precision,text,double precision,double precision,jsonb,time,smallint[],integer,double precision,text[],time) TO service_role;
REVOKE ALL ON FUNCTION public.publish_captain_line(integer,text,text,double precision,double precision,text,double precision,double precision,jsonb,time,smallint[],integer,numeric,text[],time) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_captain_line(integer,text,text,double precision,double precision,text,double precision,double precision,jsonb,time,smallint[],integer,numeric,text[],time) TO service_role;

CREATE OR REPLACE FUNCTION public.publish_captain_line(
  actor_id integer,
  vehicle_id text,
  origin_name text,
  origin_y double precision,
  origin_x double precision,
  destination_name text,
  destination_y double precision,
  destination_x double precision,
  stops jsonb,
  arrival time,
  days smallint[],
  seat_count integer,
  route_km double precision,
  seat_price numeric,
  methods text[],
  return_arrives time DEFAULT NULL
) RETURNS public.captain_lines
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  created public.captain_lines%ROWTYPE;
  allowed_seats integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = actor_id AND role = 'captain' AND verified_at IS NOT NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM public.captain_profiles
    WHERE user_id = actor_id AND verification_status = 'approved'
      AND vehicle_type_id = vehicle_id AND status <> 'suspended_grace_expired'
  ) THEN
    RAISE EXCEPTION 'approved verified captain required' USING ERRCODE = '42501';
  END IF;

  SELECT capacity_max INTO allowed_seats
  FROM public.vehicle_types WHERE id = vehicle_id;
  IF allowed_seats IS NULL OR seat_count NOT BETWEEN 1 AND allowed_seats
     OR route_km IS NULL OR route_km NOT BETWEEN 0.01 AND 1000
     OR seat_price IS NULL OR seat_price NOT BETWEEN 0.01 AND 99999999.99
     OR days IS NULL OR cardinality(days) NOT BETWEEN 1 AND 7
     OR cardinality(days) <> (SELECT count(DISTINCT value)::integer FROM unnest(days) AS d(value))
     OR NOT (days <@ ARRAY[0,1,2,3,4,5,6]::smallint[])
     OR methods IS NULL OR cardinality(methods) = 0
     OR NOT (methods <@ ARRAY['cash','instapay','wallet']::text[])
     OR stops IS NOT NULL AND (jsonb_typeof(stops) <> 'array' OR jsonb_array_length(stops) > 10) THEN
    RAISE EXCEPTION 'captain line details are invalid' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.captain_lines (
    captain_user_id, vehicle_type_id, origin_label, origin_lat, origin_lng,
    destination_label, destination_lat, destination_lng, intermediate_stops,
    arrival_time, return_arrival_time, service_days, seats, route_distance_km,
    price_per_km, price_per_seat, payment_methods
  ) VALUES (
    actor_id, vehicle_id, origin_name, origin_y, origin_x,
    destination_name, destination_y, destination_x, coalesce(stops, '[]'::jsonb),
    arrival, return_arrives, days, seat_count, route_km,
    0, seat_price, methods
  )
  RETURNING * INTO created;
  RETURN created;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_captain_line(
  integer, text, text, double precision, double precision, text, double precision,
  double precision, jsonb, time, smallint[], integer, double precision, numeric, text[], time
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_captain_line(
  integer, text, text, double precision, double precision, text, double precision,
  double precision, jsonb, time, smallint[], integer, double precision, numeric, text[], time
) TO service_role;

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
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  updated public.captain_lines%ROWTYPE;
  allowed_seats integer;
BEGIN
  PERFORM 1 FROM public.captain_lines
  WHERE id = line_id AND captain_user_id = actor_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.captain_profiles c ON c.user_id = u.id
    WHERE u.id = actor_id AND u.role = 'captain' AND u.verified_at IS NOT NULL
      AND c.verification_status = 'approved' AND c.status <> 'suspended_grace_expired'
      AND c.vehicle_type_id = vehicle_id
  ) THEN
    RAISE EXCEPTION 'line not found or not owned by captain' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.demand_groups g
    JOIN public.demand_requests r ON r.demand_group_id = g.id
    WHERE g.captain_line_id = line_id AND g.status = 'matched'
      AND r.status IN ('open','matched')
  ) THEN
    RAISE EXCEPTION 'a rider has requested or joined this line' USING ERRCODE = '55000';
  END IF;

  SELECT capacity_max INTO allowed_seats
  FROM public.vehicle_types WHERE id = vehicle_id;
  IF allowed_seats IS NULL OR seat_count NOT BETWEEN 1 AND allowed_seats
     OR route_km IS NULL OR route_km NOT BETWEEN 0.01 AND 1000
     OR seat_price IS NULL OR seat_price NOT BETWEEN 0.01 AND 99999999.99
     OR stops IS NOT NULL AND (jsonb_typeof(stops) <> 'array' OR jsonb_array_length(stops) > 10)
     OR days IS NULL OR cardinality(days) NOT BETWEEN 1 AND 7
     OR cardinality(days) <> (SELECT count(DISTINCT value)::integer FROM unnest(days) AS d(value))
     OR NOT (days <@ ARRAY[0,1,2,3,4,5,6]::smallint[])
     OR methods IS NULL OR cardinality(methods) = 0
     OR NOT (methods <@ ARRAY['cash','instapay','wallet']::text[]) THEN
    RAISE EXCEPTION 'captain line details are invalid' USING ERRCODE = '22023';
  END IF;

  UPDATE public.captain_lines SET
    vehicle_type_id = vehicle_id,
    origin_label = origin_name, origin_lat = origin_y, origin_lng = origin_x,
    destination_label = destination_name, destination_lat = destination_y, destination_lng = destination_x,
    intermediate_stops = coalesce(stops, '[]'::jsonb), arrival_time = arrival,
    return_arrival_time = return_arrives, service_days = days, seats = seat_count,
    route_distance_km = route_km, price_per_km = 0, price_per_seat = seat_price,
    payment_methods = methods, updated_at = now()
  WHERE id = line_id AND captain_user_id = actor_id
  RETURNING * INTO updated;
  RETURN updated;
END;
$$;

REVOKE ALL ON FUNCTION public.update_captain_line(
  integer, integer, text, text, double precision, double precision, text, double precision,
  double precision, jsonb, time, time, smallint[], integer, double precision, numeric, text[]
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_captain_line(
  integer, integer, text, text, double precision, double precision, text, double precision,
  double precision, jsonb, time, time, smallint[], integer, double precision, numeric, text[]
) TO service_role;
