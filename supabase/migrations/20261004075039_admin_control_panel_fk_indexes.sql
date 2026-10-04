CREATE INDEX IF NOT EXISTS admin_audit_logs_actor_idx ON public.admin_audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS admin_ledger_adjustments_actor_idx ON public.admin_ledger_adjustments(actor_user_id);
CREATE INDEX IF NOT EXISTS admin_ledger_adjustments_member_idx ON public.admin_ledger_adjustments(member_id) WHERE member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS admin_system_settings_updated_by_idx ON public.admin_system_settings(updated_by_user_id);
CREATE INDEX IF NOT EXISTS admin_trip_actions_actor_idx ON public.admin_trip_actions(actor_user_id);
CREATE INDEX IF NOT EXISTS admin_user_controls_updated_by_idx ON public.admin_user_controls(updated_by_user_id);
CREATE INDEX IF NOT EXISTS super_admins_granted_by_idx ON public.super_admins(granted_by_user_id) WHERE granted_by_user_id IS NOT NULL;