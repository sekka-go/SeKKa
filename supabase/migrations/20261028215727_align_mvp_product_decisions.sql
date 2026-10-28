-- Phase 1 MVP decisions: no automatic captain assignment, no platform
-- commission on new rides, and payment records only after captain confirmation.

ALTER TABLE public.pool_ledger
  ALTER COLUMN company_commission_rate SET DEFAULT 0;
UPDATE public.admin_system_settings
SET numeric_value = 0, updated_at = now()
WHERE setting_key = 'company_commission_rate';

CREATE OR REPLACE FUNCTION public.admin_set_commission_rate(p_actor_user_id integer,p_rate numeric,p_reason text)
RETURNS public.admin_system_settings
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE old_rate numeric; result public.admin_system_settings;
BEGIN
  PERFORM public.sekka_require_super_admin(p_actor_user_id);
  IF p_rate IS DISTINCT FROM 0 OR char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'MVP commission is fixed at zero; a new plan must be explicitly activated' USING ERRCODE='22023';
  END IF;
  SELECT numeric_value INTO old_rate FROM public.admin_system_settings WHERE setting_key='company_commission_rate';
  INSERT INTO public.admin_system_settings(setting_key,numeric_value,updated_by_user_id)
  VALUES('company_commission_rate',0,p_actor_user_id)
  ON CONFLICT (setting_key) DO UPDATE SET numeric_value=0,updated_by_user_id=excluded.updated_by_user_id,updated_at=now()
  RETURNING * INTO result;
  PERFORM public.admin_write_audit(p_actor_user_id,'config.commission_changed','system_setting','company_commission_rate',p_reason,
    jsonb_build_object('rate',old_rate),jsonb_build_object('rate',0));
  RETURN result;
END;
$$;

-- Keep legacy demand rows open. The rider's line discovery flow is the source
-- of candidate journeys; no trigger may attach one captain's line as a final match.
CREATE OR REPLACE FUNCTION public.sekka_match_demand_group(group_id integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  RETURN;
END;
$$;
REVOKE ALL ON FUNCTION public.sekka_match_demand_group(integer) FROM PUBLIC, anon, authenticated, service_role;

-- The captain confirms the amount actually received in a deliberate action.
-- A completed-trip ledger row alone does not create a payment confirmation.
CREATE OR REPLACE FUNCTION public.confirm_trip_payment(actor_id integer, trip_id integer, actual_amount numeric)
RETURNS public.payments
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE created public.payments%ROWTYPE;
BEGIN
  IF actual_amount IS NULL OR actual_amount <= 0 THEN
    RAISE EXCEPTION 'actual payment amount must be positive' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.trips t
    JOIN public.matches m ON m.id=t.match_id
    JOIN public.users u ON u.id=m.captain_user_id AND u.role='captain'
    WHERE t.id=trip_id AND t.status='completed' AND m.captain_user_id=actor_id
  ) THEN
    RAISE EXCEPTION 'assigned captain of a completed trip required' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.payments(trip_id,amount,reported_by_user_id)
  VALUES(trip_id,actual_amount,actor_id)
  RETURNING * INTO created;
  RETURN created;
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_trip_payment(integer,integer,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_trip_payment(integer,integer,numeric) TO service_role;

NOTIFY pgrst, 'reload schema';
