BEGIN;
SELECT plan(13);

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.captain_line_join_requests'::regclass), 'line join requests have RLS enabled');
SELECT ok(NOT has_table_privilege('anon', 'public.captain_line_join_requests', 'SELECT'), 'anonymous users cannot read line join requests');
SELECT ok(NOT has_table_privilege('authenticated', 'public.captain_line_join_requests', 'SELECT'), 'clients cannot bypass the API to read line join requests');
SELECT ok(has_table_privilege('service_role', 'public.captain_line_join_requests', 'SELECT'), 'the API service can read line join requests');
SELECT ok(NOT has_function_privilege('anon', 'public.create_captain_line_join_request(integer,integer,date,text,double precision,double precision,text,double precision,double precision,integer,text)', 'EXECUTE'), 'anonymous users cannot create line join requests');
SELECT ok(NOT has_function_privilege('authenticated', 'public.create_captain_line_join_request(integer,integer,date,text,double precision,double precision,text,double precision,double precision,integer,text)', 'EXECUTE'), 'clients cannot bypass the API to create line join requests');
SELECT ok(has_function_privilege('service_role', 'public.create_captain_line_join_request(integer,integer,date,text,double precision,double precision,text,double precision,double precision,integer,text)', 'EXECUTE'), 'the API service can create line join requests');
SELECT ok(NOT has_function_privilege('authenticated', 'public.decide_captain_line_join_request(integer,bigint,text,text)', 'EXECUTE'), 'clients cannot bypass the API to decide line join requests');
SELECT ok(has_function_privilege('service_role', 'public.decide_captain_line_join_request(integer,bigint,text,text)', 'EXECUTE'), 'the API service can decide line join requests');
SELECT ok(NOT has_function_privilege('authenticated', 'public.expire_captain_line_join_requests()', 'EXECUTE'), 'clients cannot manually expire join requests');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='captain_line_join_requests' AND column_name='expires_at'), 'join requests have a server-managed expiry');

SELECT throws_ok(
  $$SELECT public.create_captain_line_join_request(-1, -1, (now() AT TIME ZONE 'Africa/Cairo')::date + 1, 'pickup', 30, 31, 'dropoff', 30.1, 31.1, 1)$$,
  '42501', 'verified rider required', 'a caller cannot create a request for another role or user'
);

SELECT lives_ok($test$
DO $fixture$
DECLARE
  captain_id integer; rider_id integer; second_rider_id integer; wrong_captain_id integer;
  service_date date; service_day smallint; line_row public.captain_lines%ROWTYPE;
  first_request public.captain_line_join_requests%ROWTYPE;
  second_request public.captain_line_join_requests%ROWTYPE;
BEGIN
  service_date := (now() AT TIME ZONE 'Africa/Cairo')::date + 1;
  service_day := extract(dow FROM service_date)::smallint;
  INSERT INTO public.users(full_name, phone_number, password_hash, role, verified_at)
    VALUES ('Join request captain', '01199991201', 'test-only-hash', 'captain', now()) RETURNING id INTO captain_id;
  INSERT INTO public.captain_profiles(user_id, vehicle_type_id, license_number, vehicle_plate, verification_status)
    VALUES (captain_id, 'daily', 'join-request-license', 'join-request-plate', 'approved');
  INSERT INTO public.users(full_name, phone_number, password_hash, role, verified_at)
    VALUES ('Join request rider', '01199991202', 'test-only-hash', 'rider', now()) RETURNING id INTO rider_id;
  INSERT INTO public.users(full_name, phone_number, password_hash, role, verified_at)
    VALUES ('Second join rider', '01199991203', 'test-only-hash', 'rider', now()) RETURNING id INTO second_rider_id;
  INSERT INTO public.users(full_name, phone_number, password_hash, role, verified_at)
    VALUES ('Wrong line captain', '01199991204', 'test-only-hash', 'captain', now()) RETURNING id INTO wrong_captain_id;

  SELECT * INTO line_row FROM public.publish_captain_line(
    captain_id, 'daily', 'Join request origin', 30.0, 31.0, 'Join request destination', 30.1, 31.1,
    '[]'::jsonb, '08:00'::time, ARRAY[service_day], 1, 20, 50, ARRAY['cash']::text[], NULL
  );
  SELECT * INTO first_request FROM public.create_captain_line_join_request(
    rider_id, line_row.id, service_date, 'Join request origin', 30.0, 31.0,
    'Join request destination', 30.1, 31.1, 1
  );
  IF first_request.status <> 'pending' THEN RAISE EXCEPTION 'request should start pending'; END IF;
  PERFORM public.decide_captain_line_join_request(captain_id, first_request.id, 'accepted', NULL);

  SELECT * INTO second_request FROM public.create_captain_line_join_request(
    second_rider_id, line_row.id, service_date, 'Join request origin', 30.0, 31.0,
    'Join request destination', 30.1, 31.1, 1
  );
  BEGIN
    PERFORM public.decide_captain_line_join_request(captain_id, second_request.id, 'accepted', NULL);
    RAISE EXCEPTION 'expected capacity rejection';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  BEGIN
    PERFORM public.decide_captain_line_join_request(wrong_captain_id, second_request.id, 'rejected', NULL);
    RAISE EXCEPTION 'expected owner rejection';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF (SELECT status FROM public.captain_line_join_requests WHERE id=second_request.id) <> 'pending' THEN RAISE EXCEPTION 'a failed decision must not change the request'; END IF;
  BEGIN
    UPDATE public.captain_lines SET status='paused' WHERE id=line_row.id;
    RAISE EXCEPTION 'expected accepted-rider line guard';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    NULL;
  END;
END
$fixture$;
$test$, 'requests are captain-decided, capacity-safe, owner-checked, and protect accepted lines');

SELECT * FROM finish();
ROLLBACK;
