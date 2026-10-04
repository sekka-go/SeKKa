-- Verification uploads are mediated by sekka-api because this application
-- authenticates with hashed public.users sessions, not Supabase Auth JWTs.
-- Consequently Storage RLS denies direct client access; the Edge Function
-- enforces owner access and Super Admin review before using its server key.

ALTER TABLE public.captain_profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS grace_period_expires_at timestamptz;

ALTER TABLE public.captain_profiles
  DROP CONSTRAINT IF EXISTS captain_profiles_status_check;
ALTER TABLE public.captain_profiles
  ADD CONSTRAINT captain_profiles_status_check
  CHECK (status IN ('active','suspended_grace_expired'));

-- Existing captains receive one full review window from this migration.
UPDATE public.captain_profiles
SET grace_period_expires_at = now() + interval '30 days'
WHERE grace_period_expires_at IS NULL;
ALTER TABLE public.captain_profiles
  ALTER COLUMN grace_period_expires_at SET DEFAULT (now() + interval '30 days');

CREATE TABLE public.user_verifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN (
    'national_id_front','national_id_back',
    'driving_license_front','driving_license_back',
    'vehicle_license_front','vehicle_license_back',
    'criminal_record','drug_test'
  )),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  object_path text NOT NULL CHECK (char_length(object_path) BETWEEN 1 AND 512),
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp','application/pdf')),
  file_size_bytes integer NOT NULL CHECK (file_size_bytes BETWEEN 1 AND 8388608),
  rejection_reason text CHECK (rejection_reason IS NULL OR char_length(rejection_reason) <= 1000),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  UNIQUE(user_id,document_type),
  CHECK ((status='rejected' AND rejection_reason IS NOT NULL) OR status<>'rejected')
);
CREATE INDEX user_verifications_user_status_idx ON public.user_verifications(user_id,status);
CREATE INDEX user_verifications_review_queue_idx ON public.user_verifications(status,uploaded_at DESC);

