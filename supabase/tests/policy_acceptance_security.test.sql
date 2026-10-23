BEGIN;
SELECT plan(12);

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.policy_acceptances'::regclass), 'policy acceptance audit has RLS enabled');
SELECT ok(NOT has_table_privilege('anon', 'public.policy_acceptances', 'SELECT'), 'anonymous users cannot read acceptance records');
SELECT ok(NOT has_table_privilege('authenticated', 'public.policy_acceptances', 'INSERT'), 'authenticated users cannot forge acceptance records');
SELECT ok(NOT has_table_privilege('authenticated', 'public.policy_acceptances', 'SELECT'), 'users cannot inspect another account acceptance records');
SELECT ok(has_table_privilege('service_role', 'public.policy_acceptances', 'SELECT'), 'trusted backend can verify recorded versions');
SELECT ok(NOT has_table_privilege('service_role', 'public.policy_acceptances', 'INSERT'), 'backend cannot bypass atomic registration to forge partial records');
SELECT ok(NOT has_table_privilege('service_role', 'public.policy_acceptances', 'UPDATE'), 'acceptance history cannot be rewritten');
SELECT ok(NOT has_table_privilege('service_role', 'public.policy_acceptances', 'DELETE'), 'acceptance history cannot be deleted');
SELECT ok(NOT has_function_privilege('anon', 'public.sekka_register_with_policy_acceptance_v1(text,text,text,text,text)', 'EXECUTE'), 'anonymous callers cannot register through the privileged RPC');
SELECT ok(NOT has_function_privilege('authenticated', 'public.sekka_register_with_policy_acceptance_v1(text,text,text,text,text)', 'EXECUTE'), 'authenticated callers cannot invoke the signup RPC directly');
SELECT ok(has_function_privilege('service_role', 'public.sekka_register_with_policy_acceptance_v1(text,text,text,text,text)', 'EXECUTE'), 'trusted Edge API can atomically create a user and acceptance records');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.sekka_register_with_policy_acceptance_v1(text,text,text,text,text)'::regprocedure), 'signup RPC runs with narrowly granted definer privileges');

SELECT * FROM finish();
ROLLBACK;
