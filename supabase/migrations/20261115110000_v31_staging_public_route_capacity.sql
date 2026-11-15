-- Staging-only migration until owner-authorized production release.
-- Reveals aggregate remaining seats for published routes, never booking identities.
-- Informational snapshot: v31_reserve_seats_with_stops remains the authority under a route lock.
CREATE OR REPLACE FUNCTION public.v31_published_route_available_seats(p_route uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT GREATEST(
    0,
    r.seat_capacity::integer - COALESCE((
      SELECT SUM(b.seats)::integer
      FROM public.v31_bookings AS b
      WHERE b.route_id = r.id
        AND b.status IN ('pending','confirmed')
    ), 0)
  )
  FROM public.v31_routes AS r
  WHERE r.id = p_route
    AND r.status = 'published'
$$;

REVOKE ALL ON FUNCTION public.v31_published_route_available_seats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v31_published_route_available_seats(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.v31_published_route_available_seats(uuid)
 IS 'Aggregate availability of published route; booking RPC atomically rechecks under route lock. No passenger details exposed.';
