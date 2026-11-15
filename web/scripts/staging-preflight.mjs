/**
 * Free staging safety preflight. Does NOT mutate data or authenticate anyone.
 * Run with VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY for staging only.
 * This intentionally refuses the existing project and requires a schema created
 * from audited migrations. It is not a replacement for a logical backup.
 */
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const project='zgcvumykzivsvnlflbyp';
const production='uorxfakceqnhxqnaawdy';
const url=process.env.VITE_SUPABASE_URL;
const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url&&key,'STAGING_CONFIG_REQUIRED');
const host=new URL(url).hostname;
assert.equal(host,`${project}.supabase.co`,'REFUSE_NON_STAGING_DATABASE');
assert.ok(!host.includes(production),'REFUSE_PRODUCTION');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const expected=[
 'v31_profiles','v31_captain_profiles','v31_vehicles','v31_routes',
 'v31_route_stops','v31_bookings','v31_trip_requests','v31_trip_offers',
 'v31_notifications','v31_service_areas'
];
let unavailable=[];
for(const table of expected){
 const {error}=await client.from(table).select('*',{head:true,count:'exact'}).limit(0);
 if(error&&/does not exist|not find the table|schema cache|PGRST205|42P01/i.test(error.message+' '+error.code))unavailable.push(table);
 else if(error&& !/permission denied|42501/i.test(error.message+' '+error.code))throw Error(`UNEXPECTED_DATA_API_ERROR ${table}: ${error.code||''} ${error.message}`);
}
assert.deepEqual(unavailable,[],'STAGING_SCHEMA_MISSING: '+unavailable.join(', '));
const protectedRpcs=[
 ['v31_admin_overview',{}],
 ['v31_reserve_seats',{p_route:'00000000-0000-4000-8000-000000000001',p_seats:1,p_idempotency:'00000000-0000-4000-8000-000000000002'}],
 ['v31_accept_trip_offer',{p_offer:'00000000-0000-4000-8000-000000000001'}],
 ['v31_cancel_pending_booking',{p_booking:'00000000-0000-4000-8000-000000000001'}],
 ['v31_cancel_trip_request',{p_request:'00000000-0000-4000-8000-000000000001'}],
 ['v31_is_admin',{}],
 ['v31_reserve_seats_with_stops',{p_route:'00000000-0000-4000-8000-000000000001',p_seats:1,p_idempotency:'00000000-0000-4000-8000-000000000002',p_pickup:'00000000-0000-4000-8000-000000000003',p_dropoff:'00000000-0000-4000-8000-000000000004',p_reverse:false}],
 ['v31_set_route_status',{p_route:'00000000-0000-4000-8000-000000000001',p_status:'archived'}]
];
for(const [name,args] of protectedRpcs){
 const {data,error}=await client.rpc(name,args);
 assert.ok(error,`ANON_RPC_ALLOWED ${name}: ${JSON.stringify(data)}`);
 assert.ok(!/does not exist|PGRST202/i.test(error.message+' '+error.code),`MISSING_RPC ${name}: ${error.message}`);
}
console.log('STAGING_PREFLIGHT_OK: isolated project, '+expected.length+' required tables and '+protectedRpcs.length+' anonymous RPC denials. No records changed.');
