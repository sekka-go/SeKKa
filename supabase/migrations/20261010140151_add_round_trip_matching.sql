-- Optional return legs are stored alongside the existing outbound schedule.
-- Existing routes and requests remain one-way until their owners add a return time.
ALTER TABLE public.captain_lines
  ADD COLUMN return_arrival_time time;
ALTER TABLE public.demand_groups
  ADD COLUMN return_arrival_time time,
  ADD COLUMN matched_direction text CHECK (matched_direction IN ('outbound', 'return', 'roundtrip'));
UPDATE public.demand_groups SET matched_direction = 'outbound' WHERE status = 'matched';
ALTER TABLE public.demand_requests
  ADD COLUMN return_arrival_time time;

CREATE INDEX demand_groups_return_match_idx
  ON public.demand_groups(vehicle_type_id, trip_date, return_arrival_time)
  WHERE status = 'open' AND return_arrival_time IS NOT NULL;

DROP TRIGGER IF EXISTS trg_captain_line_match ON public.captain_lines;
CREATE TRIGGER trg_captain_line_match
  AFTER INSERT OR UPDATE OF status, arrival_time, return_arrival_time ON public.captain_lines
  FOR EACH ROW EXECUTE FUNCTION public.sekka_match_after_line_publish();

CREATE OR REPLACE FUNCTION public.sekka_match_demand_group(group_id integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  demand public.demand_groups%ROWTYPE;
  line public.captain_lines%ROWTYPE;
  radius_km numeric;
  time_window numeric;
  group_seats integer;
  occupied_outbound integer;
  occupied_return integer;
  selected_direction text;
BEGIN
  SELECT * INTO demand FROM public.demand_groups WHERE id = group_id AND status = 'open' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT numeric_value INTO radius_km FROM public.app_config WHERE config_key = 'demand_route_radius_km';
  SELECT numeric_value INTO time_window FROM public.app_config WHERE config_key = 'demand_arrival_window_minutes';

  SELECT * INTO line
  FROM public.captain_lines l
  WHERE l.status = 'active'
    AND l.vehicle_type_id = demand.vehicle_type_id
    AND extract(dow FROM demand.trip_date)::smallint = ANY(l.service_days)
    AND (
      (
        public.sekka_geo_km(l.origin_lat, l.origin_lng, demand.origin_lat, demand.origin_lng) <= radius_km
        AND public.sekka_geo_km(l.destination_lat, l.destination_lng, demand.destination_lat, demand.destination_lng) <= radius_km
        AND least(abs(extract(epoch FROM (l.arrival_time - demand.arrival_time)) / 60), 1440 - abs(extract(epoch FROM (l.arrival_time - demand.arrival_time)) / 60)) <= time_window
        AND (demand.return_arrival_time IS NULL OR (
          l.return_arrival_time IS NOT NULL
          AND least(abs(extract(epoch FROM (l.return_arrival_time - demand.return_arrival_time)) / 60), 1440 - abs(extract(epoch FROM (l.return_arrival_time - demand.return_arrival_time)) / 60)) <= time_window
        ))
      )
      OR (
        l.return_arrival_time IS NOT NULL
        AND public.sekka_geo_km(l.destination_lat, l.destination_lng, demand.origin_lat, demand.origin_lng) <= radius_km
        AND public.sekka_geo_km(l.origin_lat, l.origin_lng, demand.destination_lat, demand.destination_lng) <= radius_km
        AND least(abs(extract(epoch FROM (l.return_arrival_time - demand.arrival_time)) / 60), 1440 - abs(extract(epoch FROM (l.return_arrival_time - demand.arrival_time)) / 60)) <= time_window
        AND (demand.return_arrival_time IS NULL OR least(abs(extract(epoch FROM (l.arrival_time - demand.return_arrival_time)) / 60), 1440 - abs(extract(epoch FROM (l.arrival_time - demand.return_arrival_time)) / 60)) <= time_window)
      )
    )
  ORDER BY l.id
  LIMIT 1;

  IF FOUND THEN
    IF demand.return_arrival_time IS NOT NULL THEN
      selected_direction := 'roundtrip';
    ELSIF line.return_arrival_time IS NOT NULL
      AND public.sekka_geo_km(line.destination_lat, line.destination_lng, demand.origin_lat, demand.origin_lng) <= radius_km
      AND public.sekka_geo_km(line.origin_lat, line.origin_lng, demand.destination_lat, demand.destination_lng) <= radius_km
      AND least(abs(extract(epoch FROM (line.return_arrival_time - demand.arrival_time)) / 60), 1440 - abs(extract(epoch FROM (line.return_arrival_time - demand.arrival_time)) / 60)) <= time_window THEN
      selected_direction := 'return';
    ELSE
      selected_direction := 'outbound';
    END IF;
    PERFORM 1 FROM public.captain_lines WHERE id = line.id FOR UPDATE;
    SELECT * INTO line FROM public.captain_lines WHERE id = line.id AND status = 'active';
    IF NOT FOUND THEN RETURN; END IF;
    SELECT coalesce(sum(seats), 0)::integer INTO group_seats
      FROM public.demand_requests WHERE demand_group_id = demand.id AND status = 'open';
    SELECT coalesce(sum(r.seats) FILTER (WHERE g.matched_direction IN ('outbound', 'roundtrip')), 0)::integer,
           coalesce(sum(r.seats) FILTER (WHERE g.matched_direction IN ('return', 'roundtrip')), 0)::integer
      INTO occupied_outbound, occupied_return
      FROM public.demand_groups g JOIN public.demand_requests r ON r.demand_group_id = g.id
      WHERE g.captain_line_id = line.id AND g.trip_date = demand.trip_date AND g.status = 'matched';
    IF selected_direction IN ('outbound', 'roundtrip') AND group_seats + occupied_outbound > line.seats THEN RETURN; END IF;
    IF selected_direction IN ('return', 'roundtrip') AND group_seats + occupied_return > line.seats THEN RETURN; END IF;

    UPDATE public.demand_groups SET status = 'matched', captain_line_id = line.id, matched_direction = selected_direction WHERE id = demand.id AND status = 'open';
    UPDATE public.demand_requests SET status = 'matched' WHERE demand_group_id = demand.id AND status = 'open';
    INSERT INTO public.pool_notifications(user_id, group_id, event_key, payload)
      SELECT r.rider_user_id, NULL, 'demand-match:' || r.id,
        jsonb_build_object('title', 'تم العثور على مسار مناسب', 'message', 'تم ربط طلبك بمسار مناسب. افتح التطبيق لمراجعة التفاصيل.', 'line_id', line.id)
      FROM public.demand_requests r WHERE r.demand_group_id = demand.id
      ON CONFLICT(user_id, event_key) DO NOTHING;
    INSERT INTO public.pool_notifications(user_id, group_id, event_key, payload)
      VALUES(line.captain_user_id, NULL, 'captain-line-demand:' || line.id || ':' || demand.id,
        jsonb_build_object('title', 'طلبات ركاب جديدة', 'message', 'تم تجميع طلبات ركاب متشابهة على مسارك.', 'demand_group_id', demand.id))
      ON CONFLICT(user_id, event_key) DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sekka_cluster_demand_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  selected_group integer;
  radius_km numeric;
  time_window numeric;
  group_status text;
  matched_line_id integer;
  matched_direction text;
  line_capacity integer;
  occupied_outbound integer;
  occupied_return integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.vehicle_type_id), NEW.trip_date - DATE '2000-01-01');
  SELECT numeric_value INTO radius_km FROM public.app_config WHERE config_key = 'demand_route_radius_km';
  SELECT numeric_value INTO time_window FROM public.app_config WHERE config_key = 'demand_arrival_window_minutes';
  SELECT g.id INTO selected_group
  FROM public.demand_groups g
  WHERE g.status IN ('open', 'matched')
    AND g.vehicle_type_id = NEW.vehicle_type_id
    AND g.trip_date = NEW.trip_date
    AND least(abs(extract(epoch FROM (g.arrival_time - NEW.arrival_time)) / 60), 1440 - abs(extract(epoch FROM (g.arrival_time - NEW.arrival_time)) / 60)) <= time_window
    AND ((g.return_arrival_time IS NULL AND NEW.return_arrival_time IS NULL)
      OR (g.return_arrival_time IS NOT NULL AND NEW.return_arrival_time IS NOT NULL
        AND least(abs(extract(epoch FROM (g.return_arrival_time - NEW.return_arrival_time)) / 60), 1440 - abs(extract(epoch FROM (g.return_arrival_time - NEW.return_arrival_time)) / 60)) <= time_window))
    AND public.sekka_geo_km(g.origin_lat, g.origin_lng, NEW.pickup_lat, NEW.pickup_lng) <= radius_km
    AND public.sekka_geo_km(g.destination_lat, g.destination_lng, NEW.dropoff_lat, NEW.dropoff_lng) <= radius_km
    AND (g.status = 'open' OR EXISTS (
      SELECT 1 FROM public.captain_lines l WHERE l.id = g.captain_line_id AND l.status = 'active'
    ))
  ORDER BY g.created_at, g.id LIMIT 1 FOR UPDATE OF g;

  IF selected_group IS NOT NULL THEN
    SELECT status, captain_line_id, matched_direction INTO group_status, matched_line_id, matched_direction FROM public.demand_groups WHERE id = selected_group;
    IF group_status = 'matched' THEN
      SELECT seats INTO line_capacity FROM public.captain_lines WHERE id = matched_line_id AND status = 'active';
      SELECT coalesce(sum(r.seats) FILTER (WHERE g.matched_direction IN ('outbound', 'roundtrip')), 0)::integer,
             coalesce(sum(r.seats) FILTER (WHERE g.matched_direction IN ('return', 'roundtrip')), 0)::integer
        INTO occupied_outbound, occupied_return
        FROM public.demand_groups g JOIN public.demand_requests r ON r.demand_group_id = g.id
        WHERE g.captain_line_id = matched_line_id AND g.trip_date = NEW.trip_date AND g.status = 'matched';
      IF (matched_direction IN ('outbound', 'roundtrip') AND occupied_outbound + NEW.seats > coalesce(line_capacity, 0))
        OR (matched_direction IN ('return', 'roundtrip') AND occupied_return + NEW.seats > coalesce(line_capacity, 0)) THEN
        selected_group := NULL;
      END IF;
    END IF;
  END IF;

  IF selected_group IS NULL THEN
    INSERT INTO public.demand_groups(vehicle_type_id, origin_lat, origin_lng, destination_lat, destination_lng, trip_date, arrival_time, return_arrival_time)
    VALUES(NEW.vehicle_type_id, NEW.pickup_lat, NEW.pickup_lng, NEW.dropoff_lat, NEW.dropoff_lng, NEW.trip_date, NEW.arrival_time, NEW.return_arrival_time)
    RETURNING id INTO selected_group;
  END IF;
  NEW.demand_group_id := selected_group;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.sekka_match_after_line_publish() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE demand_row record;
