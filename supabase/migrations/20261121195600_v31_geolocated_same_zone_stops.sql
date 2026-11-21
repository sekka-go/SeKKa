-- Allow legitimate multi-stop trips within one legacy service zone.
-- No legacy routes, RLS, privileges or pricing are changed.
CREATE OR REPLACE FUNCTION public.v31_create_vehicle_route_draft(p_title text, p_vehicle uuid, p_category text, p_direction text, p_period text, p_outbound time without time zone, p_return time without time zone, p_return_supported boolean, p_price integer, p_stops jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE uid uuid:=(SELECT auth.uid()); route_id uuid; stop jsonb; position integer:=0;
        fixed_capacity smallint;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.v31_captain_profiles cp
     WHERE cp.user_id=uid AND cp.approval_status='approved')
 THEN RAISE EXCEPTION 'CAPTAIN_NOT_APPROVED'; END IF;
 SELECT c.seat_capacity INTO fixed_capacity
 FROM public.v31_vehicles v JOIN public.v31_vehicle_service_categories c ON c.vehicle_id=v.id
 WHERE v.id=p_vehicle AND v.captain_id=uid AND v.status='active' AND c.category=p_category
 FOR UPDATE OF v;
 IF fixed_capacity IS NULL THEN RAISE EXCEPTION 'VEHICLE_CATEGORY_NOT_ENABLED'; END IF;
 IF char_length(trim(coalesce(p_title,'')))<3 OR char_length(trim(p_title))>120
    OR p_category NOT IN ('PRIME','SAVER','SPACE','MAX')
    OR p_direction NOT IN ('outbound','return','round_trip')
    OR p_period NOT IN ('weekly','monthly') OR p_price IS NULL OR p_price<1
    OR (p_direction<>'return' AND p_outbound IS NULL)
    OR (p_direction<>'outbound' AND p_return IS NULL)
    OR (p_direction='round_trip' AND NOT coalesce(p_return_supported,false))
 THEN RAISE EXCEPTION 'INVALID_ROUTE_DETAILS'; END IF;
 IF jsonb_typeof(p_stops) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_stops)<2 OR jsonb_array_length(p_stops)>30
 THEN RAISE EXCEPTION 'INVALID_STOPS_COUNT'; END IF;
 -- The legacy area_id is an internal routing bucket. It is not a city
 -- boundary and must not invalidate two distinct verified stops within it.
 -- Preserve the old different-area guard for non-geolocated draft callers.
 IF p_stops->0->>'area_id' IS NOT DISTINCT FROM
    p_stops->(jsonb_array_length(p_stops)-1)->>'area_id' THEN
  IF jsonb_typeof(p_stops->0->'latitude') IS DISTINCT FROM 'number'
   OR jsonb_typeof(p_stops->0->'longitude') IS DISTINCT FROM 'number'
   OR jsonb_typeof(p_stops->(jsonb_array_length(p_stops)-1)->'latitude') IS DISTINCT FROM 'number'
   OR jsonb_typeof(p_stops->(jsonb_array_length(p_stops)-1)->'longitude') IS DISTINCT FROM 'number'
  THEN RAISE EXCEPTION 'SAME_ORIGIN_DESTINATION'; END IF;
  IF sqrt(
    power(((p_stops->0->>'latitude')::double precision
      -(p_stops->(jsonb_array_length(p_stops)-1)->>'latitude')::double precision)*111200,2)
    +power(((p_stops->0->>'longitude')::double precision
      -(p_stops->(jsonb_array_length(p_stops)-1)->>'longitude')::double precision)*111200
      *cos(radians((p_stops->0->>'latitude')::double precision)),2)
   )<50
  THEN RAISE EXCEPTION 'SAME_ORIGIN_DESTINATION'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_stops) s
    WHERE nullif(trim(s->>'name'),'') IS NULL OR char_length(trim(s->>'name'))<2
      OR (s->>'area_id') !~ '^[0-9]+$'
      OR NOT EXISTS(SELECT 1 FROM public.v31_service_areas a
        WHERE a.id=(s->>'area_id')::bigint AND a.active))
 THEN RAISE EXCEPTION 'INVALID_STOP'; END IF;
 IF (SELECT count(DISTINCT lower(trim(s->>'name'))||':'||(s->>'area_id'))
     FROM jsonb_array_elements(p_stops) s)<>jsonb_array_length(p_stops)
 THEN RAISE EXCEPTION 'DUPLICATE_STOPS'; END IF;
 INSERT INTO public.v31_routes(captain_id,title,category,seat_capacity,vehicle_id,
   direction,period,outbound_time,return_time,return_supported,price_egp,status)
 VALUES(uid,trim(p_title),p_category,fixed_capacity,p_vehicle,p_direction,p_period,
   p_outbound,p_return,coalesce(p_return_supported,false),p_price,'draft')
 RETURNING id INTO route_id;
 FOR stop IN SELECT value FROM jsonb_array_elements(p_stops) LOOP
   INSERT INTO public.v31_route_stops(route_id,area_id,name,position,pickup_allowed,dropoff_allowed)
   VALUES(route_id,(stop->>'area_id')::bigint,trim(stop->>'name'),position,
     coalesce((stop->>'pickup')::boolean,true),coalesce((stop->>'dropoff')::boolean,true));
   position:=position+1;
 END LOOP;
 RETURN route_id;
END
$function$
