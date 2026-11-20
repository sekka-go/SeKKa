-- Make Captain draft creation safe to retry after an uncertain response.
alter table public.v31_routes
  add column draft_attempt_id uuid,
  add column draft_attempt_digest bytea,
  add constraint v31_routes_draft_attempt_pair check (
    (draft_attempt_id is null) = (draft_attempt_digest is null)
  ),
  add constraint v31_routes_captain_draft_attempt_unique unique (captain_id, draft_attempt_id);

revoke select (draft_attempt_id, draft_attempt_digest),
       insert (draft_attempt_id, draft_attempt_digest),
       update (draft_attempt_id, draft_attempt_digest)
  on public.v31_routes from public, anon, authenticated;

-- Retain the existing arity for already deployed clients.
create function public.v31_create_geolocated_route_draft(
  p_title text, p_vehicle uuid, p_category text, p_direction text, p_period text,
  p_outbound time without time zone, p_return time without time zone,
  p_return_supported boolean, p_price integer, p_stops jsonb, p_attempt uuid
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := (select auth.uid());
  request_digest bytea;
  saved_digest bytea;
  route_id uuid;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;
  if not exists (
    select 1 from public.v31_captain_profiles
    where user_id=actor and approval_status='approved'
  ) then
    raise exception 'CAPTAIN_NOT_APPROVED' using errcode='42501';
  end if;
  if p_attempt is null then
    raise exception 'DRAFT_ATTEMPT_REQUIRED' using errcode='22023';
  end if;
  if jsonb_typeof(p_stops) is distinct from 'array' then
    raise exception 'INVALID_STOPS_COUNT' using errcode='23514';
  end if;
  if jsonb_array_length(p_stops) not between 2 and 30 then
    raise exception 'INVALID_STOPS_COUNT' using errcode='23514';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_stops) as stop(value)
    where jsonb_typeof(stop.value->'latitude') is distinct from 'number'
       or jsonb_typeof(stop.value->'longitude') is distinct from 'number'
  ) then
    raise exception 'STOP_COORDINATES_REQUIRED' using errcode='23514';
  end if;

  request_digest := sha256(convert_to(jsonb_build_array(
    p_title, p_vehicle, p_category, p_direction, p_period, p_outbound, p_return,
    p_return_supported, p_price, p_stops
  )::text, 'UTF8'));

  -- Serialize retries for the same Captain and attempt before creating a draft.
  perform pg_advisory_xact_lock(hashtextextended(
    'v31_draft:' || actor::text || ':' || p_attempt::text, 0
  ));
  select id, draft_attempt_digest into route_id, saved_digest
  from public.v31_routes
  where captain_id=actor and draft_attempt_id=p_attempt;

  if found then
    if saved_digest is distinct from request_digest then
      raise exception 'DRAFT_ATTEMPT_MISMATCH' using errcode='22023';
    end if;
    return route_id;
  end if;

  route_id := public.v31_create_geolocated_route_draft(
    p_title, p_vehicle, p_category, p_direction, p_period,
    p_outbound, p_return, p_return_supported, p_price, p_stops
  );
  update public.v31_routes
    set draft_attempt_id=p_attempt, draft_attempt_digest=request_digest
    where id=route_id and captain_id=actor;
  return route_id;
end;
$$;

revoke all on function public.v31_create_geolocated_route_draft(
  text, uuid, text, text, text, time, time, boolean, integer, jsonb, uuid
) from public, anon;
grant execute on function public.v31_create_geolocated_route_draft(
  text, uuid, text, text, text, time, time, boolean, integer, jsonb, uuid
) to authenticated;
