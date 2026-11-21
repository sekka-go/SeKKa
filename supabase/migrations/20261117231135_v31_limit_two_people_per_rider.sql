-- seKKa v3.1 — maximum of two people per rider, per route.
-- Staging-only rollout until explicit Production approval.
-- Existing trip requests above two seats are preserved: this INSERT / seats-update
-- guard does not rewrite old requests and does not block cancellation.
-- Every NEW booking (including accepted offers) is restricted to <= 2 seats.
-- Across active bookings on the same route an account may hold at most 2 seats.
create or replace function public.v31_guard_two_rider_seats()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare already_reserved integer;
begin
  if new.seats is null or new.seats < 1 or new.seats > 2 then
    raise exception 'RIDER_MAX_TWO_SEATS' using errcode='23514';
  end if;
  if new.status in ('pending','confirmed') then
    -- Route row serializes concurrent reservations and offer acceptances;
    -- both normal RPC paths already lock this row before insertion.
    perform 1 from public.v31_routes where id=new.route_id for update;
    select coalesce(sum(b.seats),0) into already_reserved
      from public.v31_bookings b
      where b.route_id=new.route_id
        and b.rider_id=new.rider_id
        and b.status in ('pending','confirmed')
        and b.id is distinct from new.id;
    if already_reserved+new.seats>2 then
      raise exception 'RIDER_MAX_TWO_SEATS_PER_ROUTE' using errcode='23514';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists v31_guard_two_rider_seats on public.v31_bookings;
create trigger v31_guard_two_rider_seats
before insert or update of seats,route_id,rider_id,status
on public.v31_bookings
for each row execute function public.v31_guard_two_rider_seats();

create or replace function public.v31_guard_two_request_seats()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.seats is null or new.seats < 1 or new.seats > 2 then
    raise exception 'RIDER_MAX_TWO_SEATS' using errcode='23514';
  end if;
  return new;
end $$;

drop trigger if exists v31_guard_two_request_seats on public.v31_trip_requests;
create trigger v31_guard_two_request_seats
before insert or update of seats
on public.v31_trip_requests
for each row execute function public.v31_guard_two_request_seats();

revoke all on function public.v31_guard_two_rider_seats() from public,anon,authenticated;
revoke all on function public.v31_guard_two_request_seats() from public,anon,authenticated;
