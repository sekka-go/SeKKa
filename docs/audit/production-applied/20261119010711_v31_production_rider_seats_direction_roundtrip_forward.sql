-- Reviewed Staging-tested rider migration 20261117231135_v31_limit_two_people_per_rider.sql
-- seKKa v3.1 — maximum of two people per rider, per route.
-- Staging-only rollout until explicit Production approval.
-- Existing trip requests above two seats are preserved: this INSERT / seats-update
-- guard does not rewrite old requests and does not block cancellation.
-- Every NEW booking (including accepted offers) is restricted to <= 2 seats.
-- Across active bookings on the same route an account may hold at most 2 seats.
create or replace function public.v31_guard_two_rider_seats()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare already_reserved integer;
begin
  if new.seats is null or new.seats < 1 or new.seats > 2 then
    raise exception 'RIDER_MAX_TWO_SEATS' using errcode='23514';
  end if;
  if new.status in ('pending','confirmed') then
    -- Route row serializes concurrent reservations and offer acceptances;
    -- both normal RPC paths already lock this row before insertion.
    perform 1 from public.v31_routes where id=new.route_id for update;
    select coalesce(sum(b.seats),0) into already_reserved
      from public.v31_bookings b
      where b.route_id=new.route_id
        and b.rider_id=new.rider_id
        and b.status in ('pending','confirmed')
        and b.id is distinct from new.id;
    if already_reserved+new.seats>2 then
      raise exception 'RIDER_MAX_TWO_SEATS_PER_ROUTE' using errcode='23514';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists v31_guard_two_rider_seats on public.v31_bookings;
create trigger v31_guard_two_rider_seats
before insert or update of seats,route_id,rider_id,status
on public.v31_bookings
for each row execute function public.v31_guard_two_rider_seats();

create or replace function public.v31_guard_two_request_seats()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.seats is null or new.seats < 1 or new.seats > 2 then
    raise exception 'RIDER_MAX_TWO_SEATS' using errcode='23514';
  end if;
  return new;
end $$;

drop trigger if exists v31_guard_two_request_seats on public.v31_trip_requests;
create trigger v31_guard_two_request_seats
before insert or update of seats
on public.v31_trip_requests
for each row execute function public.v31_guard_two_request_seats();

revoke all on function public.v31_guard_two_rider_seats() from public,anon,authenticated;
revoke all on function public.v31_guard_two_request_seats() from public,anon,authenticated;


-- Reviewed Staging-tested rider migration 20261118015000_v31_rider_request_direction_and_duplicate_guard.sql
-- Staging-first Phase 01: preserve rider direction/return time and prevent duplicate open requests.
-- Existing rows remain unchanged; old records default to outbound only.
alter table public.v31_trip_requests add column if not exists direction text not null default 'outbound';
alter table public.v31_trip_requests add column if not exists return_time time without time zone;
alter table public.v31_trip_requests alter column outbound_time drop not null;
alter table public.v31_trip_requests add constraint v31_request_direction_check
 check((direction='outbound' and outbound_time is not null and return_time is null)
  or (direction='return' and outbound_time is null and return_time is not null)
  or (direction='round_trip' and outbound_time is not null and return_time is not null));
create index if not exists v31_trip_requests_open_identity_idx
 on public.v31_trip_requests(rider_id,status,origin_area_id,destination_area_id,period,direction,outbound_time,return_time);

-- Transaction-scope advisory lock serializes concurrent creates from one account,
-- while preserving historical duplicates rather than imposing a retroactive unique index.
create or replace function public.v31_guard_duplicate_trip_request()
 returns trigger language plpgsql security invoker set search_path=''
as $guard$
begin
 if new.status<>'open' then return new; end if;
 if (select auth.uid()) is null or new.rider_id<>(select auth.uid()) then
  raise exception 'AUTH_REQUIRED' using errcode='28000';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(7531,pg_catalog.hashtext(new.rider_id::text));
 if exists(select 1 from public.v31_trip_requests old
  where old.rider_id=new.rider_id and old.status='open'
   and old.origin_area_id=new.origin_area_id
   and old.destination_area_id=new.destination_area_id
   and old.period=new.period and old.direction=new.direction
   and old.outbound_time is not distinct from new.outbound_time
   and old.return_time is not distinct from new.return_time) then
  raise exception 'DUPLICATE_OPEN_TRIP_REQUEST' using errcode='P0001';
 end if;
 return new;
end
$guard$;
drop trigger if exists v31_guard_duplicate_trip_request on public.v31_trip_requests;
create trigger v31_guard_duplicate_trip_request
 before insert on public.v31_trip_requests for each row execute function public.v31_guard_duplicate_trip_request();
