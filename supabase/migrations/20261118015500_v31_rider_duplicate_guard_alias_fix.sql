-- Fix PL/pgSQL OLD trigger-record collision in Phase 01 duplicate guard.
-- Same behavior and security model; only SQL table alias changes.
CREATE OR REPLACE FUNCTION public.v31_guard_duplicate_trip_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if new.status<>'open' then return new; end if;
 if (select auth.uid()) is null or new.rider_id<>(select auth.uid()) then
  raise exception 'AUTH_REQUIRED' using errcode='28000';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(7531,pg_catalog.hashtext(new.rider_id::text));
 if exists(select 1 from public.v31_trip_requests existing_request
  where existing_request.rider_id=new.rider_id and existing_request.status='open'
   and existing_request.origin_area_id=new.origin_area_id
   and existing_request.destination_area_id=new.destination_area_id
   and existing_request.period=new.period and existing_request.direction=new.direction
   and existing_request.outbound_time is not distinct from new.outbound_time
   and existing_request.return_time is not distinct from new.return_time) then
  raise exception 'DUPLICATE_OPEN_TRIP_REQUEST' using errcode='P0001';
 end if;
 return new;
end
$function$;
revoke all on function public.v31_guard_duplicate_trip_request() from public,anon,authenticated;
