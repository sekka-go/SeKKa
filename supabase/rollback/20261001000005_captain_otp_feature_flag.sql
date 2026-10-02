DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.app_feature_flags
    WHERE flag_name = 'captain_phone_otp' AND enabled = true
  ) THEN
    RAISE EXCEPTION 'Disable captain phone OTP in the admin panel before rolling back this migration.';
  END IF;
END $$;
DROP TABLE public.app_feature_flags;
