-- Owner-only removal of unwanted Captain routes.
-- Never remove a route referenced by a booking, offer or seat claim.
-- Published/paused routes are archived (historical data retained), not deleted.
create table if not exists public.v31_captain_route_removal_audit (
 id bigint generated always as identity primary key,
 route_id uuid not null,
 captain_id uuid not null,
 action text not null check(action in ('delete_draft','archive_route')),
 previous_status text not null,
 route_title text not null,
 occurred_at timestamptz not null default now()
);
alter table public.v31_captain_route_removal_audit enable row level security;
revoke all on table public.v31_captain_route_removal_audit from public, anon, authenticated;
revoke all on sequence public.v31_captain_route_removal_audit_id_seq from public, anon, authenticated;

create or replace function public.v31_remove_captain_route(p_route uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
 actor uuid := (select auth.uid());
 current_route public.v31_routes%rowtype;
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_route is null then raise exception 'INVALID_ROUTE'; end if;
 select * into current_route
 from public.v31_routes
 where id=p_route for update;
 if not found or current_route.captain_id is distinct from actor
 then raise exception 'ROUTE_NOT_OWNED'; end if;

 if current_route.status='draft' then
  -- Even canceled/history bookings must stay auditable: no hard deletion.
  if exists(select 1 from public.v31_bookings where route_id=p_route)
     or exists(select 1 from public.v31_booking_seat_claims where route_id=p_route)
     or exists(select 1 from public.v31_trip_offers where route_id=p_route)
  then raise exception 'ROUTE_HAS_HISTORY'; end if;
  insert into public.v31_captain_route_removal_audit
    (route_id,captain_id,action,previous_status,route_title)
  values(p_route,actor,'delete_draft',current_route.status,current_route.title);
  delete from public.v31_routes where id=p_route and captain_id=actor and status='draft';
  if not found then raise exception 'INVALID_TRANSITION'; end if;
  return 'deleted';
 elsif current_route.status in ('published','paused') then
  -- v31_set_route_status is the existing authorized, booking-aware transition.
  perform public.v31_set_route_status(p_route,'archived');
  insert into public.v31_captain_route_removal_audit
    (route_id,captain_id,action,previous_status,route_title)
  values(p_route,actor,'archive_route',current_route.status,current_route.title);
  return 'archived';
 elsif current_route.status='archived' then
  return 'archived';
 else
  raise exception 'INVALID_TRANSITION';
 end if;
end
$function$;

revoke all on function public.v31_remove_captain_route(uuid) from public, anon;
grant execute on function public.v31_remove_captain_route(uuid) to authenticated;
