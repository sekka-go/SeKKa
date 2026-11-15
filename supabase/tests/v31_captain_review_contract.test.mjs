import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(name)=>readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8');
const review=read('20261115130000_v31_staging_captain_review.sql');
const intent=read('20261115130500_v31_staging_captain_vehicle_intent.sql');
const caps=read('20261115131000_v31_captain_intent_category_guard.sql');
const ui=readFileSync(new URL('../../web/src/v2/AdminApprovalLive.tsx',import.meta.url),'utf8');
test('private documents limit MIME and size, and never use a public bucket',()=>{
 assert.match(review,/public,file_size_limit,allowed_mime_types/i);
 assert.match(review,/false,5242880/);
 assert.match(review,/image\/jpeg/);
 assert.match(review,/application\/pdf/);
 assert.match(review,/bucket_id='v31-captain-docs-staging'/);
 assert.match(review,/storage\.foldername\(name\)/);
 assert.doesNotMatch(ui,/getPublicUrl/);
});
test('all captain state changes require authenticated identity or admin authorization',()=>{
 for(const fn of ['v31_save_captain_application','v31_register_captain_document','v31_submit_captain_application','v31_admin_decide_captain']){
  assert.match(review,new RegExp('function public\\.'+fn));
 }
 assert.match(review,/not \(select public\.v31_is_admin\(\)\)/i);
 assert.match(review,/raise exception 'ADMIN_REQUIRED'/i);
 assert.match(review,/actor_id,decision,reason/);
 assert.match(review,/CREATE TABLE IF NOT EXISTS public\.v31_captain_approval_audit/i);
});
test('application and audit tables are read-only through RLS for clients',()=>{
 for(const table of ['v31_captain_applications','v31_captain_documents','v31_captain_approval_audit']){
  assert.match(review,new RegExp('alter table public\\.'+table+' enable row level security','i'));
 }
 assert.match(review,/revoke all on public\.v31_captain_applications,public\.v31_captain_documents,public\.v31_captain_approval_audit/i);
 assert.match(review,/grant select on public\.v31_captain_applications,public\.v31_captain_documents,public\.v31_captain_approval_audit to authenticated/i);
});
test('vehicle intent remains optional but caps cannot exceed category',()=>{
 assert.match(intent,/intended_vehicle_model/);
 assert.match(caps,/CATEGORY_CAPACITY_EXCEEDED/);
 assert.match(caps,/when 'PRIME' then 3/);
});