CREATE TABLE public.telegram_phone_verification_challenges (
  token_hash text PRIMARY KEY CHECK (length(token_hash)=64),
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  telegram_user_id bigint,
  status text NOT NULL DEFAULT 'waiting_start' CHECK (status IN ('waiting_start','waiting_contact','verified','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  verified_at timestamptz
);
CREATE INDEX telegram_phone_verification_user_idx
  ON public.telegram_phone_verification_challenges(user_id,created_at DESC);

ALTER TABLE public.user_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_verifications FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.user_verifications TO service_role;
CREATE POLICY user_verifications_deny_client_access ON public.user_verifications
  AS RESTRICTIVE FOR ALL TO anon,authenticated USING (false) WITH CHECK (false);

ALTER TABLE public.telegram_phone_verification_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.telegram_phone_verification_challenges FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.telegram_phone_verification_challenges TO service_role;
CREATE POLICY telegram_phone_challenges_deny_client_access
  ON public.telegram_phone_verification_challenges AS RESTRICTIVE FOR ALL TO anon,authenticated
  USING (false) WITH CHECK (false);

GRANT USAGE,SELECT ON SEQUENCE public.user_verifications_id_seq TO service_role;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('verification-documents','verification-documents',false,8388608,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO UPDATE SET public=false,file_size_limit=8388608,
  allowed_mime_types=EXCLUDED.allowed_mime_types;

-- Direct Storage access is intentionally disabled for the app's custom
-- session tokens. The authenticated Edge Function performs scoped operations.
CREATE POLICY verification_documents_deny_direct_read ON storage.objects
  AS RESTRICTIVE FOR SELECT TO anon,authenticated
  USING (bucket_id='verification-documents' AND false);
CREATE POLICY verification_documents_deny_direct_insert ON storage.objects
  AS RESTRICTIVE FOR INSERT TO anon,authenticated
  WITH CHECK (bucket_id='verification-documents' AND false);
CREATE POLICY verification_documents_deny_direct_update ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO anon,authenticated
  USING (bucket_id='verification-documents' AND false)
  WITH CHECK (bucket_id='verification-documents' AND false);
CREATE POLICY verification_documents_deny_direct_delete ON storage.objects
  AS RESTRICTIVE FOR DELETE TO anon,authenticated
  USING (bucket_id='verification-documents' AND false);

CREATE OR REPLACE FUNCTION public.admin_review_user_verification(
  p_actor_user_id integer,
  p_verification_id bigint,
  p_status text,
  p_rejection_reason text DEFAULT NULL
) RETURNS public.user_verifications
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE result public.user_verifications; old_row public.user_verifications;
        target_role text; required_approved integer; deferred_approved integer;
BEGIN
  PERFORM public.sekka_require_super_admin(p_actor_user_id);
  IF p_status IS NULL OR p_status NOT IN ('approved','rejected') OR
     (p_status='rejected' AND char_length(btrim(coalesce(p_rejection_reason,''))) NOT BETWEEN 1 AND 1000) THEN
    RAISE EXCEPTION 'invalid verification decision' USING ERRCODE='22023';
  END IF;
  SELECT * INTO old_row FROM public.user_verifications WHERE id=p_verification_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'verification not found' USING ERRCODE='P0002'; END IF;
  SELECT role INTO target_role FROM public.users WHERE id=old_row.user_id;
  UPDATE public.user_verifications
  SET status=p_status,
      rejection_reason=CASE WHEN p_status='rejected' THEN btrim(p_rejection_reason) ELSE NULL END,
      reviewed_by=p_actor_user_id,reviewed_at=now()
  WHERE id=p_verification_id RETURNING * INTO result;

  IF target_role='captain' THEN
    SELECT count(*) INTO required_approved FROM public.user_verifications
    WHERE user_id=old_row.user_id AND status='approved'
      AND document_type IN ('national_id_front','national_id_back','driving_license_front',
        'driving_license_back','vehicle_license_front','vehicle_license_back');
    SELECT count(*) INTO deferred_approved FROM public.user_verifications
    WHERE user_id=old_row.user_id AND status='approved'
      AND document_type IN ('criminal_record','drug_test');
    UPDATE public.captain_profiles cp SET
      verification_status=CASE
        WHEN required_approved=6 AND EXISTS(SELECT 1 FROM public.users u WHERE u.id=cp.user_id AND u.verified_at IS NOT NULL) THEN 'approved'
        WHEN EXISTS(SELECT 1 FROM public.user_verifications v WHERE v.user_id=cp.user_id AND v.status='rejected'
          AND v.document_type IN ('national_id_front','national_id_back','driving_license_front','driving_license_back','vehicle_license_front','vehicle_license_back')) THEN 'rejected'
        ELSE 'pending' END,
      status=CASE WHEN required_approved=6 AND
        (cp.grace_period_expires_at>now() OR deferred_approved=2) THEN 'active' ELSE cp.status END
    WHERE cp.user_id=old_row.user_id;
  END IF;

  PERFORM public.admin_write_audit(p_actor_user_id,'verification.document_reviewed','user_verification',
    p_verification_id::text,p_rejection_reason,
    jsonb_build_object('status',old_row.status,'document_type',old_row.document_type),
    jsonb_build_object('status',result.status,'user_id',result.user_id));
  INSERT INTO public.pool_notifications(user_id,group_id,event_key,payload)
  VALUES(result.user_id,NULL,'verification-reviewed:'||result.id||':'||result.reviewed_at::text,
    jsonb_build_object('title','تحديث توثيق المستندات','message',CASE WHEN p_status='approved'
      THEN 'تم قبول المستند. يمكنك مراجعة حالة التوثيق من حسابك.'
      ELSE 'يحتاج المستند إلى إعادة رفع. راجع سبب الرفض في صفحة التوثيق.' END))
  ON CONFLICT (user_id,event_key) DO NOTHING;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_review_user_verification(integer,bigint,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_user_verification(integer,bigint,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.sekka_sync_captain_verification_after_phone()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF OLD.verified_at IS NULL AND NEW.verified_at IS NOT NULL AND NEW.role='captain' THEN
    UPDATE public.captain_profiles cp SET verification_status='approved'
    WHERE cp.user_id=NEW.id
      AND EXISTS (
        SELECT 1 FROM public.user_verifications v WHERE v.user_id=NEW.id
          AND v.status='approved'
          AND v.document_type IN ('national_id_front','national_id_back','driving_license_front',
            'driving_license_back','vehicle_license_front','vehicle_license_back')
        GROUP BY v.user_id HAVING count(*)=6
      );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sekka_sync_captain_verification_after_phone() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER users_sync_captain_verification_after_phone
AFTER UPDATE OF verified_at ON public.users
FOR EACH ROW EXECUTE FUNCTION public.sekka_sync_captain_verification_after_phone();

CREATE OR REPLACE FUNCTION public.sekka_suspend_captains_with_expired_document_grace()
RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE suspended_count integer;
BEGIN
  WITH suspended AS (
    UPDATE public.captain_profiles cp SET status='suspended_grace_expired'
    WHERE cp.status='active' AND cp.grace_period_expires_at<=now()
      AND NOT EXISTS (
        SELECT 1 FROM public.user_verifications v
        WHERE v.user_id=cp.user_id
          AND v.document_type IN ('criminal_record','drug_test')
        GROUP BY v.user_id
        HAVING count(*) FILTER (WHERE v.status='approved')=2
      )
    RETURNING cp.user_id
  )
  INSERT INTO public.pool_notifications(user_id,group_id,event_key,payload)
  SELECT user_id,NULL,'captain-verification-grace-expired:'||user_id,
    jsonb_build_object('title','تم إيقاف استقبال الرحلات مؤقتًا',
      'message','انتهت مهلة رفع واعتماد الفيش والتشبيه وتحليل المخدرات. أكمل المستندات وتواصل مع الدعم لإعادة التفعيل.')
  FROM suspended ON CONFLICT (user_id,event_key) DO NOTHING;
  GET DIAGNOSTICS suspended_count = ROW_COUNT;
  RETURN suspended_count;
END;
$$;
REVOKE ALL ON FUNCTION public.sekka_suspend_captains_with_expired_document_grace()
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sekka_suspend_captains_with_expired_document_grace() TO postgres;

-- Supabase-managed pg_cron must be enabled for the project before applying this migration.

DO $$
DECLARE job record;
BEGIN
  FOR job IN SELECT jobid FROM cron.job WHERE jobname='sekka-captain-verification-grace'
  LOOP PERFORM cron.unschedule(job.jobid); END LOOP;
  PERFORM cron.schedule('sekka-captain-verification-grace','0 * * * *',
    'SELECT public.sekka_suspend_captains_with_expired_document_grace()');
END;
$$;
