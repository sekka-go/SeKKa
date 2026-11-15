/**
 * Real Google-session Captain submission and Admin decision test.
 *
 * Run only with designated Staging test accounts after signing in through the
 * Staging Google OAuth UI. This creates a real approved Captain test account;
 * it does not forge auth, application state, or an Admin decision.
 *
 * SEKKA_TEST_DATABASE=true
 * SEKKA_ALLOW_STAGING_ADMIN_APPROVAL=true
 * VITE_SUPABASE_URL=https://zgcvumykzivsvnlflbyp.supabase.co
 * VITE_SUPABASE_PUBLISHABLE_KEY=<public Staging key>
 * SEKKA_CAPTAIN_ACCESS_TOKEN=<real Google-authenticated Captain JWT>
 * SEKKA_ADMIN_ACCESS_TOKEN=<real Google-authenticated Admin JWT>
 * node scripts/staging-captain-review.mjs
 *
 * Tokens are never logged. A successfully approved test account remains in
 * Staging for the subsequent route/booking journey; use a disposable account.
 */
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
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

const captainUser=must(await captain.auth.getUser(env.SEKKA_CAPTAIN_ACCESS_TOKEN),'Captain identity').user;
const adminUser=must(await admin.auth.getUser(env.SEKKA_ADMIN_ACCESS_TOKEN),'Admin identity').user;
assert.notEqual(captainUser.id,adminUser.id,'Captain and Admin must be separate accounts');
assert.equal(must(await admin.rpc('v31_is_admin'),'server Admin authorization'),true,'Admin session is not server-authorized');
assert.equal(must(await captain.rpc('v31_is_admin'),'Captain authorization'),false,'Captain must not have Admin rights');

const profile=must(await captain.from('v31_profiles')
 .select('role_preference,display_name').eq('user_id',captainUser.id).single(),'Captain profile');
assert.equal(profile.role_preference,'captain','Select Captain through the real application before this test');
assert.ok(profile.display_name.trim().length>=2,'Complete the real profile before submitting');

const existingApplication=must(await captain.from('v31_captain_applications')
 .select('status').eq('user_id',captainUser.id).maybeSingle(),'existing application check');
assert.equal(existingApplication,null,'Use a fresh designated Staging Captain test account');
const existingCaptain=must(await captain.from('v31_captain_profiles')
 .select('approval_status').eq('user_id',captainUser.id).maybeSingle(),'existing Captain enrollment check');
if(existingCaptain)assert.equal(existingCaptain.approval_status,'pending','Use a fresh pending Staging Captain account');
else must(await captain.from('v31_captain_profiles')
 .insert({user_id:captainUser.id,approval_status:'pending'}),'Captain enrollment');

const tag=randomUUID().slice(0,8);
assert.equal(must(await captain.rpc('v31_save_captain_application',{
 p_notes:`Staging integration test ${tag}`,p_experience:1
}),'save application draft'),'draft');
assert.equal(must(await captain.rpc('v31_save_captain_vehicle_intent',{
 p_model:'Staging QA vehicle',p_category:'PRIME',p_seats:3,p_plate:`QA-${tag}`
}),'save planned vehicle'),'draft');
assert.equal(must(await captain.rpc('v31_submit_captain_application'),'submit Captain application'),'submitted');

const submitted=must(await admin.from('v31_captain_applications')
 .select('status,submitted_at').eq('user_id',captainUser.id).single(),'Admin sees submitted application');
assert.equal(submitted.status,'submitted');
assert.ok(submitted.submitted_at,'Submission timestamp must persist');
assert.equal(must(await admin.rpc('v31_admin_decide_captain',{
 p_captain:captainUser.id,p_decision:'approved',p_reason:null
}),'real Admin approval'),'approved');

const [application,captainState,audit]=await Promise.all([
 captain.from('v31_captain_applications').select('status,reviewed_at,reviewed_by').eq('user_id',captainUser.id).single(),
 captain.from('v31_captain_profiles').select('approval_status').eq('user_id',captainUser.id).single(),
 captain.from('v31_captain_approval_audit').select('actor_id,decision').eq('captain_id',captainUser.id).order('created_at',{ascending:false}).limit(1)
]);
assert.equal(must(application,'persisted application review').status,'approved');
assert.ok(application.data.reviewed_at,'Admin review timestamp must persist');
assert.equal(application.data.reviewed_by,adminUser.id,'Server must record the real Admin reviewer');
assert.equal(must(captainState,'persisted Captain approval').approval_status,'approved');
const decision=must(audit,'approval audit trail')[0];
assert.equal(decision?.actor_id,adminUser.id);
assert.equal(decision?.decision,'approved');

process.stdout.write('PASS: independent real Google Captain and server-authorized Admin sessions; persisted application submission, approval state, reviewer identity and audit record. Test Captain remains approved in Staging for the route/booking journey.\n');
