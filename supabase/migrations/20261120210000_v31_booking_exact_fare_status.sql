-- seKKa Staging: distinguish an exact immutable NEW booking fare from a
-- historical seat-price estimate. No historical booking amounts are rewritten.
-- This read-only RPC verifies booking ownership before returning any data.
create or replace function public.v31_rider_booking_fare_status(p_booking uuid)
returns table(amount_egp integer,is_exact boolean)
language sql stable security definer set search_path=''
as $$
 select
   case when count(c.seat_index) filter (where c.legacy=false)=b.seats
               and b.price_snapshot_egp is not null
        then b.price_snapshot_egp
        else (ceil(r.price_egp::numeric/greatest(r.seat_capacity::numeric,1))*b.seats)::integer
   end as amount_egp,
   (count(c.seat_index) filter (where c.legacy=false)=b.seats
      and b.price_snapshot_egp is not null) as is_exact
 from public.v31_bookings b
 join public.v31_routes r on r.id=b.route_id
 left join public.v31_booking_seat_claims c on c.booking_id=b.id
 where b.id=p_booking and b.rider_id=(select auth.uid())
   and (select auth.uid()) is not null
 group by b.id,b.seats,b.price_snapshot_egp,r.price_egp,r.seat_capacity
$$;
revoke all on function public.v31_rider_booking_fare_status(uuid)
 from public,anon;
grant execute on function public.v31_rider_booking_fare_status(uuid)
 to authenticated;

-- Booking lifecycle mutations happen exclusively through server-side RPCs,
-- which enforce identity, idempotency and row locks. No direct browser DML
-- is required; prevent accidental future policy additions from exposing it.
revoke insert,update,delete on public.v31_bookings from anon,authenticated;
