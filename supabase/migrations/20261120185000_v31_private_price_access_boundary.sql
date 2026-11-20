-- seKKa Staging P0: do not expose private whole-vehicle prices to Riders.
-- The published offer API exposes a seat-level figure; private totals may
-- only be read through an ownership-checked function.
-- This migration intentionally does not rewrite any historical booking rows.
create or replace view public.v31_public_route_offers
with (security_barrier=true)
as
select r.id,r.title,r.category,r.seat_capacity,r.direction,r.period,
       r.outbound_time,r.return_time,r.return_supported,r.status,
       ceil(r.price_egp::numeric/greatest(r.seat_capacity::numeric,1))::integer as seat_price_egp
from public.v31_routes r
where r.status='published';
revoke all on public.v31_public_route_offers from public,anon,authenticated;
grant select on public.v31_public_route_offers to anon,authenticated;

create or replace function public.v31_captain_private_prices(p_route uuid default null)
returns table(route_id uuid,price_egp integer)
language sql stable security definer set search_path=''
as $$
 select r.id,r.price_egp from public.v31_routes r
 where (select auth.uid()) is not null
   and r.captain_id=(select auth.uid())
   and (p_route is null or r.id=p_route)
 order by r.created_at desc
 limit 500
$$;
revoke all on function public.v31_captain_private_prices(uuid) from public,anon;
grant execute on function public.v31_captain_private_prices(uuid) to authenticated;

-- Safety adapter for old booking snapshots: some legacy rows incorrectly
-- stored the WHOLE vehicle total. Do not expose those rows' raw snapshot.
-- This estimate is NOT a paid/settled amount and does not mutate old records.
create or replace function public.v31_rider_booking_estimate(p_booking uuid)
returns integer
language sql stable security definer set search_path=''
as $$
 select (ceil(r.price_egp::numeric/greatest(r.seat_capacity::numeric,1))*b.seats)::integer
 from public.v31_bookings b join public.v31_routes r on r.id=b.route_id
 where b.id=p_booking and b.rider_id=(select auth.uid())
   and (select auth.uid()) is not null
$$;
revoke all on function public.v31_rider_booking_estimate(uuid) from public,anon;
grant execute on function public.v31_rider_booking_estimate(uuid) to authenticated;

-- Row-level security alone cannot hide a column. Exclude the private total
-- from both anon and authenticated direct table reads, including a Rider
-- querying a Captain's published route by ID. Explicit column read grants
-- retain the existing RLS filters and Captain route-management operations.
revoke select on public.v31_routes from public,anon,authenticated;
grant select (
 id,captain_id,title,category,seat_capacity,direction,period,outbound_time,
 return_time,return_supported,status,created_at,vehicle_id
) on public.v31_routes to anon,authenticated;

-- Existing booking snapshots containing private totals are also blocked
-- from direct client reads. Booking price is retrieved only through a
-- rider-owned, seat-level estimate until exact seat-index allocation ships.
revoke select on public.v31_bookings from public,anon,authenticated;
grant select (
 id,route_id,rider_id,seats,status,idempotency_key,created_at,cancelled_at,
 pickup_stop_id,dropoff_stop_id,booked_direction,period_snapshot
) on public.v31_bookings to authenticated;
