-- seKKa: coordinates represent published CAPTAIN pickup stops, never rider locations.
-- Nullable for backwards compatibility. GPS-only nearby lists never infer a stop from its area name.
alter table public.v31_route_stops
 add column if not exists latitude numeric(9,6),
 add column if not exists longitude numeric(9,6);
alter table public.v31_route_stops
 add constraint v31_stop_latitude_range_check check (latitude is null or latitude between -90 and 90),
 add constraint v31_stop_longitude_range_check check (longitude is null or longitude between -180 and 180),
 add constraint v31_stop_coordinates_pair_check check ((latitude is null)=(longitude is null));

-- Draft owner only: the captain explicitly sets a real stop coordinate.
-- Never permits a Rider to edit stop locations or an already published route to shift silently.
create or replace function public.v31_set_draft_stop_coordinates(
 p_stop uuid,p_latitude numeric,p_longitude numeric
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare actor uuid := (select auth.uid()); result uuid;
begin
 if actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if p_latitude is null or p_longitude is null or
    p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
   raise exception 'INVALID_STOP_COORDINATES' using errcode='23514';
 end if;
 update public.v31_route_stops s
 set latitude=round(p_latitude,6),longitude=round(p_longitude,6)
 from public.v31_routes r
 where s.id=p_stop and r.id=s.route_id and r.captain_id=actor and r.status='draft'
 returning s.id into result;
 if result is null then raise exception 'STOP_NOT_OWNED_OR_NOT_DRAFT' using errcode='42501'; end if;
 return result;
end
$$;
revoke all on function public.v31_set_draft_stop_coordinates(uuid,numeric,numeric) from public,anon;
grant execute on function public.v31_set_draft_stop_coordinates(uuid,numeric,numeric) to authenticated;
