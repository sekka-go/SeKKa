import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const migration=read('../migrations/20261115150000_v31_mandatory_captain_registration.sql');
const enrollment=read('../../web/src/v2/CaptainApplicationLive.tsx');
const captainValidation=read('../../web/src/v2/captainValidation.ts');
const vehicles=read('../../web/src/v2/LiveVehicles.tsx');
const routeDraft=read('../../web/src/v2/LiveCaptainDraft.tsx');
const admin=read('../../web/src/v2/AdminApprovalLive.tsx');
const approvalTest=read('../../web/scripts/staging-captain-review.mjs');
const journeyTest=read('../../web/scripts/real-journey.mjs');

test('manufacturer and model catalogs are bilingual, versioned, and Admin-extensible',()=>{
 for(const table of ['v31_vehicle_makes','v31_vehicle_models']){
  assert.match(migration,new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`,'i'));
  assert.match(migration,/catalog_version text NOT NULL DEFAULT '2026\.1'/i);
  assert.match(migration,new RegExp(`CREATE POLICY "${table.replace('v31_vehicle_','vehicle ')}.*admin manage"`,'i'));
 }
 assert.match(migration,/UNIQUE \(make_id, slug\)/i);
 assert.match(migration,/name_en text NOT NULL/i);
 assert.match(migration,/name_ar text NOT NULL/i);
});

test('application drafts persist required personal and dependent vehicle fields',()=>{
 for(const field of ['full_name','phone_number','vehicle_type','vehicle_make_id',
  'vehicle_model_id','manufacture_year','vehicle_color_code','vehicle_color_other'])
  assert.match(migration,new RegExp(`ADD COLUMN IF NOT EXISTS ${field}`,'i'));
 assert.match(migration,/intended_plate=clean_plate/i);
 assert.match(migration,/p_model_id IS NOT NULL AND NOT EXISTS[\s\S]+make_id=p_make_id/i);
 assert.match(migration,/p_year<1980 OR p_year>extract\(year FROM now\(\)\)/i);
 assert.match(migration,/p_color_code='other' AND char_length\(trim\(coalesce\(p_color_other,''\)\)\)<2/i);
 assert.match(migration,/clean_plate !~ '\^\[A-Za-z0-9 ء-ي-\]\+\$'/i);
 assert.match(migration,/status='draft',full_name=excluded\.full_name/i);
});

test('submission and approval independently require complete fields and all uploaded document kinds',()=>{
 const submit=migration.match(/CREATE OR REPLACE FUNCTION public\.v31_submit_captain_application\(\)([\s\S]*?)\n\$\$;/i)?.[1]||'';
 const decide=migration.match(/CREATE OR REPLACE FUNCTION public\.v31_admin_decide_captain\(\s*p_captain uuid,p_decision text,p_reason text,p_hiace_categories text\[\]([\s\S]*?)\n\$\$;/i)?.[1]||'';
 for(const body of [submit,decide]){
  assert.match(body,/phone_number !~ '\^01\[0125\]\[0-9\]\{8\}\$'/i);
  assert.match(body,/experience_years IS NULL/i);
  assert.match(body,/professional_notes/i);
  assert.match(body,/vehicle_type/i);
  assert.match(body,/JOIN storage\.objects/i);
  for(const kind of ['identity','driving_license','vehicle_license','vehicle_photo'])
   assert.match(body,new RegExp(`'${kind}'`));
 }
 assert.match(migration,/RAISE EXCEPTION 'ADMIN_REQUIRED'/i);
 assert.match(migration,/reviewed_by=actor,reviewed_at=now\(\)/i);
 assert.match(migration,/v31_captain_approval_audit\(captain_id,actor_id,decision,reason\)/i);
});

test('private cars gain both fixed categories while Hiace categories require Admin review',()=>{
 assert.match(migration,/categories:=ARRAY\['PRIME','SAVER'\]/i);
 assert.match(migration,/WHEN 'PRIME' THEN 3 WHEN 'SAVER' THEN 4 WHEN 'SPACE' THEN 9 ELSE 13/i);
 assert.match(migration,/HIACE_CATEGORY_REVIEW_REQUIRED/i);
 assert.match(migration,/c NOT IN \('SPACE','MAX'\)/i);
 assert.match(migration,/vehicle_type,make_id,vehicle_model_id,manufacture_year,color_code,color_other,enabled_categories/i);
 assert.match(admin,/p_hiace_categories:active\?\.vehicle_type==='hiace'\?hiaceCategories:null/);
 assert.match(enrollment,/سيارة ملاكي/);
 assert.match(enrollment,/PRIVATE CAR AUTOMATICALLY ENABLES BOTH|automatically enables both/i);
 assert.doesNotMatch(enrollment,/Planned seats|المقاعد المقترحة/i);
});

test('only server functions activate vehicles and create category-capacity routes',()=>{
 assert.match(migration,/REVOKE INSERT,UPDATE,DELETE ON public\.v31_vehicles FROM anon,authenticated/i);
 assert.match(migration,/REVOKE INSERT,UPDATE,DELETE ON public\.v31_routes,public\.v31_route_stops FROM anon,authenticated/i);
 assert.match(migration,/INSERT INTO public\.v31_vehicles[\s\S]+VALUES\(p_captain,display_model,trim\(app\.intended_plate\)[\s\S]+'active'/i);
 assert.match(migration,/CREATE TABLE IF NOT EXISTS public\.v31_vehicle_service_categories/i);
 assert.match(migration,/VEHICLE_CATEGORY_NOT_ENABLED/i);
 assert.match(migration,/CATEGORY_CAPACITY_MISMATCH/i);
 assert.match(migration,/VEHICLE_HAS_ACTIVE_SERVICE/i);
 assert.match(routeDraft,/p_vehicle:vehicleId,p_category:category/);
 assert.match(routeDraft,/seat_capacity!==categorySeats\[category\]/);
 assert.doesNotMatch(routeDraft,/<input[^>]+type="number"[^>]+seats/i);
 assert.doesNotMatch(vehicles,/<input|\.insert\(|\.update\(/i);
});

test('booking locks the physical vehicle and accounts for reservations across all its routes',()=>{
 const reserve=migration.match(/CREATE OR REPLACE FUNCTION public\.v31_reserve_seats\([\s\S]*?\n\$\$;/i)?.[0]||'';
 const offer=migration.match(/CREATE OR REPLACE FUNCTION public\.v31_accept_trip_offer\([\s\S]*?\n\$\$;/i)?.[0]||'';
 for(const body of [reserve,offer]){
  assert.match(body,/FROM public\.v31_vehicles[\s\S]*FOR UPDATE/i);
  assert.match(body,/JOIN public\.v31_routes r ON r\.id=b\.route_id/i);
  assert.match(body,/r\.vehicle_id=route\.vehicle_id/i);
  assert.match(body,/VEHICLE_SEAT_CAPACITY_EXCEEDED/i);
 }
});

test('Captain screens require all fields, preserve explicit zero, and distinguish unverified phone',()=>{
 assert.match(enrollment,/captainPersonalErrors/);
 assert.match(enrollment,/normalizeNumerals/);
 assert.match(captainValidation,/Number\.isInteger\(number\) \|\| number < 0 \|\| number > 30/);
 assert.match(enrollment,/captain-fullName-error/);
 assert.match(enrollment,/captain-phone-error/);
 assert.match(enrollment,/captain-professionalBackground-error/);
 assert.match(enrollment,/captain-experienceYears-error/);
 assert.match(enrollment,/unverified/i);
 for(const phrase of ['Full name','Egyptian mobile number','Professional background',
  'Years of experience','Required documents','License plate number'])
  assert.match(enrollment,new RegExp(phrase,'i'));
 assert.doesNotMatch(enrollment,/optional|اختياري|Planned seats|المقاعد المقترحة/i);
 assert.match(enrollment,/next&&Object\.keys\(fieldErrors\)\.length>0/);
 assert.match(enrollment,/onClick=\{\(\)=>void savePersonal\(true\)\}/);
 assert.match(enrollment,/onClick=\{\(\)=>void saveVehicle\(true\)\}/);
 assert.match(enrollment,/disabled=\{busy\|\|!hasDocuments\}/);
 assert.match(enrollment,/readSavedApplication/);
 assert.match(enrollment,/DRAFT_SAVE_NOT_VERIFIED/);
 assert.match(enrollment,/loadError&&!loading/);
 assert.match(approvalTest,/real Google-authenticated Captain JWT/);
 assert.match(approvalTest,/Explicit zero years must persist/);
 assert.match(approvalTest,/Submission without required documents/);
 assert.match(journeyTest,/blocked Captain capacity edits/);
});

test('mandatory onboarding preserves publishing and idempotent retries',()=>{
 const selectFunction=(name)=>{
  const start=migration.indexOf('CREATE OR REPLACE FUNCTION public.'+name+'(');
  assert.ok(start>=0,'missing function '+name);
  const end=migration.indexOf('$;',start);
  assert.ok(end>start,'missing end of function '+name);
  return migration.slice(start,end+4);
 };
 const status=selectFunction('v31_set_route_status');
 assert.ok(status.includes("route.status='draft' AND p_status='published'"));
 assert.ok(status.includes('ROUTE_NOT_OWNED'));
 assert.ok(status.includes('CAPTAIN_NOT_APPROVED'));
 const reserve=selectFunction('v31_reserve_seats');
 const locked=reserve.indexOf('FOR UPDATE;');
 const recheck=reserve.indexOf('Recheck after locking the route:');
 assert.ok(locked>=0 && recheck>locked);
 assert.ok(reserve.includes('ON CONFLICT(rider_id,idempotency_key) DO NOTHING'));
 assert.ok(migration.includes("IF app.vehicle_type IS NULL OR app.vehicle_type NOT IN"));
 assert.ok(migration.includes("OR app.vehicle_type IS NULL OR app.vehicle_type NOT IN"));
});
