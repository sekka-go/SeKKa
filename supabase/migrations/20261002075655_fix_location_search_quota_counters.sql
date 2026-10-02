CREATE OR REPLACE FUNCTION public.sekka_begin_location_search(p_user_id integer, p_normalized_query text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_day date := (clock_timestamp() AT TIME ZONE 'Africa/Cairo')::date;
  v_month_start timestamptz := date_trunc('month', clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_daily_used integer;
  v_monthly_used integer;
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
    SELECT count(*) INTO v_daily_used
    FROM public.user_location_searches
    WHERE user_id = p_user_id AND search_day = v_day;
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'duplicate',
      'search_id', v_id,
      'status', v_status,
      'suggestions', CASE WHEN v_created_at >= clock_timestamp() - interval '30 days' THEN v_suggestions ELSE '[]'::jsonb END,
      'daily_remaining', GREATEST(0, 2 - v_daily_used)
    );
  END IF;

  SELECT count(*) INTO v_daily_used
  FROM public.user_location_searches
  WHERE user_id = p_user_id AND search_day = v_day;

  IF v_daily_used >= 2 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'daily_limit', 'daily_remaining', 0);
  END IF;

  PERFORM pg_advisory_xact_lock(73102, 0);

  SELECT count(*) INTO v_monthly_used
  FROM public.google_maps_api_usage
  WHERE created_at >= v_month_start
    AND created_at < v_month_start + interval '1 month';

  IF v_monthly_used >= 10000 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'monthly_limit', 'monthly_remaining', 0);
  END IF;

  INSERT INTO public.google_maps_api_usage (service) VALUES ('autocomplete');
  INSERT INTO public.user_location_searches (user_id, normalized_query, search_day)
  VALUES (p_user_id, p_normalized_query, v_day)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'search_id', v_id,
    'daily_remaining', GREATEST(0, 1 - v_daily_used),
    'monthly_remaining', GREATEST(0, 9999 - v_monthly_used)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.sekka_begin_location_search(integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sekka_begin_location_search(integer, text) TO service_role;