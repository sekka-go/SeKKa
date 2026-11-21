import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../migrations/20261121202400_v31_captain_route_removal.sql',import.meta.url),'utf8');
const ui=readFileSync(new URL('../../web/src/v2/LiveCaptainRouteList.tsx',import.meta.url),'utf8');
test('route removal can only act on signed-in owner's own route',()=>{
 assert.match(sql,/actor uuid := \(select auth.uid\(\)\)/);
 assert.match(sql,/current_route\.captain_id is distinct from actor/);
 assert.match(sql,/where id=p_route for update/);
 assert.match(sql,/revoke all on function.*from public, anon/);
 assert.match(sql,/grant execute on function.*to authenticated/);
 assert.match(sql,/ROUTE_NOT_OWNED/);
});
test('draft hard delete blocks all booking, offer and claim history, and removal is audited',()=>{
 assert.match(sql,/current_route.status='draft'/);
 for(const name of ['v31_bookings','v31_booking_seat_claims','v31_trip_offers'])
  assert.match(sql,new RegExp('exists\\(select 1 from public\\.'+name));
 assert.match(sql,/ROUTE_HAS_HISTORY/);
 assert.match(sql,/v31_captain_route_removal_audit/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on table.*from public, anon, authenticated/);
});
test('published routes archive through existing server booking guard, never hard delete',()=>{
 assert.match(sql,/v31_set_route_status\(p_route,'archived'\)/);
 assert.match(sql,/delete from public.v31_routes where id=p_route and captain_id=actor and status='draft'/);
 assert.doesNotMatch(sql,/update public.v31_bookings|delete from public.v31_bookings/i);
 assert.match(ui,/v31_remove_captain_route/);
 assert.match(ui,/pendingRemoval/);
 assert.match(ui,/tab==='archived'/);
 assert.match(ui,/getByRole/===null?/not possible/:/Confirm/);
});
