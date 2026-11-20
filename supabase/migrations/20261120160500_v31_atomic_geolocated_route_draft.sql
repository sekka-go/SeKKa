-- seKKa / Staging-only forward migration. No Production changes.
-- Geolocated Captain draft: existing approved-Captain/vehicle validation stays in
-- v31_create_vehicle_route_draft; this wrapper commits stops + GPS atomically.
-- Existing callers of the legacy draft RPC remain unaffected.
create or replace function public.v31_create_geolocated_route_draft(
 p_title text,p_vehicle uuid,p_category text,p_direction text,p_period text,
 p_outbound time without time zone,p_return time without time zone,
 p_return_supported boolean,p_price integer,p_stops jsonb
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare
 actor uuid := (select auth.uid());
 created_route uuid;
 item jsonb;
 stop_id uuid;
 stop_index integer:=0;
 latitude_value numeric;
 longitude_value numeric;
begin
 if actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if jsonb_typeof(p_stops) is distinct from 'array'
    or jsonb_array_length(p_stops) < 2
    or jsonb_array_length(p_stops) > 30 then
  raise exception 'INVALID_STOPS_COUNT' using errcode='23514';
 end if;
 -- Fail before insertion for malformed or missing GPS coordinates. All stops
 -- selected in the new picker have verified locations; do not store half-GPS routes.
 for item in select value from jsonb_array_elements(p_stops) loop
  if jsonb_typeof(item->'latitude') <> 'number'
     or jsonb_typeof(item->'longitude') <> 'number' then
   raise exception 'STOP_COORDINATES_REQUIRED' using errcode='23514';
  end if;
  latitude_value:=(item->>'latitude')::numeric;
  longitude_value:=(item->>'longitude')::numeric;
  -- Broad launch-region guard, not a claim of exact district/polygon membership.
  if latitude_value not between 29.45 and 30.45
     or longitude_value not between 30.45 and 31.95 then
   raise exception 'STOP_OUTSIDE_LAUNCH_REGION' using errcode='23514';
  end if;
 end loop;
 -- Reuse the already-approved server validation for Captain, approved vehicle,
 -- category/capacity, direction, time preferences, price positivity and areas.
 -- An exception anywhere below rolls back the entire RPC transaction.
 created_route:=public.v31_create_vehicle_route_draft(
  p_title,p_vehicle,p_category,p_direction,p_period,p_outbound,p_return,
  p_return_supported,p_price,p_stops
 );
 for item in select value from jsonb_array_elements(p_stops) loop
  select s.id into stop_id from public.v31_route_stops s
  where s.route_id=created_route and s.position=stop_index;
  if stop_id is null then
   raise exception 'DRAFT_STOP_NOT_CREATED' using errcode='23514';
  end if;
  perform public.v31_set_draft_stop_coordinates(
   stop_id,(item->>'latitude')::numeric,(item->>'longitude')::numeric
  );
  stop_index:=stop_index+1;
 end loop;
 return created_route;
end
$$;
revoke all on function public.v31_create_geolocated_route_draft(
 text,uuid,text,text,text,time without time zone,time without time zone,boolean,integer,jsonb
) from public,anon;
grant execute on function public.v31_create_geolocated_route_draft(
 text,uuid,text,text,text,time without time zone,time without time zone,boolean,integer,jsonb
) to authenticated;
comment on function public.v31_create_geolocated_route_draft(
 text,uuid,text,text,text,time without time zone,time without time zone,boolean,integer,jsonb
) is 'Authenticated, approved Captain only; atomic draft+coordinates. Keeps existing route rules and defers operational-trip modeling.';
