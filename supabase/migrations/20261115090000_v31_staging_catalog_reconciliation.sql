-- Exact v31 schema reconstruction from READ-ONLY production catalog, 2026-11-15.
-- Apply ONLY to staging zgcvumykzivsvnlflbyp; no production data or secrets.
-- Legacy pre-v31 migrations intentionally not replayed.

create table public.v31_admin_allowlist (
  email text not null,
  contact_phone text,
  created_at timestamp with time zone not null default now()
);

create table public.v31_admin_phone_pending (
  phone_eg text not null,
  created_at timestamp with time zone not null default now()
);

create table public.v31_bookings (
  id uuid not null default gen_random_uuid(),
  route_id uuid not null,
  rider_id uuid not null,
  seats smallint not null,
  status text not null default 'pending'::text,
  idempotency_key uuid not null,
  created_at timestamp with time zone not null default now(),
  cancelled_at timestamp with time zone,
  pickup_stop_id uuid,
  dropoff_stop_id uuid,
  booked_direction text,
  price_snapshot_egp integer,
  period_snapshot text
);

create table public.v31_captain_profiles (
  user_id uuid not null,
  approval_status text not null default 'pending'::text,
  created_at timestamp with time zone not null default now()
);

create table public.v31_notifications (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  kind text not null,
  entity_id uuid,
  message_ar text not null,
  message_en text not null,
  created_at timestamp with time zone not null default now(),
  read_at timestamp with time zone
);

create table public.v31_phone_verifications (
  user_id uuid not null,
  phone_e164 text,
  verified_at timestamp with time zone,
  updated_at timestamp with time zone not null default now()
);

create table public.v31_profiles (
  user_id uuid not null,
  display_name text not null default ''::text,
  role_preference text not null default 'rider'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  phone_number text
);

create table public.v31_route_stops (
  id uuid not null default gen_random_uuid(),
  route_id uuid not null,
  area_id bigint not null,
  name text not null,
  "position" integer not null,
  pickup_allowed boolean not null default true,
  dropoff_allowed boolean not null default true
);

create table public.v31_routes (
  id uuid not null default gen_random_uuid(),
  captain_id uuid not null,
  title text not null,
  category text not null,
  seat_capacity smallint not null,
  direction text not null,
  period text not null,
  outbound_time time without time zone,
  return_time time without time zone,
  return_supported boolean not null default false,
  price_egp integer not null,
  status text not null default 'draft'::text,
  created_at timestamp with time zone not null default now()
);

create table public.v31_service_areas (
  id bigint not null,
  name_ar text not null,
  name_en text not null,
  region text not null,
  active boolean not null default true
);

create table public.v31_trip_offers (
  id uuid not null default gen_random_uuid(),
  request_id uuid not null,
  captain_id uuid not null,
  route_id uuid not null,
  status text not null default 'offered'::text,
  created_at timestamp with time zone not null default now()
);

create table public.v31_trip_requests (
  id uuid not null default gen_random_uuid(),
  rider_id uuid not null,
  origin_area_id bigint not null,
  destination_area_id bigint not null,
  outbound_time time without time zone not null,
  period text not null,
  seats smallint not null,
  request_key uuid not null,
  status text not null default 'open'::text,
  accepted_offer_id uuid,
  created_at timestamp with time zone not null default now()
);