revoke all on function public.v31_guard_duplicate_trip_request() from public,anon,authenticated;

-- Offer acceptance must validate published Captain route against both schedules
-- and the requested direction; original auth, lock, capacity and idempotency stay intact.
CREATE OR REPLACE FUNCTION public.v31_accept_trip_offer(p_offer uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE uid uuid:=(SELECT auth.uid()); offer public.v31_trip_offers%rowtype;
        request public.v31_trip_requests%rowtype; route public.v31_routes%rowtype;
        physical_capacity smallint; reserved integer; booking uuid;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 SELECT * INTO offer FROM public.v31_trip_offers WHERE id=p_offer;
 IF NOT FOUND THEN RAISE EXCEPTION 'OFFER_NOT_FOUND'; END IF;
 SELECT * INTO request FROM public.v31_trip_requests WHERE id=offer.request_id FOR UPDATE;
 IF NOT FOUND OR request.rider_id<>uid THEN RAISE EXCEPTION 'NOT_REQUEST_OWNER'; END IF;
 IF request.status='accepted' AND request.accepted_offer_id=p_offer THEN
   SELECT id INTO booking FROM public.v31_bookings WHERE rider_id=uid AND idempotency_key=request.id;
   IF booking IS NOT NULL THEN RETURN booking; END IF;
 END IF;
 IF request.status<>'open' OR offer.status<>'offered' THEN RAISE EXCEPTION 'REQUEST_NOT_AVAILABLE'; END IF;
 SELECT * INTO route FROM public.v31_routes WHERE id=offer.route_id FOR UPDATE;
 IF NOT FOUND OR route.status<>'published' OR route.captain_id<>offer.captain_id
 THEN RAISE EXCEPTION 'ROUTE_NOT_AVAILABLE'; END IF;
 IF route.captain_id=uid THEN RAISE EXCEPTION 'CAPTAIN_CANNOT_BOOK_OWN_ROUTE'; END IF;
 IF route.period<>request.period THEN RAISE EXCEPTION 'ROUTE_SCHEDULE_MISMATCH'; END IF;
 IF request.direction='outbound' THEN
  IF route.direction='return' OR route.outbound_time IS DISTINCT FROM request.outbound_time THEN RAISE EXCEPTION 'ROUTE_SCHEDULE_MISMATCH'; END IF;
 ELSIF request.direction='return' THEN
  IF route.direction='outbound' OR NOT route.return_supported OR route.return_time IS DISTINCT FROM request.return_time THEN RAISE EXCEPTION 'ROUTE_SCHEDULE_MISMATCH'; END IF;
 ELSIF request.direction='round_trip' THEN
  IF route.direction<>'round_trip' OR NOT route.return_supported
   OR route.outbound_time IS DISTINCT FROM request.outbound_time
   OR route.return_time IS DISTINCT FROM request.return_time THEN RAISE EXCEPTION 'ROUTE_SCHEDULE_MISMATCH'; END IF;
 ELSE RAISE EXCEPTION 'INVALID_REQUEST_DIRECTION'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.v31_captain_profiles cp
   WHERE cp.user_id=route.captain_id AND cp.approval_status='approved')
 THEN RAISE EXCEPTION 'CAPTAIN_NOT_APPROVED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.v31_route_stops o JOIN public.v31_route_stops d
   ON o.route_id=d.route_id
   WHERE o.route_id=route.id AND o.area_id=request.origin_area_id
    AND d.area_id=request.destination_area_id
    AND ((request.direction='return' AND o.position>d.position AND o.dropoff_allowed AND d.pickup_allowed)
      OR (request.direction<>'return' AND o.position<d.position AND o.pickup_allowed AND d.dropoff_allowed)))
 THEN RAISE EXCEPTION 'ROUTE_NOT_MATCHING_REQUEST'; END IF;
 IF route.vehicle_id IS NOT NULL THEN
   SELECT seats INTO physical_capacity FROM public.v31_vehicles
   WHERE id=route.vehicle_id AND status='active' FOR UPDATE;
   IF physical_capacity IS NULL THEN RAISE EXCEPTION 'VEHICLE_NOT_ACTIVE'; END IF;
   SELECT coalesce(sum(b.seats),0) INTO reserved
   FROM public.v31_bookings b JOIN public.v31_routes r ON r.id=b.route_id
   WHERE r.vehicle_id=route.vehicle_id AND b.status IN ('pending','confirmed');
   IF reserved+request.seats>physical_capacity
   THEN RAISE EXCEPTION 'VEHICLE_SEAT_CAPACITY_EXCEEDED'; END IF;
 END IF;
 SELECT coalesce(sum(b.seats),0) INTO reserved FROM public.v31_bookings b
 WHERE b.route_id=route.id AND b.status IN ('pending','confirmed');
 IF reserved+request.seats>route.seat_capacity THEN RAISE EXCEPTION 'INSUFFICIENT_SEATS'; END IF;
 INSERT INTO public.v31_bookings(route_id,rider_id,seats,idempotency_key,status)
 VALUES(route.id,uid,request.seats,request.id,'pending') RETURNING id INTO booking;
 UPDATE public.v31_trip_offers SET status='accepted' WHERE id=p_offer;
 UPDATE public.v31_trip_offers SET status='rejected'
 WHERE request_id=request.id AND id<>p_offer AND status='offered';
 UPDATE public.v31_trip_requests SET status='accepted',accepted_offer_id=p_offer
 WHERE id=request.id;
 RETURN booking;
