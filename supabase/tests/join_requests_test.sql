BEGIN;

DO $$
DECLARE
  captain_id integer;
  other_captain_id integer;
  rider_id integer;
  second_rider_id integer;
  own_line_id integer;
  line_id integer;
  request_row public.captain_line_join_requests%ROWTYPE;
  duplicate_row public.captain_line_join_requests%ROWTYPE;
  expired_row public.captain_line_join_requests%ROWTYPE;
  conversation_id bigint;
  service_date date := timezone('Africa/Cairo', now())::date + 14;
  service_day smallint;
BEGIN
  service_day := extract(dow FROM service_date::timestamp)::smallint;
  INSERT INTO public.vehicle_types (id, name_ar, capacity_max)
  VALUES ('join-test', 'نوع اختبار', 13);

  INSERT INTO public.users (full_name, phone_number, password_hash, role, verified_at)
  VALUES ('Test Captain', 'join-test-captain-' || gen_random_uuid(), 'test-hash', 'captain', now())
  RETURNING id INTO captain_id;
  INSERT INTO public.users (full_name, phone_number, password_hash, role, verified_at)
  VALUES ('Other Captain', 'join-test-other-captain-' || gen_random_uuid(), 'test-hash', 'captain', now())
  RETURNING id INTO other_captain_id;
  INSERT INTO public.users (full_name, phone_number, password_hash, role, verified_at)
  VALUES ('Test Rider', 'join-test-rider-' || gen_random_uuid(), 'test-hash', 'rider', now())
  RETURNING id INTO rider_id;
  INSERT INTO public.users (full_name, phone_number, password_hash, role, verified_at)
  VALUES ('Second Rider', 'join-test-second-rider-' || gen_random_uuid(), 'test-hash', 'rider', now())
  RETURNING id INTO second_rider_id;

  INSERT INTO public.captain_profiles (user_id, vehicle_type_id, license_number, vehicle_plate, verification_status, status)
  VALUES (captain_id, 'join-test', 'test-license-' || captain_id, 'test-plate-' || captain_id, 'approved', 'active');
  INSERT INTO public.captain_profiles (user_id, vehicle_type_id, license_number, vehicle_plate, verification_status, status)
  VALUES (other_captain_id, 'join-test', 'test-license-' || other_captain_id, 'test-plate-' || other_captain_id, 'approved', 'active');

  INSERT INTO public.captain_lines (
    captain_user_id, vehicle_type_id, origin_label, origin_lat, origin_lng,
    destination_label, destination_lat, destination_lng, arrival_time,
    return_arrival_time, service_days, seats, route_distance_km, price_per_km,
    price_per_seat, payment_methods
  ) VALUES (
    captain_id, 'join-test', 'Test Origin', 30.04, 31.23,
    'Test Destination', 30.05, 31.24, '10:00', '18:00',
    ARRAY[service_day], 2, 2, 0, 10, ARRAY['cash']
  ) RETURNING id INTO line_id;

  INSERT INTO public.captain_lines (
    captain_user_id, vehicle_type_id, origin_label, origin_lat, origin_lng,
    destination_label, destination_lat, destination_lng, arrival_time,
    return_arrival_time, service_days, seats, route_distance_km, price_per_km,
    price_per_seat, payment_methods
  ) VALUES (
    rider_id, 'join-test', 'Own Origin', 30.04, 31.23,
    'Own Destination', 30.05, 31.24, '10:00', '18:00',
    ARRAY[service_day], 2, 2, 0, 10, ARRAY['cash']
  ) RETURNING id INTO own_line_id;

  request_row := public.create_join_request(rider_id, line_id, service_date, 'outbound', 1, 'test note');
  IF request_row.status <> 'pending' OR request_row.note <> 'test note' THEN
    RAISE EXCEPTION 'create join request assertion failed';
  END IF;

  duplicate_row := public.create_join_request(rider_id, line_id, service_date, 'outbound', 1, 'different note');
  IF duplicate_row.id <> request_row.id THEN
    RAISE EXCEPTION 'active request idempotency assertion failed';
  END IF;

  BEGIN
    PERFORM public.create_join_request(rider_id, own_line_id, service_date, 'outbound', 1, NULL);
    RAISE EXCEPTION 'expected self-join rejection';
  EXCEPTION WHEN SQLSTATE 'PJR02' THEN
    NULL;
  END;

  BEGIN
    PERFORM public.create_join_request(rider_id, line_id, service_date + 1, 'outbound', 1, NULL);
    RAISE EXCEPTION 'expected service-day rejection';
  EXCEPTION WHEN SQLSTATE 'PJR04' THEN
    NULL;
  END;

  BEGIN
    PERFORM public.create_join_request(rider_id, line_id, service_date - 21, 'outbound', 1, NULL);
    RAISE EXCEPTION 'expected past-date rejection';
  EXCEPTION WHEN SQLSTATE 'PJR04' THEN
    NULL;
  END;

  request_row := public.decide_join_request(captain_id, request_row.id, 'accept');
  IF request_row.status <> 'accepted' THEN
    RAISE EXCEPTION 'captain accept assertion failed';
  END IF;
  SELECT conversation.id INTO conversation_id
  FROM public.message_conversations AS conversation
  WHERE conversation.participant_low_id = LEAST(captain_id, rider_id)
    AND conversation.participant_high_id = GREATEST(captain_id, rider_id);
  IF conversation_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.direct_message_contact_ids(rider_id) AS contact WHERE contact.contact_user_id = captain_id)
     OR NOT EXISTS (SELECT 1 FROM public.direct_message_contact_ids(captain_id) AS contact WHERE contact.contact_user_id = rider_id) THEN
    RAISE EXCEPTION 'accepted join request messaging assertion failed';
  END IF;

  BEGIN
    PERFORM public.create_join_request(second_rider_id, line_id, service_date, 'outbound', 2, NULL);
    RAISE EXCEPTION 'expected insufficient-capacity rejection';
  EXCEPTION WHEN SQLSTATE 'PJR05' THEN
    NULL;
  END;

  request_row := public.cancel_join_request(rider_id, request_row.id);
  IF request_row.status <> 'cancelled' OR NOT EXISTS (
    SELECT 1 FROM public.pool_notifications AS notice
    WHERE notice.user_id = captain_id AND notice.event_key = 'join-request:cancelled-by-rider:' || request_row.id
  ) THEN
    RAISE EXCEPTION 'accepted request cancellation or captain notification assertion failed';
  END IF;

  duplicate_row := public.create_join_request(second_rider_id, line_id, service_date, 'outbound', 1, NULL);
  BEGIN
    PERFORM public.decide_join_request(other_captain_id, duplicate_row.id, 'accept');
    RAISE EXCEPTION 'expected non-owner decision rejection';
  EXCEPTION WHEN SQLSTATE 'PJR07' THEN
    NULL;
  END;
  duplicate_row := public.decide_join_request(captain_id, duplicate_row.id, 'reject');
  IF duplicate_row.status <> 'rejected' THEN
    RAISE EXCEPTION 'captain reject assertion failed';
  END IF;

  duplicate_row := public.create_join_request(second_rider_id, line_id, service_date, 'return', 1, NULL);
  BEGIN
    PERFORM public.cancel_join_request(rider_id, duplicate_row.id);
    RAISE EXCEPTION 'expected non-owner cancellation rejection';
  EXCEPTION WHEN SQLSTATE 'PJR07' THEN
    NULL;
  END;
  duplicate_row := public.cancel_join_request(second_rider_id, duplicate_row.id);
  IF duplicate_row.status <> 'cancelled' THEN
    RAISE EXCEPTION 'rider cancellation assertion failed';
  END IF;

  duplicate_row := public.create_join_request(second_rider_id, line_id, service_date, 'outbound', 1, NULL);
  UPDATE public.captain_line_join_requests
  SET expires_at = now() - interval '1 minute'
  WHERE id = duplicate_row.id;
  expired_row := public.decide_join_request(captain_id, duplicate_row.id, 'accept');
  IF expired_row.status <> 'expired' THEN
    RAISE EXCEPTION 'expired decision assertion failed';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.create_join_request(integer,integer,date,text,integer,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.create_join_request(integer,integer,date,text,integer,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.create_join_request(integer,integer,date,text,integer,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'join request function grants assertion failed';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.captain_line_join_requests'::regclass)
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'captain_line_join_requests')
     OR has_table_privilege('anon', 'public.captain_line_join_requests', 'SELECT')
     OR has_table_privilege('authenticated', 'public.captain_line_join_requests', 'SELECT') THEN
    RAISE EXCEPTION 'join request table RLS/grants assertion failed';
  END IF;
END;
$$;

ROLLBACK;
