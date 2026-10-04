-- Map a verified Firebase Auth identity to the existing phone-based SeKKa user.
-- API access stays behind the Edge Function's service role and custom sessions.
CREATE TABLE public.firebase_auth_links (
  firebase_uid text PRIMARY KEY CHECK (length(firebase_uid) BETWEEN 1 AND 128),
  user_id integer NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.firebase_auth_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.firebase_auth_links FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.firebase_auth_links TO service_role;

CREATE INDEX firebase_auth_links_user_id_idx
  ON public.firebase_auth_links (user_id);
