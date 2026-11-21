/**
 * Read-only Cloudflare production release gate.
 * The live main site must not deploy new v3.1 UI to a missing/misconfigured
 * Production Supabase schema. Does not alter Production data or Storage.
 */
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createClient} from '@supabase/supabase-js';

export const PRODUCTION_REF='uorxfakceqnhxqnaawdy';
export const STAGING_REF='zgcvumykzivsvnlflbyp';

export const REQUIRED_PRODUCTION_TABLES=Object.freeze([
 'v31_profiles','v31_captain_profiles','v31_captain_applications',
 'v31_captain_documents','v31_captain_approval_audit',
 'v31_vehicle_makes','v31_vehicle_models','v31_vehicle_colors',
 'v31_vehicle_service_categories','v31_vehicles','v31_routes',
 'v31_route_stops','v31_bookings','v31_trip_requests',
 'v31_trip_offers','v31_notifications','v31_service_areas'
]);

export function releaseTarget(env){
 // The live Pages project uses its Production Supabase config for BOTH
 // preview and main builds. Probe those credentials read-only BEFORE merge
 // to main. Staging is a different Pages project and must always be skipped.
 if(!env.CF_PAGES_URL){
  if(env.CF_PAGES_BRANCH==='main')throw Error('PRODUCTION_GATE_CANNOT_VERIFY_PAGES_URL');
  return 'skip-local';
 }
 let site;
 try{site=new URL(env.CF_PAGES_URL).hostname;}catch{
  throw Error('PRODUCTION_GATE_CANNOT_VERIFY_PAGES_URL');
 }
 // Both Pages projects track main; never gate the intentionally isolated
 // Staging project as if it were the public production website.
 if(site==='sekka-staging-web.pages.dev'||site.endsWith('.sekka-staging-web.pages.dev'))
  return 'skip-staging-project';
 if(site==='sekka-go.pages.dev'||site.endsWith('.sekka-go.pages.dev'))
  return 'production';
 throw Error('PRODUCTION_GATE_UNKNOWN_MAIN_SITE');
}

// Public read-only probes may legitimately lack SELECT grants on a private
// table. Treat ONLY the explicit SQL privilege error as permission-limited;
// arbitrary 401/403/404, timeouts and missing relations must FAIL CLOSED.
export function assertTableProbe(table,error,status){
 if(!error)return;
 const code=String(error.code||'');
 const message=String(error.message||'');
 if(code==='42501'&&/permission denied/i.test(message))return;
 if(code==='PGRST205'||code==='42P01'||/could not find the table|does not exist|schema cache/i.test(message))
  throw Error('PRODUCTION_GATE_MISSING_TABLE: '+table);
 throw Error('PRODUCTION_GATE_TABLE_PROBE_FAILED: '+table+' '+String(code||status||'UNKNOWN'));
}

export function validateProductionConfig(env){
 assert.equal(releaseTarget(env),'production');
 const url=env.VITE_SUPABASE_URL;
 const publishableKey=env.VITE_SUPABASE_PUBLISHABLE_KEY;
 assert.ok(url&&publishableKey,'PRODUCTION_GATE_MISSING_SUPABASE_CONFIG');
 const host=new URL(url).hostname;
 assert.equal(host,`${PRODUCTION_REF}.supabase.co`,'PRODUCTION_GATE_REFUSE_STAGING_OR_OTHER_DB');
 assert.ok(!host.includes(STAGING_REF),'PRODUCTION_GATE_REFUSE_STAGING');
 return {url,publishableKey};
}

export async function runProductionPreflight(env=process.env){
 const target=releaseTarget(env);
 if(target!=='production'){
  console.log('PRODUCTION_PREFLIGHT_SKIPPED: '+target);
  return;
 }
 const {url,publishableKey}=validateProductionConfig(env);
 const client=createClient(url,publishableKey,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
 });
 // All tables needed by launch-critical real Passenger/Captain workflows.
 // The read-only probe is deliberately stricter than a simple build check.
 const required=REQUIRED_PRODUCTION_TABLES;
 // IMPORTANT: never use HEAD here. Some PostgREST configurations return
 // an empty HEAD response for a table missing from the schema cache, hiding
 // PGRST205 and giving an incorrect PASS. GET with limit=0 returns zero
 // rows, but always exposes the machine-readable API error body.
 for(const table of required){
  const {error,status}=await client.from(table).select('*').limit(0);
  assertTableProbe(table,error,status);
 }
 // Do not claim Captain uploads work without authenticated Android evidence.
 // But reject deployments where even the public capacity API is absent.
 const {data:available,error:capacityError}=await client.rpc(
  'v31_published_route_available_seats',
  {p_route:'00000000-0000-4000-8000-000000000001'}
 );
 if(capacityError)throw Error('PRODUCTION_GATE_PUBLIC_CAPACITY_RPC_UNAVAILABLE: '+String(capacityError.code||'UNKNOWN'));
 assert.equal(available,null,'PRODUCTION_GATE_INVALID_PUBLIC_CAPACITY_BOUNDARY');

 const auth=await fetch(`${url}/auth/v1/settings`,{
  headers:{apikey:publishableKey}
 });
 assert.ok(auth.ok,'PRODUCTION_GATE_AUTH_UNAVAILABLE: HTTP '+auth.status);
 const settings=await auth.json();
 assert.equal(settings.external?.google,true,'PRODUCTION_GATE_GOOGLE_DISABLED');
 console.log('PRODUCTION_READ_ONLY_PREFLIGHT_OK: correct Production project, '+required.length+
  ' schema probes, capacity boundary, Google provider. No data modified.');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 await runProductionPreflight();
}
