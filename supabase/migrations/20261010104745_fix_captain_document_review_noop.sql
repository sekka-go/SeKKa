-- Allow individual captain documents to be reviewed while overall verification remains pending.
-- Prevent a second reviewer from overwriting a decision made while they waited
-- for the row lock. The existing RPC continues to own all audit, profile and
-- notification side effects.
CREATE OR REPLACE FUNCTION public.admin_review_user_verification(
  p_actor_user_id integer,
  p_verification_id bigint,
  p_status text,
  p_rejection_reason text DEFAULT NULL::text
)
RETURNS public.user_verifications
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  result public.user_verifications;
  old_row public.user_verifications;
  target_role text;
  required_approved integer;
  deferred_approved integer;
  next_verification_status text;
BEGIN
  PERFORM public.sekka_require_super_admin(p_actor_user_id);

  IF p_status IS NULL OR p_status NOT IN ('approved', 'rejected') OR
     (p_status = 'rejected' AND char_length(btrim(coalesce(p_rejection_reason, ''))) NOT BETWEEN 1 AND 1000) THEN
    RAISE EXCEPTION 'invalid verification decision' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO old_row
  FROM public.user_verifications
  WHERE id = p_verification_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'verification not found' USING ERRCODE = 'P0002';
  END IF;
  IF old_row.status <> 'pending' THEN
    RAISE EXCEPTION 'verification already reviewed' USING ERRCODE = '40001';
  END IF;

  SELECT role INTO target_role
  FROM public.users
  WHERE id = old_row.user_id;

  UPDATE public.user_verifications
  SET status = p_status,
      rejection_reason = CASE WHEN p_status = 'rejected' THEN btrim(p_rejection_reason) ELSE NULL END,
      reviewed_by = p_actor_user_id,
      reviewed_at = now()
  WHERE id = p_verification_id
  RETURNING * INTO result;

  IF target_role = 'captain' THEN
    SELECT count(*) INTO required_approved
    FROM public.user_verifications
    WHERE user_id = old_row.user_id
      AND status = 'approved'
      AND document_type IN (
        'national_id_front', 'national_id_back', 'driving_license_front',
        'driving_license_back', 'vehicle_license_front', 'vehicle_license_back'
      );

    SELECT count(*) INTO deferred_approved
    FROM public.user_verifications
    WHERE user_id = old_row.user_id
      AND status = 'approved'
      AND document_type IN ('criminal_record', 'drug_test');

    SELECT CASE
      WHEN required_approved = 6 AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = old_row.user_id AND u.verified_at IS NOT NULL
      ) THEN 'approved'
      WHEN EXISTS (
        SELECT 1 FROM public.user_verifications v
        WHERE v.user_id = old_row.user_id AND v.status = 'rejected'
          AND v.document_type IN (
            'national_id_front', 'national_id_back', 'driving_license_front',
            'driving_license_back', 'vehicle_license_front', 'vehicle_license_back'
          )
      ) THEN 'rejected'
      ELSE 'pending'
    END INTO next_verification_status;

    -- The captain_profiles trigger rejects no-op verification_status updates.
    -- An approved document often leaves the overall captain status pending, so
    -- only write the aggregate status when it actually changes.
    UPDATE public.captain_profiles
    SET verification_status = next_verification_status
    WHERE user_id = old_row.user_id
      AND verification_status IS DISTINCT FROM next_verification_status;

    IF required_approved = 6 AND EXISTS (
      SELECT 1 FROM public.captain_profiles cp
      WHERE cp.user_id = old_row.user_id
        AND (cp.grace_period_expires_at > now() OR deferred_approved = 2)
        AND cp.status IS DISTINCT FROM 'active'
    ) THEN
      UPDATE public.captain_profiles
      SET status = 'active'
      WHERE user_id = old_row.user_id
        AND status IS DISTINCT FROM 'active';
    END IF;
  END IF;
  PERFORM public.admin_write_audit(
    p_actor_user_id,
    'verification.document_reviewed',
    'user_verification',
    p_verification_id::text,
    p_rejection_reason,
    jsonb_build_object('status', old_row.status, 'document_type', old_row.document_type),
    jsonb_build_object('status', result.status, 'user_id', result.user_id)
  );

  INSERT INTO public.pool_notifications(user_id, group_id, event_key, payload)
  VALUES (
    result.user_id,
    NULL,
    'verification-reviewed:' || result.id || ':' || result.reviewed_at::text,
    jsonb_build_object(
      'title', 'تحديث توثيق المستندات',
      'message', CASE WHEN p_status = 'approved'
        THEN 'تم قبول المستند. يمكنك مراجعة حالة التوثيق من حسابك.'
        ELSE 'يحتاج المستند إلى إعادة رفع. راجع سبب الرفض في صفحة التوثيق.'
      END
    )
  )
  ON CONFLICT (user_id, event_key) DO NOTHING;

  RETURN result;
END;
$function$;

NOTIFY pgrst, 'reload schema';
