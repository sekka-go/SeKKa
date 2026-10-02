CREATE TABLE public.api_rate_limits (
  key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  hit_count integer NOT NULL CHECK (hit_count > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.api_rate_limits FROM anon, authenticated;
GRANT ALL ON TABLE public.api_rate_limits TO service_role;
CREATE POLICY sekka_backend_only ON public.api_rate_limits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.sekka_take_rate_limit(
  p_key text, p_limit integer, p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE allowed boolean;
BEGIN
  IF p_limit < 1 OR p_window_seconds < 1 OR length(p_key) > 512 THEN
    RAISE EXCEPTION 'invalid rate limit parameters' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.api_rate_limits(key,window_started_at,hit_count,updated_at)
    VALUES(p_key,now(),1,now())
  ON CONFLICT(key) DO UPDATE SET
    window_started_at=CASE
      WHEN public.api_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) THEN now()
      ELSE public.api_rate_limits.window_started_at END,
    hit_count=CASE
      WHEN public.api_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) THEN 1
      ELSE public.api_rate_limits.hit_count+1 END,
    updated_at=now()
  RETURNING hit_count <= p_limit INTO allowed;
  RETURN allowed;
END
$fn$;
REVOKE ALL ON FUNCTION public.sekka_take_rate_limit(text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sekka_take_rate_limit(text,integer,integer) TO service_role;
