CREATE INDEX IF NOT EXISTS idx_user_verifications_reviewed_by
  ON public.user_verifications(reviewed_by);
