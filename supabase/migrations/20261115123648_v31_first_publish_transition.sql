-- Applied to Supabase Staging only as migration 20261115123648.
-- Keep Production unchanged until independent acceptance.
-- Permit approved captains to publish their first saved route draft.
CREATE OR REPLACE FUNCTION public.v31_set_route_status(p_route uuid, p_status text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_uid uuid := (SELECT auth.uid());
 v_route public.v31_routes%rowtype;
 v_active integer;
 v_stop_count integer;
 v_first_area bigint;
 v_last_area bigint;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF p_status NOT IN ('paused','published','archived') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
 SELECT * INTO v_route FROM public.v31_routes WHERE id=p_route FOR UPDATE;
 IF NOT FOUND OR v_route.captain_id<>v_uid THEN RAISE EXCEPTION 'ROUTE_NOT_OWNED'; END IF;

 IF v_route.status='draft' AND p_status='published' THEN
  SELECT count(*) INTO v_stop_count FROM public.v31_route_stops WHERE route_id=p_route;
  IF v_stop_count<2 THEN RAISE EXCEPTION 'ROUTE_STOPS_REQUIRED'; END IF;
  SELECT area_id INTO v_first_area FROM public.v31_route_stops
  WHERE route_id=p_route ORDER BY position ASC LIMIT 1;
  SELECT area_id INTO v_last_area FROM public.v31_route_stops
  WHERE route_id=p_route ORDER BY position DESC LIMIT 1;
  IF v_first_area=v_last_area THEN RAISE EXCEPTION 'SAME_ORIGIN_DESTINATION'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.v31_route_stops AS s
    JOIN public.v31_service_areas AS a ON a.id=s.area_id
    WHERE s.route_id=p_route AND NOT a.active
  ) THEN RAISE EXCEPTION 'INACTIVE_ROUTE_AREA'; END IF;
 ELSIF v_route.status='published' AND p_status IN ('paused','archived') THEN
  NULL;
 ELSIF v_route.status='paused' AND p_status IN ('published','archived') THEN
  NULL;
 ELSE
  RAISE EXCEPTION 'INVALID_TRANSITION';
 END IF;

 IF p_status='published' AND NOT EXISTS (
   SELECT 1 FROM public.v31_captain_profiles AS cp
   WHERE cp.user_id=v_uid AND cp.approval_status='approved'
 ) THEN RAISE EXCEPTION 'CAPTAIN_NOT_APPROVED'; END IF;
 IF p_status='archived' THEN
  SELECT count(*) INTO v_active FROM public.v31_bookings
  WHERE route_id=p_route AND status IN ('pending','confirmed');
  IF v_active>0 THEN RAISE EXCEPTION 'ACTIVE_BOOKINGS_PREVENT_ARCHIVE'; END IF;
 END IF;
 UPDATE public.v31_routes SET status=p_status WHERE id=p_route;
 RETURN p_status;
END
$function$
