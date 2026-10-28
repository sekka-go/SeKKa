BEGIN;
SELECT plan(12);

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.account_deletion_events'::regclass), 'account deletion audit has RLS enabled');
SELECT ok(NOT has_table_privilege('anon', 'public.account_deletion_events', 'SELECT'), 'anonymous users cannot read account deletion audit');
SELECT ok(NOT has_table_privilege('authenticated', 'public.account_deletion_events', 'INSERT'), 'authenticated users cannot write account deletion audit');
SELECT ok(has_table_privilege('service_role', 'public.account_deletion_events', 'SELECT'), 'service role can read deletion audit through trusted backend');
SELECT ok(NOT has_table_privilege('service_role', 'public.account_deletion_events', 'INSERT'), 'only the trusted database function can append deletion audit');
SELECT ok(NOT has_table_privilege('service_role', 'public.account_deletion_events', 'UPDATE'), 'deletion audit cannot be rewritten');
SELECT ok(NOT has_table_privilege('service_role', 'public.account_deletion_events', 'DELETE'), 'deletion audit cannot be removed');
SELECT ok(NOT has_function_privilege('anon', 'public.sekka_delete_account_v1(integer,integer,text)', 'EXECUTE'), 'anonymous callers cannot invoke account deletion');
SELECT ok(NOT has_function_privilege('authenticated', 'public.sekka_delete_account_v1(integer,integer,text)', 'EXECUTE'), 'authenticated callers cannot bypass the session-checked API');
SELECT ok(has_function_privilege('service_role', 'public.sekka_delete_account_v1(integer,integer,text)', 'EXECUTE'), 'trusted Edge Function can invoke account deletion');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.sekka_delete_account_v1(integer,integer,text)'::regprocedure), 'account deletion runs as a guarded database function');
SELECT ok((SELECT is_nullable = 'YES' FROM information_schema.columns WHERE table_schema='public' AND table_name='pool_members' AND column_name='pickup_lat'), 'retained ride rows support explicit location redaction');

SELECT * FROM finish();
ROLLBACK;
