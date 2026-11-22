-- seKKa v3.1: one live request per identical rider journey; edit only unoffered open requests.
-- Forward-only Staging-first migration. Historical cancelled/accepted requests remain intact.
-- The existing identity deliberately ignores seat count, so a change in seats edits
-- the same live need rather than creating another request.

create or replace function public.v31_guard_duplicate_trip_request()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $guard$
begin
  if new.status <> 'open' then return new; end if;
  if (select auth.uid()) is null or new.rider_id <> (select auth.uid()) then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  -- Serialize both inserts and edits by rider across concurrent devices.
  perform pg_catalog.pg_advisory_xact_lock(7531,pg_catalog.hashtext(new.rider_id::text));
  if exists (
    select 1 from public.v31_trip_requests existing_request
    where existing_request.rider_id = new.rider_id
      and existing_request.id <> new.id
      and existing_request.status = 'open'
      and existing_request.origin_area_id = new.origin_area_id
      and existing_request.destination_area_id = new.destination_area_id
      and existing_request.period = new.period
      and existing_request.direction = new.direction
      and existing_request.outbound_time is not distinct from new.outbound_time
      and existing_request.return_time is not distinct from new.return_time
  ) then
    raise exception 'DUPLICATE_OPEN_TRIP_REQUEST' using errcode = 'P0001';
  end if;
  return new;
end
$guard$;

drop trigger if exists v31_guard_duplicate_trip_request on public.v31_trip_requests;
create trigger v31_guard_duplicate_trip_request
before insert or update of origin_area_id,destination_area_id,outbound_time,return_time,period,direction,seats
on public.v31_trip_requests
for each row execute function public.v31_guard_duplicate_trip_request();

revoke all on function public.v31_guard_duplicate_trip_request() from public,anon,authenticated;

-- Only the verified owner can edit an open request; existing offers are immutable
-- so a captain's priced/scheduled offer cannot silently change under them.
-- No direct UPDATE RLS policy or grant is added; this is the only UI edit entry.
create or replace function public.v31_edit_open_trip_request(
  p_request uuid,
  p_direction text,
  p_outbound_time time without time zone,
  p_return_time time without time zone,
  p_period text,
  p_seats smallint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $edit$
declare
  actor uuid := (select auth.uid());
  current_request public.v31_trip_requests%rowtype;
begin
  if actor is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  -- Use the same rider lock as the insert/update duplicate guard.
  perform pg_catalog.pg_advisory_xact_lock(7531,pg_catalog.hashtext(actor::text));
  select * into current_request
  from public.v31_trip_requests
  where id = p_request and rider_id = actor
  for update;
  if not found then raise exception 'REQUEST_NOT_FOUND_OR_NOT_OWNED' using errcode = '42501'; end if;
  if current_request.status <> 'open' then raise exception 'REQUEST_NOT_EDITABLE' using errcode = 'P0001'; end if;
  if exists (select 1 from public.v31_trip_offers where request_id = p_request) then
    raise exception 'REQUEST_HAS_OFFERS' using errcode = 'P0001';
  end if;
  if p_seats is null or p_seats < 1 or p_seats > 2 then
    raise exception 'RIDER_MAX_TWO_SEATS' using errcode = '23514';
  end if;
  if p_period not in ('weekly','monthly') or p_period is null
     or p_direction not in ('outbound','return','round_trip') or p_direction is null
     or not (
      (p_direction='outbound' and p_outbound_time is not null and p_return_time is null)
      or (p_direction='return' and p_outbound_time is null and p_return_time is not null)
      or (p_direction='round_trip' and p_outbound_time is not null and p_return_time is not null)
     )
  then raise exception 'INVALID_REQUEST_SCHEDULE' using errcode = '23514'; end if;
  update public.v31_trip_requests
    set direction=p_direction,outbound_time=p_outbound_time,
        return_time=p_return_time,period=p_period,seats=p_seats
    where id=p_request and rider_id=actor and status='open';
  if not found then raise exception 'REQUEST_NOT_EDITABLE' using errcode = 'P0001'; end if;
  return p_request;
end
$edit$;

revoke all on function public.v31_edit_open_trip_request(uuid,text,time without time zone,time without time zone,text,smallint)
 from public,anon;
grant execute on function public.v31_edit_open_trip_request(uuid,text,time without time zone,time without time zone,text,smallint)
 to authenticated;
