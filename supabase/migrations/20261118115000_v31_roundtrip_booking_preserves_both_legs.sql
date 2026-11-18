-- Preserve published round-trip terms in actual saved reservations.
-- Staging-first. No historical rows are changed; book one capacity allocation
-- for a two-leg subscription, not two separate seat allocations.
alter table public.v31_bookings drop constraint if exists v31_bookings_booked_direction_check;
alter table public.v31_bookings add constraint v31_bookings_booked_direction_check
 check (booked_direction in ('outbound','return','round_trip'));

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
  if v_route.direction='round_trip' then
   if not v_route.return_supported or v_route.return_time is null
    or not v_from.dropoff_allowed or not v_to.pickup_allowed then
    raise exception 'ROUND_TRIP_RETURN_STOPS_UNSUPPORTED';
   end if;
   v_direction:='round_trip';
  else
   v_direction:='outbound';
  end if;
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
end $function$;

-- Original SECURITY DEFINER ownership, authorization and route locking stay
-- unchanged, with a server-side return-leg stop validation added above.
revoke all on function public.v31_reserve_seats_with_stops(uuid,smallint,uuid,uuid,uuid,boolean) from public,anon;
grant execute on function public.v31_reserve_seats_with_stops(uuid,smallint,uuid,uuid,uuid,boolean) to authenticated;
