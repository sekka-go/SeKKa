CREATE TABLE public.user_location_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  normalized_query text NOT NULL CHECK (char_length(normalized_query) BETWEEN 3 AND 160),
  search_day date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'complete', 'failed')),
  provider_place_ids text[] NOT NULL DEFAULT '{}',
  suggestions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(suggestions) = 'array'),
  selected_place_id text,
  selected_lat double precision,
  selected_lng double precision,
  details_calls smallint NOT NULL DEFAULT 0 CHECK (details_calls BETWEEN 0 AND 5),
  coordinates_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_location_searches_unique_query UNIQUE (user_id, normalized_query),
  CONSTRAINT user_location_searches_coordinate_pair CHECK ((selected_lat IS NULL) = (selected_lng IS NULL)),
  CONSTRAINT user_location_searches_selected_place_valid CHECK (selected_place_id IS NULL OR selected_place_id = ANY (provider_place_ids))
);

CREATE INDEX user_location_searches_user_day_idx
  ON public.user_location_searches (user_id, search_day);

ALTER TABLE public.user_location_searches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_location_searches FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_location_searches TO service_role;

CREATE TABLE public.google_maps_api_usage (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service text NOT NULL CHECK (service IN ('autocomplete', 'place_details', 'compute_route')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX google_maps_api_usage_created_at_idx
  ON public.google_maps_api_usage (created_at);

ALTER TABLE public.google_maps_api_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_maps_api_usage FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.google_maps_api_usage TO service_role;

ALTER TABLE public.pool_members
  ALTER COLUMN pickup_lat DROP NOT NULL,
  ALTER COLUMN pickup_lng DROP NOT NULL,
  ALTER COLUMN dropoff_lat DROP NOT NULL,
  ALTER COLUMN dropoff_lng DROP NOT NULL,
  ADD COLUMN pickup_place_id text,
  ADD COLUMN dropoff_place_id text,
  ADD COLUMN location_data_updated_at timestamptz;

UPDATE public.pool_members
SET location_data_updated_at = joined_at
WHERE pickup_lat IS NOT NULL OR pickup_lng IS NOT NULL OR dropoff_lat IS NOT NULL OR dropoff_lng IS NOT NULL;

ALTER TABLE public.pool_members ALTER COLUMN location_data_updated_at SET DEFAULT now();

ALTER TABLE public.pool_groups ADD COLUMN route_geometry_updated_at timestamptz;
UPDATE public.pool_groups SET route_geometry_updated_at = created_at WHERE route_geometry IS NOT NULL;
ALTER TABLE public.pool_groups ALTER COLUMN route_geometry_updated_at SET DEFAULT now();

ALTER TABLE public.pool_trip_stops
  ALTER COLUMN lat DROP NOT NULL,
  ALTER COLUMN lng DROP NOT NULL,
  ADD COLUMN location_data_updated_at timestamptz;
UPDATE public.pool_trip_stops s
SET location_data_updated_at = COALESCE(m.location_data_updated_at, t.departure_at, now())
FROM public.pool_members m, public.pool_trips t
WHERE s.member_id = m.id AND s.trip_id = t.id
  AND (s.lat IS NOT NULL OR s.lng IS NOT NULL);
ALTER TABLE public.pool_trip_stops ALTER COLUMN location_data_updated_at SET DEFAULT now();

ALTER TABLE public.daily_commute_requests
  ALTER COLUMN pickup_lat DROP NOT NULL,
  ALTER COLUMN pickup_lng DROP NOT NULL,
  ALTER COLUMN dropoff_lat DROP NOT NULL,
  ALTER COLUMN dropoff_lng DROP NOT NULL,
  ADD COLUMN location_data_updated_at timestamptz;
UPDATE public.daily_commute_requests
SET location_data_updated_at = COALESCE(requested_at, created_at)
WHERE pickup_lat IS NOT NULL OR pickup_lng IS NOT NULL OR dropoff_lat IS NOT NULL OR dropoff_lng IS NOT NULL;
ALTER TABLE public.daily_commute_requests ALTER COLUMN location_data_updated_at SET DEFAULT now();

ALTER TABLE public.trip_stops
  ALTER COLUMN lat DROP NOT NULL,
  ALTER COLUMN lng DROP NOT NULL,
  ADD COLUMN location_data_updated_at timestamptz;
UPDATE public.trip_stops s
SET location_data_updated_at = COALESCE(t.started_at, now())
FROM public.trips t
WHERE s.trip_id = t.id AND (s.lat IS NOT NULL OR s.lng IS NOT NULL);
ALTER TABLE public.trip_stops ALTER COLUMN location_data_updated_at SET DEFAULT now();

ALTER TABLE public.captain_profiles ADD COLUMN current_location_updated_at timestamptz;
UPDATE public.captain_profiles
SET current_location_updated_at = created_at
WHERE current_lat IS NOT NULL OR current_lng IS NOT NULL;
ALTER TABLE public.captain_profiles ALTER COLUMN current_location_updated_at SET DEFAULT now();

CREATE OR REPLACE FUNCTION public.sekka_track_route_geometry_age()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.route_geometry IS NULL THEN
    IF TG_OP = 'INSERT' OR OLD.route_geometry IS NOT NULL THEN
      NEW.route_geometry_updated_at := NULL;
    END IF;
  ELSIF TG_OP = 'INSERT' OR NEW.route_geometry IS DISTINCT FROM OLD.route_geometry THEN
    NEW.route_geometry_updated_at := clock_timestamp();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER pool_groups_track_route_geometry_age
BEFORE INSERT OR UPDATE OF route_geometry ON public.pool_groups
FOR EACH ROW EXECUTE FUNCTION public.sekka_track_route_geometry_age();

CREATE OR REPLACE FUNCTION public.sekka_begin_location_search(p_user_id integer, p_normalized_query text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_day date := (clock_timestamp() AT TIME ZONE 'Africa/Cairo')::date;
  v_month_start timestamptz := date_trunc('month', clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_used integer;
  v_id uuid;
  v_status text;
  v_created_at timestamptz;
  v_suggestions jsonb;
BEGIN
  IF p_user_id IS NULL OR p_user_id < 1 OR p_normalized_query IS NULL OR char_length(p_normalized_query) NOT BETWEEN 3 AND 160 THEN
    RAISE EXCEPTION 'invalid location search request' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(73101, p_user_id);

  SELECT id, status, created_at, suggestions
    INTO v_id, v_status, v_created_at, v_suggestions
  FROM public.user_location_searches
  WHERE user_id = p_user_id AND normalized_query = p_normalized_query;

  IF FOUND THEN
    SELECT count(*) INTO v_used
    FROM public.user_location_searches
    WHERE user_id = p_user_id AND search_day = v_day;
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'duplicate',
      'search_id', v_id,
      'status', v_status,
      'suggestions', CASE WHEN v_created_at >= clock_timestamp() - interval '30 days' THEN v_suggestions ELSE '[]'::jsonb END,
      'daily_remaining', GREATEST(0, 2 - v_used)
    );
  END IF;

  SELECT count(*) INTO v_used
  FROM public.user_location_searches
  WHERE user_id = p_user_id AND search_day = v_day;

  IF v_used >= 2 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'daily_limit', 'daily_remaining', 0);
  END IF;

  PERFORM pg_advisory_xact_lock(73102, 0);

  SELECT count(*) INTO v_used
  FROM public.google_maps_api_usage
  WHERE created_at >= v_month_start
    AND created_at < v_month_start + interval '1 month';

  IF v_used >= 10000 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'monthly_limit', 'monthly_remaining', 0);
  END IF;

  INSERT INTO public.google_maps_api_usage (service) VALUES ('autocomplete');
  INSERT INTO public.user_location_searches (user_id, normalized_query, search_day)
  VALUES (p_user_id, p_normalized_query, v_day)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'search_id', v_id,
    'daily_remaining', GREATEST(0, 1 - (v_used)),
    'monthly_remaining', GREATEST(0, 9999 - v_used)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sekka_claim_location_resolution(p_user_id integer, p_search_id uuid, p_place_id text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_search public.user_location_searches%ROWTYPE;
  v_month_start timestamptz := date_trunc('month', clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_used integer;
BEGIN
  IF p_user_id IS NULL OR p_user_id < 1 OR p_search_id IS NULL OR p_place_id IS NULL OR char_length(p_place_id) NOT BETWEEN 5 AND 300 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid');
  END IF;

  SELECT * INTO v_search
  FROM public.user_location_searches
  WHERE id = p_search_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_search.status <> 'complete' OR NOT (p_place_id = ANY(v_search.provider_place_ids)) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'place_not_found');
  END IF;

  IF v_search.selected_place_id = p_place_id
     AND v_search.selected_lat IS NOT NULL
     AND v_search.coordinates_updated_at >= clock_timestamp() - interval '30 days' THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'cached', true,
      'place_id', p_place_id,
      'lat', v_search.selected_lat,
      'lng', v_search.selected_lng,
      'label', COALESCE((SELECT item->>'label' FROM jsonb_array_elements(v_search.suggestions) item WHERE item->>'place_id' = p_place_id LIMIT 1), '')
    );
  END IF;

  IF v_search.details_calls >= 5 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'resolution_limit');
  END IF;

  PERFORM pg_advisory_xact_lock(73102, 0);

  SELECT count(*) INTO v_used
  FROM public.google_maps_api_usage
  WHERE created_at >= v_month_start
    AND created_at < v_month_start + interval '1 month';

  IF v_used >= 10000 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'monthly_limit', 'monthly_remaining', 0);
  END IF;

  INSERT INTO public.google_maps_api_usage (service) VALUES ('place_details');
  UPDATE public.user_location_searches
  SET details_calls = details_calls + 1
  WHERE id = p_search_id AND user_id = p_user_id;

  RETURN jsonb_build_object('allowed', true, 'cached', false, 'place_id', p_place_id, 'monthly_remaining', GREATEST(0, 9999 - v_used));
