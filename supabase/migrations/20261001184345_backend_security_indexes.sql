-- Supabase hardening and FK indexes for the reviewed PostgreSQL baseline.
CREATE INDEX IF NOT EXISTS idx_captain_profiles_vehicle_type ON public.captain_profiles(vehicle_type_id);
CREATE INDEX IF NOT EXISTS idx_daily_requests_category ON public.daily_commute_requests(service_category_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_actor ON public.payment_status_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_payments_reporter ON public.payments(reported_by_user_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transfers_escrow ON public.pool_captain_escrow_transfers(escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transfers_original_captain ON public.pool_captain_escrow_transfers(original_captain_user_id);
CREATE INDEX IF NOT EXISTS idx_escrows_original_captain ON public.pool_captain_escrows(original_captain_user_id);
CREATE INDEX IF NOT EXISTS idx_pool_groups_category ON public.pool_groups(category_id);
CREATE INDEX IF NOT EXISTS idx_pool_groups_creator ON public.pool_groups(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_pool_groups_fixed_captain ON public.pool_groups(fixed_captain_user_id);
CREATE INDEX IF NOT EXISTS idx_pool_ledger_member ON public.pool_ledger(member_id);
CREATE INDEX IF NOT EXISTS idx_pool_notifications_group ON public.pool_notifications(group_id);
CREATE INDEX IF NOT EXISTS idx_pool_subscriptions_group ON public.pool_subscriptions(group_id);
CREATE INDEX IF NOT EXISTS idx_pool_cancellations_member ON public.pool_trip_cancellations(member_id);
CREATE INDEX IF NOT EXISTS idx_pool_stops_member ON public.pool_trip_stops(member_id);
CREATE INDEX IF NOT EXISTS idx_service_categories_vehicle_type ON public.service_categories(vehicle_type_id);
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('CREATE POLICY sekka_backend_only ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',t.tablename);
  END LOOP;
END $$;
