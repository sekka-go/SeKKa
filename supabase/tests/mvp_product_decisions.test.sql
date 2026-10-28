BEGIN;
SELECT plan(12);

SELECT is((SELECT capacity_max FROM public.vehicle_types WHERE id='prime'), 3, 'Prime is capped at three riders');
SELECT is((SELECT capacity_max FROM public.vehicle_types WHERE id='daily'), 4, 'Daily is capped at four riders');
SELECT is((SELECT capacity_max FROM public.vehicle_types WHERE id='space'), 9, 'Space is capped at nine riders');
SELECT is((SELECT capacity_max FROM public.vehicle_types WHERE id='max'), 13, 'Max is capped at thirteen riders');

SELECT is(
  (SELECT numeric_value FROM public.admin_system_settings WHERE setting_key='company_commission_rate'),
  0::numeric,
  'MVP commission setting is zero'
);
SELECT is(
  (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='pool_ledger' AND column_name='company_commission_rate'),
  '0'::text,
  'new pool ledger rows default to zero commission'
);
SELECT ok(NOT has_function_privilege('anon', 'public.confirm_trip_payment(integer,integer,numeric)', 'EXECUTE'), 'anon cannot confirm payment');
SELECT ok(NOT has_function_privilege('authenticated', 'public.confirm_trip_payment(integer,integer,numeric)', 'EXECUTE'), 'authenticated cannot bypass the API to confirm payment');
SELECT ok(has_function_privilege('service_role', 'public.confirm_trip_payment(integer,integer,numeric)', 'EXECUTE'), 'the authenticated API service can record captain confirmation');
SELECT throws_ok(
  $$SELECT public.confirm_trip_payment(-1, -1, 10)$$,
  '42501',
  'assigned captain of a completed trip required',
  'a non-owner cannot record a payment'
);
SELECT throws_ok(
  $$SELECT public.confirm_trip_payment(-1, -1, 0)$$,
  '22023',
  'actual payment amount must be positive',
  'zero is not a valid actual payment amount'
);

SELECT lives_ok($test$
DO $fixture$
DECLARE captain_id integer; rider_id integer; today date; day_of_week smallint; request_row public.demand_requests%ROWTYPE; line_row public.captain_lines%ROWTYPE;
BEGIN
  today := (now() AT TIME ZONE 'Africa/Cairo')::date;
  day_of_week := extract(dow FROM today)::smallint;
  INSERT INTO public.users(full_name, phone_number, password_hash, role, verified_at)
  VALUES ('MVP matching captain', '01199991101', 'test-only-hash', 'captain', now()) RETURNING id INTO captain_id;
  INSERT INTO public.captain_profiles(user_id, vehicle_type_id, license_number, vehicle_plate, verification_status)
  VALUES (captain_id, 'daily', 'test-license-mvp', 'test-plate-mvp', 'approved');
  INSERT INTO public.users(full_name, phone_number, password_hash, role, verified_at)
  VALUES ('MVP matching rider', '01199991102', 'test-only-hash', 'rider', now()) RETURNING id INTO rider_id;

  SELECT * INTO request_row FROM public.create_demand_request(
    rider_id, 'daily', today, '08:00'::time, 'MVP origin', 30.0, 31.0, 'MVP destination', 30.1, 31.1, 1
  );
  SELECT * INTO line_row FROM public.publish_captain_line(
    captain_id, 'daily', 'MVP origin', 30.0, 31.0, 'MVP destination', 30.1, 31.1,
    '[]'::jsonb, '08:00'::time, ARRAY[day_of_week], 4, 50, 20, ARRAY['cash']::text[]
  );
  IF (SELECT status FROM public.demand_groups WHERE id=request_row.demand_group_id) <> 'open'
     OR (SELECT captain_line_id FROM public.demand_groups WHERE id=request_row.demand_group_id) IS NOT NULL
     OR (SELECT status FROM public.demand_requests WHERE id=request_row.id) <> 'open' THEN
    RAISE EXCEPTION 'new matching requests must stay open for rider choice';
  END IF;
END
$fixture$;
$test$, 'new lines remain suggestions and do not automatically assign open demand');

SELECT * FROM finish();
ROLLBACK;
