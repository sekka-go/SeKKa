-- Approved vehicle classes and passenger capacities. Legacy IDs remain for
-- existing profiles, lines, and records; clients use the four new classes.
INSERT INTO public.vehicle_types (id, name_ar, capacity_max)
VALUES
  ('prime', 'Prime', 3),
  ('daily', 'Daily', 4),
  ('space', 'Space', 9),
  ('max', 'Max', 13)
ON CONFLICT (id) DO UPDATE
SET name_ar = EXCLUDED.name_ar,
    capacity_max = EXCLUDED.capacity_max;

ALTER TABLE public.captain_lines
  DROP CONSTRAINT IF EXISTS captain_lines_vehicle_seats_check,
  ADD CONSTRAINT captain_lines_seats_legacy_safe_check CHECK (seats BETWEEN 1 AND 14);

CREATE OR REPLACE FUNCTION public.enforce_captain_line_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE allowed_seats integer; configured_rate numeric;
BEGIN
  SELECT capacity_max INTO allowed_seats
  FROM public.vehicle_types WHERE id = NEW.vehicle_type_id;
  IF allowed_seats IS NULL OR NEW.seats < 1 OR NEW.seats > allowed_seats THEN
    RAISE EXCEPTION 'seat count exceeds vehicle class capacity' USING ERRCODE = '22023';
  END IF;
  SELECT numeric_value INTO configured_rate FROM public.app_config WHERE config_key='captain_line_price_per_km';
  IF configured_rate IS NULL OR configured_rate NOT BETWEEN 7 AND 11 THEN
    RAISE EXCEPTION 'captain line price configuration is invalid' USING ERRCODE = '22023';
  END IF;
  IF NEW.route_distance_km IS NULL OR NEW.route_distance_km <= 0 THEN
    RAISE EXCEPTION 'captain line route distance must be positive' USING ERRCODE = '22023';
  END IF;
  NEW.price_per_km := configured_rate;
  IF NEW.price_per_seat IS NULL OR NEW.price_per_seat <= 0 THEN
    NEW.price_per_seat := ROUND(NEW.route_distance_km * configured_rate, 2);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_captain_line(
  actor_id integer, vehicle_id text, origin_name text, origin_y double precision, origin_x double precision,
  destination_name text, destination_y double precision, destination_x double precision, stops jsonb,
  arrival time, days smallint[], seat_count integer, route_km double precision, seat_price numeric,
  methods text[], return_arrives time DEFAULT NULL
) RETURNS public.captain_lines
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE created public.captain_lines%ROWTYPE; allowed_seats integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id=actor_id AND role='captain' AND verified_at IS NOT NULL)
     OR NOT EXISTS (SELECT 1 FROM public.captain_profiles WHERE user_id=actor_id AND verification_status='approved' AND vehicle_type_id=vehicle_id) THEN
    RAISE EXCEPTION 'approved verified captain profile required' USING ERRCODE='42501';
  END IF;
  SELECT capacity_max INTO allowed_seats FROM public.vehicle_types WHERE id=vehicle_id;
  IF allowed_seats IS NULL OR seat_count NOT BETWEEN 1 AND allowed_seats OR route_km IS NULL OR route_km NOT BETWEEN 0.01 AND 1000
     OR seat_price IS NULL OR seat_price NOT BETWEEN 0.01 AND 99999999.99
     OR jsonb_typeof(coalesce(stops,'[]'::jsonb)) <> 'array' OR jsonb_array_length(coalesce(stops,'[]'::jsonb)) > 10
     OR cardinality(days) NOT BETWEEN 1 AND 7 OR cardinality(days) <> (SELECT count(DISTINCT value)::integer FROM unnest(days) AS d(value))
     OR NOT (days <@ ARRAY[0,1,2,3,4,5,6]::smallint[]) OR cardinality(methods)=0 OR NOT (methods <@ ARRAY['cash','instapay','wallet']::text[]) THEN
    RAISE EXCEPTION 'captain line details are invalid' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.captain_lines(captain_user_id,vehicle_type_id,origin_label,origin_lat,origin_lng,destination_label,destination_lat,destination_lng,intermediate_stops,arrival_time,return_arrival_time,service_days,seats,route_distance_km,price_per_km,price_per_seat,payment_methods)
  VALUES(actor_id,vehicle_id,origin_name,origin_y,origin_x,destination_name,destination_y,destination_x,coalesce(stops,'[]'::jsonb),arrival,return_arrives,days,seat_count,route_km,9,seat_price,methods)
  RETURNING * INTO created;
  RETURN created;
END $$;