BEGIN
  IF NEW.status = 'active' THEN
    FOR demand_row IN
      SELECT id FROM public.demand_groups
      WHERE status = 'open' AND vehicle_type_id = NEW.vehicle_type_id
        AND extract(dow FROM trip_date)::smallint = ANY(NEW.service_days)
    LOOP
      PERFORM public.sekka_match_demand_group(demand_row.id);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

-- Matching is invoked only by database triggers; keep the SECURITY DEFINER helper
-- out of the PostgREST RPC surface so clients cannot trigger arbitrary matches.
REVOKE ALL ON FUNCTION public.sekka_match_demand_group(integer) FROM PUBLIC, anon, authenticated;

DROP FUNCTION public.publish_captain_line(integer, text, text, double precision, double precision, text, double precision, double precision, jsonb, time, smallint[], integer, numeric, text[]);
CREATE FUNCTION public.publish_captain_line(
  actor_id integer, vehicle_id text, origin_name text, origin_y double precision, origin_x double precision,
  destination_name text, destination_y double precision, destination_x double precision, stops jsonb,
  arrival time, days smallint[], seat_count integer, seat_price numeric, methods text[], return_arrives time DEFAULT NULL
) RETURNS public.captain_lines
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE created public.captain_lines%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = actor_id AND role = 'captain' AND verified_at IS NOT NULL) THEN
    RAISE EXCEPTION 'verified captain required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.captain_profiles WHERE user_id = actor_id AND verification_status = 'approved' AND vehicle_type_id = vehicle_id) THEN
    RAISE EXCEPTION 'approved vehicle profile required' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.captain_lines(captain_user_id, vehicle_type_id, origin_label, origin_lat, origin_lng, destination_label, destination_lat, destination_lng, intermediate_stops, arrival_time, return_arrival_time, service_days, seats, price_per_seat, payment_methods)
  VALUES(actor_id, vehicle_id, origin_name, origin_y, origin_x, destination_name, destination_y, destination_x, coalesce(stops, '[]'::jsonb), arrival, return_arrives, days, seat_count, seat_price, methods)
  RETURNING * INTO created;
  RETURN created;
