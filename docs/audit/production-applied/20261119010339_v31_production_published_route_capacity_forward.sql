-- Applied to seKKa Production as the reviewed, additive migration
-- 20261119010339. Its public function reads ONLY aggregate remaining seats
-- for published routes. No existing rows or schemas were dropped.
-- Staging had this same RPC contract before the Production application.
CREATE FUNCTION public.v31_published_route_available_seats(p_route uuid)
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
  WHERE r.id = p_route AND r.status = 'published'
$$;

REVOKE ALL ON FUNCTION public.v31_published_route_available_seats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v31_published_route_available_seats(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.v31_published_route_available_seats(uuid)
IS 'Aggregate remaining seats of a published route; reservation RPC rechecks capacity atomically. No rider details.';
