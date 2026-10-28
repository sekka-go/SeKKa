-- Append-only, low-PII history for captain line and auto-matching lifecycle changes.
-- Existing admin_audit_logs remains the record for explicit administrative actions.
CREATE TABLE public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id integer REFERENCES public.users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'captain_line.created', 'captain_line.lifecycle_changed',
    'demand_group.created', 'demand_group.lifecycle_changed',
    'demand_request.created', 'demand_request.lifecycle_changed'
  )),
  resource_type text NOT NULL CHECK (resource_type IN ('captain_line','demand_group','demand_request')),
  resource_id integer NOT NULL,
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(before_state) = 'object'
    AND before_state - ARRAY['status','captain_line_id','demand_group_id','seats']::text[] = '{}'::jsonb
  ),
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(after_state) = 'object'
    AND after_state - ARRAY['status','captain_line_id','demand_group_id','seats']::text[] = '{}'::jsonb
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_idx ON public.audit_log(created_at DESC, id DESC);
CREATE INDEX audit_log_resource_idx ON public.audit_log(resource_type, resource_id, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.audit_log FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.audit_log TO service_role;
CREATE POLICY audit_log_deny_client_access ON public.audit_log
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Only trigger code may write audit rows. The payload is intentionally limited
-- to lifecycle identifiers and statuses; route labels and coordinates stay out.
CREATE OR REPLACE FUNCTION public.sekka_capture_lifecycle_audit()
RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  new_row jsonb := to_jsonb(NEW);
  old_row jsonb;
  actor_id integer;
  event_name text;
  resource_name text;
  before_payload jsonb := '{}'::jsonb;
  after_payload jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    old_row := to_jsonb(OLD);
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'captain_lines' THEN
      resource_name := 'captain_line';
      actor_id := (new_row->>'captain_user_id')::integer;
      after_payload := jsonb_build_object('status', new_row->'status');
      IF TG_OP = 'INSERT' THEN
        event_name := 'captain_line.created';
      ELSE
        IF old_row->'status' IS NOT DISTINCT FROM new_row->'status' THEN RETURN NEW; END IF;
        event_name := 'captain_line.lifecycle_changed';
        before_payload := jsonb_build_object('status', old_row->'status');
      END IF;

    WHEN 'demand_groups' THEN
      resource_name := 'demand_group';
      after_payload := jsonb_build_object(
        'status', new_row->'status',
        'captain_line_id', new_row->'captain_line_id'
      );
      IF TG_OP = 'INSERT' THEN
        event_name := 'demand_group.created';
      ELSE
        IF old_row->'status' IS NOT DISTINCT FROM new_row->'status'
           AND old_row->'captain_line_id' IS NOT DISTINCT FROM new_row->'captain_line_id' THEN
          RETURN NEW;
        END IF;
        event_name := 'demand_group.lifecycle_changed';
        before_payload := jsonb_build_object(
          'status', old_row->'status',
          'captain_line_id', old_row->'captain_line_id'
        );
      END IF;

    WHEN 'demand_requests' THEN
      resource_name := 'demand_request';
      actor_id := (new_row->>'rider_user_id')::integer;
      after_payload := jsonb_build_object(
        'status', new_row->'status',
        'demand_group_id', new_row->'demand_group_id',
        'seats', new_row->'seats'
      );
      IF TG_OP = 'INSERT' THEN
        event_name := 'demand_request.created';
      ELSE
        IF old_row->'status' IS NOT DISTINCT FROM new_row->'status'
           AND old_row->'demand_group_id' IS NOT DISTINCT FROM new_row->'demand_group_id' THEN
          RETURN NEW;
        END IF;
        event_name := 'demand_request.lifecycle_changed';
        before_payload := jsonb_build_object(
          'status', old_row->'status',
          'demand_group_id', old_row->'demand_group_id',
          'seats', old_row->'seats'
        );
      END IF;

    ELSE
      RAISE EXCEPTION 'unsupported audit source table: %', TG_TABLE_NAME USING ERRCODE = '22023';
  END CASE;

  INSERT INTO public.audit_log(actor_user_id, event_type, resource_type, resource_id, before_state, after_state)
  VALUES (actor_id, event_name, resource_name, (new_row->>'id')::integer, before_payload, after_payload);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sekka_capture_lifecycle_audit() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER audit_captain_lines_lifecycle
  AFTER INSERT OR UPDATE OF status ON public.captain_lines
  FOR EACH ROW EXECUTE FUNCTION public.sekka_capture_lifecycle_audit();
CREATE TRIGGER audit_demand_groups_lifecycle
  AFTER INSERT OR UPDATE OF status, captain_line_id ON public.demand_groups
  FOR EACH ROW EXECUTE FUNCTION public.sekka_capture_lifecycle_audit();
CREATE TRIGGER audit_demand_requests_lifecycle
  AFTER INSERT OR UPDATE OF status, demand_group_id ON public.demand_requests
  FOR EACH ROW EXECUTE FUNCTION public.sekka_capture_lifecycle_audit();

CREATE OR REPLACE FUNCTION public.sekka_audit_log_append_only()
RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only' USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION public.sekka_audit_log_append_only() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER audit_log_no_change BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.sekka_audit_log_append_only();