END $$;

DROP FUNCTION public.create_demand_request(integer, text, date, time, text, double precision, double precision, text, double precision, double precision, integer);
CREATE FUNCTION public.create_demand_request(
  actor_id integer, vehicle_id text, trip_on date, arrives time,
  pickup_name text, pickup_y double precision, pickup_x double precision,
  dropoff_name text, dropoff_y double precision, dropoff_x double precision,
  seat_count integer DEFAULT 1, return_arrives time DEFAULT NULL
) RETURNS public.demand_requests
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE created public.demand_requests%ROWTYPE;
BEGIN
  IF trip_on < (now() AT TIME ZONE 'Africa/Cairo')::date THEN
    RAISE EXCEPTION 'trip date must be today or later' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = actor_id AND role = 'rider' AND verified_at IS NOT NULL) THEN
    RAISE EXCEPTION 'verified rider required' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.demand_requests(rider_user_id, vehicle_type_id, trip_date, arrival_time, return_arrival_time, pickup_label, pickup_lat, pickup_lng, dropoff_label, dropoff_lat, dropoff_lng, seats)
  VALUES(actor_id, vehicle_id, trip_on, arrives, return_arrives, pickup_name, pickup_y, pickup_x, dropoff_name, dropoff_y, dropoff_x, seat_count)
  RETURNING * INTO created;
  RETURN created;
END $$;

REVOKE ALL ON FUNCTION public.publish_captain_line(integer, text, text, double precision, double precision, text, double precision, double precision, jsonb, time, smallint[], integer, numeric, text[], time) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_demand_request(integer, text, date, time, text, double precision, double precision, text, double precision, double precision, integer, time) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_captain_line(integer, text, text, double precision, double precision, text, double precision, double precision, jsonb, time, smallint[], integer, numeric, text[], time) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_demand_request(integer, text, date, time, text, double precision, double precision, text, double precision, double precision, integer, time) TO service_role;

NOTIFY pgrst, 'reload schema';
