import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const notifications=readFileSync(new URL('../migrations/20261120224000_v31_capacity_transition_notifications.sql',import.meta.url),'utf8');
const summary=readFileSync(new URL('../migrations/20261120225500_v31_captain_capacity_summary.sql',import.meta.url),'utf8');
const ui=readFileSync(new URL('../../web/src/v2/LiveCaptainRouteList.tsx',import.meta.url),'utf8');

test('capacity notices are triggered by transactional booking insert and status changes',()=>{
 assert.match(notifications,/after insert or update of status on public\.v31_bookings/);
 assert.match(notifications,/tg_op='INSERT'/);
 assert.match(notifications,/v_filled=v_capacity/);
 assert.match(notifications,/v_filled\+old\.seats=v_capacity/);
 assert.match(notifications,/v_reopened and v_filled\+old\.seats=v_capacity/);
 assert.match(notifications,/route_capacity_full/);
 assert.match(notifications,/route_seat_reopened/);
 assert.doesNotMatch(notifications,/set\s+departure_date\s*=/i);
});
test('only the signed-in Captain can see exact occupancy, not a 500 booking cap',()=>{
 assert.match(summary,/r\.captain_id=\(select auth\.uid\(\)\)/);
 assert.match(summary,/x\.status in \('pending','confirmed'\)/);
 assert.match(summary,/coalesce\(sum\(x\.seats\),0\)/);
 assert.match(summary,/grant execute on function public\.v31_captain_route_capacity_summary/);
 assert.match(summary,/revoke all on function public\.v31_captain_route_capacity_summary\(uuid\) from public,anon/);
 assert.match(ui,/rpc\('v31_captain_route_capacity_summary'\)/);
 assert.doesNotMatch(ui,/from\('v31_bookings'\)[\s\S]*limit\(500\)/);
 assert.match(ui,/counts\?\.is_full===true/);
});
