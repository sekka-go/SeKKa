import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const truncate=readFileSync(new URL('../migrations/20261120204500_v31_revoke_client_truncate.sql',import.meta.url),'utf8');
const fare=readFileSync(new URL('../migrations/20261120210000_v31_booking_exact_fare_status.sql',import.meta.url),'utf8');
const booking=readFileSync(new URL('../../web/src/v2/BookingFlow.tsx',import.meta.url),'utf8');

test('client roles cannot TRUNCATE public tables even though RLS cannot protect TRUNCATE',()=>{
 assert.match(truncate,/revoke truncate on all tables in schema public from anon,authenticated/);
 assert.match(truncate,/alter default privileges for role postgres in schema public/);
});
test('fare status is owner scoped and does not reveal historical whole-vehicle price',()=>{
 assert.match(fare,/b\.rider_id=\(select auth\.uid\(\)\)/);
 assert.match(fare,/and \(select auth\.uid\(\)\) is not null/);
 assert.match(fare,/filter \(where c\.legacy=false\)=b\.seats/);
 assert.match(fare,/then b\.price_snapshot_egp/);
 assert.match(fare,/revoke all on function public\.v31_rider_booking_fare_status/);
 assert.match(fare,/grant execute on function public\.v31_rider_booking_fare_status/);
 assert.match(fare,/revoke insert,update,delete on public\.v31_bookings from anon,authenticated/);
 assert.match(booking,/rpc\('v31_rider_booking_fare_status'/);
 assert.match(booking,/fare\.is_exact/);
 assert.match(booking,/Recorded seat fare/);
 assert.match(booking,/Estimated legacy seat fare/);
 assert.doesNotMatch(booking,/\.select\('[^']*price_snapshot_egp/);
});
