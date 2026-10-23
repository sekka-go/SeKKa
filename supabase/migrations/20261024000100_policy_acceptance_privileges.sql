-- Keep acceptance records append-only even for the trusted Edge API role.
-- Registration uses the SECURITY DEFINER RPC; service_role only needs SELECT.
REVOKE ALL ON TABLE public.policy_acceptances
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.policy_acceptances TO service_role;

REVOKE ALL ON SEQUENCE public.policy_acceptances_id_seq
  FROM PUBLIC, anon, authenticated, service_role;
