-- Manual rollback for the fresh SeKKa Supabase baseline.
-- This intentionally refuses to run once any user/operational rows exist.
DO $guard$
DECLARE
  table_name text;
  has_rows boolean;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users','sessions','captain_profiles','otp_challenges','daily_commute_requests',
    'matches','trips','trip_stops','payments','payment_status_events',
    'pool_groups','pool_members','pool_subscriptions','pool_trips','pool_trip_stops',
    'pool_ledger','pool_trip_cancellations','pool_captain_stats','pool_captain_capabilities',
    'pool_notifications','pool_captain_escrows','pool_captain_escrow_transfers',
    'push_subscriptions','api_rate_limits'
  ] LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)', table_name) INTO has_rows;
    IF has_rows THEN
      RAISE EXCEPTION 'Rollback refused: public.% contains operational data', table_name;
    END IF;
  END LOOP;
END
$guard$;

DROP TABLE IF EXISTS public.pool_captain_escrow_transfers;
DROP TABLE IF EXISTS public.pool_captain_escrows;
DROP TABLE IF EXISTS public.push_subscriptions;
DROP TABLE IF EXISTS public.pool_notifications;
DROP TABLE IF EXISTS public.pool_captain_capabilities;
DROP TABLE IF EXISTS public.pool_captain_stats;
DROP TABLE IF EXISTS public.pool_trip_cancellations;
DROP TABLE IF EXISTS public.pool_ledger;
DROP TABLE IF EXISTS public.pool_trip_stops;
DROP TABLE IF EXISTS public.pool_trips;
DROP TABLE IF EXISTS public.pool_subscriptions;
DROP TABLE IF EXISTS public.pool_members;
DROP TABLE IF EXISTS public.pool_groups;
DROP TABLE IF EXISTS public.pool_categories;
DROP TABLE IF EXISTS public.payment_status_events;
DROP TABLE IF EXISTS public.payments;
DROP TABLE IF EXISTS public.pricing_config;
DROP TABLE IF EXISTS public.trip_stops;
DROP TABLE IF EXISTS public.trips;
DROP TABLE IF EXISTS public.matches;
DROP TABLE IF EXISTS public.daily_commute_requests;
DROP TABLE IF EXISTS public.otp_challenges;
DROP TABLE IF EXISTS public.captain_profiles;
DROP TABLE IF EXISTS public.sessions;
DROP TABLE IF EXISTS public.service_categories;
DROP TABLE IF EXISTS public.vehicle_types;
DROP TABLE IF EXISTS public.api_rate_limits;
DROP TABLE IF EXISTS public.users;

DROP FUNCTION IF EXISTS public.sekka_take_rate_limit(text,integer,integer);
DROP FUNCTION IF EXISTS public.sekka_require_role();
DROP FUNCTION IF EXISTS public.sekka_validate_vehicle_capacity();
DROP FUNCTION IF EXISTS public.sekka_match_guard();
DROP FUNCTION IF EXISTS public.sekka_match_creates_trip();
DROP FUNCTION IF EXISTS public.sekka_trip_stop_order();
DROP FUNCTION IF EXISTS public.sekka_trip_complete_guard();
DROP FUNCTION IF EXISTS public.sekka_append_only();
DROP FUNCTION IF EXISTS public.sekka_payment_guard();
DROP FUNCTION IF EXISTS public.sekka_captain_verification_noop();
