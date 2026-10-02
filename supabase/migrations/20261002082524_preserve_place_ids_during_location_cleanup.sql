-- Keep provider Place IDs for route continuity; expire coordinate-bearing content only.
CREATE OR REPLACE FUNCTION public.sekka_purge_expired_location_data()
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
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
      coordinates_updated_at = NULL
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
$function$;
