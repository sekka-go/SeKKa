import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseTarget,validateProductionConfig,assertTableProbe,REQUIRED_PRODUCTION_TABLES,PRODUCTION_REF,STAGING_REF} from './production-release-preflight.mjs';

const production={
 CF_PAGES_BRANCH:'main',
 CF_PAGES_URL:'https://sekka-go.pages.dev',
 VITE_SUPABASE_URL:`https://${PRODUCTION_REF}.supabase.co`,
 VITE_SUPABASE_PUBLISHABLE_KEY:'synthetic-publishable-test-key'
};

test('production gate recognizes the live main site and checks its project',()=>{
 assert.equal(releaseTarget(production),'production');
 const config=validateProductionConfig(production);
 assert.equal(new URL(config.url).hostname,`${PRODUCTION_REF}.supabase.co`);
});

test('production project previews safely probe actual production backend before merge',()=>{
 assert.equal(releaseTarget({...production,CF_PAGES_BRANCH:'feature/test'}),'production');
 assert.equal(releaseTarget({...production,CF_PAGES_BRANCH:undefined}),'production');
 assert.equal(releaseTarget({...production,CF_PAGES_URL:'https://abcd1234.sekka-go.pages.dev',CF_PAGES_BRANCH:'feature/test'}),'production');
});

test('local builds without Pages URL remain offline and cannot accidentally target production',()=>{
 assert.equal(releaseTarget({}),'skip-local');
 assert.equal(releaseTarget({...production,CF_PAGES_URL:undefined,CF_PAGES_BRANCH:'feature/test'}),'skip-local');
 assert.throws(()=>releaseTarget({...production,CF_PAGES_URL:undefined}),/PRODUCTION_GATE_CANNOT_VERIFY_PAGES_URL/);
});

test('the separate Staging main deployment must not use Production credentials',()=>{
 assert.equal(releaseTarget({...production,CF_PAGES_URL:'https://sekka-staging-web.pages.dev'}),'skip-staging-project');
 assert.equal(releaseTarget({...production,CF_PAGES_URL:'https://e35d0fd2.sekka-staging-web.pages.dev'}),'skip-staging-project');
});

test('live release rejects incorrect Supabase target or missing publishable key',()=>{
 assert.throws(()=>validateProductionConfig({
  ...production,VITE_SUPABASE_URL:`https://${STAGING_REF}.supabase.co`
 }),/PRODUCTION_GATE_REFUSE_STAGING_OR_OTHER_DB/);
 assert.throws(()=>validateProductionConfig({...production,VITE_SUPABASE_PUBLISHABLE_KEY:''}),/PRODUCTION_GATE_MISSING_SUPABASE_CONFIG/);
 assert.throws(()=>releaseTarget({...production,CF_PAGES_URL:'https://other-project.pages.dev'}),/PRODUCTION_GATE_UNKNOWN_MAIN_SITE/);
 assert.throws(()=>releaseTarget({...production,CF_PAGES_URL:''}),/PRODUCTION_GATE_CANNOT_VERIFY_PAGES_URL/);
});

test('missing Production tables are not mistaken for RLS or harmless empty rows',()=>{
 assert.doesNotThrow(()=>assertTableProbe('v31_captain_applications',null,200));
 assert.throws(()=>assertTableProbe('v31_captain_applications',{
  code:'PGRST205',message:"Could not find the table 'public.v31_captain_applications' in the schema cache"
 },404),/PRODUCTION_GATE_MISSING_TABLE: v31_captain_applications/);
 assert.throws(()=>assertTableProbe('v31_captain_documents',{
  code:'42P01',message:'relation does not exist'
 },404),/PRODUCTION_GATE_MISSING_TABLE: v31_captain_documents/);
});

test('private-table permissions can be explicitly denied but ambiguous failures fail closed',()=>{
 assert.doesNotThrow(()=>assertTableProbe('v31_captain_documents',{
  code:'42501',message:'permission denied for table v31_captain_documents'
 },403));
 for(const code of ['PGRST301','PGRST202','UNKNOWN']){
  assert.throws(()=>assertTableProbe('v31_captain_documents',{
   code,message:'unavailable'
  },403),/PRODUCTION_GATE_TABLE_PROBE_FAILED/);
 }
 assert.throws(()=>assertTableProbe('v31_captain_documents',{
  code:'',message:'unexpected response'
 },401),/PRODUCTION_GATE_TABLE_PROBE_FAILED/);
});

test('release gate includes every critical Captain document and vehicle catalog table',()=>{
 assert.equal(REQUIRED_PRODUCTION_TABLES.length,17);
 const expected=[
  'v31_captain_applications','v31_captain_documents','v31_captain_approval_audit',
  'v31_vehicle_makes','v31_vehicle_models','v31_vehicle_colors',
  'v31_vehicle_service_categories','v31_routes','v31_bookings'
 ];
 for(const name of expected)assert.ok(REQUIRED_PRODUCTION_TABLES.includes(name),name);
 assert.equal(new Set(REQUIRED_PRODUCTION_TABLES).size,REQUIRED_PRODUCTION_TABLES.length);
});
