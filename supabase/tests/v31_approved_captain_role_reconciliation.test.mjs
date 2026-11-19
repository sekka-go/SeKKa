import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../migrations/20261119152000_v31_preserve_approved_captain_account_role.sql',import.meta.url),'utf8');
const app=readFileSync(new URL('../../web/src/v2/MobileApp.tsx',import.meta.url),'utf8');

test('only server-approved Captains are reconciled, not legacy draft or Rider profiles',()=>{
 assert.match(sql,/c\.approval_status='approved' and a\.status='approved'/);
 assert.match(sql,/p\.role_preference='rider'/);
 assert.match(sql,/set role_preference='captain'/);
 assert.match(sql,/before insert or update of role_preference/);
 assert.match(sql,/new\.role_preference:='captain'/);
 assert.doesNotMatch(sql,/delete from|truncate /i);
});
test('runtime approved Captain decision comes from server, never from browser intent',()=>{
 assert.match(app,/const approvedCaptain=captainRow\?\.approval_status==='approved'/);
 assert.match(app,/approvedCaptain\?'captain'/);
 assert.match(app,/if\(approvedCaptain\)\{/);
 assert.match(app,/setCaptainApproved\(approvedCaptain\)/);
 assert.match(app,/const captainDestination:MobileRoute=\{tab:'routes',view:42\}/);
 assert.match(app,/if\(captainError\)throw captainError/);
});