create table public.v31_vehicles (
  id uuid not null default gen_random_uuid(),
  captain_id uuid not null,
  model text not null,
  plate_number text not null,
  category text not null,
  seats smallint not null,
  status text not null default 'active'::text,
  created_at timestamp with time zone not null default now()
);
alter table public.v31_admin_allowlist add constraint "v31_admin_allowlist_pkey" PRIMARY KEY (email);
alter table public.v31_admin_allowlist add constraint "v31_admin_lowercase" CHECK (email = lower(TRIM(BOTH FROM email)));
alter table public.v31_admin_phone_pending add constraint "v31_admin_phone_pending_phone_eg_check" CHECK (phone_eg ~ '^01[0125][0-9]{8}$'::text);
alter table public.v31_admin_phone_pending add constraint "v31_admin_phone_pending_pkey" PRIMARY KEY (phone_eg);
alter table public.v31_bookings add constraint "v31_bookings_booked_direction_check" CHECK (booked_direction = ANY (ARRAY['outbound'::text, 'return'::text]));
alter table public.v31_bookings add constraint "v31_bookings_period_snapshot_check" CHECK (period_snapshot = ANY (ARRAY['weekly'::text, 'monthly'::text]));
alter table public.v31_bookings add constraint "v31_bookings_pkey" PRIMARY KEY (id);
alter table public.v31_bookings add constraint "v31_bookings_price_snapshot_egp_check" CHECK (price_snapshot_egp > 0);
alter table public.v31_bookings add constraint "v31_bookings_rider_id_idempotency_key_key" UNIQUE (rider_id, idempotency_key);
alter table public.v31_bookings add constraint "v31_bookings_seats_check" CHECK (seats >= 1 AND seats <= 13);
alter table public.v31_bookings add constraint "v31_bookings_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text, 'completed'::text]));
alter table public.v31_captain_profiles add constraint "v31_captain_profiles_approval_status_check" CHECK (approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'suspended'::text]));
alter table public.v31_captain_profiles add constraint "v31_captain_profiles_pkey" PRIMARY KEY (user_id);
alter table public.v31_notifications add constraint "v31_notifications_kind_check" CHECK (length(kind) >= 2 AND length(kind) <= 50);
alter table public.v31_notifications add constraint "v31_notifications_pkey" PRIMARY KEY (id);
alter table public.v31_phone_verifications add constraint "v31_phone_e164_format" CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\\+[1-9][0-9]{7,14}$'::text);
alter table public.v31_phone_verifications add constraint "v31_phone_verifications_pkey" PRIMARY KEY (user_id);
alter table public.v31_phone_verifications add constraint "v31_phone_verified_requires_phone" CHECK (verified_at IS NULL OR phone_e164 IS NOT NULL);
alter table public.v31_profiles add constraint "v31_profiles_phone_number_check" CHECK (phone_number IS NULL OR phone_number ~ '^01[0125][0-9]{8}$'::text);
alter table public.v31_profiles add constraint "v31_profiles_pkey" PRIMARY KEY (user_id);
alter table public.v31_profiles add constraint "v31_profiles_role_preference_check" CHECK (role_preference = ANY (ARRAY['rider'::text, 'captain'::text]));
alter table public.v31_route_stops add constraint "v31_route_stops_name_check" CHECK (char_length(TRIM(BOTH FROM name)) >= 2 AND char_length(TRIM(BOTH FROM name)) <= 100);
alter table public.v31_route_stops add constraint "v31_route_stops_pkey" PRIMARY KEY (id);
alter table public.v31_route_stops add constraint "v31_route_stops_position_check" CHECK ("position" >= 0);
alter table public.v31_route_stops add constraint "v31_route_stops_route_id_position_key" UNIQUE (route_id, "position");
alter table public.v31_routes add constraint "v31_routes_category_check" CHECK (category = ANY (ARRAY['PRIME'::text, 'SAVER'::text, 'SPACE'::text, 'MAX'::text]));
alter table public.v31_routes add constraint "v31_routes_check" CHECK (category = 'PRIME'::text AND seat_capacity <= 3 OR category = 'SAVER'::text AND seat_capacity <= 4 OR category = 'SPACE'::text AND seat_capacity <= 9 OR category = 'MAX'::text AND seat_capacity <= 13);
alter table public.v31_routes add constraint "v31_routes_check1" CHECK (direction = 'return'::text OR outbound_time IS NOT NULL);
alter table public.v31_routes add constraint "v31_routes_check2" CHECK (direction = 'outbound'::text OR return_time IS NOT NULL);
alter table public.v31_routes add constraint "v31_routes_check3" CHECK (direction <> 'round_trip'::text OR return_supported);
alter table public.v31_routes add constraint "v31_routes_direction_check" CHECK (direction = ANY (ARRAY['outbound'::text, 'return'::text, 'round_trip'::text]));
alter table public.v31_routes add constraint "v31_routes_period_check" CHECK (period = ANY (ARRAY['weekly'::text, 'monthly'::text]));
alter table public.v31_routes add constraint "v31_routes_pkey" PRIMARY KEY (id);
alter table public.v31_routes add constraint "v31_routes_price_egp_check" CHECK (price_egp > 0);
alter table public.v31_routes add constraint "v31_routes_seat_capacity_check" CHECK (seat_capacity >= 1 AND seat_capacity <= 13);
alter table public.v31_routes add constraint "v31_routes_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'paused'::text, 'archived'::text]));
alter table public.v31_routes add constraint "v31_routes_title_check" CHECK (char_length(TRIM(BOTH FROM title)) >= 3 AND char_length(TRIM(BOTH FROM title)) <= 120);
alter table public.v31_service_areas add constraint "v31_service_areas_name_ar_key" UNIQUE (name_ar);
alter table public.v31_service_areas add constraint "v31_service_areas_pkey" PRIMARY KEY (id);
alter table public.v31_service_areas add constraint "v31_service_areas_region_check" CHECK (region = ANY (ARRAY['Cairo'::text, 'Giza'::text]));
alter table public.v31_trip_offers add constraint "v31_trip_offers_pkey" PRIMARY KEY (id);
alter table public.v31_trip_offers add constraint "v31_trip_offers_request_id_captain_id_route_id_key" UNIQUE (request_id, captain_id, route_id);
alter table public.v31_trip_offers add constraint "v31_trip_offers_status_check" CHECK (status = ANY (ARRAY['offered'::text, 'accepted'::text, 'rejected'::text]));
alter table public.v31_trip_requests add constraint "v31_trip_requests_check" CHECK (origin_area_id <> destination_area_id);
alter table public.v31_trip_requests add constraint "v31_trip_requests_period_check" CHECK (period = ANY (ARRAY['weekly'::text, 'monthly'::text]));
alter table public.v31_trip_requests add constraint "v31_trip_requests_pkey" PRIMARY KEY (id);
alter table public.v31_trip_requests add constraint "v31_trip_requests_rider_id_request_key_key" UNIQUE (rider_id, request_key);
alter table public.v31_trip_requests add constraint "v31_trip_requests_seats_check" CHECK (seats >= 1 AND seats <= 13);
alter table public.v31_trip_requests add constraint "v31_trip_requests_status_check" CHECK (status = ANY (ARRAY['open'::text, 'accepted'::text, 'cancelled'::text]));
alter table public.v31_vehicles add constraint "v31_vehicles_captain_id_plate_number_key" UNIQUE (captain_id, plate_number);
alter table public.v31_vehicles add constraint "v31_vehicles_category_check" CHECK (category = ANY (ARRAY['PRIME'::text, 'SAVER'::text, 'SPACE'::text, 'MAX'::text]));
alter table public.v31_vehicles add constraint "v31_vehicles_check" CHECK (category = 'PRIME'::text AND seats <= 3 OR category = 'SAVER'::text AND seats <= 4 OR category = 'SPACE'::text AND seats <= 9 OR category = 'MAX'::text AND seats <= 13);
alter table public.v31_vehicles add constraint "v31_vehicles_model_check" CHECK (length(TRIM(BOTH FROM model)) >= 2 AND length(TRIM(BOTH FROM model)) <= 100);
alter table public.v31_vehicles add constraint "v31_vehicles_pkey" PRIMARY KEY (id);
alter table public.v31_vehicles add constraint "v31_vehicles_plate_number_check" CHECK (length(TRIM(BOTH FROM plate_number)) >= 3 AND length(TRIM(BOTH FROM plate_number)) <= 24);
alter table public.v31_vehicles add constraint "v31_vehicles_seats_check" CHECK (seats >= 1 AND seats <= 13);
alter table public.v31_vehicles add constraint "v31_vehicles_status_check" CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text]));
alter table public.v31_bookings add constraint "v31_bookings_dropoff_stop_id_fkey" FOREIGN KEY (dropoff_stop_id) REFERENCES v31_route_stops(id);
alter table public.v31_bookings add constraint "v31_bookings_pickup_stop_id_fkey" FOREIGN KEY (pickup_stop_id) REFERENCES v31_route_stops(id);
alter table public.v31_bookings add constraint "v31_bookings_rider_id_fkey" FOREIGN KEY (rider_id) REFERENCES auth.users(id);
alter table public.v31_bookings add constraint "v31_bookings_route_id_fkey" FOREIGN KEY (route_id) REFERENCES v31_routes(id);
alter table public.v31_captain_profiles add constraint "v31_captain_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES v31_profiles(user_id) ON DELETE CASCADE;
alter table public.v31_notifications add constraint "v31_notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES v31_profiles(user_id) ON DELETE CASCADE;
alter table public.v31_phone_verifications add constraint "v31_phone_verifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.v31_profiles add constraint "v31_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.v31_route_stops add constraint "v31_route_stops_area_id_fkey" FOREIGN KEY (area_id) REFERENCES v31_service_areas(id);
alter table public.v31_route_stops add constraint "v31_route_stops_route_id_fkey" FOREIGN KEY (route_id) REFERENCES v31_routes(id) ON DELETE CASCADE;
alter table public.v31_routes add constraint "v31_routes_captain_id_fkey" FOREIGN KEY (captain_id) REFERENCES v31_captain_profiles(user_id);
alter table public.v31_trip_offers add constraint "v31_trip_offers_captain_id_fkey" FOREIGN KEY (captain_id) REFERENCES v31_captain_profiles(user_id);
alter table public.v31_trip_offers add constraint "v31_trip_offers_request_id_fkey" FOREIGN KEY (request_id) REFERENCES v31_trip_requests(id);
alter table public.v31_trip_offers add constraint "v31_trip_offers_route_id_fkey" FOREIGN KEY (route_id) REFERENCES v31_routes(id);
alter table public.v31_trip_requests add constraint "v31_accepted_offer_fk" FOREIGN KEY (accepted_offer_id) REFERENCES v31_trip_offers(id);
alter table public.v31_trip_requests add constraint "v31_trip_requests_destination_area_id_fkey" FOREIGN KEY (destination_area_id) REFERENCES v31_service_areas(id);
alter table public.v31_trip_requests add constraint "v31_trip_requests_origin_area_id_fkey" FOREIGN KEY (origin_area_id) REFERENCES v31_service_areas(id);
alter table public.v31_trip_requests add constraint "v31_trip_requests_rider_id_fkey" FOREIGN KEY (rider_id) REFERENCES v31_profiles(user_id);
alter table public.v31_vehicles add constraint "v31_vehicles_captain_id_fkey" FOREIGN KEY (captain_id) REFERENCES v31_captain_profiles(user_id) ON DELETE CASCADE;
CREATE INDEX v31_bookings_capacity_idx ON public.v31_bookings USING btree (route_id, status);
CREATE INDEX v31_route_stops_route_position ON public.v31_route_stops USING btree (route_id, "position");
CREATE INDEX v31_routes_published_index ON public.v31_routes USING btree (status, period, direction);

