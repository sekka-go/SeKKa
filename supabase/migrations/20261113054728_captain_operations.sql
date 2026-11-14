begin;
alter function sekka_v2.api(text,jsonb) rename to api_before_operations;
revoke all on function sekka_v2.api_before_operations(text,jsonb) from public,anon,authenticated;
create function sekka_v2.api(operation text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target uuid; rider uuid; today date:=(statement_timestamp() at time zone 'Africa/Cairo')::date; eligible boolean; cfg sekka_v2.settings; result jsonb;
begin
 if operation in ('captain.operations','captain.conversation.open') then
  if actor is null or not exists(select 1 from sekka_v2.profiles p where p.id=actor and p.role='captain') then raise exception 'CAPTAIN_REQUIRED' using errcode='42501'; end if;
  if operation='captain.conversation.open' then
   select b.rider_id into rider from sekka_v2.bookings b join sekka_v2.routes r on r.id=b.route_id where b.id=(payload->>'bookingId')::uuid and r.captain_id=actor and b.status in ('reserved','confirmed','disputed','completed');
   if rider is null then raise exception 'CONFIRMED_BOOKING_REQUIRED' using errcode='42501'; end if;
   insert into sekka_v2.conversations(rider_id,captain_id) values(rider,actor) on conflict(rider_id,captain_id) do update set captain_id=excluded.captain_id returning id into target;
   return jsonb_build_object('id',target);
  end if;
  select * into cfg from sekka_v2.settings;
  if cfg.calendar_from is not null and today between cfg.calendar_from and cfg.calendar_through then eligible:=sekka_v2.eligible(today); end if;
  select jsonb_build_object(
   'today',today,'eligible',eligible,
   'captain',coalesce((select to_jsonb(c) from sekka_v2.captains c where c.user_id=actor),'{}'),
   'vehicle',coalesce((select to_jsonb(v) from sekka_v2.vehicles v where v.captain_id=actor),'{}'),
   'routes',coalesce((select jsonb_agg(r order by r.created_at desc) from sekka_v2.routes r where r.captain_id=actor),'[]'),
   'bookings',coalesce((select jsonb_agg(to_jsonb(b)||jsonb_build_object('rider_name',p.full_name,'origin',r.origin,'destination',r.destination,'period',c.period,'security_state',s.state) order by b.created_at desc) from sekka_v2.bookings b join sekka_v2.routes r on r.id=b.route_id join sekka_v2.profiles p on p.id=b.rider_id join sekka_v2.cycles c on c.id=b.cycle_id left join sekka_v2.reservations s on s.booking_id=b.id where r.captain_id=actor),'[]'),
   'conversations',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('rider_name',p.full_name,'body',m.body,'created_at',m.created_at)) from sekka_v2.conversations c join sekka_v2.profiles p on p.id=c.rider_id left join lateral(select body,created_at from sekka_v2.messages where conversation_id=c.id order by created_at desc limit 1)m on true where c.captain_id=actor and exists(select 1 from sekka_v2.bookings b join sekka_v2.routes r on r.id=b.route_id where r.captain_id=actor and b.rider_id=c.rider_id and b.status in ('reserved','confirmed','disputed','completed'))),'[]'),
   'notifications',coalesce((select jsonb_agg(n order by n.created_at desc) from sekka_v2.notifications n where n.user_id=actor),'[]'),
   'tickets',coalesce((select jsonb_agg(t order by t.created_at desc) from sekka_v2.support_tickets t where t.user_id=actor),'[]')
  ) into result;
  return result;
 end if;
 return sekka_v2.api_before_operations(operation,payload);
end $$;
revoke all on function sekka_v2.api(text,jsonb) from public;
grant execute on function sekka_v2.api(text,jsonb) to anon,authenticated;
create or replace function public.sekka_v2_api(operation text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select sekka_v2.api(operation,payload) $$;
commit;
