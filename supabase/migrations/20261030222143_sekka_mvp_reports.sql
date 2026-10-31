-- MVP reports are private operational records. All reads/writes go through the
-- authenticated sekka-api Edge Function; client roles receive no table access.
CREATE TABLE IF NOT EXISTS public.user_reports (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reporter_user_id integer NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  subject_type text NOT NULL CHECK (subject_type IN ('user', 'offer', 'behavior')),
  subject_user_id integer REFERENCES public.users(id) ON DELETE SET NULL,
  captain_line_id integer REFERENCES public.captain_lines(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('fraud', 'harassment', 'unsafe_behavior', 'misleading_offer', 'other')),
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 20 AND 5000),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'in_review', 'reviewed', 'closed')),
  resolution text CHECK (resolution IS NULL OR resolution IN ('violation_confirmed', 'no_violation', 'insufficient_evidence')),
  resolution_note text CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 2000),
  reviewed_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_reports_subject_shape CHECK (
    (subject_type = 'user' AND subject_user_id IS NOT NULL AND captain_line_id IS NULL)
    OR (subject_type = 'offer' AND captain_line_id IS NOT NULL AND subject_user_id IS NULL)
    OR (subject_type = 'behavior' AND (subject_user_id IS NOT NULL OR captain_line_id IS NOT NULL))
  ),
  CONSTRAINT user_reports_not_self CHECK (subject_user_id IS NULL OR subject_user_id <> reporter_user_id)
);

CREATE INDEX IF NOT EXISTS user_reports_reporter_recent_idx
  ON public.user_reports (reporter_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_reports_review_queue_idx
  ON public.user_reports (status, created_at ASC);
CREATE INDEX IF NOT EXISTS user_reports_subject_user_idx
  ON public.user_reports (subject_user_id, created_at DESC) WHERE subject_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS user_reports_subject_line_idx
  ON public.user_reports (captain_line_id, created_at DESC) WHERE captain_line_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.user_report_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id bigint NOT NULL REFERENCES public.user_reports(id) ON DELETE CASCADE,
  uploaded_by integer NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  object_path text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 5242880),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_report_evidence_report_idx
  ON public.user_report_evidence (report_id, created_at);

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_report_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_reports, public.user_report_evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_reports, public.user_report_evidence TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.user_reports_id_seq TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sekka-report-evidence', 'sekka-report-evidence', false, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.admin_review_user_report(
  p_actor_user_id integer,
  p_report_id bigint,
  p_status text,
  p_resolution text,
  p_resolution_note text,
  p_reason text,
  p_request_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_report public.user_reports%ROWTYPE;
  updated_report public.user_reports%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.super_admins s WHERE s.user_id = p_actor_user_id) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('in_review', 'reviewed', 'closed')
     OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 5 AND 1000
     OR (p_resolution IS NOT NULL AND p_resolution NOT IN ('violation_confirmed', 'no_violation', 'insufficient_evidence'))
     OR (p_status IN ('reviewed', 'closed') AND p_resolution IS NULL)
     OR (p_resolution_note IS NOT NULL AND char_length(p_resolution_note) > 2000) THEN
    RAISE EXCEPTION 'invalid review payload' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO current_report FROM public.user_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'report not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT (
    (current_report.status = 'submitted' AND p_status = 'in_review')
    OR (current_report.status = 'in_review' AND p_status IN ('reviewed', 'closed'))
    OR (current_report.status = 'reviewed' AND p_status = 'closed')
  ) THEN
    RAISE EXCEPTION 'invalid report state transition' USING ERRCODE = '55000';
  END IF;

  UPDATE public.user_reports SET
    status = p_status,
    resolution = COALESCE(p_resolution, resolution),
    resolution_note = COALESCE(p_resolution_note, resolution_note),
    reviewed_by = p_actor_user_id,
    reviewed_at = now(),
    updated_at = now()
  WHERE id = p_report_id
  RETURNING * INTO updated_report;

  INSERT INTO public.admin_audit_logs (
    actor_user_id, action, resource_type, resource_id, reason,
    before_state, after_state, request_id
  ) VALUES (
    p_actor_user_id, 'report.reviewed', 'user_report', p_report_id::text, btrim(p_reason),
    jsonb_build_object('status', current_report.status, 'resolution', current_report.resolution),
    jsonb_build_object('status', updated_report.status, 'resolution', updated_report.resolution),
    p_request_id
  );

  RETURN to_jsonb(updated_report);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_review_user_report(integer, bigint, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_user_report(integer, bigint, text, text, text, text, uuid) TO service_role;

-- No anon/authenticated object policies are added. Evidence is uploaded and
-- issued as short-lived signed URLs only by the server-side service client.