CREATE OR REPLACE FUNCTION public.v31_accept_trip_offer(p_offer uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=(select auth.uid()); v_offer public.v31_trip_offers%rowtype; v_req public.v31_trip_requests%rowtype; v_route public.v31_routes%rowtype; v_reserved integer; v_booking uuid;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into v_offer from public.v31_trip_offers where id=p_offer;
 if not found then raise exception 'OFFER_NOT_FOUND'; end if;
 select * into v_req from public.v31_trip_requests where id=v_offer.request_id for update;
 if not found or v_req.rider_id<>v_uid then raise exception 'NOT_REQUEST_OWNER'; end if;
 if v_req.status='accepted' and v_req.accepted_offer_id=p_offer then
   select id into v_booking from public.v31_bookings where rider_id=v_uid and idempotency_key=v_req.id;
   if v_booking is not null then return v_booking; end if;
 end if;
 if v_req.status<>'open' or v_offer.status<>'offered' then raise exception 'REQUEST_NOT_AVAILABLE'; end if;
 select * into v_route from public.v31_routes where id=v_offer.route_id for update;
 if not found or v_route.status<>'published' or v_route.captain_id<>v_offer.captain_id then raise exception 'ROUTE_NOT_AVAILABLE'; end if;
 if v_route.captain_id=v_uid then raise exception 'CAPTAIN_CANNOT_BOOK_OWN_ROUTE'; end if;
 if v_route.period<>v_req.period or v_route.outbound_time is distinct from v_req.outbound_time or v_route.direction='return' then raise exception 'ROUTE_SCHEDULE_MISMATCH'; end if;
 if not exists(select 1 from public.v31_captain_profiles cp where cp.user_id=v_route.captain_id and cp.approval_status='approved') then raise exception 'CAPTAIN_NOT_APPROVED'; end if;
 if not exists(
  select 1 from public.v31_route_stops o join public.v31_route_stops d
    on o.route_id=d.route_id and o.position<d.position
  where o.route_id=v_route.id and o.area_id=v_req.origin_area_id and d.area_id=v_req.destination_area_id and o.pickup_allowed and d.dropoff_allowed
 ) then raise exception 'ROUTE_NOT_MATCHING_REQUEST'; end if;
 select coalesce(sum(b.seats),0) into v_reserved from public.v31_bookings b where b.route_id=v_route.id and b.status in ('pending','confirmed');
 if v_reserved+v_req.seats>v_route.seat_capacity then raise exception 'INSUFFICIENT_SEATS'; end if;
 insert into public.v31_bookings(route_id,rider_id,seats,idempotency_key,status)
 values(v_route.id,v_uid,v_req.seats,v_req.id,'pending') returning id into v_booking;
 update public.v31_trip_offers set status='accepted' where id=p_offer;
 update public.v31_trip_offers set status='rejected' where request_id=v_req.id and id<>p_offer and status='offered';
 update public.v31_trip_requests set status='accepted',accepted_offer_id=p_offer where id=v_req.id;
 return v_booking;
end $function$
;

CREATE OR REPLACE FUNCTION public.v31_admin_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if (select public.v31_is_admin()) is distinct from true then raise exception 'ADMIN_REQUIRED'; end if;
 return jsonb_build_object(
  'passengers',(select count(*) from public.v31_profiles where role_preference='rider'),
  'captains_approved',(select count(*) from public.v31_captain_profiles where approval_status='approved'),
  'vehicles',(select count(*) from public.v31_vehicles where status='active'),
  'routes_published',(select count(*) from public.v31_routes where status='published'),
  'pending_bookings',(select count(*) from public.v31_bookings where status='pending'),
  'open_requests',(select count(*) from public.v31_trip_requests where status='open'),
  'captain_offers',(select count(*) from public.v31_trip_offers where status='offered'),
  'notifications',(select count(*) from public.v31_notifications)
 );
end $function$
;

CREATE OR REPLACE FUNCTION public.v31_cancel_pending_booking(p_booking uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid := (select auth.uid()); v_route uuid; v_status text;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 -- Lock ordering matches reservation: route first, then booking.
 select b.route_id into v_route from public.v31_bookings b
 where b.id=p_booking and b.rider_id=v_uid;
 if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
 perform 1 from public.v31_routes where id=v_route for update;
 select b.status into v_status from public.v31_bookings b
 where b.id=p_booking and b.rider_id=v_uid for update;
 if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
 if v_status='cancelled' then return true; end if;
 if v_status<>'pending' then raise exception 'ONLY_PENDING_BOOKINGS_CAN_BE_CANCELLED'; end if;
 update public.v31_bookings set status='cancelled',cancelled_at=now()
 where id=p_booking and rider_id=v_uid and status='pending';
 return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.v31_cancel_trip_request(p_request uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=(select auth.uid()); v_updated uuid;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 update public.v31_trip_requests set status='cancelled' where id=p_request and rider_id=v_uid and status='open' returning id into v_updated;
 if v_updated is null then raise exception 'REQUEST_NOT_OPEN_OR_OWNED'; end if;
 update public.v31_trip_offers set status='rejected' where request_id=p_request and status='offered';
 return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.v31_create_route_draft(p_title text, p_category text, p_capacity smallint, p_direction text, p_period text, p_outbound time without time zone, p_return time without time zone, p_return_supported boolean, p_price integer, p_stops jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_uid uuid := (select auth.uid()); v_id uuid; v_stop jsonb; v_i integer := 0;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if jsonb_typeof(p_stops) is distinct from 'array' or jsonb_array_length(p_stops) < 2 or jsonb_array_length(p_stops)>30
 then raise exception 'INVALID_STOPS_COUNT'; end if;
 if (p_stops->0->>'area_id') is not distinct from (p_stops->(jsonb_array_length(p_stops)-1)->>'area_id')
 then raise exception 'SAME_ORIGIN_DESTINATION'; end if;
 if exists (select 1 from jsonb_array_elements(p_stops) s
   where nullif(trim(s->>'name'),'') is null or char_length(trim(s->>'name'))<2
   or (s->>'area_id') !~ '^[0-9]+$'
   or not exists (select 1 from public.v31_service_areas a where a.id=(s->>'area_id')::bigint and a.active))
 then raise exception 'INVALID_STOP'; end if;
 if (select count(distinct lower(trim(s->>'name')) || ':' || (s->>'area_id')) from jsonb_array_elements(p_stops) s) <> jsonb_array_length(p_stops)
 then raise exception 'DUPLICATE_STOPS'; end if;
 insert into public.v31_routes(captain_id,title,category,seat_capacity,direction,period,outbound_time,return_time,return_supported,price_egp,status)
 values(v_uid,p_title,p_category,p_capacity,p_direction,p_period,p_outbound,p_return,p_return_supported,p_price,'draft')
 returning id into v_id;
 for v_stop in select value from jsonb_array_elements(p_stops)
 loop
  insert into public.v31_route_stops(route_id,area_id,name,position,pickup_allowed,dropoff_allowed)
  values(v_id,(v_stop->>'area_id')::bigint,trim(v_stop->>'name'),v_i,
   coalesce((v_stop->>'pickup')::boolean,true),coalesce((v_stop->>'dropoff')::boolean,true));
  v_i:=v_i+1;
 end loop;
 return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.v31_guard_route_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_n int; v_first bigint; v_last bigint;
begin
 if new.status = 'published' and (tg_op='INSERT' or old.status is distinct from 'published') then
  if tg_op='INSERT' then raise exception 'DRAFT_FIRST_REQUIRED'; end if;
  if not exists(select 1 from public.v31_captain_profiles cp
     where cp.user_id=new.captain_id and cp.approval_status='approved') then
    raise exception 'CAPTAIN_NOT_APPROVED';
  end if;
  select count(*), min(area_id) filter(where position=0)
    into v_n,v_first from public.v31_route_stops where route_id=new.id;
  select area_id into v_last from public.v31_route_stops where route_id=new.id order by position desc limit 1;
  if v_n < 2 or v_n > 30 or v_first is null or v_last is null or v_first=v_last then
    raise exception 'INVALID_ROUTE_STOPS';
  end if;
  if exists(select 1 from public.v31_route_stops s where s.route_id=new.id
    and not exists (select 1 from public.v31_service_areas a where a.id=s.area_id and a.active)) then
    raise exception 'INACTIVE_SERVICE_AREA';
  end if;
  if not exists (select 1 from public.v31_route_stops p
    join public.v31_route_stops d on p.route_id=d.route_id
    where p.route_id=new.id and p.position<d.position and p.pickup_allowed and d.dropoff_allowed) then
    raise exception 'NO_VALID_PICKUP_DROPOFF';
  end if;
  if new.direction='round_trip' and (not new.return_supported or
     not exists(select 1 from public.v31_route_stops p
       join public.v31_route_stops d on p.route_id=d.route_id
       where p.route_id=new.id and p.position<d.position and d.pickup_allowed and p.dropoff_allowed)) then
    raise exception 'REVERSE_ROUTE_UNSUPPORTED';
  end if;
 end if;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.v31_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(
 select 1 from auth.users u
 join public.v31_admin_allowlist a on a.email=lower(u.email)
 where u.id=(select auth.uid())
   and u.email_confirmed_at is not null
   and exists(select 1 from auth.identities i where i.user_id=u.id and i.provider='google')
 )
$function$
;

CREATE OR REPLACE FUNCTION public.v31_notify_new_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_captain uuid;
begin
 select captain_id into v_captain from public.v31_routes where id=new.route_id;
 if v_captain is not null then
  insert into public.v31_notifications(user_id,kind,entity_id,message_ar,message_en)
  values(v_captain,'new_booking',new.id,'وصلك طلب حجز جديد على خطك.','A new seat booking arrived on your route.');
 end if;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.v31_notify_offer_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_rider uuid;
begin
 if tg_op='INSERT' then
  select rider_id into v_rider from public.v31_trip_requests where id=new.request_id;
  if v_rider is not null then
   insert into public.v31_notifications(user_id,kind,entity_id,message_ar,message_en)
   values(v_rider,'new_offer',new.id,'كابتن بعتلك عرض لطلب رحلتك.','A captain offered a route for your trip request.');
  end if;
 elsif new.status='accepted' and old.status is distinct from 'accepted' then
  insert into public.v31_notifications(user_id,kind,entity_id,message_ar,message_en)
  values(new.captain_id,'offer_accepted',new.id,'الراكب وافق على عرض خطك.','A passenger accepted your route offer.');
 end if;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.v31_reserve_seats(p_route uuid, p_seats smallint, p_idempotency uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid := (select auth.uid()); v_route public.v31_routes%rowtype; v_reserved int; v_existing public.v31_bookings%rowtype; v_id uuid;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_seats is null or p_seats<1 or p_seats>13 or p_idempotency is null then raise exception 'INVALID_BOOKING'; end if;
 select * into v_existing from public.v31_bookings where rider_id=v_user and idempotency_key=p_idempotency;
 if found then
  if v_existing.route_id<>p_route or v_existing.seats<>p_seats then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  if v_existing.status='cancelled' then raise exception 'BOOKING_ALREADY_CANCELLED'; end if;
  return v_existing.id;
 end if;
 select * into v_route from public.v31_routes where id=p_route for update;
 if not found or v_route.status<>'published' then raise exception 'ROUTE_NOT_AVAILABLE'; end if;
 if v_route.captain_id=v_user then raise exception 'CAPTAIN_CANNOT_BOOK_OWN_ROUTE'; end if;
 select coalesce(sum(seats),0) into v_reserved from public.v31_bookings
 where route_id=p_route and status in ('pending','confirmed');
 if v_reserved+p_seats>v_route.seat_capacity then raise exception 'INSUFFICIENT_SEATS'; end if;
 insert into public.v31_bookings(route_id,rider_id,seats,idempotency_key,status)
 values(p_route,v_user,p_seats,p_idempotency,'pending') returning id into v_id;
 return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.v31_reserve_seats_with_stops(p_route uuid, p_seats smallint, p_idempotency uuid, p_pickup uuid, p_dropoff uuid, p_reverse boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=(select auth.uid());v_from public.v31_route_stops%rowtype;v_to public.v31_route_stops%rowtype;v_route public.v31_routes%rowtype;v_booking uuid;v_existing public.v31_bookings%rowtype;v_direction text;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED';end if;
 select * into v_route from public.v31_routes where id=p_route;
 if not found or v_route.status<>'published' then raise exception 'ROUTE_NOT_AVAILABLE';end if;
 select * into v_from from public.v31_route_stops where id=p_pickup and route_id=p_route;
 select * into v_to from public.v31_route_stops where id=p_dropoff and route_id=p_route;
 if v_from.id is null or v_to.id is null then raise exception 'INVALID_BOOKING_STOPS';end if;
 if p_reverse then
  if v_route.direction='outbound' or not v_route.return_supported or v_from.position<=v_to.position or not v_from.dropoff_allowed or not v_to.pickup_allowed then raise exception 'INVALID_REVERSE_STOPS';end if;
  v_direction:='return';
 else
  if v_route.direction='return' or v_from.position>=v_to.position or not v_from.pickup_allowed or not v_to.dropoff_allowed then raise exception 'INVALID_OUTBOUND_STOPS';end if;
  v_direction:='outbound';
 end if;
 v_booking:=public.v31_reserve_seats(p_route,p_seats,p_idempotency);
 select * into v_existing from public.v31_bookings where id=v_booking for update;
 if v_existing.pickup_stop_id is not null and
  (v_existing.pickup_stop_id<>p_pickup or v_existing.dropoff_stop_id<>p_dropoff or v_existing.booked_direction<>v_direction)
  then raise exception 'IDEMPOTENCY_STOPS_CONFLICT';end if;
 update public.v31_bookings set pickup_stop_id=p_pickup,dropoff_stop_id=p_dropoff,booked_direction=v_direction,
 price_snapshot_egp=coalesce(v_existing.price_snapshot_egp,v_route.price_egp),
 period_snapshot=coalesce(v_existing.period_snapshot,v_route.period)
 where id=v_booking;
 return v_booking;
end $function$
;

CREATE OR REPLACE FUNCTION public.v31_set_route_status(p_route uuid, p_status text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=(select auth.uid());v_route public.v31_routes%rowtype;v_active int;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_status not in ('paused','published','archived') then raise exception 'INVALID_STATUS'; end if;
 select * into v_route from public.v31_routes where id=p_route for update;
 if not found or v_route.captain_id<>v_uid then raise exception 'ROUTE_NOT_OWNED'; end if;
 if v_route.status='published' and p_status='paused' then null;
 elsif v_route.status='paused' and p_status in ('published','archived') then null;
 elsif v_route.status='published' and p_status='archived' then null;
 else raise exception 'INVALID_TRANSITION'; end if;
 if p_status='published' and not exists(select 1 from public.v31_captain_profiles cp where cp.user_id=v_uid and cp.approval_status='approved') then raise exception 'CAPTAIN_NOT_APPROVED'; end if;
 if p_status='archived' then
  select count(*) into v_active from public.v31_bookings where route_id=p_route and status in ('pending','confirmed');
  if v_active>0 then raise exception 'ACTIVE_BOOKINGS_PREVENT_ARCHIVE'; end if;
 end if;
 update public.v31_routes set status=p_status where id=p_route;
 return p_status;
end $function$
;
CREATE TRIGGER v31_booking_created_notify AFTER INSERT ON v31_bookings FOR EACH ROW EXECUTE FUNCTION v31_notify_new_booking();
CREATE TRIGGER v31_route_publish_guard BEFORE INSERT OR UPDATE OF status ON v31_routes FOR EACH ROW EXECUTE FUNCTION v31_guard_route_status();
CREATE TRIGGER v31_offer_accepted_notify AFTER UPDATE OF status ON v31_trip_offers FOR EACH ROW EXECUTE FUNCTION v31_notify_offer_changes();
CREATE TRIGGER v31_offer_created_notify AFTER INSERT ON v31_trip_offers FOR EACH ROW EXECUTE FUNCTION v31_notify_offer_changes();
alter table public.v31_admin_allowlist enable row level security;
alter table public.v31_admin_phone_pending enable row level security;
alter table public.v31_bookings enable row level security;
alter table public.v31_captain_profiles enable row level security;
alter table public.v31_notifications enable row level security;
alter table public.v31_phone_verifications enable row level security;
alter table public.v31_profiles enable row level security;
alter table public.v31_route_stops enable row level security;
alter table public.v31_routes enable row level security;
alter table public.v31_service_areas enable row level security;
alter table public.v31_trip_offers enable row level security;
alter table public.v31_trip_requests enable row level security;
alter table public.v31_vehicles enable row level security;
create policy "own bookings read" on public.v31_bookings as PERMISSIVE for SELECT to authenticated using ((rider_id = ( SELECT auth.uid() AS uid))) ;
create policy "route captain booking read" on public.v31_bookings as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM v31_routes r
  WHERE ((r.id = v31_bookings.route_id) AND (r.captain_id = ( SELECT auth.uid() AS uid)))))) ;
create policy "captain profile enrollment" on public.v31_captain_profiles as PERMISSIVE for INSERT to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND (approval_status = 'pending'::text))) ;
create policy "own captain profile read" on public.v31_captain_profiles as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) ;
create policy "recipient acknowledge notifications" on public.v31_notifications as PERMISSIVE for UPDATE to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid))) ;
create policy "recipient read notifications" on public.v31_notifications as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) ;
create policy "read own verification status" on public.v31_phone_verifications as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) ;
create policy "self profile insert" on public.v31_profiles as PERMISSIVE for INSERT to authenticated with check ((user_id = ( SELECT auth.uid() AS uid))) ;
create policy "self profile select" on public.v31_profiles as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) ;
create policy "self profile update" on public.v31_profiles as PERMISSIVE for UPDATE to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid))) ;
create policy "own draft stops delete" on public.v31_route_stops as PERMISSIVE for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM v31_routes r
  WHERE ((r.id = v31_route_stops.route_id) AND (r.captain_id = ( SELECT auth.uid() AS uid)) AND (r.status = 'draft'::text))))) ;
