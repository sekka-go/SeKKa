/**
 * Real Google-session Captain submission and Admin decision test.
 *
 * Run only with designated disposable Staging accounts after signing in via
 * Google OAuth. This creates a real application, private QA uploads, and an
 * approved Staging vehicle; the Captain account remains for route testing.
 *
 * SEKKA_TEST_DATABASE=true
 * SEKKA_ALLOW_STAGING_ADMIN_APPROVAL=true
 * VITE_SUPABASE_URL=https://zgcvumykzivsvnlflbyp.supabase.co
 * VITE_SUPABASE_PUBLISHABLE_KEY=<public Staging key>
 * SEKKA_CAPTAIN_ACCESS_TOKEN=<real Google-authenticated Captain JWT>
 * SEKKA_ADMIN_ACCESS_TOKEN=<real Google-authenticated Admin JWT>
 * node scripts/staging-captain-review.mjs
 *
 * Tokens are never logged. QA PNGs are uploaded to the private bucket and are
 * test fixtures, not identity evidence or production documents.
 */
import {createClient} from '@supabase/supabase-js';
import {randomInt,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';

const env=process.env;
assert.equal(env.SEKKA_TEST_DATABASE,'true','Explicit Staging test opt-in required');
assert.equal(env.SEKKA_ALLOW_STAGING_ADMIN_APPROVAL,'true','Explicit Admin approval opt-in required');
const url=env.VITE_SUPABASE_URL,key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url&&key,'Missing Staging public configuration');
assert.equal(new URL(url).hostname,'zgcvumykzivsvnlflbyp.supabase.co','REFUSE_NON_STAGING_DATABASE');
assert.ok(env.SEKKA_CAPTAIN_ACCESS_TOKEN&&env.SEKKA_ADMIN_ACCESS_TOKEN,'Two real Google sessions required');

