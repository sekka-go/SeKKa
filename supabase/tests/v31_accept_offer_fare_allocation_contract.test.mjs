import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration=readFileSync(new URL('../migrations/20261120212000_v31_accept_offer_seat_price_snapshot.sql',import.meta.url),'utf8');
const pricing=readFileSync(new URL('../migrations/20261120192000_v31_immutable_seat_index_pricing.sql',import.meta.url),'utf8');

test('offer acceptance calls the audited seat price allocator immediately after booking insert',()=>{
 assert.match(migration,/public\.v31_accept_trip_offer\(uuid\)/);
 assert.match(migration,/VALUES\(route\.id,uid,request\.seats,request\.id,'pending'\) RETURNING id INTO booking/);
 assert.match(migration,/PERFORM public\.v31_allocate_booking_seat_prices\(booking\)/);
 assert.match(migration,/OFFER_ACCEPTANCE_EXPECTED_ANCHOR_CHANGED/);
 assert.match(migration,/grant execute on function public\.v31_accept_trip_offer\(uuid\) to authenticated/);
 assert.match(pricing,/select \* into v_route from public\.v31_routes where id=v_booking\.route_id for update/);
 assert.match(pricing,/v_booking\.rider_id is distinct from \(select auth\.uid\(\)\)/);
});
test('no new payment system or automatic trip rescheduling introduced',()=>{
 assert.doesNotMatch(migration,/payment|auto_schedule|departure_date|commission/i);
});
