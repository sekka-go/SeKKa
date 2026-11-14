-- Forward only. Creates an isolated model; touches no legacy tables or users.
begin;
create schema sekka_v2;
revoke all on schema sekka_v2 from public;
grant usage on schema sekka_v2 to anon, authenticated;
create table sekka_v2.settings (
 id boolean primary key default true check(id), legal_terms_approved boolean not null default false, real_money_enabled boolean not null default false,
 payment_partner_approved boolean not null default false, financial_policies_approved boolean not null default false,
 calendar_from date, calendar_through date, holiday_source text,
 check(not real_money_enabled or (payment_partner_approved and financial_policies_approved)),
 check((calendar_from is null and calendar_through is null) or (calendar_from is not null and calendar_through>=calendar_from))
);
insert into sekka_v2.settings(id) values(true);
create table sekka_v2.holidays(day date primary key, title text not null, official_source text not null);
create table sekka_v2.profiles(id uuid primary key references auth.users(id), full_name text not null check(length(full_name) between 2 and 100), role text not null check(role in ('rider','captain')), accepted_policy_version text not null, accepted_at timestamptz not null default now(), created_at timestamptz not null default now());
create table sekka_v2.staff(user_id uuid references auth.users(id), permission text check(permission in ('verification','operations','finance','analytics','administration')), primary key(user_id,permission));
create table sekka_v2.captains(user_id uuid primary key references sekka_v2.profiles(id), status text not null default 'pending' check(status in ('pending','approved','changes_requested','rejected','suspended')), experience text not null default '', created_at timestamptz not null default now());
create table sekka_v2.vehicles(id uuid primary key default gen_random_uuid(), captain_id uuid not null unique references sekka_v2.captains(user_id), category text not null check(category in ('PRIME','SAVER','SPACE','MAX')), model text not null, plate text not null, status text not null default 'pending' check(status in ('pending','approved','changes_requested','rejected')), created_at timestamptz not null default now());
create table sekka_v2.documents(id uuid primary key default gen_random_uuid(), owner_id uuid not null references sekka_v2.profiles(id), kind text not null check(kind in ('identity','driving_license','vehicle_license','vehicle_photo')), storage_path text not null, expires_on date, status text not null default 'pending' check(status in ('pending','approved','changes_requested','rejected')));
create table sekka_v2.routes(id uuid primary key default gen_random_uuid(), captain_id uuid not null references sekka_v2.captains(user_id), vehicle_id uuid not null references sekka_v2.vehicles(id), origin text not null check(length(origin) between 2 and 120), destination text not null check(length(destination) between 2 and 120), outbound time not null, return_time time, anchor date not null, seats integer not null check(seats between 1 and 13), category text not null check(category in ('PRIME','SAVER','SPACE','MAX')), check(seats<=case category when 'PRIME' then 3 when 'SAVER' then 4 when 'SPACE' then 9 else 13 end), status text not null default 'draft' check(status in ('draft','active','paused')), created_at timestamptz not null default now());
create table sekka_v2.route_stops(id uuid primary key default gen_random_uuid(), route_id uuid references sekka_v2.routes(id), position integer not null check(position>=0), name text not null, latitude numeric check(latitude between 22 and 32), longitude numeric check(longitude between 24 and 37), unique(route_id,position));
create table sekka_v2.prices(route_id uuid references sekka_v2.routes(id), period text check(period in ('weekly','monthly')), direction text check(direction in ('outbound','return','round_trip')), amount integer not null check(amount>0), primary key(route_id,period,direction));
create table sekka_v2.cycles(id uuid primary key default gen_random_uuid(), route_id uuid not null references sekka_v2.routes(id), period text not null check(period in ('weekly','monthly')), starts_on date not null, ends_before date not null check(ends_before>starts_on), unique(route_id,period,starts_on));
create table sekka_v2.accounts(user_id uuid primary key references sekka_v2.profiles(id), created_at timestamptz not null default now());
create table sekka_v2.bookings(id uuid primary key default gen_random_uuid(), rider_id uuid not null references sekka_v2.profiles(id), route_id uuid not null references sekka_v2.routes(id), cycle_id uuid not null references sekka_v2.cycles(id), direction text not null check(direction in ('outbound','return','round_trip')), starts_on date not null, ends_before date not null check(ends_before>starts_on), full_price integer not null check(full_price>0), price integer not null check(price>=0), total_days integer not null check(total_days>0), remaining_days integer not null check(remaining_days between 1 and total_days), security_egp integer not null default 100 check(security_egp=100), status text not null default 'reserved' check(status in ('reserved','confirmed','disputed','cancelled','completed')), rider_paid_at timestamptz, captain_received_at timestamptz, idempotency_key uuid not null, created_at timestamptz not null default now(), unique(rider_id,idempotency_key));
create function sekka_v2.booking_snapshot_guard() returns trigger language plpgsql set search_path='' as $$ begin if (to_jsonb(new)-array['status','rider_paid_at','captain_received_at']) is distinct from (to_jsonb(old)-array['status','rider_paid_at','captain_received_at']) then raise exception 'BOOKING_SNAPSHOT_IMMUTABLE'; end if; return new; end $$;
create trigger bookings_snapshot_immutable before update on sekka_v2.bookings for each row execute function sekka_v2.booking_snapshot_guard();
create index bookings_route_dates on sekka_v2.bookings(route_id,starts_on,ends_before) where status in ('reserved','confirmed','disputed');
create index bookings_rider on sekka_v2.bookings(rider_id,created_at desc);
create table sekka_v2.reservations(booking_id uuid primary key references sekka_v2.bookings(id), user_id uuid not null references sekka_v2.accounts(user_id), amount integer not null check(amount=100), state text not null default 'reserved' check(state in ('reserved','released','disputed')), released_at timestamptz);
create table sekka_v2.ledger(id bigint generated always as identity primary key, user_id uuid not null references sekka_v2.accounts(user_id), booking_id uuid references sekka_v2.bookings(id), available_delta integer not null, reserved_delta integer not null, reference text not null unique, kind text not null check(kind in ('provider_credit','reserve','release','withdrawal','reversal')), created_at timestamptz not null default now(), check((kind='provider_credit' and available_delta>0 and reserved_delta=0) or (kind='reserve' and available_delta=-100 and reserved_delta=100) or (kind='release' and available_delta=100 and reserved_delta=-100) or (kind='withdrawal' and available_delta<0 and reserved_delta=0) or kind='reversal'));
create index ledger_owner on sekka_v2.ledger(user_id);
create table sekka_v2.payment_events(id bigint generated always as identity primary key, booking_id uuid not null references sekka_v2.bookings(id), actor_id uuid not null references sekka_v2.profiles(id), kind text not null check(kind in ('rider_paid','captain_received')), created_at timestamptz not null default now(), unique(booking_id,kind));
create table sekka_v2.provider_events(id text primary key, provider text not null, status text not null check(status in ('received','reconciled','failed')), amount integer check(amount>0), created_at timestamptz not null default now());
create table sekka_v2.withdrawals(id uuid primary key default gen_random_uuid(), user_id uuid not null references sekka_v2.accounts(user_id), amount integer not null check(amount>0), status text not null default 'pending' check(status in ('pending','processing','paid','rejected')), provider_reference text unique);
create table sekka_v2.renewals(id uuid primary key default gen_random_uuid(), booking_id uuid references sekka_v2.bookings(id), next_booking_id uuid unique references sekka_v2.bookings(id), priority_until timestamptz, status text not null default 'policy_pending');
create table sekka_v2.favorites(user_id uuid references sekka_v2.profiles(id), route_id uuid references sekka_v2.routes(id), primary key(user_id,route_id));
create table sekka_v2.waitlist(user_id uuid references sekka_v2.profiles(id), route_id uuid references sekka_v2.routes(id), created_at timestamptz not null default now(), primary key(user_id,route_id));
create table sekka_v2.demand_signals(id uuid primary key default gen_random_uuid(),origin text not null,destination text not null,created_at timestamptz not null default now(),unique(origin,destination));
create table sekka_v2.route_requests(id uuid primary key default gen_random_uuid(), user_id uuid not null references sekka_v2.profiles(id), origin text not null, destination text not null, departure time not null, direction text not null check(direction in ('outbound','return','round_trip')), created_at timestamptz not null default now(), unique(user_id,origin,destination,departure,direction));
create table sekka_v2.conversations(id uuid primary key default gen_random_uuid(), rider_id uuid not null references sekka_v2.profiles(id), captain_id uuid not null references sekka_v2.captains(user_id), unique(rider_id,captain_id));
create table sekka_v2.messages(id uuid primary key default gen_random_uuid(), conversation_id uuid not null references sekka_v2.conversations(id), sender_id uuid not null references sekka_v2.profiles(id), body text not null check(length(body) between 1 and 2000), created_at timestamptz not null default now());
create index messages_conversation on sekka_v2.messages(conversation_id,created_at);
create table sekka_v2.notifications(id uuid primary key default gen_random_uuid(), user_id uuid not null references sekka_v2.profiles(id), body text not null, created_at timestamptz not null default now(), read_at timestamptz);
create table sekka_v2.support_tickets(id uuid primary key default gen_random_uuid(), user_id uuid not null references sekka_v2.profiles(id), body text not null check(length(body) between 5 and 4000), status text not null default 'open', created_at timestamptz not null default now());
create table sekka_v2.disputes(id uuid primary key default gen_random_uuid(), booking_id uuid not null references sekka_v2.bookings(id), opened_by uuid not null references sekka_v2.profiles(id), reason text not null check(length(reason) between 5 and 4000), status text not null default 'open', created_at timestamptz not null default now());
create table sekka_v2.audit_log(id bigint generated always as identity primary key, actor_id uuid, action text not null, resource_id text, details jsonb not null default '{}', created_at timestamptz not null default now());
create table sekka_v2.legacy_quarantine(id uuid primary key default gen_random_uuid(), source_table text not null, source_id text not null, reason text not null, reviewed_at timestamptz, unique(source_table,source_id));
-- No grants on tables. RLS remains defense in depth even if grants are added later.
do $$ declare t record; begin for t in select tablename from pg_tables where schemaname='sekka_v2' loop execute format('alter table sekka_v2.%I enable row level security',t.tablename); end loop; end $$;
create function sekka_v2.immutable() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'APPEND_ONLY'; end $$;
create trigger ledger_immutable before update or delete on sekka_v2.ledger for each row execute function sekka_v2.immutable();
create trigger payment_events_immutable before update or delete on sekka_v2.payment_events for each row execute function sekka_v2.immutable();
create trigger audit_immutable before update or delete on sekka_v2.audit_log for each row execute function sekka_v2.immutable();
create function sekka_v2.boundary(anchor date, period text, n integer) returns date language sql immutable set search_path='' as $$ select case when period='weekly' then anchor+n*7 else (anchor + make_interval(months=>n))::date end $$;
create function sekka_v2.eligible(d date) returns boolean language plpgsql stable set search_path='' as $$ declare cfg sekka_v2.settings; begin select * into cfg from sekka_v2.settings; if cfg.calendar_from is null or d<cfg.calendar_from or d>cfg.calendar_through then raise exception 'HOLIDAY_CALENDAR_UNAPPROVED'; end if; return extract(dow from d)<5 and not exists(select 1 from sekka_v2.holidays where day=d); end $$;
create function sekka_v2.quote(route_uuid uuid, period_kind text, direction_kind text, at_time timestamptz) returns jsonb language plpgsql stable set search_path='' as $$
declare r sekka_v2.routes; local_time timestamp; d date; i integer; cs date; ce date; total integer:=0; remaining integer:=0; full_amount integer; start_day date; attempts integer:=0;
begin
 if period_kind not in ('weekly','monthly') or direction_kind not in ('outbound','return','round_trip') then raise exception 'INVALID_SELECTION'; end if;
 select * into r from sekka_v2.routes where id=route_uuid and status='active'; if not found then raise exception 'ROUTE_UNAVAILABLE'; end if;
 if direction_kind in ('return','round_trip') and r.return_time is null then raise exception 'DIRECTION_UNAVAILABLE'; end if;
 select amount into full_amount from sekka_v2.prices where route_id=r.id and period=period_kind and direction=direction_kind; if full_amount is null then raise exception 'PRICE_UNAVAILABLE'; end if;
 local_time:=at_time at time zone 'Africa/Cairo'; start_day:=local_time::date; if local_time::time>=time '00:01' then start_day:=start_day+1; end if;
 while not sekka_v2.eligible(start_day) loop start_day:=start_day+1; attempts:=attempts+1; if attempts>370 then raise exception 'NO_ELIGIBLE_DAY'; end if; end loop;
 if start_day<r.anchor then raise exception 'CYCLE_NOT_STARTED'; end if;
 if period_kind='weekly' then i:=(start_day-r.anchor)/7; else i:=(extract(year from start_day)::integer-extract(year from r.anchor)::integer)*12+extract(month from start_day)::integer-extract(month from r.anchor)::integer; end if;
 if sekka_v2.boundary(r.anchor,period_kind,i)>start_day then i:=i-1; end if;
 cs:=sekka_v2.boundary(r.anchor,period_kind,i); ce:=sekka_v2.boundary(r.anchor,period_kind,i+1); d:=cs;
 while d<ce loop if sekka_v2.eligible(d) then total:=total+1; if d>=start_day then remaining:=remaining+1; end if; end if; d:=d+1; end loop;
 if total=0 or remaining=0 then raise exception 'NO_ELIGIBLE_DAY'; end if;
 return jsonb_build_object('start',start_day,'cycleStart',cs,'endExclusive',ce,'totalDays',total,'remainingDays',remaining,'fullPrice',full_amount,'price',round(full_amount::numeric*remaining/total),'securityEgp',100);
