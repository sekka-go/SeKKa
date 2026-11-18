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

export function releaseTarget(env){
 if(env.CF_PAGES_BRANCH!=='main')return 'skip-preview';
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
 const required=[
  'v31_profiles','v31_captain_profiles','v31_captain_applications',
  'v31_captain_documents','v31_vehicles','v31_routes','v31_route_stops',
  'v31_bookings','v31_trip_requests','v31_trip_offers',
  'v31_notifications','v31_service_areas','v31_captain_approval_audit'
 ];
 // We only query empty sets. RLS/grant refusal may be legitimate; missing
 // relation and network errors are not. No actual records are returned.
 for(const table of required){
  const {error,status}=await client.from(table).select('id',{head:true}).limit(0);
  if(!error)continue;
  const info=String(error.code||'')+' '+String(error.message||'');
  if(/PGRST205|42P01|schema cache|could not find the table|does not exist/i.test(info))
   throw Error('PRODUCTION_GATE_MISSING_TABLE: '+table);
  if(status===401||status===403||/42501|permission denied/i.test(info))
   continue;
  throw Error('PRODUCTION_GATE_TABLE_PROBE_FAILED: '+table+' '+String(error.code||status||'UNKNOWN'));
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