END;
$$;

CREATE OR REPLACE FUNCTION public.sekka_reserve_google_maps_request(p_service text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_month_start timestamptz := date_trunc('month', clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_used integer;
BEGIN
  IF p_service NOT IN ('autocomplete', 'place_details', 'compute_route') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_service');
  END IF;

  PERFORM pg_advisory_xact_lock(73102, 0);
  SELECT count(*) INTO v_used
  FROM public.google_maps_api_usage
  WHERE created_at >= v_month_start
    AND created_at < v_month_start + interval '1 month';

  IF v_used >= 10000 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'monthly_limit', 'monthly_remaining', 0);
  END IF;

  INSERT INTO public.google_maps_api_usage (service) VALUES (p_service);
  RETURN jsonb_build_object('allowed', true, 'monthly_remaining', GREATEST(0, 9999 - v_used));
END;
$$;

CREATE OR REPLACE FUNCTION public.sekka_purge_expired_location_data()
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer := 0;
  v_rows integer;
  v_cutoff timestamptz := clock_timestamp() - interval '30 days';
BEGIN
  UPDATE public.user_location_searches
  SET suggestions = '[]'::jsonb
  WHERE created_at < v_cutoff AND suggestions <> '[]'::jsonb;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  UPDATE public.user_location_searches
  SET selected_lat = NULL,
      selected_lng = NULL,
      coordinates_updated_at = NULL,
      selected_place_id = NULL
  WHERE coordinates_updated_at < v_cutoff
    AND (selected_lat IS NOT NULL OR selected_lng IS NOT NULL);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  UPDATE public.pool_members
  SET pickup_lat = NULL, pickup_lng = NULL, dropoff_lat = NULL, dropoff_lng = NULL, location_data_updated_at = NULL
  WHERE location_data_updated_at < v_cutoff
    AND (pickup_lat IS NOT NULL OR pickup_lng IS NOT NULL OR dropoff_lat IS NOT NULL OR dropoff_lng IS NOT NULL);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  UPDATE public.pool_groups
  SET route_geometry = NULL, route_geometry_updated_at = NULL
  WHERE route_geometry_updated_at < v_cutoff AND route_geometry IS NOT NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  UPDATE public.pool_trip_stops
  SET lat = NULL, lng = NULL, location_data_updated_at = NULL
  WHERE location_data_updated_at < v_cutoff AND (lat IS NOT NULL OR lng IS NOT NULL);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  UPDATE public.daily_commute_requests
  SET pickup_lat = NULL, pickup_lng = NULL, dropoff_lat = NULL, dropoff_lng = NULL, location_data_updated_at = NULL
  WHERE location_data_updated_at < v_cutoff
    AND (pickup_lat IS NOT NULL OR pickup_lng IS NOT NULL OR dropoff_lat IS NOT NULL OR dropoff_lng IS NOT NULL);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  UPDATE public.trip_stops
  SET lat = NULL, lng = NULL, location_data_updated_at = NULL
  WHERE location_data_updated_at < v_cutoff AND (lat IS NOT NULL OR lng IS NOT NULL);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  UPDATE public.captain_profiles
  SET current_lat = NULL, current_lng = NULL, current_location_updated_at = NULL
  WHERE current_location_updated_at < v_cutoff AND (current_lat IS NOT NULL OR current_lng IS NOT NULL);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  DELETE FROM public.google_maps_api_usage
  WHERE created_at < clock_timestamp() - interval '90 days';

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sekka_begin_location_search(integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sekka_claim_location_resolution(integer, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sekka_reserve_google_maps_request(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sekka_purge_expired_location_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sekka_begin_location_search(integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sekka_claim_location_resolution(integer, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sekka_reserve_google_maps_request(text) TO service_role;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    FOR v_job_id IN SELECT jobid FROM cron.job WHERE jobname = 'sekka-purge-expired-location-data'
    LOOP
      PERFORM cron.unschedule(v_job_id);
    END LOOP;
    PERFORM cron.schedule(
      'sekka-purge-expired-location-data',
      '*/15 * * * *',
      'SELECT public.sekka_purge_expired_location_data()'
    );
  END IF;
END;
$$;