END
$function$;
revoke all on function public.v31_accept_trip_offer(uuid) from public,anon;
grant execute on function public.v31_accept_trip_offer(uuid) to authenticated;


-- Reviewed Staging-tested rider migration 20261118015500_v31_rider_duplicate_guard_alias_fix.sql
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


-- Reviewed Staging-tested rider migration 20261118115000_v31_roundtrip_booking_preserves_both_legs.sql
-- Preserve published round-trip terms in actual saved reservations.
-- Staging-first. No historical rows are changed; book one capacity allocation
-- for a two-leg subscription, not two separate seat allocations.
alter table public.v31_bookings drop constraint if exists v31_bookings_booked_direction_check;
alter table public.v31_bookings add constraint v31_bookings_booked_direction_check
 check (booked_direction in ('outbound','return','round_trip'));

CREATE OR REPLACE FUNCTION public.v31_reserve_seats_with_stops(p_route uuid, p_seats smallint, p_idempotency uuid, p_pickup uuid, p_dropoff uuid, p_reverse boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=(select auth.uid());v_from public.v31_route_stops%rowtype;v_to public.v31_route_stops%rowtype;v_route public.v31_routes%rowtype;v_booking uuid;v_existing public.v31_bookings%rowtype;v_direction text;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED';end if;
 select * into v_route from public.v31_routes where id=p_route;
 if not found or v_route.status<>'published' then raise exception 'ROUTE_NOT_AVAILABLE';end if;
 select * into v_from from public.v31_route_stops where id=p_pickup and route_id=p_route;
 select * into v_to from public.v31_route_stops where id=p_dropoff and route_id=p_route;
 if v_from.id is null or v_to.id is null then raise exception 'INVALID_BOOKING_STOPS';end if;
 if p_reverse then
  if v_route.direction='outbound' or not v_route.return_supported or v_from.position<=v_to.position or not v_from.dropoff_allowed or not v_to.pickup_allowed then raise exception 'INVALID_REVERSE_STOPS';end if;
  v_direction:='return';
 else
  if v_route.direction='return' or v_from.position>=v_to.position or not v_from.pickup_allowed or not v_to.dropoff_allowed then raise exception 'INVALID_OUTBOUND_STOPS';end if;
  if v_route.direction='round_trip' then
   if not v_route.return_supported or v_route.return_time is null
    or not v_from.dropoff_allowed or not v_to.pickup_allowed then
    raise exception 'ROUND_TRIP_RETURN_STOPS_UNSUPPORTED';
   end if;
   v_direction:='round_trip';
  else
   v_direction:='outbound';
  end if;
 end if;
 v_booking:=public.v31_reserve_seats(p_route,p_seats,p_idempotency);
 select * into v_existing from public.v31_bookings where id=v_booking for update;
 if v_existing.pickup_stop_id is not null and
  (v_existing.pickup_stop_id<>p_pickup or v_existing.dropoff_stop_id<>p_dropoff or v_existing.booked_direction<>v_direction)
  then raise exception 'IDEMPOTENCY_STOPS_CONFLICT';end if;
 update public.v31_bookings set pickup_stop_id=p_pickup,dropoff_stop_id=p_dropoff,booked_direction=v_direction,
 price_snapshot_egp=coalesce(v_existing.price_snapshot_egp,v_route.price_egp),
 period_snapshot=coalesce(v_existing.period_snapshot,v_route.period)
 where id=v_booking;
 return v_booking;
end $function$;

-- Original SECURITY DEFINER ownership, authorization and route locking stay
-- unchanged, with a server-side return-leg stop validation added above.
revoke all on function public.v31_reserve_seats_with_stops(uuid,smallint,uuid,uuid,uuid,boolean) from public,anon;
grant execute on function public.v31_reserve_seats_with_stops(uuid,smallint,uuid,uuid,uuid,boolean) to authenticated;
