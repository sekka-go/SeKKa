-- seKKa staging: deterministic, immutable seat-index pricing for NEW bookings.
-- Existing booking price_snapshot_egp is never rewritten by this migration.
-- No payment ledger, departure scheduling, production write, or PR merge.
create table if not exists public.v31_booking_seat_claims (
  booking_id uuid not null references public.v31_bookings(id),
  route_id uuid not null references public.v31_routes(id),
  seat_index smallint not null check (seat_index between 1 and 13),
  seat_price_egp integer not null check (seat_price_egp > 0),
  legacy boolean not null default false,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  primary key (booking_id,seat_index)
);
create unique index if not exists v31_active_seat_index
 on public.v31_booking_seat_claims(route_id,seat_index) where released_at is null;
create index if not exists v31_seat_claims_route on public.v31_booking_seat_claims(route_id,booking_id);
alter table public.v31_booking_seat_claims enable row level security;
revoke all on public.v31_booking_seat_claims from public,anon,authenticated;

-- Safely mark slots held by pre-existing bookings. These legacy claims are
-- occupancy markers ONLY; leave historical prices untouched and unverified.
do $$
begin
 if exists (
   select 1 from (
     select r.id,coalesce(sum(b.seats) filter(where b.status in('pending','confirmed')),0) as total_seats,
       r.seat_capacity
     from public.v31_routes r left join public.v31_bookings b on b.route_id=r.id group by r.id
   ) x where x.total_seats>x.seat_capacity
 ) then raise exception 'LEGACY_BOOKINGS_CAPACITY_EXCEEDED'; end if;
end $$;
with existing as (
 select b.route_id,b.id as booking_id,r.price_egp,r.seat_capacity,
  row_number() over(partition by b.route_id order by b.created_at,b.id,gs.n)::smallint as seat_index
 from public.v31_bookings b
 join public.v31_routes r on r.id=b.route_id
 cross join lateral generate_series(1,b.seats) gs(n)
 where b.status in ('pending','confirmed')
)
insert into public.v31_booking_seat_claims(booking_id,route_id,seat_index,seat_price_egp,legacy)
select booking_id,route_id,seat_index,
 (price_egp/seat_capacity + case when seat_index<=(price_egp%seat_capacity) then 1 else 0 end)::integer,
 true
from existing
where price_egp>=seat_capacity
on conflict(booking_id,seat_index) do nothing;

-- Called only inside a route-row-locked reservation. Defensive checks also
-- apply if a privileged caller ever invokes it from another server path.
create or replace function public.v31_allocate_booking_seat_prices(p_booking uuid)
returns integer language plpgsql security definer set search_path=''
as $$
declare
 v_booking public.v31_bookings%rowtype;
 v_route public.v31_routes%rowtype;
 v_seat smallint;
 v_price integer;
 v_total integer:=0;
 v_claims integer:=0;
begin
 select * into v_booking from public.v31_bookings where id=p_booking for update;
 if not found or v_booking.status not in('pending','confirmed') then
   raise exception 'BOOKING_NOT_ACTIVE' using errcode='23514';
 end if;
 if v_booking.rider_id is distinct from (select auth.uid()) then
   raise exception 'BOOKING_NOT_OWNED' using errcode='42501';
 end if;
 select * into v_route from public.v31_routes where id=v_booking.route_id for update;
 if not found or v_route.status<>'published' then
   raise exception 'ROUTE_NOT_AVAILABLE' using errcode='23514';
 end if;
 select count(*)::integer into v_claims from public.v31_booking_seat_claims where booking_id=p_booking;
 if v_claims>0 or v_booking.price_snapshot_egp is not null then
   raise exception 'PRICE_ALREADY_ASSIGNED_OR_LEGACY' using errcode='23514';
 end if;
 if v_route.seat_capacity<1 or v_route.price_egp<v_route.seat_capacity then
   raise exception 'PRICE_TOO_LOW_FOR_ALL_SEATS' using errcode='23514';
 end if;
 for v_seat in
   select candidate.i::smallint from generate_series(1,v_route.seat_capacity) candidate(i)
   where not exists(
     select 1 from public.v31_booking_seat_claims claim
     where claim.route_id=v_route.id and claim.seat_index=candidate.i
       and claim.released_at is null
   ) order by candidate.i limit v_booking.seats
 loop
   v_price:=v_route.price_egp/v_route.seat_capacity+
     case when v_seat<=(v_route.price_egp%v_route.seat_capacity) then 1 else 0 end;
   insert into public.v31_booking_seat_claims(booking_id,route_id,seat_index,seat_price_egp)
   values(p_booking,v_route.id,v_seat,v_price);
   v_claims:=v_claims+1;
   v_total:=v_total+v_price;
 end loop;
 if v_claims<>v_booking.seats then
   raise exception 'INSUFFICIENT_SEATS' using errcode='23514';
 end if;
 update public.v31_bookings set price_snapshot_egp=v_total
  where id=p_booking and price_snapshot_egp is null;
 if not found then raise exception 'PRICE_SNAPSHOT_WRITE_FAILED' using errcode='23514';end if;
 return v_total;
