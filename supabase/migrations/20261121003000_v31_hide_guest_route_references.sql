-- Published stops are public; their Captain and vehicle identifiers are not.
alter policy "route stops read" on public.v31_route_stops to authenticated;

create policy "published route stops guest read"
on public.v31_route_stops for select to anon
using (
  exists (
    select 1 from public.v31_routes as route
    where route.id = v31_route_stops.route_id and route.status = 'published'
  )
);

revoke select (captain_id, vehicle_id) on public.v31_routes from anon;