create policy "own draft stops insert" on public.v31_route_stops as PERMISSIVE for INSERT to authenticated with check ((EXISTS ( SELECT 1
   FROM v31_routes r
  WHERE ((r.id = v31_route_stops.route_id) AND (r.captain_id = ( SELECT auth.uid() AS uid)) AND (r.status = 'draft'::text))))) ;
create policy "own draft stops update" on public.v31_route_stops as PERMISSIVE for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM v31_routes r
  WHERE ((r.id = v31_route_stops.route_id) AND (r.captain_id = ( SELECT auth.uid() AS uid)) AND (r.status = 'draft'::text))))) with check ((EXISTS ( SELECT 1
   FROM v31_routes r
  WHERE ((r.id = v31_route_stops.route_id) AND (r.captain_id = ( SELECT auth.uid() AS uid)) AND (r.status = 'draft'::text))))) ;
create policy "route stops read" on public.v31_route_stops as PERMISSIVE for SELECT to anon,authenticated using ((EXISTS ( SELECT 1
   FROM v31_routes r
  WHERE ((r.id = v31_route_stops.route_id) AND ((r.status = 'published'::text) OR (r.captain_id = ( SELECT auth.uid() AS uid))))))) ;
create policy "captain draft route insert" on public.v31_routes as PERMISSIVE for INSERT to authenticated with check (((captain_id = ( SELECT auth.uid() AS uid)) AND (status = 'draft'::text))) ;
create policy "captain own or published routes read" on public.v31_routes as PERMISSIVE for SELECT to authenticated using (((captain_id = ( SELECT auth.uid() AS uid)) OR (status = 'published'::text))) ;
create policy "captain owned route review" on public.v31_routes as PERMISSIVE for UPDATE to authenticated using (((captain_id = ( SELECT auth.uid() AS uid)) AND (status = 'draft'::text))) with check (((captain_id = ( SELECT auth.uid() AS uid)) AND ((status = 'draft'::text) OR ((status = 'published'::text) AND (EXISTS ( SELECT 1
   FROM v31_captain_profiles cp
  WHERE ((cp.user_id = ( SELECT auth.uid() AS uid)) AND (cp.approval_status = 'approved'::text)))))))) ;
