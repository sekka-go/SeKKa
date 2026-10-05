ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS privacy_version text;

CREATE TABLE public.telegram_password_reset_challenges (
  token_hash text PRIMARY KEY CHECK (length(token_hash) = 64),
  phone_hash text NOT NULL CHECK (length(phone_hash) = 64),
  telegram_user_id bigint,
  status text NOT NULL DEFAULT 'waiting_start'
    CHECK (status IN ('waiting_start', 'waiting_contact', 'code_sent', 'used', 'locked', 'expired')),
  code_hash text CHECK (code_hash IS NULL OR length(code_hash) = 64),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  used_at timestamptz
);

CREATE INDEX telegram_password_reset_phone_idx
  ON public.telegram_password_reset_challenges(phone_hash, created_at DESC);
CREATE INDEX telegram_password_reset_telegram_idx
  ON public.telegram_password_reset_challenges(telegram_user_id, created_at DESC)
  WHERE status = 'waiting_contact';

ALTER TABLE public.telegram_password_reset_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.telegram_password_reset_challenges FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.telegram_password_reset_challenges TO service_role;
CREATE POLICY telegram_password_reset_deny_client_access
  ON public.telegram_password_reset_challenges AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
