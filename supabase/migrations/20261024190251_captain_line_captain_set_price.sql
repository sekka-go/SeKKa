-- Let captains choose the passenger-facing seat price while retaining the
-- legacy automatic rate only for older RPC callers that still send zero.
CREATE OR REPLACE FUNCTION public.enforce_captain_line_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  configured_rate numeric;
  max_seats integer;
BEGIN
  SELECT numeric_value INTO configured_rate
    FROM public.app_config
    WHERE config_key = 'captain_line_price_per_km';
  IF configured_rate IS NULL OR configured_rate < 7 OR configured_rate > 11 THEN
    RAISE EXCEPTION 'captain line rate must be configured between 7 and 11 EGP per km'
      USING ERRCODE = '22023';
  END IF;

  SELECT CASE id WHEN 'private_car' THEN 4 WHEN 'hiace' THEN 14 ELSE 0 END
    INTO max_seats
    FROM public.vehicle_types
    WHERE id = NEW.vehicle_type_id;
  IF max_seats IS NULL OR max_seats = 0 OR NEW.seats < 1 OR NEW.seats > max_seats THEN
    RAISE EXCEPTION 'captain line seats exceed vehicle capacity'
      USING ERRCODE = '22023';
  END IF;
  IF NEW.route_distance_km IS NULL OR NEW.route_distance_km <= 0 THEN
    RAISE EXCEPTION 'captain line route distance must be positive'
      USING ERRCODE = '22023';
  END IF;

  NEW.price_per_km := configured_rate;
  IF NEW.price_per_seat IS NULL OR NEW.price_per_seat <= 0 THEN
    NEW.price_per_seat := ROUND(NEW.route_distance_km * configured_rate, 2);
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.enforce_captain_line_pricing() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_captain_line_pricing() TO service_role;

-- A new overload keeps older clients deploy-safe during rollout. New callers
-- supply seat_price and the database persists it without repricing it.
CREATE FUNCTION public.publish_captain_line(
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
  ) THEN
    RAISE EXCEPTION 'verified captain required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.captain_profiles
    WHERE user_id = actor_id AND verification_status = 'approved'
      AND vehicle_type_id = vehicle_id
  ) THEN
    RAISE EXCEPTION 'approved vehicle profile required' USING ERRCODE = '42501';
  END IF;
  allowed_seats := CASE vehicle_id WHEN 'private_car' THEN 4 WHEN 'hiace' THEN 14 ELSE 0 END;
  IF allowed_seats = 0 OR seat_count < 1 OR seat_count > allowed_seats THEN
    RAISE EXCEPTION 'captain line seats exceed vehicle capacity' USING ERRCODE = '22023';
  END IF;
  IF route_km IS NULL OR route_km <= 0 OR route_km > 1000 THEN
    RAISE EXCEPTION 'captain line route distance is invalid' USING ERRCODE = '22023';
  END IF;
  IF seat_price IS NULL OR seat_price < 0.01 OR seat_price > 99999999.99 THEN
    RAISE EXCEPTION 'captain line seat price is invalid' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(coalesce(stops, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'captain line stops must be an array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(coalesce(stops, '[]'::jsonb)) > 10 THEN
    RAISE EXCEPTION 'captain line has too many intermediate stops' USING ERRCODE = '22023';
  END IF;
  IF cardinality(days) NOT BETWEEN 1 AND 7
     OR cardinality(days) <> (SELECT count(DISTINCT value)::integer FROM unnest(days) AS day_value(value))
     OR NOT (days <@ ARRAY[0,1,2,3,4,5,6]::smallint[])
     OR cardinality(methods) = 0
     OR NOT (methods <@ ARRAY['cash','instapay','wallet']::text[]) THEN
    RAISE EXCEPTION 'captain line details are invalid' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.captain_lines(
    captain_user_id, vehicle_type_id, origin_label, origin_lat, origin_lng,
    destination_label, destination_lat, destination_lng, intermediate_stops,
    arrival_time, return_arrival_time, service_days, seats, route_distance_km,
    price_per_km, price_per_seat, payment_methods
  ) VALUES (
    actor_id, vehicle_id, origin_name, origin_y, origin_x,
    destination_name, destination_y, destination_x, coalesce(stops, '[]'::jsonb),
    arrival, return_arrives, days, seat_count, route_km,
    9, seat_price, methods
  )
  RETURNING * INTO created;
  RETURN created;
END $$;

REVOKE ALL ON FUNCTION public.publish_captain_line(
  integer, text, text, double precision, double precision, text, double precision,
  double precision, jsonb, time, smallint[], integer, double precision, numeric, text[], time
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_captain_line(
  integer, text, text, double precision, double precision, text, double precision,
  double precision, jsonb, time, smallint[], integer, double precision, numeric, text[], time
) TO service_role;

NOTIFY pgrst, 'reload schema';
