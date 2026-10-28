-- Keep trigger-only security-definer helpers out of PostgREST's callable RPC surface.
REVOKE ALL ON FUNCTION public.sekka_cluster_demand_request() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sekka_match_after_demand_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sekka_match_after_line_publish() FROM PUBLIC, anon, authenticated;

-- Pin the helper's object resolution path and cover the new foreign keys.
ALTER FUNCTION public.sekka_geo_km(double precision, double precision, double precision, double precision)
  SET search_path = pg_catalog, public;

CREATE INDEX IF NOT EXISTS demand_groups_captain_line_idx
  ON public.demand_groups(captain_line_id) WHERE captain_line_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS demand_requests_vehicle_type_idx
  ON public.demand_requests(vehicle_type_id);
