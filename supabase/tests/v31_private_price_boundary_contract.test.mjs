import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration=readFileSync(new URL('../migrations/20261120185000_v31_private_price_access_boundary.sql',import.meta.url),'utf8');
const search=readFileSync(new URL('../../web/src/v2/LiveRouteSearch.tsx',import.meta.url),'utf8');
const nearby=readFileSync(new URL('../../web/src/v2/NearbyRides.tsx',import.meta.url),'utf8');
const booking=readFileSync(new URL('../../web/src/v2/BookingFlow.tsx',import.meta.url),'utf8');
const captain=readFileSync(new URL('../../web/src/v2/LiveCaptainRouteList.tsx',import.meta.url),'utf8');

test('public offers expose seat price, not private vehicle total, and only published rows',()=>{
 assert.match(migration,/create or replace view public\.v31_public_route_offers/);
 assert.match(migration,/r\.status='published'/);
 assert.match(migration,/as seat_price_egp/);
 assert.match(migration,/revoke select on public\.v31_routes from public,anon,authenticated/);
 assert.match(migration,/grant select \(\s*id,captain_id,title/);
 assert.doesNotMatch(migration,/grant select \([^;]*price_egp[^;]*\) on public\.v31_routes/);
 assert.match(search,/from\('v31_public_route_offers'\)/);
 assert.match(nearby,/from\('v31_public_route_offers'\)/);
 assert.doesNotMatch(search,/from\('v31_routes'\)/);
 assert.doesNotMatch(nearby,/from\('v31_routes'\)/);
});
test('captains alone can retrieve their private total and riders cannot query old snapshots',()=>{
 assert.match(migration,/r\.captain_id=\(select auth\.uid\(\)\)/);
 assert.match(migration,/v31_captain_private_prices/);
 assert.match(captain,/rpc\('v31_captain_private_prices'\)/);
 assert.match(migration,/revoke select on public\.v31_bookings from public,anon,authenticated/);
 assert.match(migration,/v31_rider_booking_estimate/);
 assert.match(booking,/rpc\('v31_rider_booking_estimate'/);
 assert.doesNotMatch(booking,/\.select\('[^']*price_snapshot_egp/);
});
