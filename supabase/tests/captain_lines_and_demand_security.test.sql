BEGIN;
SELECT plan(42);

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

SELECT ok(has_function_privilege('service_role', 'public.publish_captain_line(integer,text,text,double precision,double precision,text,double precision,double precision,jsonb,time,smallint[],integer,numeric,text[],time)', 'EXECUTE'), 'service_role can publish a captain line with an optional return time');
SELECT ok(NOT has_function_privilege('anon', 'public.publish_captain_line(integer,text,text,double precision,double precision,text,double precision,double precision,jsonb,time,smallint[],integer,numeric,text[],time)', 'EXECUTE'), 'anon cannot publish a captain line');
SELECT ok(NOT has_function_privilege('authenticated', 'public.publish_captain_line(integer,text,text,double precision,double precision,text,double precision,double precision,jsonb,time,smallint[],integer,numeric,text[],time)', 'EXECUTE'), 'authenticated cannot publish a captain line directly');

SELECT ok(has_function_privilege('service_role', 'public.create_demand_request(integer,text,date,time,text,double precision,double precision,text,double precision,double precision,integer,time)', 'EXECUTE'), 'service_role can register rider demand with an optional return time');
SELECT ok(NOT has_function_privilege('anon', 'public.create_demand_request(integer,text,date,time,text,double precision,double precision,text,double precision,double precision,integer,time)', 'EXECUTE'), 'anon cannot register rider demand');
SELECT ok(NOT has_function_privilege('authenticated', 'public.create_demand_request(integer,text,date,time,text,double precision,double precision,text,double precision,double precision,integer,time)', 'EXECUTE'), 'authenticated cannot register rider demand directly');

SELECT ok(has_function_privilege('service_role', 'public.set_captain_line_status(integer,integer,text)', 'EXECUTE'), 'service_role can change a captain line status');
SELECT ok(NOT has_function_privilege('anon', 'public.set_captain_line_status(integer,integer,text)', 'EXECUTE'), 'anon cannot change a captain line status');
SELECT ok(NOT has_function_privilege('authenticated', 'public.set_captain_line_status(integer,integer,text)', 'EXECUTE'), 'authenticated cannot change a captain line status directly');

SELECT ok(NOT has_function_privilege('anon', 'public.sekka_cluster_demand_request()', 'EXECUTE'), 'anon cannot call the request-clustering trigger');
SELECT ok(NOT has_function_privilege('authenticated', 'public.sekka_cluster_demand_request()', 'EXECUTE'), 'authenticated cannot call the request-clustering trigger');
SELECT ok(NOT has_function_privilege('anon', 'public.sekka_match_after_demand_insert()', 'EXECUTE'), 'anon cannot call the demand-matching trigger');
SELECT ok(NOT has_function_privilege('authenticated', 'public.sekka_match_after_demand_insert()', 'EXECUTE'), 'authenticated cannot call the demand-matching trigger');
SELECT ok(NOT has_function_privilege('anon', 'public.sekka_match_after_line_publish()', 'EXECUTE'), 'anon cannot call the line-matching trigger');
SELECT ok(NOT has_function_privilege('authenticated', 'public.sekka_match_after_line_publish()', 'EXECUTE'), 'authenticated cannot call the line-matching trigger');
SELECT ok(NOT has_function_privilege('anon', 'public.sekka_match_demand_group(integer)', 'EXECUTE'), 'anon cannot directly invoke demand matching');
SELECT ok(NOT has_function_privilege('authenticated', 'public.sekka_match_demand_group(integer)', 'EXECUTE'), 'authenticated cannot directly invoke demand matching');
SELECT ok(NOT has_function_privilege('service_role', 'public.sekka_match_demand_group(integer)', 'EXECUTE'), 'demand matching is restricted to database triggers');

SELECT is((SELECT capacity_max FROM public.vehicle_types WHERE id = 'private_car'), 4, 'private cars allow at most four passenger seats');
SELECT is((SELECT capacity_max FROM public.vehicle_types WHERE id = 'hiace'), 14, 'HiAce allows at most fourteen passenger seats');
SELECT ok((SELECT numeric_value BETWEEN 7 AND 11 FROM public.app_config WHERE config_key = 'captain_line_price_per_km'), 'captain line price per kilometer is configured within the permitted range');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'captain_lines' AND column_name = 'route_distance_km'), 'captain line distance is persisted by the backend');
SELECT ok(EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.captain_lines'::regclass AND tgname = 'trg_captain_line_pricing' AND NOT tgisinternal), 'database trigger derives line price from the configured rate');
SELECT ok(has_function_privilege('service_role', 'public.publish_captain_line(integer,text,text,double precision,double precision,text,double precision,double precision,jsonb,time,smallint[],integer,double precision,text[],time)', 'EXECUTE'), 'service_role can publish with server-calculated route distance');
SELECT ok(NOT has_function_privilege('anon', 'public.publish_captain_line(integer,text,text,double precision,double precision,text,double precision,double precision,jsonb,time,smallint[],integer,double precision,text[],time)', 'EXECUTE'), 'anon cannot publish with server-calculated route distance');
SELECT ok(NOT has_function_privilege('authenticated', 'public.publish_captain_line(integer,text,text,double precision,double precision,text,double precision,double precision,jsonb,time,smallint[],integer,double precision,text[],time)', 'EXECUTE'), 'authenticated cannot invoke server-calculated pricing directly');

SELECT * FROM finish();
ROLLBACK;
