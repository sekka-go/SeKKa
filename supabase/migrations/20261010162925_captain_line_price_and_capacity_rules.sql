-- Captain lines use server-calculated road distance and a backend-owned rate.
-- Existing routes are repriced from their stored endpoints without deleting data.

INSERT INTO public.app_config(config_key, numeric_value)
VALUES ('captain_line_price_per_km', 9)
ON CONFLICT (config_key) DO NOTHING;
ALTER TABLE public.app_config
  ADD CONSTRAINT app_config_captain_line_rate_check
  CHECK (config_key <> 'captain_line_price_per_km' OR numeric_value BETWEEN 7 AND 11);

UPDATE public.vehicle_types SET capacity_max = 4 WHERE id = 'private_car';
UPDATE public.vehicle_types SET capacity_max = 14 WHERE id = 'hiace';

ALTER TABLE public.captain_lines
  ADD COLUMN route_distance_km numeric(10,2),
  ADD COLUMN price_per_km numeric(4,2);

UPDATE public.captain_lines
SET route_distance_km = GREATEST(
      0.01,
      public.sekka_geo_km(origin_lat, origin_lng, destination_lat, destination_lng)
    ),
    price_per_km = (SELECT numeric_value FROM public.app_config WHERE config_key = 'captain_line_price_per_km'),
    price_per_seat = ROUND(
      GREATEST(0.01, public.sekka_geo_km(origin_lat, origin_lng, destination_lat, destination_lng))
        * (SELECT numeric_value FROM public.app_config WHERE config_key = 'captain_line_price_per_km'),
      2
    );

ALTER TABLE public.captain_lines
  ALTER COLUMN route_distance_km SET NOT NULL,
  ALTER COLUMN price_per_km SET NOT NULL,
  DROP CONSTRAINT captain_lines_seats_check,
  ADD CONSTRAINT captain_lines_vehicle_seats_check CHECK (
    (vehicle_type_id = 'private_car' AND seats BETWEEN 1 AND 4)
    OR (vehicle_type_id = 'hiace' AND seats BETWEEN 1 AND 14)
  ),
  ADD CONSTRAINT captain_lines_route_distance_check CHECK (route_distance_km > 0),
  ADD CONSTRAINT captain_lines_price_per_km_check CHECK (price_per_km BETWEEN 7 AND 11);

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
  NEW.price_per_seat := ROUND(NEW.route_distance_km * configured_rate, 2);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_captain_line_pricing
BEFORE INSERT OR UPDATE OF vehicle_type_id, seats, route_distance_km, price_per_km, price_per_seat
ON public.captain_lines
FOR EACH ROW EXECUTE FUNCTION public.enforce_captain_line_pricing();
REVOKE ALL ON FUNCTION public.enforce_captain_line_pricing() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_captain_line_pricing() TO service_role;

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
  IF cardinality(days) NOT BETWEEN 1 AND 7
     OR cardinality(days) <> (SELECT count(DISTINCT value)::integer FROM unnest(days) AS day_value(value))
     OR NOT (days <@ ARRAY[0,1,2,3,4,5,6]::smallint[])
     OR cardinality(methods) = 0
     OR NOT (methods <@ ARRAY['cash','instapay','wallet']::text[])
     OR jsonb_typeof(coalesce(stops, '[]'::jsonb)) <> 'array' THEN
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
    9, 0, methods
  )
  RETURNING * INTO created;
  RETURN created;
END $$;

REVOKE ALL ON FUNCTION public.publish_captain_line(
  integer, text, text, double precision, double precision, text, double precision,
  double precision, jsonb, time, smallint[], integer, double precision, text[], time
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_captain_line(
  integer, text, text, double precision, double precision, text, double precision,
  double precision, jsonb, time, smallint[], integer, double precision, text[], time
) TO service_role;

-- Keep the previous API signature deploy-safe for the few seconds until the
-- Edge Function update completes. Ignore its client-supplied price and derive
-- a conservative direct-distance estimate inside PostgreSQL.
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
  route_km numeric;
  allowed_seats integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = actor_id AND role = 'captain' AND verified_at IS NOT NULL)
     OR NOT EXISTS (SELECT 1 FROM public.captain_profiles WHERE user_id = actor_id AND verification_status = 'approved' AND vehicle_type_id = vehicle_id) THEN
    RAISE EXCEPTION 'verified captain and approved vehicle required' USING ERRCODE = '42501';
  END IF;
  allowed_seats := CASE vehicle_id WHEN 'private_car' THEN 4 WHEN 'hiace' THEN 14 ELSE 0 END;
  IF allowed_seats = 0 OR seat_count < 1 OR seat_count > allowed_seats THEN
    RAISE EXCEPTION 'captain line seats exceed vehicle capacity' USING ERRCODE = '22023';
  END IF;
  route_km := GREATEST(0.01, public.sekka_geo_km(origin_y, origin_x, destination_y, destination_x));
  INSERT INTO public.captain_lines(
    captain_user_id, vehicle_type_id, origin_label, origin_lat, origin_lng,
    destination_label, destination_lat, destination_lng, intermediate_stops,
    arrival_time, return_arrival_time, service_days, seats, route_distance_km,
    price_per_km, price_per_seat, payment_methods
  ) VALUES (
    actor_id, vehicle_id, origin_name, origin_y, origin_x,
    destination_name, destination_y, destination_x, coalesce(stops, '[]'::jsonb),
    arrival, return_arrives, days, seat_count, route_km, 9, 0, methods
  )
  RETURNING * INTO created;
  RETURN created;
END $$;

REVOKE ALL ON FUNCTION public.publish_captain_line(
  integer, text, text, double precision, double precision, text, double precision,
  double precision, jsonb, time, smallint[], integer, numeric, text[], time
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_captain_line(
  integer, text, text, double precision, double precision, text, double precision,
  double precision, jsonb, time, smallint[], integer, numeric, text[], time
) TO service_role;

NOTIFY pgrst, 'reload schema';