end $$;
create function sekka_v2.balance(owner uuid) returns jsonb language sql stable set search_path='' as $$ select jsonb_build_object('available',coalesce(sum(available_delta),0),'reserved',coalesce(sum(reserved_delta),0)) from sekka_v2.ledger where user_id=owner $$;
-- API is the only private function client roles can execute. Never trusts client user ids or prices.
create function sekka_v2.api(operation text, payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare actor uuid:=auth.uid(); actor_role text; r sekka_v2.routes; b sekka_v2.bookings; v sekka_v2.vehicles; q jsonb; cfg sekka_v2.settings; result jsonb; target uuid; cycle_uuid uuid; occupied integer; cap integer; k uuid; txt text; permitted boolean;
begin
 select * into cfg from sekka_v2.settings;
 if operation='health' then return jsonb_build_object('version',2,'realMoneyEnabled',cfg.real_money_enabled,'calendarApproved',cfg.calendar_from is not null,'renewalsEnabled',false,'legalTermsApproved',cfg.legal_terms_approved); end if;
 if operation='search' then
  select coalesce(jsonb_agg(x),'[]') into result from (select r.id,r.origin,r.destination,r.outbound,r.return_time,r.category,r.seats,p.full_name as captain_name,v.model, (select coalesce(jsonb_agg(jsonb_build_object('period',pr.period,'direction',pr.direction,'amount',pr.amount)),'[]') from sekka_v2.prices pr where pr.route_id=r.id) as prices
  from sekka_v2.routes r join sekka_v2.profiles p on p.id=r.captain_id join sekka_v2.captains c on c.user_id=r.captain_id join sekka_v2.vehicles v on v.id=r.vehicle_id
  where r.status='active' and c.status='approved' and v.status='approved'
  and (coalesce(payload->>'origin','')='' or r.origin ilike '%'||(payload->>'origin')||'%') and (coalesce(payload->>'destination','')='' or r.destination ilike '%'||(payload->>'destination')||'%')
  and (coalesce(payload->>'category','')='' or r.category=payload->>'category')
  and (coalesce(payload->>'direction','outbound')='outbound' or r.return_time is not null)
  and (coalesce(payload->>'departure','')='' or abs(extract(epoch from (case when payload->>'direction'='return' then r.return_time else r.outbound end)-(payload->>'departure')::time))<=1800)
  and (coalesce(payload->>'returnTime','')='' or (r.return_time is not null and abs(extract(epoch from r.return_time-(payload->>'returnTime')::time))<=1800))
  and exists(select 1 from sekka_v2.prices pr where pr.route_id=r.id and pr.direction=coalesce(nullif(payload->>'direction',''),'outbound') and (coalesce(payload->>'period','')='' or pr.period=payload->>'period') and (coalesce(payload->>'maxPrice','')='' or pr.amount<=(payload->>'maxPrice')::integer))
  order by r.created_at desc limit 100) x; return result;
 end if;
 if operation='route' then
  select to_jsonb(r)||jsonb_build_object('captain_name',p.full_name,'vehicle_model',v.model,'plate',v.plate,'prices',(select jsonb_agg(pr) from sekka_v2.prices pr where pr.route_id=r.id),'stops',(select coalesce(jsonb_agg(s order by s.position),'[]') from sekka_v2.route_stops s where s.route_id=r.id)) into result
  from sekka_v2.routes r join sekka_v2.profiles p on p.id=r.captain_id join sekka_v2.captains c on c.user_id=r.captain_id join sekka_v2.vehicles v on v.id=r.vehicle_id where r.id=(payload->>'id')::uuid and r.status='active' and c.status='approved' and v.status='approved';
  if result is null then raise exception 'ROUTE_UNAVAILABLE'; end if; return result;
 end if;
 if operation='quote' then return sekka_v2.quote((payload->>'routeId')::uuid,payload->>'period',payload->>'direction',statement_timestamp()); end if;
 if actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 select role into actor_role from sekka_v2.profiles where id=actor;
 if operation='profile.save' then
  if not cfg.legal_terms_approved then raise exception 'LEGAL_TERMS_UNAPPROVED'; end if;
  if length(trim(payload->>'name')) not between 2 and 100 or coalesce(payload->>'role','') not in ('rider','captain') or coalesce(payload->>'policyVersion','')<>'2026-11-12' then raise exception 'INVALID_PROFILE'; end if;
  insert into sekka_v2.profiles(id,full_name,role,accepted_policy_version) values(actor,trim(payload->>'name'),payload->>'role',payload->>'policyVersion') on conflict(id) do update set full_name=excluded.full_name;
  insert into sekka_v2.accounts(user_id) values(actor) on conflict do nothing;
  if payload->>'role'='captain' and actor_role is null then insert into sekka_v2.captains(user_id) values(actor) on conflict do nothing; end if;
  select to_jsonb(p) into result from sekka_v2.profiles p where id=actor; return result;
 end if;
 if operation='me' then select to_jsonb(p)||jsonb_build_object('balance',sekka_v2.balance(actor),'permissions',(select coalesce(jsonb_agg(permission),'[]') from sekka_v2.staff where user_id=actor)) into result from sekka_v2.profiles p where id=actor; return result; end if;
 if actor_role is null then raise exception 'PROFILE_REQUIRED'; end if;
 if operation='bookings' then select coalesce(jsonb_agg(to_jsonb(b)||jsonb_build_object('origin',r.origin,'destination',r.destination) order by b.created_at desc),'[]') into result from sekka_v2.bookings b join sekka_v2.routes r on r.id=b.route_id where b.rider_id=actor or r.captain_id=actor; return result; end if;
 if operation='book' then
  if actor_role<>'rider' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  k:=(payload->>'idempotencyKey')::uuid; if k is null then raise exception 'IDEMPOTENCY_REQUIRED'; end if;
  -- Serialize wallet reservations before locking route to maintain one global lock order.
  perform 1 from sekka_v2.accounts where user_id=actor for update;
  select * into b from sekka_v2.bookings where rider_id=actor and idempotency_key=k;
  if found then
   if b.route_id<>(payload->>'routeId')::uuid or b.direction<>payload->>'direction' or not exists(select 1 from sekka_v2.cycles c where c.id=b.cycle_id and c.period=payload->>'period') then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
   return to_jsonb(b);
  end if;
  if not cfg.real_money_enabled then raise exception 'REAL_MONEY_DISABLED'; end if;
  select * into r from sekka_v2.routes where id=(payload->>'routeId')::uuid and status='active' for update;
  if not found then raise exception 'ROUTE_UNAVAILABLE'; end if;
  if not exists(select 1 from sekka_v2.captains where user_id=r.captain_id and status='approved') or not exists(select 1 from sekka_v2.vehicles where id=r.vehicle_id and status='approved') then raise exception 'ROUTE_UNAVAILABLE'; end if;
  q:=sekka_v2.quote(r.id,payload->>'period',payload->>'direction',statement_timestamp());
  if payload->'expectedQuote' is distinct from q then raise exception 'QUOTE_CHANGED'; end if;
  -- Count across weekly/monthly bookings and each overlapping operating day, per direction.
  select coalesce(max(n),0) into occupied from (select count(*) n from generate_series((q->>'start')::date,((q->>'endExclusive')::date-1),interval '1 day') d join sekka_v2.bookings x on x.route_id=r.id and x.starts_on<=d::date and x.ends_before>d::date and x.status in ('reserved','confirmed','disputed') cross join (values('outbound'),('return')) as leg(direction) where sekka_v2.eligible(d::date) and (payload->>'direction'='round_trip' or leg.direction=payload->>'direction') and (x.direction='round_trip' or x.direction=leg.direction) group by d,leg.direction) slots;
  if occupied>=r.seats then raise exception 'SOLD_OUT'; end if;
  if (sekka_v2.balance(actor)->>'available')::integer<100 then raise exception 'INSUFFICIENT_SECURITY'; end if;
  insert into sekka_v2.cycles(route_id,period,starts_on,ends_before) values(r.id,payload->>'period',(q->>'cycleStart')::date,(q->>'endExclusive')::date) on conflict(route_id,period,starts_on) do update set starts_on=excluded.starts_on returning id into cycle_uuid;
  insert into sekka_v2.bookings(rider_id,route_id,cycle_id,direction,starts_on,ends_before,full_price,price,total_days,remaining_days,idempotency_key) values(actor,r.id,cycle_uuid,payload->>'direction',(q->>'start')::date,(q->>'endExclusive')::date,(q->>'fullPrice')::integer,(q->>'price')::integer,(q->>'totalDays')::integer,(q->>'remainingDays')::integer,k) returning * into b;
  insert into sekka_v2.reservations(booking_id,user_id,amount) values(b.id,actor,100);
  insert into sekka_v2.ledger(user_id,booking_id,available_delta,reserved_delta,reference,kind) values(actor,b.id,-100,100,'reserve:'||b.id,'reserve');
  insert into sekka_v2.audit_log(actor_id,action,resource_id) values(actor,'booking.reserved',b.id::text);
  return to_jsonb(b);
 end if;
 if operation in ('payment.paid','payment.received','dispute.open') then
  -- Same lock order as book: account, then route/booking.
  select * into b from sekka_v2.bookings where id=(payload->>'bookingId')::uuid;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into r from sekka_v2.routes where id=b.route_id;
  if actor not in (b.rider_id,r.captain_id) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  perform 1 from sekka_v2.accounts where user_id=b.rider_id for update;
  select * into b from sekka_v2.bookings where id=b.id for update;
  if operation='dispute.open' then
   if length(trim(payload->>'reason')) not between 5 and 4000 or b.status not in ('reserved','confirmed') then raise exception 'INVALID_DISPUTE'; end if;
   insert into sekka_v2.disputes(booking_id,opened_by,reason) values(b.id,actor,trim(payload->>'reason'));
   update sekka_v2.bookings set status='disputed' where id=b.id;
   update sekka_v2.reservations set state='disputed' where booking_id=b.id and state='reserved';
   return jsonb_build_object('status','disputed');
  end if;
  if b.status not in ('reserved','confirmed') then raise exception 'BOOKING_NOT_CONFIRMABLE'; end if;
  if (statement_timestamp() at time zone 'Africa/Cairo')::date<b.starts_on then raise exception 'PAYMENT_TOO_EARLY'; end if;
  if operation='payment.paid' then
   if actor<>b.rider_id then raise exception 'FORBIDDEN' using errcode='42501'; end if;
   update sekka_v2.bookings set rider_paid_at=coalesce(rider_paid_at,statement_timestamp()) where id=b.id;
  else
   if actor<>r.captain_id then raise exception 'FORBIDDEN' using errcode='42501'; end if;
   if b.rider_paid_at is null then raise exception 'RIDER_CONFIRMATION_REQUIRED'; end if;
   update sekka_v2.bookings set captain_received_at=coalesce(captain_received_at,statement_timestamp()) where id=b.id;
  end if;
  insert into sekka_v2.payment_events(booking_id,actor_id,kind) values(b.id,actor,case operation when 'payment.paid' then 'rider_paid' else 'captain_received' end) on conflict do nothing;
  select * into b from sekka_v2.bookings where id=b.id;
  if b.rider_paid_at is not null and b.captain_received_at is not null then
   update sekka_v2.reservations set state='released',released_at=statement_timestamp() where booking_id=b.id and state='reserved';
   if found then
    insert into sekka_v2.ledger(user_id,booking_id,available_delta,reserved_delta,reference,kind) values(b.rider_id,b.id,100,-100,'release:'||b.id,'release');
    update sekka_v2.bookings set status='confirmed' where id=b.id;
    insert into sekka_v2.notifications(user_id,body) values(b.rider_id,'الكابتن أكد الاستلام. تأمينك متاح دلوقتي.');
   end if;
  end if;
  return (select to_jsonb(x) from sekka_v2.bookings x where id=b.id);
 end if;
 if operation='wallet' then return jsonb_build_object('balance',sekka_v2.balance(actor),'transactions',(select coalesce(jsonb_agg(l order by l.id desc),'[]') from sekka_v2.ledger l where user_id=actor)); end if;
 if operation in ('wallet.topup','wallet.withdraw','renew') then raise exception 'POLICY_OR_PROVIDER_APPROVAL_REQUIRED'; end if;
 if operation='favorite.toggle' then
  target:=(payload->>'routeId')::uuid;
  delete from sekka_v2.favorites where user_id=actor and route_id=target;
  if not found then insert into sekka_v2.favorites values(actor,target); end if;
  return jsonb_build_object('saved',exists(select 1 from sekka_v2.favorites where user_id=actor and route_id=target));
 end if;
 if operation='favorites' then select coalesce(jsonb_agg(r),'[]') into result from sekka_v2.routes r join sekka_v2.favorites f on f.route_id=r.id where f.user_id=actor and r.status='active'; return result; end if;
 if operation='waitlist.join' then insert into sekka_v2.waitlist(user_id,route_id) values(actor,(payload->>'routeId')::uuid) on conflict do nothing; return jsonb_build_object('joined',true); end if;
 if operation='request.create' then
  if length(trim(payload->>'origin')) not between 2 and 120 or length(trim(payload->>'destination')) not between 2 and 120 then raise exception 'INVALID_ROUTE'; end if;
  insert into sekka_v2.route_requests(user_id,origin,destination,departure,direction) values(actor,trim(payload->>'origin'),trim(payload->>'destination'),(payload->>'departure')::time,payload->>'direction') on conflict(user_id,origin,destination,departure,direction) do update set user_id=excluded.user_id returning id into target;
  if (select count(distinct user_id) from sekka_v2.route_requests where lower(trim(origin))=lower(trim(payload->>'origin')) and lower(trim(destination))=lower(trim(payload->>'destination')))>=10 then
   insert into sekka_v2.demand_signals(origin,destination) values(lower(trim(payload->>'origin')),lower(trim(payload->>'destination'))) on conflict do nothing;
   if found then
    insert into sekka_v2.notifications(user_id,body) select distinct c.user_id,'فيه 10 مهتمين أو أكتر بخط من '||trim(payload->>'origin')||' لـ '||trim(payload->>'destination')||'. راجع الطلب يا كابتن.' from sekka_v2.captains c join sekka_v2.routes r on r.captain_id=c.user_id where c.status='approved' and lower(trim(r.origin))=lower(trim(payload->>'origin')) and lower(trim(r.destination))=lower(trim(payload->>'destination'));
   end if;
  end if;
  return jsonb_build_object('id',target);
 end if;
 if operation='support.create' then insert into sekka_v2.support_tickets(user_id,body) values(actor,trim(payload->>'body')) returning id into target; return jsonb_build_object('id',target); end if;
 if operation='notifications' then select coalesce(jsonb_agg(n order by n.created_at desc),'[]') into result from sekka_v2.notifications n where user_id=actor; return result; end if;
 if operation='conversation.open' then
  if actor_role<>'rider' then raise exception 'FORBIDDEN'; end if;
  insert into sekka_v2.conversations(rider_id,captain_id) values(actor,(payload->>'captainId')::uuid) on conflict(rider_id,captain_id) do update set rider_id=excluded.rider_id returning id into target; return jsonb_build_object('id',target);
 end if;
 if operation='conversations' then select coalesce(jsonb_agg(c),'[]') into result from sekka_v2.conversations c where actor in (c.rider_id,c.captain_id); return result; end if;
 if operation in ('messages','message.send') then
  target:=(payload->>'conversationId')::uuid;
  if not exists(select 1 from sekka_v2.conversations c where c.id=target and actor in (c.rider_id,c.captain_id)) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if operation='message.send' then insert into sekka_v2.messages(conversation_id,sender_id,body) values(target,actor,trim(payload->>'body')); end if;
  select coalesce(jsonb_agg(m order by m.created_at),'[]') into result from (select * from sekka_v2.messages where conversation_id=target order by created_at desc limit 100)m; return result;
 end if;
 if operation='captain.save' then
  if actor_role<>'captain' then raise exception 'FORBIDDEN'; end if;
  insert into sekka_v2.captains(user_id,experience) values(actor,coalesce(payload->>'experience','')) on conflict(user_id) do update set experience=excluded.experience;
  return jsonb_build_object('status','pending');
 end if;
 if operation='vehicle.save' then
  if actor_role<>'captain' then raise exception 'FORBIDDEN'; end if;
  if not exists(select 1 from sekka_v2.captains where user_id=actor) then raise exception 'CAPTAIN_REQUIRED'; end if;
  insert into sekka_v2.vehicles(captain_id,category,model,plate) values(actor,payload->>'category',trim(payload->>'model'),trim(payload->>'plate')) on conflict(captain_id) do update set category=excluded.category,model=excluded.model,plate=excluded.plate,status='pending' returning id into target;
  update sekka_v2.routes set status='paused' where captain_id=actor;
  return jsonb_build_object('id',target,'status','pending');
 end if;
 if operation='captain' then return jsonb_build_object('captain',(select to_jsonb(c) from sekka_v2.captains c where user_id=actor),'vehicle',(select to_jsonb(v) from sekka_v2.vehicles v where captain_id=actor),'documents',(select coalesce(jsonb_agg(d),'[]') from sekka_v2.documents d where owner_id=actor)); end if;
 if operation='document.save' then
  txt:=payload->>'path'; if txt not like actor::text||'/%' then raise exception 'FORBIDDEN'; end if;
  if not exists(select 1 from storage.objects where bucket_id='sekka-v2-documents' and name=txt) then raise exception 'DOCUMENT_UPLOAD_REQUIRED'; end if;
  insert into sekka_v2.documents(owner_id,kind,storage_path,expires_on) values(actor,payload->>'kind',txt,nullif(payload->>'expiresOn','')::date) returning id into target;
  return jsonb_build_object('id',target);
 end if;
 if operation='captain.waitlist' then select coalesce(jsonb_agg(jsonb_build_object('origin',r.origin,'destination',r.destination,'full_name',p.full_name,'created_at',w.created_at) order by w.created_at),'[]') into result from sekka_v2.waitlist w join sekka_v2.routes r on r.id=w.route_id join sekka_v2.profiles p on p.id=w.user_id where r.captain_id=actor; return result; end if;
 if operation='captain.routes' then select coalesce(jsonb_agg(r),'[]') into result from sekka_v2.routes r where captain_id=actor; return result; end if;
 if operation='route.create' then
  if actor_role<>'captain' or not exists(select 1 from sekka_v2.captains where user_id=actor and status='approved') then raise exception 'CAPTAIN_NOT_APPROVED'; end if;
  select * into v from sekka_v2.vehicles where captain_id=actor and status='approved'; if not found then raise exception 'VEHICLE_NOT_APPROVED'; end if;
  cap:=case v.category when 'PRIME' then 3 when 'SAVER' then 4 when 'SPACE' then 9 else 13 end;
  if (payload->>'seats')::integer not between 1 and cap then raise exception 'INVALID_CAPACITY'; end if;
  -- Duration/overlap policy is not approved: a second active line is blocked conservatively.
  if exists(select 1 from sekka_v2.routes where captain_id=actor and status='active') then raise exception 'SCHEDULE_REVIEW_REQUIRED'; end if;
  insert into sekka_v2.routes(captain_id,vehicle_id,origin,destination,outbound,return_time,anchor,seats,category,status) values(actor,v.id,trim(payload->>'origin'),trim(payload->>'destination'),(payload->>'outbound')::time,nullif(payload->>'returnTime','')::time,(payload->>'anchor')::date,(payload->>'seats')::integer,v.category,'active') returning id into target;
  insert into sekka_v2.prices(route_id,period,direction,amount) select target,x.period,x.direction,x.amount from jsonb_to_recordset(payload->'prices') as x(period text,direction text,amount integer);
  if not exists(select 1 from sekka_v2.prices where route_id=target) then raise exception 'PRICE_REQUIRED'; end if;
  insert into sekka_v2.audit_log(actor_id,action,resource_id) values(actor,'route.created',target::text);
  return jsonb_build_object('id',target);
 end if;
 if operation='admin.list' then
  txt:=payload->>'resource';
  permitted:=exists(select 1 from sekka_v2.staff where user_id=actor and (permission='administration' or permission=case when txt in ('captains','vehicles','documents') then 'verification' when txt in ('ledger','disputes','reservations') then 'finance' when txt='analytics' then 'analytics' when txt='audit_log' then 'administration' else 'operations' end));
  if not permitted then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if txt='analytics' then return jsonb_build_object('routes',(select count(*) from sekka_v2.routes where status='active'),'reservedSeats',(select count(*) from sekka_v2.bookings where status='reserved'),'confirmedSeats',(select count(*) from sekka_v2.bookings where status='confirmed'),'unmetRequests',(select count(*) from sekka_v2.route_requests),'realMoneyEnabled',cfg.real_money_enabled); end if;
  if txt not in ('captains','vehicles','documents','profiles','routes','bookings','ledger','disputes','route_requests','notifications','audit_log','reservations','support_tickets') then raise exception 'INVALID_RESOURCE'; end if;
  execute format('select coalesce(jsonb_agg(x),''[]'') from (select * from sekka_v2.%I limit 100) x',txt) into result; return result;
 end if;
 if operation='admin.review' then
  if not exists(select 1 from sekka_v2.staff where user_id=actor and permission in ('administration','verification')) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  txt:=payload->>'status'; if txt not in ('approved','changes_requested','rejected') then raise exception 'INVALID_STATUS'; end if;
  if payload->>'resource'='captains' then
   target:=(payload->>'id')::uuid;
   if txt='approved' and (not exists(select 1 from sekka_v2.documents where owner_id=target and kind='driving_license' and status='approved' and expires_on>=(statement_timestamp() at time zone 'Africa/Cairo')::date) or not exists(select 1 from sekka_v2.documents where owner_id=target and kind='identity' and status='approved')) then raise exception 'APPROVED_DOCUMENTS_REQUIRED'; end if;
   update sekka_v2.captains set status=txt where user_id=target;
  elsif payload->>'resource'='vehicles' then
   target:=(payload->>'id')::uuid;
   if txt='approved' and not exists(select 1 from sekka_v2.documents d join sekka_v2.vehicles v on v.captain_id=d.owner_id where v.id=target and d.kind='vehicle_license' and d.status='approved' and d.expires_on>=(statement_timestamp() at time zone 'Africa/Cairo')::date) then raise exception 'APPROVED_DOCUMENTS_REQUIRED'; end if;
   update sekka_v2.vehicles set status=txt where id=target;
  elsif payload->>'resource'='documents' then target:=(payload->>'id')::uuid; update sekka_v2.documents set status=txt where id=target;
  else raise exception 'INVALID_RESOURCE'; end if;
  insert into sekka_v2.audit_log(actor_id,action,resource_id,details) values(actor,'verification.review',target::text,jsonb_build_object('status',txt,'resource',payload->>'resource'));
  return jsonb_build_object('status',txt);
 end if;
 raise exception 'UNKNOWN_OPERATION';
end $$;
revoke all on all functions in schema sekka_v2 from public,anon,authenticated;
grant execute on function sekka_v2.api(text,jsonb) to anon,authenticated;
create function public.sekka_v2_api(operation text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select sekka_v2.api(operation,payload) $$;
revoke all on function public.sekka_v2_api(text,jsonb) from public;
grant execute on function public.sekka_v2_api(text,jsonb) to anon,authenticated;
-- Private document bucket isolated from legacy buckets.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('sekka-v2-documents','sekka-v2-documents',false,5242880,array['image/jpeg','image/png','application/pdf']);
create function sekka_v2.can_review_documents() returns boolean language sql security definer set search_path='' as $$ select auth.uid() is not null and exists(select 1 from sekka_v2.staff where user_id=auth.uid() and permission in ('administration','verification')) $$;
revoke all on function sekka_v2.can_review_documents() from public;
grant execute on function sekka_v2.can_review_documents() to authenticated;
create policy sekka_v2_document_upload on storage.objects for insert to authenticated with check(bucket_id='sekka-v2-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy sekka_v2_document_read on storage.objects for select to authenticated using(bucket_id='sekka-v2-documents' and ((storage.foldername(name))[1]=(select auth.uid())::text or sekka_v2.can_review_documents()));
commit;