create policy "public published routes read" on public.v31_routes as PERMISSIVE for SELECT to anon using ((status = 'published'::text)) ;
create policy "areas public read" on public.v31_service_areas as PERMISSIVE for SELECT to anon,authenticated using ((active = true)) ;
create policy "approved captain offer existing route" on public.v31_trip_offers as PERMISSIVE for INSERT to authenticated with check (((captain_id = ( SELECT auth.uid() AS uid)) AND (status = 'offered'::text) AND (EXISTS ( SELECT 1
   FROM v31_captain_profiles cp
  WHERE ((cp.user_id = ( SELECT auth.uid() AS uid)) AND (cp.approval_status = 'approved'::text)))) AND (EXISTS ( SELECT 1
   FROM v31_routes route
  WHERE ((route.id = v31_trip_offers.route_id) AND (route.captain_id = ( SELECT auth.uid() AS uid)) AND (route.status = 'published'::text)))) AND (EXISTS ( SELECT 1
   FROM v31_trip_requests req
  WHERE ((req.id = v31_trip_offers.request_id) AND (req.status = 'open'::text)))))) ;
create policy "rider and captain see offers" on public.v31_trip_offers as PERMISSIVE for SELECT to authenticated using (((captain_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM v31_trip_requests req
  WHERE ((req.id = v31_trip_offers.request_id) AND (req.rider_id = ( SELECT auth.uid() AS uid))))))) ;