CREATE OR REPLACE FUNCTION public.update_captain_line(
  actor_id integer, line_id integer, vehicle_id text, origin_name text, origin_y double precision, origin_x double precision,
  destination_name text, destination_y double precision, destination_x double precision, stops jsonb,
  arrival time, return_arrives time, days smallint[], seat_count integer, route_km double precision, seat_price numeric, methods text[]
) RETURNS public.captain_lines
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE updated public.captain_lines%ROWTYPE; allowed_seats integer;
BEGIN
  PERFORM 1 FROM public.captain_lines WHERE id=line_id AND captain_user_id=actor_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.users u JOIN public.captain_profiles c ON c.user_id=u.id WHERE u.id=actor_id AND u.role='captain' AND u.verified_at IS NOT NULL AND c.verification_status='approved' AND c.status <> 'suspended_grace_expired' AND c.vehicle_type_id=vehicle_id) THEN
    RAISE EXCEPTION 'line not found or not owned by captain' USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM public.demand_groups g JOIN public.demand_requests r ON r.demand_group_id=g.id WHERE g.captain_line_id=line_id AND g.status='matched' AND r.status IN ('open','matched')) THEN
    RAISE EXCEPTION 'a rider has joined this line' USING ERRCODE='55000';
  END IF;
  SELECT capacity_max INTO allowed_seats FROM public.vehicle_types WHERE id=vehicle_id;
  IF allowed_seats IS NULL OR seat_count NOT BETWEEN 1 AND allowed_seats OR route_km IS NULL OR route_km NOT BETWEEN 0.01 AND 1000
     OR seat_price IS NULL OR seat_price NOT BETWEEN 0.01 AND 99999999.99
     OR jsonb_typeof(coalesce(stops,'[]'::jsonb)) <> 'array' OR jsonb_array_length(coalesce(stops,'[]'::jsonb)) > 10
     OR cardinality(days) NOT BETWEEN 1 AND 7 OR cardinality(days) <> (SELECT count(DISTINCT value)::integer FROM unnest(days) AS d(value))
     OR NOT (days <@ ARRAY[0,1,2,3,4,5,6]::smallint[]) OR cardinality(methods)=0 OR NOT (methods <@ ARRAY['cash','instapay','wallet']::text[]) THEN
    RAISE EXCEPTION 'captain line details are invalid' USING ERRCODE='22023';
  END IF;
  UPDATE public.captain_lines SET vehicle_type_id=vehicle_id,origin_label=origin_name,origin_lat=origin_y,origin_lng=origin_x,
    destination_label=destination_name,destination_lat=destination_y,destination_lng=destination_x,intermediate_stops=coalesce(stops,'[]'::jsonb),
    arrival_time=arrival,return_arrival_time=return_arrives,service_days=days,seats=seat_count,route_distance_km=route_km,
    price_per_seat=seat_price,payment_methods=methods,updated_at=now() WHERE id=line_id AND captain_user_id=actor_id RETURNING * INTO updated;
  RETURN updated;
END $$;

REVOKE ALL ON FUNCTION public.enforce_captain_line_pricing() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_captain_line_pricing() TO service_role;
REVOKE ALL ON FUNCTION public.publish_captain_line(integer,text,text,double precision,double precision,text,double precision,double precision,jsonb,time,smallint[],integer,double precision,numeric,text[],time) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_captain_line(integer,text,text,double precision,double precision,text,double precision,double precision,jsonb,time,smallint[],integer,double precision,numeric,text[],time) TO service_role;
REVOKE ALL ON FUNCTION public.update_captain_line(integer,integer,text,text,double precision,double precision,text,double precision,double precision,jsonb,time,time,smallint[],integer,double precision,numeric,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_captain_line(integer,integer,text,text,double precision,double precision,text,double precision,double precision,jsonb,time,time,smallint[],integer,double precision,numeric,text[]) TO service_role;

-- Reclassify existing accounts and trips where the approved capacity safely
-- contains their current seat count. Keep over-capacity legacy lines intact.
UPDATE public.captain_lines SET vehicle_type_id='daily'
WHERE vehicle_type_id='private_car' AND seats <= 4;
UPDATE public.captain_lines SET vehicle_type_id='max'
WHERE vehicle_type_id='hiace' AND seats <= 13;
UPDATE public.service_categories SET vehicle_type_id='daily' WHERE vehicle_type_id='private_car';
UPDATE public.service_categories SET vehicle_type_id='max', max_seats=13 WHERE vehicle_type_id='hiace';
UPDATE public.demand_groups SET vehicle_type_id='daily' WHERE vehicle_type_id='private_car';
UPDATE public.demand_groups SET vehicle_type_id='max' WHERE vehicle_type_id='hiace';
UPDATE public.demand_requests SET vehicle_type_id='daily' WHERE vehicle_type_id='private_car';
UPDATE public.demand_requests SET vehicle_type_id='max' WHERE vehicle_type_id='hiace';
UPDATE public.captain_profiles SET vehicle_type_id='daily' WHERE vehicle_type_id='private_car';
UPDATE public.captain_profiles SET vehicle_type_id='max' WHERE vehicle_type_id='hiace';

INSERT INTO public.pricing_config(vehicle_type_id,base_fee,rate_per_km,rate_per_min)
SELECT target.id, source.base_fee, source.rate_per_km, source.rate_per_min
FROM (VALUES ('prime'),('daily')) AS target(id)
JOIN public.pricing_config source ON source.vehicle_type_id='private_car'
ON CONFLICT (vehicle_type_id) DO NOTHING;
INSERT INTO public.pricing_config(vehicle_type_id,base_fee,rate_per_km,rate_per_min)
SELECT target.id, source.base_fee, source.rate_per_km, source.rate_per_min
FROM (VALUES ('space'),('max')) AS target(id)
JOIN public.pricing_config source ON source.vehicle_type_id='hiace'
ON CONFLICT (vehicle_type_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