end $$;
revoke all on function public.v31_allocate_booking_seat_prices(uuid) from public,anon,authenticated;

-- The route lock and atomic capacity/idempotency logic are intentionally kept
-- from v31_reserve_seats. NEW bookings now receive a stable snapshot before
-- the RPC returns, never the private vehicle total.
create or replace function public.v31_reserve_seats(p_route uuid,p_seats smallint,p_idempotency uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
 uid uuid:=(select auth.uid());
 route public.v31_routes%rowtype;
 vehicle_capacity smallint;
 route_reserved integer;
 vehicle_reserved integer;
 existing public.v31_bookings%rowtype;
 booking uuid;
begin
 if uid is null then raise exception 'AUTH_REQUIRED';end if;
 if p_seats is null or p_seats<1 or p_seats>2 or p_idempotency is null
 then raise exception 'INVALID_BOOKING';end if;
 select * into existing from public.v31_bookings
 where rider_id=uid and idempotency_key=p_idempotency;
 if found then
   if existing.route_id<>p_route or existing.seats<>p_seats then raise exception 'IDEMPOTENCY_CONFLICT';end if;
   if existing.status='cancelled' then raise exception 'BOOKING_ALREADY_CANCELLED';end if;
   return existing.id;
 end if;
 select * into route from public.v31_routes where id=p_route for update;
 if not found or route.status<>'published' then raise exception 'ROUTE_NOT_AVAILABLE';end if;
 if route.captain_id=uid then raise exception 'CAPTAIN_CANNOT_BOOK_OWN_ROUTE';end if;
 select * into existing from public.v31_bookings
 where rider_id=uid and idempotency_key=p_idempotency;
 if found then
   if existing.route_id<>p_route or existing.seats<>p_seats then raise exception 'IDEMPOTENCY_CONFLICT';end if;
   if existing.status='cancelled' then raise exception 'BOOKING_ALREADY_CANCELLED';end if;
   return existing.id;
 end if;
 if route.vehicle_id is not null then
   select seats into vehicle_capacity from public.v31_vehicles
   where id=route.vehicle_id and status='active' for update;
   if vehicle_capacity is null then raise exception 'VEHICLE_NOT_ACTIVE';end if;
   select coalesce(sum(b.seats),0) into vehicle_reserved
   from public.v31_bookings b join public.v31_routes r on r.id=b.route_id
   where r.vehicle_id=route.vehicle_id and b.status in ('pending','confirmed');
   if vehicle_reserved+p_seats>vehicle_capacity then
     raise exception 'VEHICLE_SEAT_CAPACITY_EXCEEDED';end if;
 end if;
 select coalesce(sum(seats),0) into route_reserved from public.v31_bookings
 where route_id=p_route and status in ('pending','confirmed');
 if route_reserved+p_seats>route.seat_capacity then raise exception 'INSUFFICIENT_SEATS';end if;
 insert into public.v31_bookings(route_id,rider_id,seats,idempotency_key,status)
 values(p_route,uid,p_seats,p_idempotency,'pending')
 on conflict(rider_id,idempotency_key) do nothing returning id into booking;
 if booking is not null then
   perform public.v31_allocate_booking_seat_prices(booking);
   return booking;
 end if;
 select * into existing from public.v31_bookings
 where rider_id=uid and idempotency_key=p_idempotency for update;
 if not found then raise exception 'IDEMPOTENCY_RETRY_NOT_FOUND';end if;
 if existing.route_id<>p_route or existing.seats<>p_seats then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 if existing.status='cancelled' then raise exception 'BOOKING_ALREADY_CANCELLED';end if;
 return existing.id;
end $$;
revoke all on function public.v31_reserve_seats(uuid,smallint,uuid) from public,anon;
grant execute on function public.v31_reserve_seats(uuid,smallint,uuid) to authenticated;

-- Keep stop/direction/round-trip validation and immutable snapshot.
create or replace function public.v31_reserve_seats_with_stops(
 p_route uuid,p_seats smallint,p_idempotency uuid,p_pickup uuid,p_dropoff uuid,
 p_reverse boolean default false
) returns uuid language plpgsql security definer set search_path=''
as $$
declare
 v_uid uuid:=(select auth.uid());
 v_from public.v31_route_stops%rowtype;
 v_to public.v31_route_stops%rowtype;
 v_route public.v31_routes%rowtype;
 v_booking uuid;
 v_existing public.v31_bookings%rowtype;
 v_direction text;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED';end if;
 select * into v_route from public.v31_routes where id=p_route;
 if not found or v_route.status<>'published' then raise exception 'ROUTE_NOT_AVAILABLE';end if;
 select * into v_from from public.v31_route_stops where id=p_pickup and route_id=p_route;
 select * into v_to from public.v31_route_stops where id=p_dropoff and route_id=p_route;
 if v_from.id is null or v_to.id is null then raise exception 'INVALID_BOOKING_STOPS';end if;
 if p_reverse then
   if v_route.direction='outbound' or not v_route.return_supported or
      v_from.position<=v_to.position or not v_from.dropoff_allowed or
      not v_to.pickup_allowed then raise exception 'INVALID_REVERSE_STOPS';end if;
   v_direction:='return';
 else
   if v_route.direction='return' or v_from.position>=v_to.position or
      not v_from.pickup_allowed or not v_to.dropoff_allowed then raise exception 'INVALID_OUTBOUND_STOPS';end if;
   if v_route.direction='round_trip' then
     if not v_route.return_supported or v_route.return_time is null
        or not v_from.dropoff_allowed or not v_to.pickup_allowed then
        raise exception 'ROUND_TRIP_RETURN_STOPS_UNSUPPORTED';
     end if;
     v_direction:='round_trip';
   else v_direction:='outbound';end if;
 end if;
 v_booking:=public.v31_reserve_seats(p_route,p_seats,p_idempotency);
 select * into v_existing from public.v31_bookings where id=v_booking for update;
 if v_existing.pickup_stop_id is not null and
  (v_existing.pickup_stop_id<>p_pickup or v_existing.dropoff_stop_id<>p_dropoff or
   v_existing.booked_direction<>v_direction) then
   raise exception 'IDEMPOTENCY_STOPS_CONFLICT';
 end if;
 -- No price overwrite here. The base reserve RPC allocates deterministic seat
 -- slots + exact snapshot for new bookings. Historical snapshots stay untouched.
 update public.v31_bookings
 set pickup_stop_id=p_pickup,dropoff_stop_id=p_dropoff,booked_direction=v_direction,
     period_snapshot=coalesce(v_existing.period_snapshot,v_route.period)
 where id=v_booking;
 return v_booking;
end $$;
revoke all on function public.v31_reserve_seats_with_stops(
 uuid,smallint,uuid,uuid,uuid,boolean
) from public,anon;
grant execute on function public.v31_reserve_seats_with_stops(
 uuid,smallint,uuid,uuid,uuid,boolean
) to authenticated;

-- Release only the *seat index*, never mutate a historical booked price.
create or replace function public.v31_release_booking_claims()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if old.status in('pending','confirmed') and new.status not in('pending','confirmed') then
   update public.v31_booking_seat_claims set released_at=now()
   where booking_id=new.id and released_at is null;
 end if;
 return new;
end $$;
revoke all on function public.v31_release_booking_claims() from public,anon,authenticated;
drop trigger if exists v31_release_booking_claims on public.v31_bookings;
create trigger v31_release_booking_claims
 after update of status on public.v31_bookings
 for each row when(old.status is distinct from new.status)
 execute function public.v31_release_booking_claims();

-- New booking snapshots are exact; legacy snapshots remain masked. For old
-- rows show only the prior seat estimate (never the raw whole-vehicle price).
create or replace function public.v31_rider_booking_estimate(p_booking uuid)
returns integer language sql stable security definer set search_path=''
as $$
 select case when
    (select count(*) from public.v31_booking_seat_claims c
      where c.booking_id=b.id and c.legacy=false)=b.seats
   then b.price_snapshot_egp
   else (ceil(r.price_egp::numeric/greatest(r.seat_capacity::numeric,1))*b.seats)::integer
 end
 from public.v31_bookings b join public.v31_routes r on r.id=b.route_id
 where b.id=p_booking and b.rider_id=(select auth.uid())
   and (select auth.uid()) is not null
$$;
revoke all on function public.v31_rider_booking_estimate(uuid) from public,anon;
grant execute on function public.v31_rider_booking_estimate(uuid) to authenticated;