const actor=token=>createClient(url,key,{
 global:{headers:{Authorization:`Bearer ${token}`}},
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const captain=actor(env.SEKKA_CAPTAIN_ACCESS_TOKEN);
const admin=actor(env.SEKKA_ADMIN_ACCESS_TOKEN);
const must=(result,operation)=>{
 if(result.error)throw Error(`${operation}: ${result.error.message}`);
 return result.data;
};
const mustFail=(result,code,operation)=>{
 assert.ok(result.error,`${operation} must be rejected`);
 if(code)assert.match(result.error.message,new RegExp(code),operation);
};

const captainUser=must(await captain.auth.getUser(env.SEKKA_CAPTAIN_ACCESS_TOKEN),'Captain identity').user;
const adminUser=must(await admin.auth.getUser(env.SEKKA_ADMIN_ACCESS_TOKEN),'Admin identity').user;
assert.notEqual(captainUser.id,adminUser.id,'Captain and Admin must be separate accounts');
assert.equal(must(await admin.rpc('v31_is_admin'),'server Admin authorization'),true,'Admin session is not server-authorized');
assert.equal(must(await captain.rpc('v31_is_admin'),'Captain authorization'),false,'Captain must not have Admin rights');

const profile=must(await captain.from('v31_profiles')
 .select('role_preference').eq('user_id',captainUser.id).single(),'Captain profile');
assert.equal(profile.role_preference,'captain','Select Captain through the application before this test');
const existingApplication=must(await captain.from('v31_captain_applications')
 .select('status').eq('user_id',captainUser.id).maybeSingle(),'existing application check');
assert.equal(existingApplication,null,'Use a fresh designated Staging Captain test account');
const existingCaptain=must(await captain.from('v31_captain_profiles')
 .select('approval_status').eq('user_id',captainUser.id).maybeSingle(),'Captain enrollment check');
if(existingCaptain)assert.equal(existingCaptain.approval_status,'pending','Use a fresh pending Captain account');
else must(await captain.from('v31_captain_profiles')
 .insert({user_id:captainUser.id,approval_status:'pending'}),'Captain enrollment');

const tag=randomUUID().slice(0,8),fullName=`QA Captain ${tag}`,phone='01012345678';
// Acceptance data must pass the same plate format as the live Android form:
// three Arabic letters and four digits. An English "STG-..." placeholder
// would be rejected by the server before this test reaches Admin review.
const plateAlphabet='أبجدرسعفقلمنهوي';
const qaPlate=Array.from({length:3},()=>plateAlphabet[randomInt(plateAlphabet.length)]).join('')
 + String(randomInt(1000,10000));
assert.match(qaPlate,/^[ء-ي]{3}[0-9]{4}$/u,'QA plate must satisfy the actual Egyptian registration format');
mustFail(await captain.rpc('v31_save_captain_application',{
 p_full_name:fullName,p_phone:phone,p_notes:'Staging professional background',p_experience:-1
}),'INVALID_PROFESSIONAL_DETAILS','Negative years of experience');
assert.equal(must(await captain.rpc('v31_save_captain_application',{
 p_full_name:fullName,p_phone:phone,p_notes:'Staging professional background',p_experience:0
}),'Save complete personal details'), 'draft');

const make=must(await captain.from('v31_vehicle_makes').select('id').eq('slug','toyota').single(),'Toyota catalog entry');
const model=must(await captain.from('v31_vehicle_models').select('id').eq('make_id',make.id).eq('slug','corolla').single(),'Corolla catalog entry');
mustFail(await captain.rpc('v31_save_captain_vehicle_intent',{
 p_vehicle_type:'private_car',p_make_id:make.id,p_model_id:-1,p_year:2018,
 p_color_code:'white',p_color_other:null,p_plate:qaPlate
}),'INVALID_VEHICLE_DETAILS','Model outside selected manufacturer');
assert.equal(must(await captain.rpc('v31_save_captain_vehicle_intent',{
 p_vehicle_type:'private_car',p_make_id:make.id,p_model_id:model.id,p_year:2018,
 p_color_code:'white',p_color_other:null,p_plate:qaPlate
}),'Save required vehicle details'),'draft');

mustFail(await captain.rpc('v31_submit_captain_application'),'CAPTAIN_DOCUMENTS_INCOMPLETE',
 'Submission without required documents');

const png=Buffer.from(
 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0c8AAAAASUVORK5CYII=',
 'base64'
);
const kinds=['identity','driving_license','vehicle_license','vehicle_photo'];
for(const kind of kinds){
 const objectName=`${captainUser.id}/${randomUUID()}.png`;
 const upload=await captain.storage.from('v31-captain-docs-staging').upload(objectName,png,{
  upsert:false,contentType:'image/png'
 });
 if(upload.error)throw Error(`Upload ${kind}: ${upload.error.message}`);
 must(await captain.rpc('v31_register_captain_document',{p_kind:kind,p_object_name:objectName}),
  `Register ${kind}`);
}

assert.equal(must(await captain.rpc('v31_submit_captain_application'),'Submit Captain application'),'submitted');
const submitted=must(await admin.from('v31_captain_applications')
 .select('status,submitted_at,experience_years,vehicle_type,vehicle_make_id,vehicle_model_id,manufacture_year,vehicle_color_code,intended_plate')
 .eq('user_id',captainUser.id).single(),'Admin sees complete application');
assert.equal(submitted.status,'submitted');
assert.ok(submitted.submitted_at,'Submission timestamp must persist');
assert.equal(submitted.experience_years,0,'Explicit zero years must persist');
assert.equal(submitted.vehicle_type,'private_car');

const adminDocuments=must(await admin.from('v31_captain_documents')
 .select('kind,object_name').eq('captain_id',captainUser.id),'Admin document review list');
assert.equal(new Set(adminDocuments.map(document=>document.kind)).size,4);
for(const document of adminDocuments){
 const download=await admin.storage.from('v31-captain-docs-staging').download(document.object_name);
 if(download.error||!download.data)throw Error(`Admin cannot review ${document.kind}: ${download.error?.message}`);
 assert.ok(download.data.size>0,`${document.kind} must be readable by the Admin reviewer`);
}

mustFail(await captain.rpc('v31_admin_decide_captain',{
 p_captain:captainUser.id,p_decision:'approved',p_reason:null,p_hiace_categories:null
}),'ADMIN_REQUIRED','Captain attempts Admin approval');
assert.equal(must(await admin.rpc('v31_admin_decide_captain',{
 p_captain:captainUser.id,p_decision:'approved',p_reason:null,p_hiace_categories:null
}),'Explicit authorized Staging Admin approval'),'approved');

const [application,captainState,audit]=await Promise.all([
 captain.from('v31_captain_applications')
  .select('status,reviewed_at,reviewed_by,approved_vehicle_id,vehicle_make_id,vehicle_model_id,manufacture_year,vehicle_color_code,intended_plate')
  .eq('user_id',captainUser.id).single(),
 captain.from('v31_captain_profiles').select('approval_status').eq('user_id',captainUser.id).single(),
 captain.from('v31_captain_approval_audit').select('actor_id,decision')
   .eq('captain_id',captainUser.id).order('created_at',{ascending:false}).limit(1)
 ]);
assert.equal(must(application,'Persisted application review').status,'approved');
assert.ok(application.data.reviewed_at,'Admin review timestamp must persist');
assert.equal(application.data.reviewed_by,adminUser.id,'Server must record the real Admin reviewer');
assert.equal(must(captainState,'Persisted Captain approval').approval_status,'approved');
assert.equal(must(audit,'Approval audit trail')[0]?.actor_id,adminUser.id);
assert.equal(audit.data[0]?.decision,'approved');
assert.equal(application.data.vehicle_make_id,make.id);
assert.equal(application.data.vehicle_model_id,model.id);
assert.equal(application.data.manufacture_year,2018);
assert.equal(application.data.vehicle_color_code,'white');
assert.equal(application.data.intended_plate,qaPlate);
const vehicle=must(await captain.from('v31_vehicles')
 .select('id,status,vehicle_type,model,plate_number,manufacture_year,color_code,seats,enabled_categories')
 .eq('captain_id',captainUser.id).eq('id',application.data.approved_vehicle_id).single(),'Activated vehicle');
assert.equal(application.data.approved_vehicle_id,vehicle.id);
assert.equal(vehicle.status,'active','Vehicle must only activate after Admin approval');
assert.equal(vehicle.vehicle_type,'private_car');
assert.equal(vehicle.manufacture_year,2018);
assert.equal(vehicle.color_code,'white');
assert.equal(vehicle.seats,4,'Private-car physical passenger capacity must be system-controlled');
assert.deepEqual(vehicle.enabled_categories,['PRIME','SAVER']);
const ownCategories=must(await captain.from('v31_vehicle_service_categories').select('category,seat_capacity')
 .eq('vehicle_id',vehicle.id).order('category'),'Private-car service eligibility');
assert.deepEqual(ownCategories,[{category:'PRIME',seat_capacity:3},{category:'SAVER',seat_capacity:4}]);

mustFail(await captain.from('v31_vehicles').update({seats:13,enabled_categories:['MAX']})
 .eq('id',vehicle.id).select('id'),'','Captain must not forge seats or service eligibility');
process.stdout.write('PASS: real Captain/Admin Google sessions, required personal and vehicle persistence, explicit zero experience, private document uploads and Admin reads, missing-document rejection, server-owned approval, PRIME+SAVER eligibility, fixed capacities, vehicle activation, and blocked client seat/category changes. QA test application and vehicle remain in Staging for route testing.\n');
