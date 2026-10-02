-- Make the service-role-only access explicit and index the optional audit actor.
CREATE POLICY app_feature_flags_service_role_all
  ON public.app_feature_flags
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
CREATE INDEX idx_app_feature_flags_updated_by_user_id
  ON public.app_feature_flags (updated_by_user_id);