create policy "approved captains read open requests" on public.v31_trip_requests as PERMISSIVE for SELECT to authenticated using (((status = 'open'::text) AND (EXISTS ( SELECT 1
   FROM v31_captain_profiles cp
  WHERE ((cp.user_id = ( SELECT auth.uid() AS uid)) AND (cp.approval_status = 'approved'::text)))))) ;
create policy "rider insert own requests" on public.v31_trip_requests as PERMISSIVE for INSERT to authenticated with check (((rider_id = ( SELECT auth.uid() AS uid)) AND (status = 'open'::text) AND (accepted_offer_id IS NULL))) ;
create policy "rider own requests" on public.v31_trip_requests as PERMISSIVE for SELECT to authenticated using ((rider_id = ( SELECT auth.uid() AS uid))) ;
create policy "captain vehicles own create" on public.v31_vehicles as PERMISSIVE for INSERT to authenticated with check (((captain_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM v31_captain_profiles cp
  WHERE ((cp.user_id = ( SELECT auth.uid() AS uid)) AND (cp.approval_status = 'approved'::text)))))) ;
create policy "captain vehicles own edit" on public.v31_vehicles as PERMISSIVE for UPDATE to authenticated using ((captain_id = ( SELECT auth.uid() AS uid))) with check ((captain_id = ( SELECT auth.uid() AS uid))) ;
create policy "captain vehicles own read" on public.v31_vehicles as PERMISSIVE for SELECT to authenticated using ((captain_id = ( SELECT auth.uid() AS uid))) ;
grant SELECT on public.v31_bookings to authenticated;
grant INSERT on public.v31_captain_profiles to authenticated;
grant SELECT on public.v31_captain_profiles to authenticated;
grant SELECT on public.v31_notifications to authenticated;
grant SELECT on public.v31_phone_verifications to authenticated;
grant INSERT on public.v31_profiles to authenticated;
grant SELECT on public.v31_profiles to authenticated;
grant UPDATE on public.v31_profiles to authenticated;
grant SELECT on public.v31_route_stops to anon;
grant DELETE on public.v31_route_stops to authenticated;
grant INSERT on public.v31_route_stops to authenticated;
grant SELECT on public.v31_route_stops to authenticated;
grant UPDATE on public.v31_route_stops to authenticated;
grant SELECT on public.v31_routes to anon;
grant INSERT on public.v31_routes to authenticated;
grant SELECT on public.v31_routes to authenticated;
grant UPDATE on public.v31_routes to authenticated;
grant SELECT on public.v31_service_areas to anon;
grant SELECT on public.v31_service_areas to authenticated;
grant INSERT on public.v31_trip_offers to authenticated;
grant SELECT on public.v31_trip_offers to authenticated;
grant INSERT on public.v31_trip_requests to authenticated;
grant SELECT on public.v31_trip_requests to authenticated;
grant INSERT on public.v31_vehicles to authenticated;
grant SELECT on public.v31_vehicles to authenticated;
grant UPDATE on public.v31_vehicles to authenticated;
grant update (read_at) on public.v31_notifications to authenticated;
revoke execute on function v31_accept_trip_offer(uuid) from public, anon, authenticated;
revoke execute on function v31_admin_overview() from public, anon, authenticated;
revoke execute on function v31_cancel_pending_booking(uuid) from public, anon, authenticated;
revoke execute on function v31_cancel_trip_request(uuid) from public, anon, authenticated;
revoke execute on function v31_create_route_draft(text,text,smallint,text,text,time without time zone,time without time zone,boolean,integer,jsonb) from public, anon, authenticated;
revoke execute on function v31_guard_route_status() from public, anon, authenticated;
revoke execute on function v31_is_admin() from public, anon, authenticated;
revoke execute on function v31_notify_new_booking() from public, anon, authenticated;
revoke execute on function v31_notify_offer_changes() from public, anon, authenticated;
revoke execute on function v31_reserve_seats(uuid,smallint,uuid) from public, anon, authenticated;
revoke execute on function v31_reserve_seats_with_stops(uuid,smallint,uuid,uuid,uuid,boolean) from public, anon, authenticated;
revoke execute on function v31_set_route_status(uuid,text) from public, anon, authenticated;
grant execute on function v31_is_admin() to authenticated;
grant execute on function v31_admin_overview() to authenticated;
grant execute on function v31_cancel_pending_booking(uuid) to authenticated;
grant execute on function v31_cancel_trip_request(uuid) to authenticated;
grant execute on function v31_create_route_draft(text,text,smallint,text,text,time without time zone,time without time zone,boolean,integer,jsonb) to authenticated;
grant execute on function v31_reserve_seats(uuid,smallint,uuid) to authenticated;
grant execute on function v31_reserve_seats_with_stops(uuid,smallint,uuid,uuid,uuid,boolean) to authenticated;
grant execute on function v31_accept_trip_offer(uuid) to authenticated;
grant execute on function v31_set_route_status(uuid,text) to authenticated;
insert into public.v31_service_areas(id,name_ar,name_en,region,active) values(1,'المعادي','Maadi','Cairo',true);
insert into public.v31_service_areas(id,name_ar,name_en,region,active) values(2,'التجمع','New Cairo','Cairo',true);
insert into public.v31_service_areas(id,name_ar,name_en,region,active) values(3,'مدينة نصر','Nasr City','Cairo',true);
insert into public.v31_service_areas(id,name_ar,name_en,region,active) values(4,'الدقي','Dokki','Giza',true);
insert into public.v31_service_areas(id,name_ar,name_en,region,active) values(5,'المهندسين','Mohandessin','Giza',true);
insert into public.v31_service_areas(id,name_ar,name_en,region,active) values(6,'الزمالك','Zamalek','Cairo',true);
insert into public.v31_service_areas(id,name_ar,name_en,region,active) values(7,'الشيخ زايد','Sheikh Zayed','Giza',true);
insert into public.v31_service_areas(id,name_ar,name_en,region,active) values(8,'6 أكتوبر','6th of October','Giza',true);
insert into public.v31_service_areas(id,name_ar,name_en,region,active) values(9,'مصر الجديدة','Heliopolis','Cairo',true);
