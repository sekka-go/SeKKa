BEGIN;
SELECT plan(18);

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.audit_log'::regclass), 'audit_log has RLS enabled');
SELECT ok(NOT has_table_privilege('anon', 'public.audit_log', 'SELECT'), 'anon cannot read audit_log');
SELECT ok(NOT has_table_privilege('authenticated', 'public.audit_log', 'SELECT'), 'authenticated cannot read audit_log');
SELECT ok(NOT has_table_privilege('anon', 'public.audit_log', 'INSERT'), 'anon cannot write audit_log');
SELECT ok(NOT has_table_privilege('authenticated', 'public.audit_log', 'INSERT'), 'authenticated cannot write audit_log');
SELECT ok(has_table_privilege('service_role', 'public.audit_log', 'SELECT'), 'service_role can read audit_log');
SELECT ok(NOT has_table_privilege('service_role', 'public.audit_log', 'INSERT'), 'audit rows are written only by triggers');
SELECT ok(NOT has_table_privilege('service_role', 'public.audit_log', 'UPDATE'), 'service_role cannot update audit rows');
SELECT ok(NOT has_table_privilege('service_role', 'public.audit_log', 'DELETE'), 'service_role cannot delete audit rows');
SELECT ok(NOT has_function_privilege('anon', 'public.sekka_capture_lifecycle_audit()', 'EXECUTE'), 'anon cannot call the audit trigger function');
SELECT ok(NOT has_function_privilege('authenticated', 'public.sekka_capture_lifecycle_audit()', 'EXECUTE'), 'authenticated cannot call the audit trigger function');
SELECT ok(NOT has_function_privilege('service_role', 'public.sekka_capture_lifecycle_audit()', 'EXECUTE'), 'service_role cannot call the audit trigger function directly');
SELECT ok(EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.captain_lines'::regclass AND tgname = 'audit_captain_lines_lifecycle' AND NOT tgisinternal), 'captain line lifecycle trigger is installed');
SELECT ok(EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.demand_groups'::regclass AND tgname = 'audit_demand_groups_lifecycle' AND NOT tgisinternal), 'demand group lifecycle trigger is installed');
SELECT ok(EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.demand_requests'::regclass AND tgname = 'audit_demand_requests_lifecycle' AND NOT tgisinternal), 'demand request lifecycle trigger is installed');
SELECT ok(EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.audit_log'::regclass AND tgname = 'audit_log_no_change' AND NOT tgisinternal), 'audit log append-only trigger is installed');

SELECT lives_ok($test$
DO $audit_fixture$
DECLARE
  captain_id integer;
  rider_id integer;
  line_row public.captain_lines%ROWTYPE;
  request_row public.demand_requests%ROWTYPE;
BEGIN
  INSERT INTO public.users(full_name, phone_number, password_hash, role, verified_at)
  VALUES ('Audit fixture captain', '01199990001', 'test-only-hash', 'captain', now())
  RETURNING id INTO captain_id;

  INSERT INTO public.vehicle_types(id, name_ar, capacity_max)
  VALUES ('audit_test_vehicle', 'مركبة اختبار', 4);

  INSERT INTO public.captain_profiles(user_id, vehicle_type_id, license_number, vehicle_plate, verification_status)
  VALUES (captain_id, 'audit_test_vehicle', 'test-license', 'test-plate', 'approved');

  SELECT * INTO line_row FROM public.publish_captain_line(
    captain_id, 'audit_test_vehicle', 'Hidden origin label', 30.0, 31.0,
    'Hidden destination label', 30.1, 31.2, '[]'::jsonb, '08:00'::time,
    ARRAY[1]::smallint[], 4, 12.50, ARRAY['cash']::text[]
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.audit_log
    WHERE actor_user_id = captain_id
      AND event_type = 'captain_line.created'
      AND resource_id = line_row.id
      AND after_state = '{"status":"active"}'::jsonb
  ) THEN
    RAISE EXCEPTION 'captain line creation was not audited';
  END IF;

  PERFORM public.set_captain_line_status(captain_id, line_row.id, 'paused');

  IF NOT EXISTS (
    SELECT 1 FROM public.audit_log
    WHERE actor_user_id = captain_id
      AND event_type = 'captain_line.lifecycle_changed'
      AND resource_id = line_row.id
      AND before_state = '{"status":"active"}'::jsonb
      AND after_state = '{"status":"paused"}'::jsonb
  ) THEN
    RAISE EXCEPTION 'captain line status change was not audited';
  END IF;

  INSERT INTO public.users(full_name, phone_number, password_hash, role, verified_at)
  VALUES ('Audit fixture rider', '01199990002', 'test-only-hash', 'rider', now())
  RETURNING id INTO rider_id;

  SELECT * INTO request_row FROM public.create_demand_request(
    rider_id, 'audit_test_vehicle', (now() AT TIME ZONE 'Africa/Cairo')::date, '09:00'::time,
    'Hidden pickup label', 30.2, 31.3, 'Hidden dropoff label', 30.3, 31.4, 1
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.audit_log
    WHERE event_type = 'demand_group.created'
      AND resource_id = request_row.demand_group_id
      AND after_state->>'status' = 'open'
      AND after_state ? 'captain_line_id'
  ) THEN
    RAISE EXCEPTION 'automatic demand group creation was not audited';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.audit_log
    WHERE actor_user_id = rider_id
      AND event_type = 'demand_request.created'
      AND resource_id = request_row.id
      AND after_state->>'status' = 'open'
      AND after_state->>'demand_group_id' = request_row.demand_group_id::text
  ) THEN
    RAISE EXCEPTION 'demand request creation was not audited';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.audit_log
    WHERE before_state ?| ARRAY['origin_label','origin_lat','origin_lng','destination_label','destination_lat','destination_lng','pickup_label','pickup_lat','pickup_lng','dropoff_label','dropoff_lat','dropoff_lng']
       OR after_state ?| ARRAY['origin_label','origin_lat','origin_lng','destination_label','destination_lat','destination_lng','pickup_label','pickup_lat','pickup_lng','dropoff_label','dropoff_lat','dropoff_lng']
       OR before_state::text LIKE '%Hidden %'
       OR after_state::text LIKE '%Hidden %'
  ) THEN
    RAISE EXCEPTION 'audit payload contains route location data';
  END IF;
END;
$audit_fixture$;
$test$, 'captain line creation and status changes are audited without route location data');

SELECT throws_ok(
  $$UPDATE public.audit_log SET after_state = '{}'::jsonb WHERE id = (SELECT min(id) FROM public.audit_log)$$,
  '55000',
  'audit_log is append-only',
  'audit rows cannot be edited'
);

SELECT * FROM finish();
ROLLBACK;
