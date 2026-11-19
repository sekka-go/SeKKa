import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../migrations/20261119144500_v31_admin_captain_login_email.sql',import.meta.url),'utf8');
const ui=readFileSync(new URL('../../web/src/v2/AdminApprovalLive.tsx',import.meta.url),'utf8');

test('Captain Google email comes from auth.users only through an Admin-protected RPC',()=>{
 assert.match(sql,/security definer/i);
 assert.match(sql,/set search_path\s*=\s*''/i);
 assert.match(sql,/auth\.uid\(\)/i);
 assert.match(sql,/public\.v31_is_admin\(\)/i);
 assert.match(sql,/raise exception 'ADMIN_REQUIRED'/i);
 assert.match(sql,/from public\.v31_captain_applications as a\s+join auth\.users as u on u\.id\s*=\s*a\.user_id/i);
 assert.match(sql,/revoke all on function public\.v31_admin_captain_login_email\(uuid\) from public, anon, authenticated/i);
 assert.match(sql,/grant execute on function public\.v31_admin_captain_login_email\(uuid\) to authenticated/i);
});
test('Admin frontend fetches selected Captain email from RPC only after authorization',()=>{
 assert.match(ui,/authorized!==true/);
 assert.match(ui,/client\.rpc\('v31_admin_captain_login_email',\{p_captain:selected\}\)/);
 assert.match(ui,/setLoginEmail\(null\)/);
 assert.match(ui,/loginEmail\?<bdi dir="ltr"/);
 assert.doesNotMatch(ui,/auth\.admin\.listUsers|\.from\('auth\.users'\)/);
});
