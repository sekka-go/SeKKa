-- Captain-only authoritative occupancy; no arbitrary 500-booking row cap.
-- Purely read-only. No new operational-trip or departure-date semantics.
create or replace function public.v31_captain_route_capacity_summary(p_route uuid default null)
returns table(route_id uuid, capacity integer, booked integer, remaining integer, is_full boolean)
language sql stable security definer set search_path=''
as $$
 select r.id,
  r.seat_capacity::integer,
  coalesce(b.used,0)::integer,
  greatest(0,r.seat_capacity::integer-coalesce(b.used,0))::integer,
  (r.status in ('published','paused') and
   r.seat_capacity>0 and coalesce(b.used,0)>=r.seat_capacity)::boolean
 from public.v31_routes r
 left join lateral (
  select coalesce(sum(x.seats),0)::integer as used
  from public.v31_bookings x
  where x.route_id=r.id and x.status in ('pending','confirmed')
 ) b on true
 where (select auth.uid()) is not null
   and r.captain_id=(select auth.uid())
   and (p_route is null or r.id=p_route)
 order by r.created_at desc
 limit 500
$$;
revoke all on function public.v31_captain_route_capacity_summary(uuid) from public,anon;
grant execute on function public.v31_captain_route_capacity_summary(uuid) to authenticated;
