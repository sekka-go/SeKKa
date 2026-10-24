-- Captains may edit or cancel a published line only until a rider has been
-- matched to it. Lock the line row while checking and writing so simultaneous
-- requests cannot bypass the check.
CREATE OR REPLACE FUNCTION public.set_captain_line_status(actor_id integer, line_id integer, next_status text)
RETURNS public.captain_lines
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE updated public.captain_lines%ROWTYPE;
BEGIN
  IF next_status NOT IN ('active','paused','cancelled') THEN
    RAISE EXCEPTION 'invalid status' USING ERRCODE='22023';
  END IF;

  PERFORM 1 FROM public.captain_lines
    WHERE id=line_id AND captain_user_id=actor_id
    FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.users u JOIN public.captain_profiles c ON c.user_id=u.id
    WHERE u.id=actor_id AND u.role='captain' AND u.verified_at IS NOT NULL
      AND c.verification_status='approved' AND c.status <> 'suspended_grace_expired'
  ) THEN
    RAISE EXCEPTION 'line not found or not owned by captain' USING ERRCODE='42501';
  END IF;

  IF next_status='cancelled' AND EXISTS (
    SELECT 1 FROM public.demand_groups g
    JOIN public.demand_requests r ON r.demand_group_id=g.id
    WHERE g.captain_line_id=line_id AND g.status='matched'
      AND r.status IN ('open','matched')
  ) THEN
    RAISE EXCEPTION 'a rider has joined this line' USING ERRCODE='55000';
  END IF;

  UPDATE public.captain_lines SET status=next_status, updated_at=now()
    WHERE id=line_id AND captain_user_id=actor_id
    RETURNING * INTO updated;
  RETURN updated;
END $$;

CREATE FUNCTION public.update_captain_line(
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
    WHERE id=line_id AND captain_user_id=actor_id
    FOR UPDATE;
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
  ) THEN
    RAISE EXCEPTION 'a rider has joined this line' USING ERRCODE='55000';
  END IF;

  allowed_seats := CASE vehicle_id WHEN 'private_car' THEN 4 WHEN 'hiace' THEN 14 ELSE 0 END;
  IF allowed_seats=0 OR seat_count < 1 OR seat_count > allowed_seats
     OR route_km IS NULL OR route_km <= 0 OR route_km > 1000
     OR seat_price IS NULL OR seat_price < 0.01 OR seat_price > 99999999.99
     OR jsonb_typeof(coalesce(stops,'[]'::jsonb)) <> 'array'
     OR jsonb_array_length(coalesce(stops,'[]'::jsonb)) > 10
     OR cardinality(days) NOT BETWEEN 1 AND 7
     OR cardinality(days) <> (SELECT count(DISTINCT value)::integer FROM unnest(days) AS day_value(value))
     OR NOT (days <@ ARRAY[0,1,2,3,4,5,6]::smallint[])
     OR cardinality(methods)=0
     OR NOT (methods <@ ARRAY['cash','instapay','wallet']::text[]) THEN
    RAISE EXCEPTION 'captain line details are invalid' USING ERRCODE='22023';
  END IF;

  UPDATE public.captain_lines SET
    vehicle_type_id=vehicle_id,
    origin_label=origin_name, origin_lat=origin_y, origin_lng=origin_x,
    destination_label=destination_name, destination_lat=destination_y, destination_lng=destination_x,
    intermediate_stops=coalesce(stops,'[]'::jsonb), arrival_time=arrival,
    return_arrival_time=return_arrives, service_days=days, seats=seat_count,
    route_distance_km=route_km, price_per_seat=seat_price,
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

NOTIFY pgrst, 'reload schema';
