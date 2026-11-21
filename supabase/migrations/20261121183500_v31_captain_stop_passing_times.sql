-- Staging-tested additive Captain stop passing times. No existing route data is overwritten.
-- Time preferences are NOT finalized departure dates; booking terms remain unchanged.
alter table public.v31_route_stops
  add column if not exists outbound_stop_time time without time zone,
  add column if not exists return_stop_time time without time zone;

comment on column public.v31_route_stops.outbound_stop_time is 'Optional Captain estimated outbound passing time at this ordered stop (local time), not confirmed departure.';
comment on column public.v31_route_stops.return_stop_time is 'Optional Captain estimated return passing time at this ordered stop (local time), not confirmed departure.';

CREATE OR REPLACE FUNCTION public.v31_create_geolocated_route_draft(p_title text, p_vehicle uuid, p_category text, p_direction text, p_period text, p_outbound time without time zone, p_return time without time zone, p_return_supported boolean, p_price integer, p_stops jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if jsonb_typeof(item->'latitude') is distinct from 'number'
     or jsonb_typeof(item->'longitude') is distinct from 'number' then
   raise exception 'STOP_COORDINATES_REQUIRED' using errcode='23514';
  end if;
  latitude_value:=(item->>'latitude')::numeric;
  longitude_value:=(item->>'longitude')::numeric;
  -- Broad launch-region guard, not a claim of exact district/polygon membership.
  if latitude_value not between 29.45 and 30.45
     or longitude_value not between 30.45 and 31.95 then
   raise exception 'STOP_OUTSIDE_LAUNCH_REGION' using errcode='23514';
  end if;
  -- Per-stop times are optional and describe an expected clock passing time;
  -- malformed values cannot be silently cast or change an existing draft.
  if (item ? 'outbound_stop_time') and item->>'outbound_stop_time' is not null
   and (item->>'outbound_stop_time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9] for Captain, approved vehicle,
 -- category/capacity, direction, time preferences, price positivity and areas.
 -- An exception anywhere below rolls back the entire RPC transaction.
 created_route:=public.v31_create_vehicle_route_draft(
  p_title,p_vehicle,p_category,p_direction,p_period,p_outbound,p_return,
  (p_direction='return' or coalesce(p_return_supported,false)),p_price,p_stops
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
  -- Store both directions against the same immutable ordered stop.
  -- The reversed return journey reads return_stop_time, not outbound.
  update public.v31_route_stops as s
    set outbound_stop_time=case when p_direction='return' then null else nullif(item->>'outbound_stop_time','')::time end,
        return_stop_time=case when p_direction='outbound' then null else nullif(item->>'return_stop_time','')::time end
  from public.v31_routes as r
  where s.id=stop_id and s.route_id=created_route and r.id=s.route_id
    and r.captain_id=actor and r.status='draft';
  stop_index:=stop_index+1;
 end loop;
 return created_route;
end
$function$
 then
   raise exception 'INVALID_STOP_PASSING_TIME' using errcode='23514';
  end if;
  if (item ? 'return_stop_time') and item->>'return_stop_time' is not null
   and (item->>'return_stop_time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9] for Captain, approved vehicle,
 -- category/capacity, direction, time preferences, price positivity and areas.
 -- An exception anywhere below rolls back the entire RPC transaction.
 created_route:=public.v31_create_vehicle_route_draft(
  p_title,p_vehicle,p_category,p_direction,p_period,p_outbound,p_return,
  (p_direction='return' or coalesce(p_return_supported,false)),p_price,p_stops
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
$function$
 then
   raise exception 'INVALID_STOP_PASSING_TIME' using errcode='23514';
  end if;
 end loop;
 -- Reuse the already-approved server validation for Captain, approved vehicle,
 -- category/capacity, direction, time preferences, price positivity and areas.
 -- An exception anywhere below rolls back the entire RPC transaction.
 created_route:=public.v31_create_vehicle_route_draft(
  p_title,p_vehicle,p_category,p_direction,p_period,p_outbound,p_return,
  (p_direction='return' or coalesce(p_return_supported,false)),p_price,p_stops
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
$function$

