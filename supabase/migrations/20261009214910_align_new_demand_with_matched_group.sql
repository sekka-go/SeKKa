-- A request can join an already matched group when the published line has spare seats.
-- Mark that new request as matched after the BEFORE trigger assigned the group.
CREATE OR REPLACE FUNCTION public.sekka_match_after_demand_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public.sekka_match_demand_group(NEW.demand_group_id);
  UPDATE public.demand_requests r
     SET status = 'matched'
   WHERE r.id = NEW.id
     AND r.status = 'open'
     AND EXISTS (
       SELECT 1 FROM public.demand_groups g
        WHERE g.id = r.demand_group_id AND g.status = 'matched'
     );
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.sekka_match_after_demand_insert() FROM PUBLIC, anon, authenticated;
