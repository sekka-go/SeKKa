-- Staging security hardening: no SECURITY DEFINER public offers VIEW.
-- A generated per-seat projection avoids granting the private vehicle total.
alter table public.v31_routes
 add column if not exists seat_price_egp integer
 generated always as (
   ceil(price_egp::numeric / greatest(seat_capacity::numeric,1))::integer
 ) stored;

-- Only this generated public column is readable; private price_egp remains
-- excluded from the existing anon/authenticated column grants.
grant select(seat_price_egp) on public.v31_routes to anon,authenticated;

create or replace view public.v31_public_route_offers
with (security_invoker=true,security_barrier=true)
as
select r.id,r.title,r.category,r.seat_capacity,r.direction,r.period,
       r.outbound_time,r.return_time,r.return_supported,r.status,
       r.seat_price_egp
from public.v31_routes r
where r.status='published';

revoke all on public.v31_public_route_offers from public,anon,authenticated;
grant select on public.v31_public_route_offers to anon,authenticated;
