#!/usr/bin/env bash
set -euo pipefail

container="supabase_db_sekka"
if ! docker ps --format '{{.Names}}' | grep -Fxq "$container"; then
  printf '%s\n' 'Local Supabase database container is not running. Start it with `npx supabase start`.' >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
captain_id=""
rider_one_id=""
rider_two_id=""
line_id=""
request_one_id=""
request_two_id=""

psql_local() {
  docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"
}

cleanup() {
  if [[ -n "$line_id" ]]; then
    psql_local -c "DELETE FROM public.captain_lines WHERE id = $line_id;" >/dev/null 2>&1 || true
  fi
  if [[ -n "$captain_id$rider_one_id$rider_two_id" ]]; then
    psql_local -c "DELETE FROM public.users WHERE id IN (${captain_id:-0}, ${rider_one_id:-0}, ${rider_two_id:-0});" >/dev/null 2>&1 || true
  fi
  psql_local -c "DELETE FROM public.vehicle_types WHERE id = 'join-test-concurrency';" >/dev/null 2>&1 || true
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

psql_local -c "INSERT INTO public.vehicle_types (id, name_ar, capacity_max) VALUES ('join-test-concurrency', 'نوع اختبار تزامن', 1) ON CONFLICT (id) DO UPDATE SET capacity_max = 1;" >/dev/null
fixture="$(psql_local -At -F '|' <<'SQL'
WITH captain AS (
  INSERT INTO public.users (full_name, phone_number, password_hash, role, verified_at)
  VALUES ('Concurrency Captain', 'join-test-c-' || gen_random_uuid(), 'test-hash', 'captain', now())
  RETURNING id
), rider_one AS (
  INSERT INTO public.users (full_name, phone_number, password_hash, role, verified_at)
  VALUES ('Concurrency Rider One', 'join-test-r1-' || gen_random_uuid(), 'test-hash', 'rider', now())
  RETURNING id
), rider_two AS (
  INSERT INTO public.users (full_name, phone_number, password_hash, role, verified_at)
  VALUES ('Concurrency Rider Two', 'join-test-r2-' || gen_random_uuid(), 'test-hash', 'rider', now())
  RETURNING id
), profile AS (
  INSERT INTO public.captain_profiles (user_id, vehicle_type_id, license_number, vehicle_plate, verification_status, status)
  SELECT id, 'join-test-concurrency', 'test-license-' || id, 'test-plate-' || id, 'approved', 'active' FROM captain
  RETURNING user_id
), line AS (
  INSERT INTO public.captain_lines (
    captain_user_id, vehicle_type_id, origin_label, origin_lat, origin_lng,
    destination_label, destination_lat, destination_lng, arrival_time,
    service_days, seats, route_distance_km, price_per_km, price_per_seat, payment_methods
  )
  SELECT captain.id, 'join-test-concurrency', 'Concurrency Origin', 30.04, 31.23,
    'Concurrency Destination', 30.05, 31.24, '23:59',
    ARRAY[extract(dow FROM (current_date + 14)::timestamp)::smallint], 1, 2, 0, 10, ARRAY['cash']
  FROM captain
  RETURNING id
)
SELECT captain.id, rider_one.id, rider_two.id, line.id, (current_date + 14)::date
FROM captain, rider_one, rider_two, line, profile;
SQL
)"
IFS='|' read -r captain_id rider_one_id rider_two_id line_id trip_date <<< "$fixture"

request_one_id="$(psql_local -At -c "SELECT (public.create_join_request($rider_one_id, $line_id, '$trip_date', 'outbound', 1, NULL)).id;")"
request_two_id="$(psql_local -At -c "SELECT (public.create_join_request($rider_two_id, $line_id, '$trip_date', 'outbound', 1, NULL)).id;")"

sql_one="BEGIN; SELECT id FROM public.captain_lines WHERE id = $line_id FOR UPDATE; SELECT pg_sleep(1); SELECT status FROM public.decide_join_request($captain_id, $request_one_id, 'accept'); COMMIT;"
sql_two="BEGIN; SELECT id FROM public.captain_lines WHERE id = $line_id FOR UPDATE; SELECT pg_sleep(1); SELECT status FROM public.decide_join_request($captain_id, $request_two_id, 'accept'); COMMIT;"
psql_local -c "$sql_one" >"$tmp_dir/one.out" 2>&1 &
pid_one=$!
psql_local -c "$sql_two" >"$tmp_dir/two.out" 2>&1 &
pid_two=$!
set +e
wait "$pid_one"
result_one=$?
wait "$pid_two"
result_two=$?
set -e

if [[ ! ( ( "$result_one" -eq 0 && "$result_two" -ne 0 ) || ( "$result_one" -ne 0 && "$result_two" -eq 0 ) ) ]]; then
  printf '%s\n' 'FAIL: expected exactly one concurrent acceptance to succeed.' >&2
  cat "$tmp_dir/one.out" "$tmp_dir/two.out" >&2
  exit 1
fi

accepted_count="$(psql_local -At -c "SELECT count(*) FROM public.captain_line_join_requests WHERE line_id = $line_id AND trip_date = '$trip_date' AND direction = 'outbound' AND status = 'accepted';")"
if [[ "$accepted_count" != "1" ]]; then
  printf 'FAIL: expected one accepted request, found %s.\n' "$accepted_count" >&2
  exit 1
fi
printf '%s\n' 'PASS: two local psql sessions raced for the last seat; exactly one acceptance succeeded.'
