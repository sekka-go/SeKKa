-- Staging only. Preserve every existing offer-acceptance rule and state
-- transition while ensuring its NEW booking goes through the same
-- deterministic, atomic seat-price allocator as direct reservations.
-- Using the exact known SQL anchor avoids replacing audited validation with
-- a second divergent implementation. Fail closed if the original has changed.
do $$
declare
  old_source text;
  anchor text:=$anchor$VALUES(route.id,uid,request.seats,request.id,'pending') RETURNING id INTO booking;$anchor$;
  patched_source text;
begin
  select pg_get_functiondef('public.v31_accept_trip_offer(uuid)'::regprocedure)
    into old_source;
  if old_source is null then raise exception 'OFFER_ACCEPTANCE_FUNCTION_MISSING';end if;
  if position('v31_allocate_booking_seat_prices(booking)' in old_source)>0 then
    return;
  end if;
  if (length(old_source)-length(replace(old_source,anchor,'')))<>length(anchor) then
    raise exception 'OFFER_ACCEPTANCE_EXPECTED_ANCHOR_CHANGED';
  end if;
  patched_source:=replace(old_source,anchor,
    anchor||E'\n PERFORM public.v31_allocate_booking_seat_prices(booking);');
  execute patched_source;
end $$;
-- Re-state intended RPC permissions; internal seat-price allocator stays
-- inaccessible directly to anon and authenticated browser clients.
revoke all on function public.v31_accept_trip_offer(uuid) from public,anon;
grant execute on function public.v31_accept_trip_offer(uuid) to authenticated;
