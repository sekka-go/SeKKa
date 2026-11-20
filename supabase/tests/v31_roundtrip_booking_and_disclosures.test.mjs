import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../migrations/20261118115000_v31_roundtrip_booking_preserves_both_legs.sql',import.meta.url),'utf8');
const booking=readFileSync(new URL('../../web/src/v2/BookingFlow.tsx',import.meta.url),'utf8');
const discovery=readFileSync(new URL('../../web/src/v2/Discovery.tsx',import.meta.url),'utf8');

test('round-trip booking persists exact published two-leg terms as one capacity allocation',()=>{
 assert.match(sql,/booked_direction in \('outbound','return','round_trip'\)/);
 assert.match(sql,/if v_route\.direction='round_trip' then/);
 assert.match(sql,/not v_route\.return_supported or v_route\.return_time is null/);
 assert.match(sql,/not v_from\.dropoff_allowed or not v_to\.pickup_allowed/);
 assert.match(sql,/raise exception 'ROUND_TRIP_RETURN_STOPS_UNSUPPORTED'/);
 assert.match(sql,/v_direction:='round_trip'/);
 assert.match(sql,/v_booking:=public\.v31_reserve_seats\(p_route,p_seats,p_idempotency\)/);
 assert.doesNotMatch(sql,/\bdelete from public\.v31_bookings\b/i);
});

test('booking still validates owned row and does not claim payment success',()=>{
 assert.match(booking,/row\.booked_direction!==\(offer\?\.direction==='round_trip'/);
 assert.match(booking,/select\('id,status,seats,period_snapshot,booked_direction/);
 assert.match(booking,/v31_rider_booking_estimate/);
 assert.doesNotMatch(booking,/\.select\('[^']*price_snapshot_egp/);
 assert.match(booking,/stored\.booked_direction==='round_trip'/);
 assert.match(booking,/MAX_SEATS_PER_RIDER/);
 assert.match(booking,/No payment or deposit is collected in the app at present/);
 assert.match(booking,/not a final invoice/);
 assert.match(discovery,/returnStops:live\.route\.direction==='round_trip'/);
});

test('role restrictions are unchanged for new round-trip reservation semantics',()=>{
 assert.match(sql,/SECURITY DEFINER/);
 assert.match(sql,/if v_uid is null then raise exception 'AUTH_REQUIRED'/);
 assert.match(sql,/v_route\.status<>'published'/);
 assert.match(sql,/where id=p_pickup and route_id=p_route/);
 assert.match(sql,/where id=p_dropoff and route_id=p_route/);
 assert.match(sql,/from public,anon/);
 assert.match(sql,/to authenticated/);
});
