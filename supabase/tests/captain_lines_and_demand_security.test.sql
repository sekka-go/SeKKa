BEGIN;
SELECT plan(31);

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.app_config'::regclass), 'app_config has RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.captain_lines'::regclass), 'captain_lines has RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.demand_groups'::regclass), 'demand_groups has RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.demand_requests'::regclass), 'demand_requests has RLS enabled');

SELECT ok(NOT has_table_privilege('anon', 'public.app_config', 'SELECT'), 'anon cannot read app_config');
SELECT ok(NOT has_table_privilege('authenticated', 'public.app_config', 'SELECT'), 'authenticated cannot read app_config');
SELECT ok(NOT has_table_privilege('anon', 'public.captain_lines', 'SELECT'), 'anon cannot read captain_lines');
SELECT ok(NOT has_table_privilege('authenticated', 'public.captain_lines', 'SELECT'), 'authenticated cannot read captain_lines');
SELECT ok(NOT has_table_privilege('anon', 'public.demand_groups', 'SELECT'), 'anon cannot read demand_groups');
SELECT ok(NOT has_table_privilege('authenticated', 'public.demand_groups', 'SELECT'), 'authenticated cannot read demand_groups');
SELECT ok(NOT has_table_privilege('anon', 'public.demand_requests', 'SELECT'), 'anon cannot read demand_requests');
SELECT ok(NOT has_table_privilege('authenticated', 'public.demand_requests', 'SELECT'), 'authenticated cannot read demand_requests');

SELECT ok(has_table_privilege('service_role', 'public.app_config', 'SELECT'), 'service_role can read app_config');
SELECT ok(has_table_privilege('service_role', 'public.captain_lines', 'SELECT'), 'service_role can read captain_lines');
SELECT ok(has_table_privilege('service_role', 'public.demand_groups', 'SELECT'), 'service_role can read demand_groups');
SELECT ok(has_table_privilege('service_role', 'public.demand_requests', 'SELECT'), 'service_role can read demand_requests');

SELECT ok(has_function_privilege('service_role', 'public.publish_captain_line(integer,text,text,double precision,double precision,text,double precision,double precision,jsonb,time,smallint[],integer,numeric,text[])', 'EXECUTE'), 'service_role can publish a captain line');
SELECT ok(NOT has_function_privilege('anon', 'public.publish_captain_line(integer,text,text,double precision,double precision,text,double precision,double precision,jsonb,time,smallint[],integer,numeric,text[])', 'EXECUTE'), 'anon cannot publish a captain line');
SELECT ok(NOT has_function_privilege('authenticated', 'public.publish_captain_line(integer,text,text,double precision,double precision,text,double precision,double precision,jsonb,time,smallint[],integer,numeric,text[])', 'EXECUTE'), 'authenticated cannot publish a captain line directly');

SELECT ok(has_function_privilege('service_role', 'public.create_demand_request(integer,text,date,time,text,double precision,double precision,text,double precision,double precision,integer)', 'EXECUTE'), 'service_role can register rider demand');
SELECT ok(NOT has_function_privilege('anon', 'public.create_demand_request(integer,text,date,time,text,double precision,double precision,text,double precision,double precision,integer)', 'EXECUTE'), 'anon cannot register rider demand');
SELECT ok(NOT has_function_privilege('authenticated', 'public.create_demand_request(integer,text,date,time,text,double precision,double precision,text,double precision,double precision,integer)', 'EXECUTE'), 'authenticated cannot register rider demand directly');

SELECT ok(has_function_privilege('service_role', 'public.set_captain_line_status(integer,integer,text)', 'EXECUTE'), 'service_role can change a captain line status');
SELECT ok(NOT has_function_privilege('anon', 'public.set_captain_line_status(integer,integer,text)', 'EXECUTE'), 'anon cannot change a captain line status');
SELECT ok(NOT has_function_privilege('authenticated', 'public.set_captain_line_status(integer,integer,text)', 'EXECUTE'), 'authenticated cannot change a captain line status directly');

SELECT ok(NOT has_function_privilege('anon', 'public.sekka_cluster_demand_request()', 'EXECUTE'), 'anon cannot call the request-clustering trigger');
SELECT ok(NOT has_function_privilege('authenticated', 'public.sekka_cluster_demand_request()', 'EXECUTE'), 'authenticated cannot call the request-clustering trigger');
SELECT ok(NOT has_function_privilege('anon', 'public.sekka_match_after_demand_insert()', 'EXECUTE'), 'anon cannot call the demand-matching trigger');
SELECT ok(NOT has_function_privilege('authenticated', 'public.sekka_match_after_demand_insert()', 'EXECUTE'), 'authenticated cannot call the demand-matching trigger');
SELECT ok(NOT has_function_privilege('anon', 'public.sekka_match_after_line_publish()', 'EXECUTE'), 'anon cannot call the line-matching trigger');
SELECT ok(NOT has_function_privilege('authenticated', 'public.sekka_match_after_line_publish()', 'EXECUTE'), 'authenticated cannot call the line-matching trigger');

SELECT * FROM finish();
ROLLBACK;
