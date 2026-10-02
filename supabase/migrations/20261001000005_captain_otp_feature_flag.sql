-- Keep captain phone verification dormant until an administrator enables it.
CREATE TABLE public.app_feature_flags (
  flag_name text PRIMARY KEY CHECK (flag_name IN ('captain_phone_otp')),
  enabled boolean NOT NULL DEFAULT false,
  updated_by_user_id integer REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_feature_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_feature_flags FROM anon, authenticated;
GRANT ALL ON TABLE public.app_feature_flags TO service_role;
INSERT INTO public.app_feature_flags (flag_name, enabled)
VALUES ('captain_phone_otp', false)
ON CONFLICT (flag_name) DO NOTHING;
