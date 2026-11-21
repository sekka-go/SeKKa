import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../migrations/20261117231135_v31_limit_two_people_per_rider.sql',import.meta.url),'utf8');
const reservations=readFileSync(new URL('../../web/src/v2/reservations.ts',import.meta.url),'utf8');
const booking=readFileSync(new URL('../../web/src/v2/BookingFlow.tsx',import.meta.url),'utf8');
const requests=readFileSync(new URL('../../web/src/v2/LiveTripRequests.tsx',import.meta.url),'utf8');

test('rider max-two is enforced by BOTH Staging database write triggers',()=>{
 assert.match(sql,/new\.seats\s*>\s*2/);
 assert.match(sql,/before insert or update of seats,route_id,rider_id,status\s+on public\.v31_bookings/i);
 assert.match(sql,/before insert or update of seats\s+on public\.v31_trip_requests/i);
 assert.match(sql,/RIDER_MAX_TWO_SEATS/);
 assert.doesNotMatch(sql,/\b(delete from|truncate table|update public\.v31_trip_requests set)\b/i);
});

test('repeated active reservations on one route cannot bypass the two-person cap',()=>{
 assert.match(sql,/from public\.v31_routes where id=new\.route_id for update/i);
 assert.match(sql,/sum\(b\.seats\)/);
 assert.match(sql,/b\.rider_id=new\.rider_id/);
 assert.match(sql,/b\.status in \('pending','confirmed'\)/);
 assert.match(sql,/already_reserved\+new\.seats>2/);
 assert.match(sql,/b\.id is distinct from new\.id/);
});

test('all production client reservation paths impose the same cap',()=>{
 assert.match(reservations,/MAX_SEATS_PER_RIDER = 2/);
 const guards=reservations.match(/seats>MAX_SEATS_PER_RIDER/g)||[];
 assert.equal(guards.length,2,'both reservation RPC wrappers validate two-seat maximum');
 assert.match(booking,/seats>=MAX_SEATS_PER_RIDER\|\|seats>=offer\.available/);
 assert.match(booking,/setSeats\(v=>Math\.min\(MAX_SEATS_PER_RIDER,offer\.available,v\+1\)\)/);
 assert.match(booking,/seats>MAX_SEATS_PER_RIDER\|\|seats>offer\.available/);
 assert.match(requests,/max=\{MAX_SEATS_PER_RIDER\}/);
 assert.match(requests,/seats>MAX_SEATS_PER_RIDER/);
});
