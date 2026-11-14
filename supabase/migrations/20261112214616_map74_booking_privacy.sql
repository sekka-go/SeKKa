begin;
-- Preserve the prior implementation privately; no data is rewritten or removed.
alter function sekka_v2.api(text,jsonb) rename to api_before_map74;
revoke all on function sekka_v2.api_before_map74(text,jsonb) from public,anon,authenticated;
create function sekka_v2.api(operation text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb; target uuid; c sekka_v2.conversations; booking_record sekka_v2.bookings;
begin
 if operation='booking.contact' then
  if actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into booking_record from sekka_v2.bookings where id=(payload->>'bookingId')::uuid and rider_id=actor and status in ('reserved','confirmed','disputed','completed');
  if not found then raise exception 'CONFIRMED_BOOKING_REQUIRED' using errcode='42501'; end if;
  select jsonb_build_object('captain_id',r.captain_id,'captain_name',p.full_name,'vehicle_model',v.model,'plate',v.plate) into result from sekka_v2.routes r join sekka_v2.profiles p on p.id=r.captain_id join sekka_v2.vehicles v on v.id=r.vehicle_id where r.id=booking_record.route_id;
  return result;
 end if;
 if operation='conversation.open' then
  if actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not exists(select 1 from sekka_v2.bookings b join sekka_v2.routes r on r.id=b.route_id where b.rider_id=actor and r.captain_id=(payload->>'captainId')::uuid and b.status in ('reserved','confirmed','disputed','completed')) then raise exception 'CONFIRMED_BOOKING_REQUIRED' using errcode='42501'; end if;
 end if;
 if operation in ('messages','message.send') then
  if actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into c from sekka_v2.conversations where id=(payload->>'conversationId')::uuid and actor in (rider_id,captain_id);
  if not found then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if not exists(select 1 from sekka_v2.bookings b join sekka_v2.routes r on r.id=b.route_id where b.rider_id=c.rider_id and r.captain_id=c.captain_id and b.status in ('reserved','confirmed','disputed','completed')) then raise exception 'CONFIRMED_BOOKING_REQUIRED' using errcode='42501'; end if;
 end if;
 result:=sekka_v2.api_before_map74(operation,payload);
 if operation in ('search','favorites') then
  select coalesce(jsonb_agg(x-array['captain_name','captain_id','vehicle_id','vehicle_model','model','plate']),'[]'::jsonb) into result from jsonb_array_elements(result) x;
 elsif operation='route' then
  result:=result-array['captain_name','captain_id','vehicle_id','vehicle_model','model','plate'];
 elsif operation='conversations' then
  select coalesce(jsonb_agg(x),'[]'::jsonb) into result from jsonb_array_elements(result) x where exists(select 1 from sekka_v2.bookings b join sekka_v2.routes r on r.id=b.route_id where b.rider_id=(x->>'rider_id')::uuid and r.captain_id=(x->>'captain_id')::uuid and b.status in ('reserved','confirmed','disputed','completed'));
 end if;
 return result;
end $$;
revoke all on function sekka_v2.api(text,jsonb) from public;
grant execute on function sekka_v2.api(text,jsonb) to anon,authenticated;
-- Rebind the public entry point to the protected function after the rename.
create or replace function public.sekka_v2_api(operation text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select sekka_v2.api(operation,payload) $$;
commit;
