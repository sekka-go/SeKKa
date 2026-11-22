-- STAGING-only until separately reviewed and authorized for production.
-- Serialize repeat requests by route and recover the same booking if the
-- idempotency unique constraint wins a race across different route locks.
CREATE OR REPLACE FUNCTION public.v31_reserve_seats(
 p_route uuid,p_seats smallint,p_idempotency uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
 v_user uuid := (SELECT auth.uid());
 v_route public.v31_routes%rowtype;
 v_reserved integer;
 v_existing public.v31_bookings%rowtype;
 v_id uuid;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF p_seats IS NULL OR p_seats<1 OR p_seats>13 OR p_idempotency IS NULL
 THEN RAISE EXCEPTION 'INVALID_BOOKING'; END IF;

 SELECT * INTO v_existing FROM public.v31_bookings
 WHERE rider_id=v_user AND idempotency_key=p_idempotency;
 IF FOUND THEN
  IF v_existing.route_id<>p_route OR v_existing.seats<>p_seats
  THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
  IF v_existing.status='cancelled' THEN RAISE EXCEPTION 'BOOKING_ALREADY_CANCELLED'; END IF;
  RETURN v_existing.id;
 END IF;

 SELECT * INTO v_route FROM public.v31_routes WHERE id=p_route FOR UPDATE;
 IF NOT FOUND OR v_route.status<>'published' THEN RAISE EXCEPTION 'ROUTE_NOT_AVAILABLE'; END IF;
 IF v_route.captain_id=v_user THEN RAISE EXCEPTION 'CAPTAIN_CANNOT_BOOK_OWN_ROUTE'; END IF;

 -- Recheck after the route lock so concurrent retries on one route converge.
 SELECT * INTO v_existing FROM public.v31_bookings
 WHERE rider_id=v_user AND idempotency_key=p_idempotency;
 IF FOUND THEN
  IF v_existing.route_id<>p_route OR v_existing.seats<>p_seats
  THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
  IF v_existing.status='cancelled' THEN RAISE EXCEPTION 'BOOKING_ALREADY_CANCELLED'; END IF;
  RETURN v_existing.id;
 END IF;

 SELECT COALESCE(SUM(seats),0) INTO v_reserved FROM public.v31_bookings
 WHERE route_id=p_route AND status IN ('pending','confirmed');
 IF v_reserved+p_seats>v_route.seat_capacity THEN RAISE EXCEPTION 'INSUFFICIENT_SEATS'; END IF;

 INSERT INTO public.v31_bookings(route_id,rider_id,seats,idempotency_key,status)
 VALUES(p_route,v_user,p_seats,p_idempotency,'pending')
 ON CONFLICT (rider_id,idempotency_key) DO NOTHING
 RETURNING id INTO v_id;
 IF v_id IS NOT NULL THEN RETURN v_id; END IF;

 -- A concurrent request using the same key against a different route does
 -- not share the route lock; return its booking only for an identical request.
 SELECT * INTO v_existing FROM public.v31_bookings
 WHERE rider_id=v_user AND idempotency_key=p_idempotency FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'IDEMPOTENCY_RETRY_NOT_FOUND'; END IF;
 IF v_existing.route_id<>p_route OR v_existing.seats<>p_seats
 THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
 IF v_existing.status='cancelled' THEN RAISE EXCEPTION 'BOOKING_ALREADY_CANCELLED'; END IF;
 RETURN v_existing.id;
END
$function$;
