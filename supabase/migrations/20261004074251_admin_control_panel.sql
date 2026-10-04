-- A separate, explicit Super Admin allow-list protects operational controls.
-- The browser never receives a service-role credential; requests arrive only
-- through the authenticated Edge Function, which checks this table per request.
CREATE TABLE public.super_admins (
  user_id integer PRIMARY KEY REFERENCES public.users(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by_user_id integer REFERENCES public.users(id) ON DELETE SET NULL,
  note text NOT NULL DEFAULT 'Bootstrap super administrator'
);

-- Bootstrap the single configured owner account. Later grants are explicit
-- database changes; ordinary admin roles are not automatically elevated.
INSERT INTO public.super_admins(user_id, note)
SELECT id, 'Owner account configured for SeKKa operations'
FROM public.users
WHERE regexp_replace(phone_number, '[^0-9]', '', 'g') IN ('01101002429','201101002429') AND role = 'admin'
ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE public.admin_user_controls (
  user_id integer PRIMARY KEY REFERENCES public.users(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('active','suspended','banned')),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 1000),
  updated_by_user_id integer NOT NULL REFERENCES public.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.admin_audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id integer NOT NULL REFERENCES public.users(id),
  action text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 100),
  resource_type text NOT NULL CHECK (char_length(resource_type) BETWEEN 1 AND 80),
  resource_id text,
  reason text CHECK (reason IS NULL OR char_length(reason) <= 1000),
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(before_state)='object'),
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(after_state)='object'),
  request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_logs_created_idx ON public.admin_audit_logs(created_at DESC, id DESC);
CREATE INDEX admin_audit_logs_resource_idx ON public.admin_audit_logs(resource_type, resource_id, created_at DESC);

CREATE TABLE public.admin_trip_actions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trip_kind text NOT NULL CHECK (trip_kind IN ('daily','pool')),
  trip_id integer NOT NULL,
  action text NOT NULL CHECK (action IN ('cancelled','captain_reassigned')),
  reason_tag text NOT NULL CHECK (char_length(btrim(reason_tag)) BETWEEN 1 AND 80),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 1000),
  actor_user_id integer NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_trip_actions_trip_idx ON public.admin_trip_actions(trip_kind, trip_id, created_at DESC);

-- pool_ledger is append-only. Corrections are separate signed adjustments.
CREATE TABLE public.admin_ledger_adjustments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trip_kind text NOT NULL CHECK (trip_kind IN ('daily','pool')),
  trip_id integer NOT NULL,
  member_id integer REFERENCES public.pool_members(id),
  amount numeric(12,2) NOT NULL CHECK (amount <> 0 AND abs(amount) <= 1000000),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 1000),
  actor_user_id integer NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_ledger_adjustments_trip_idx ON public.admin_ledger_adjustments(trip_kind, trip_id, created_at DESC);

CREATE TABLE public.admin_system_settings (
  setting_key text PRIMARY KEY CHECK (setting_key IN ('company_commission_rate')),
  numeric_value numeric(7,6) NOT NULL CHECK (numeric_value BETWEEN 0 AND 1),
  updated_by_user_id integer NOT NULL REFERENCES public.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.admin_system_settings(setting_key,numeric_value,updated_by_user_id)
SELECT 'company_commission_rate',0.20,id FROM public.users
WHERE regexp_replace(phone_number, '[^0-9]', '', 'g') IN ('01101002429','201101002429') AND role='admin'
ON CONFLICT (setting_key) DO NOTHING;

-- Trip cancellation becomes an explicit terminal state for the daily workflow.
ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_status_check;
ALTER TABLE public.trips ADD CONSTRAINT trips_status_check CHECK (status IN ('in_progress','completed','cancelled'));

CREATE OR REPLACE FUNCTION public.sekka_is_super_admin(p_user_id integer)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins sa
    JOIN public.users u ON u.id=sa.user_id
    WHERE sa.user_id=p_user_id AND u.role='admin'
  );
