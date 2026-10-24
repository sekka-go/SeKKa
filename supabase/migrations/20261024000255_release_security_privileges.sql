-- The matching helper is callable only from its SECURITY DEFINER trigger functions.
-- Remove an older service_role grant that survived the original PUBLIC/client revoke.
REVOKE ALL ON FUNCTION public.sekka_match_demand_group(integer)
  FROM PUBLIC, anon, authenticated, service_role;
