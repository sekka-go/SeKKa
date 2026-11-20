import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../migrations/20261120234000_v31_notification_ack_privileges.sql',import.meta.url),'utf8');
const ui=readFileSync(new URL('../../web/src/v2/LiveNotifications.tsx',import.meta.url),'utf8');

test('notifications can be acknowledged, but not forged or deleted by client roles',()=>{
 assert.match(sql,/revoke insert,update,delete on public\.v31_notifications from anon,authenticated/);
 assert.match(sql,/revoke select on public\.v31_notifications from anon/);
 assert.match(sql,/grant update\(read_at\) on public\.v31_notifications to authenticated/);
 assert.doesNotMatch(sql,/grant update\([^)]*message_ar/);
});
test('server sets the first read timestamp and never rewrites it',()=>{
 assert.match(sql,/if old\.read_at is null then[\s\S]*new\.read_at:=now\(\)/);
 assert.match(sql,/new\.read_at:=old\.read_at/);
 assert.match(sql,/before update of read_at on public\.v31_notifications/);
 assert.match(ui,/update\(\{read_at:new Date\(\)\.toISOString\(\)\}\)/);
});
test('full and reopened capacity notices link to the real Captain trips screen',()=>{
 assert.match(ui,/n\.kind==='route_capacity_full'/);
 assert.match(ui,/n\.kind==='route_seat_reopened'/);
 assert.match(ui,/href="\/\?tab=routes&view=44"/);
});