$$;
REVOKE ALL ON FUNCTION public.sekka_is_super_admin(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sekka_is_super_admin(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.sekka_require_super_admin(p_actor_user_id integer)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.sekka_is_super_admin(p_actor_user_id) THEN
    RAISE EXCEPTION 'super admin required' USING ERRCODE='42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.sekka_require_super_admin(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sekka_require_super_admin(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_write_audit(
  p_actor_user_id integer,
  p_action text,
  p_resource_type text,
  p_resource_id text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_before jsonb DEFAULT '{}'::jsonb,
  p_after jsonb DEFAULT '{}'::jsonb,
  p_request_id uuid DEFAULT NULL
) RETURNS bigint
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE audit_id bigint;
BEGIN
  PERFORM public.sekka_require_super_admin(p_actor_user_id);
  INSERT INTO public.admin_audit_logs(actor_user_id,action,resource_type,resource_id,reason,before_state,after_state,request_id)
  VALUES(p_actor_user_id,left(p_action,100),left(p_resource_type,80),p_resource_id,left(p_reason,1000),coalesce(p_before,'{}'::jsonb),coalesce(p_after,'{}'::jsonb),p_request_id)
  RETURNING id INTO audit_id;
  RETURN audit_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_write_audit(integer,text,text,text,text,jsonb,jsonb,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_write_audit(integer,text,text,text,text,jsonb,jsonb,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_set_user_status(
  p_actor_user_id integer, p_target_user_id integer, p_status text, p_reason text
) RETURNS public.admin_user_controls
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE old_status text; result public.admin_user_controls;
BEGIN
  PERFORM public.sekka_require_super_admin(p_actor_user_id);
  IF p_status IS NULL OR p_status NOT IN ('active','suspended','banned') OR char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'invalid status or reason' USING ERRCODE='22023';
  END IF;
  IF p_target_user_id=p_actor_user_id OR EXISTS (SELECT 1 FROM public.super_admins WHERE user_id=p_target_user_id) THEN
    RAISE EXCEPTION 'cannot change a super administrator account' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id=p_target_user_id) THEN
    RAISE EXCEPTION 'user not found' USING ERRCODE='P0002';
  END IF;
  SELECT status INTO old_status FROM public.admin_user_controls WHERE user_id=p_target_user_id;
  INSERT INTO public.admin_user_controls(user_id,status,reason,updated_by_user_id)
  VALUES(p_target_user_id,p_status,btrim(p_reason),p_actor_user_id)
  ON CONFLICT (user_id) DO UPDATE SET status=excluded.status,reason=excluded.reason,
    updated_by_user_id=excluded.updated_by_user_id,updated_at=now()
  RETURNING * INTO result;
  INSERT INTO public.pool_notifications(user_id,group_id,event_key,payload)
  VALUES(p_target_user_id,NULL,'admin-account-status:'||result.updated_at::text,
    jsonb_build_object('title','تحديث حالة الحساب','message',CASE p_status WHEN 'active' THEN 'تمت إعادة تفعيل حسابك.' WHEN 'suspended' THEN 'تم إيقاف حسابك مؤقتًا. تواصل مع خدمة العملاء للمساعدة.' ELSE 'تم إيقاف حسابك. تواصل مع خدمة العملاء للمساعدة.' END))
  ON CONFLICT (user_id,event_key) DO NOTHING;
  PERFORM public.admin_write_audit(p_actor_user_id,'user.status_changed','user',p_target_user_id::text,p_reason,
    jsonb_build_object('status',coalesce(old_status,'active')),
    jsonb_build_object('status',p_status));
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_user_status(integer,integer,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(integer,integer,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_add_ledger_adjustment(
  p_actor_user_id integer,p_trip_kind text,p_trip_id integer,p_member_id integer,p_amount numeric,p_reason text
) RETURNS public.admin_ledger_adjustments
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE result public.admin_ledger_adjustments;
BEGIN
  PERFORM public.sekka_require_super_admin(p_actor_user_id);
  IF p_trip_kind NOT IN ('daily','pool') OR p_trip_id<=0 OR p_amount=0 OR abs(p_amount)>1000000
      OR char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'invalid ledger adjustment' USING ERRCODE='22023';
  END IF;
  IF p_trip_kind='daily' AND NOT EXISTS (SELECT 1 FROM public.trips WHERE id=p_trip_id) THEN
    RAISE EXCEPTION 'trip not found' USING ERRCODE='P0002';
  ELSIF p_trip_kind='pool' AND NOT EXISTS (SELECT 1 FROM public.pool_trips WHERE id=p_trip_id) THEN
    RAISE EXCEPTION 'pool trip not found' USING ERRCODE='P0002';
  END IF;
  IF p_trip_kind='daily' AND p_member_id IS NOT NULL THEN
    RAISE EXCEPTION 'daily trips do not use pool members' USING ERRCODE='22023';
  ELSIF p_trip_kind='pool' AND p_member_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.pool_trips t JOIN public.pool_members m ON m.group_id=t.group_id
    WHERE t.id=p_trip_id AND m.id=p_member_id
  ) THEN
    RAISE EXCEPTION 'member is not part of this trip' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.admin_ledger_adjustments(trip_kind,trip_id,member_id,amount,reason,actor_user_id)
  VALUES(p_trip_kind,p_trip_id,p_member_id,p_amount,btrim(p_reason),p_actor_user_id) RETURNING * INTO result;
  PERFORM public.admin_write_audit(p_actor_user_id,'ledger.adjusted','trip',p_trip_kind||':'||p_trip_id,p_reason,
    '{}'::jsonb,jsonb_build_object('amount',p_amount,'member_id',p_member_id));
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_add_ledger_adjustment(integer,text,integer,integer,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_ledger_adjustment(integer,text,integer,integer,numeric,text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_set_commission_rate(p_actor_user_id integer,p_rate numeric,p_reason text)
RETURNS public.admin_system_settings
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE old_rate numeric; result public.admin_system_settings;
BEGIN
  PERFORM public.sekka_require_super_admin(p_actor_user_id);
  IF p_rate IS NULL OR p_rate<0 OR p_rate>1 OR char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'invalid commission rate or reason' USING ERRCODE='22023'; END IF;
  SELECT numeric_value INTO old_rate FROM public.admin_system_settings WHERE setting_key='company_commission_rate';
  INSERT INTO public.admin_system_settings(setting_key,numeric_value,updated_by_user_id)
  VALUES('company_commission_rate',p_rate,p_actor_user_id)
  ON CONFLICT (setting_key) DO UPDATE SET numeric_value=excluded.numeric_value,updated_by_user_id=excluded.updated_by_user_id,updated_at=now()
  RETURNING * INTO result;
  PERFORM public.admin_write_audit(p_actor_user_id,'config.commission_changed','system_setting','company_commission_rate',p_reason,
    jsonb_build_object('rate',old_rate),jsonb_build_object('rate',p_rate));
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_commission_rate(integer,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_commission_rate(integer,numeric,text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_audit_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN RAISE EXCEPTION '% is append-only',TG_TABLE_NAME USING ERRCODE='55000'; END;
$$;
REVOKE ALL ON FUNCTION public.admin_audit_append_only() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER admin_audit_no_change BEFORE UPDATE OR DELETE ON public.admin_audit_logs
FOR EACH ROW EXECUTE FUNCTION public.admin_audit_append_only();
CREATE TRIGGER admin_trip_actions_no_change BEFORE UPDATE OR DELETE ON public.admin_trip_actions
FOR EACH ROW EXECUTE FUNCTION public.admin_audit_append_only();
CREATE TRIGGER admin_ledger_adjustments_no_change BEFORE UPDATE OR DELETE ON public.admin_ledger_adjustments
FOR EACH ROW EXECUTE FUNCTION public.admin_audit_append_only();

-- Keep all control-plane data unavailable through the public Data API.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['super_admins','admin_user_controls','admin_audit_logs','admin_trip_actions','admin_ledger_adjustments','admin_system_settings'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated',table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM service_role',table_name);
    IF table_name IN ('admin_audit_logs','admin_trip_actions','admin_ledger_adjustments') THEN
      EXECUTE format('GRANT SELECT, INSERT ON TABLE public.%I TO service_role',table_name);
    ELSIF table_name='super_admins' THEN
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO service_role',table_name);
    ELSE
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE public.%I TO service_role',table_name);
    END IF;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',table_name || '_deny_client_access',table_name);
  END LOOP;
END;
$$;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
