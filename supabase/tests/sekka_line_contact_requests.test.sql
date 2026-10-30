BEGIN;
SELECT plan(10);

CREATE TEMP TABLE line_contact_fixture AS
SELECT gen_random_uuid() AS fixture_key;

INSERT INTO public.users (full_name, phone_number, password_hash, role, verified_at)
SELECT 'Contact rider ' || fixture_key, 'contact-rider-' || fixture_key, 'not-a-real-password-hash', 'rider', now()
FROM line_contact_fixture;
INSERT INTO public.users (full_name, phone_number, password_hash, role, verified_at)
SELECT 'Contact captain ' || fixture_key, 'contact-captain-' || fixture_key, 'not-a-real-password-hash', 'captain', now()
FROM line_contact_fixture;
INSERT INTO public.users (full_name, phone_number, password_hash, role, verified_at)
SELECT 'Contact non-rider ' || fixture_key, 'contact-admin-' || fixture_key, 'not-a-real-password-hash', 'admin', now()
FROM line_contact_fixture;

INSERT INTO public.captain_profiles (user_id, vehicle_type_id, license_number, vehicle_plate, verification_status, status)
SELECT captain.id, 'daily', 'TEST-' || fixture_key, 'TEST-' || fixture_key, 'approved', 'active'
FROM public.users captain CROSS JOIN line_contact_fixture fixture
WHERE captain.full_name = 'Contact captain ' || fixture.fixture_key;

INSERT INTO public.captain_lines (
  captain_user_id, vehicle_type_id, origin_label, origin_lat, origin_lng,
  destination_label, destination_lat, destination_lng, arrival_time,
  service_days, seats, price_per_seat, route_distance_km, price_per_km, status
)
SELECT captain.id, 'daily', 'Test origin', 30.04, 31.23,
  'Test destination', 30.05, 31.24, '08:00', ARRAY[1,2,3,4,5]::smallint[],
  4, 20, 5, 8, 'active'
FROM public.users captain CROSS JOIN line_contact_fixture fixture
WHERE captain.full_name = 'Contact captain ' || fixture.fixture_key;

INSERT INTO public.captain_lines (
  captain_user_id, vehicle_type_id, origin_label, origin_lat, origin_lng,
  destination_label, destination_lat, destination_lng, arrival_time,
  service_days, seats, price_per_seat, route_distance_km, price_per_km, status
)
SELECT captain.id, 'daily', 'Paused origin ' || fixture.fixture_key, 30.04, 31.23,
  'Paused destination', 30.05, 31.24, '08:00', ARRAY[1,2,3,4,5]::smallint[],
  4, 20, 5, 8, 'paused'
FROM public.users captain CROSS JOIN line_contact_fixture fixture
WHERE captain.full_name = 'Contact captain ' || fixture.fixture_key;

CREATE TEMP TABLE line_contact_result AS
SELECT (result.value->'request'->>'id')::bigint AS request_id,
       (result.value->'request'->>'conversation_id')::bigint AS conversation_id,
       result.value->'request'->>'status' AS status,
       (result.value->>'created')::boolean AS created,
       rider.id AS rider_id, captain.id AS captain_id, line.id AS line_id
FROM public.users rider
CROSS JOIN public.users captain
CROSS JOIN public.captain_lines line
CROSS JOIN line_contact_fixture fixture
CROSS JOIN LATERAL (SELECT public.create_line_contact_request(rider.id, line.id) AS value) result
WHERE rider.full_name = 'Contact rider ' || fixture.fixture_key
  AND captain.full_name = 'Contact captain ' || fixture.fixture_key
  AND line.captain_user_id = captain.id AND line.status = 'active';

SELECT is((SELECT status FROM line_contact_result), 'contact_requested', 'new linked request has the backend contact state');
SELECT is((SELECT created FROM line_contact_result), true, 'first submission is identified as a new request');
SELECT ok((SELECT c.id = result.conversation_id
  FROM public.message_conversations c CROSS JOIN line_contact_result result
  WHERE c.id = result.conversation_id), 'request creates its direct conversation atomically');
SELECT is((SELECT (public.create_line_contact_request(rider_id, line_id)->'request'->>'id')::bigint FROM line_contact_result),
  (SELECT request_id FROM line_contact_result), 'retries return the same request instead of duplicating it');
SELECT is((SELECT (public.create_line_contact_request(rider_id, line_id)->>'created')::boolean FROM line_contact_result),
  false, 'retry response distinguishes the previously saved request');
SELECT is((SELECT seats FROM public.captain_lines line JOIN line_contact_result result ON result.line_id = line.id),
  4, 'contact requests do not reserve seats or alter offer capacity');
SELECT ok((SELECT result.captain_id = ANY(ARRAY(SELECT contact_user_id FROM public.direct_message_contact_ids(result.rider_id))) FROM line_contact_result result),
  'rider may contact the captain for this linked offer');
SELECT ok((SELECT result.rider_id = ANY(ARRAY(SELECT contact_user_id FROM public.direct_message_contact_ids(result.captain_id))) FROM line_contact_result result),
  'captain contact list includes the requesting rider');
SELECT throws_ok(
  $$SELECT public.create_line_contact_request(
    (SELECT rider.id FROM public.users rider CROSS JOIN line_contact_fixture fixture WHERE rider.full_name = 'Contact rider ' || fixture.fixture_key),
    (SELECT line.id FROM public.captain_lines line CROSS JOIN line_contact_fixture fixture WHERE line.status = 'paused' AND line.origin_label = 'Paused origin ' || fixture.fixture_key)
  )$$,
  '55000', 'offer is not available for contact', 'paused offer rejects a new contact request'
);
SELECT throws_ok(
  $$SELECT public.create_line_contact_request(
    (SELECT admin_user.id FROM public.users admin_user CROSS JOIN line_contact_fixture fixture WHERE admin_user.full_name = 'Contact non-rider ' || fixture.fixture_key),
    (SELECT line_id FROM line_contact_result)
  )$$,
  '42501', 'rider is not eligible', 'non-rider cannot create an offer contact request'
);

SELECT * FROM finish();
ROLLBACK;
