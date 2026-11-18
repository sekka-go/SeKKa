import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration=readFileSync(new URL('../migrations/20261118015000_v31_rider_request_direction_and_duplicate_guard.sql',import.meta.url),'utf8');
const frontend=readFileSync(new URL('../../web/src/v2/LiveTripRequests.tsx',import.meta.url),'utf8');
const search=readFileSync(new URL('../../web/src/v2/LiveRouteSearch.tsx',import.meta.url),'utf8');

test('request schema captures each supported direction without fabricating a time',()=>{
 assert.match(migration,/direction text not null default 'outbound'/);
 assert.match(migration,/return_time time without time zone/);
 assert.match(migration,/outbound_time drop not null/);
 assert.match(migration,/direction='return' and outbound_time is null and return_time is not null/);
 assert.match(migration,/direction='round_trip' and outbound_time is not null and return_time is not null/);
 assert.match(frontend,/outbound=requestDirection==='return'\?null:requestTime/);
 assert.match(frontend,/inbound=requestDirection==='outbound'\?null:requestReturnTime/);
 assert.match(frontend,/saved\.direction!==requestDirection/);
 assert.match(frontend,/saved\.return_time\?\.slice\(0,5\)/);
 assert.match(search,/returnTime,period:requestPeriod/);
});

test('server serializes open-request duplicates independently of client-side checks',()=>{
 assert.match(migration,/security invoker set search_path=''/);
 assert.match(migration,/pg_catalog\.pg_advisory_xact_lock\(7531/);
 assert.match(migration,/old\.rider_id=new\.rider_id and old\.status='open'/);
 assert.match(migration,/old\.outbound_time is not distinct from new\.outbound_time/);
 assert.match(migration,/old\.return_time is not distinct from new\.return_time/);
 assert.match(migration,/raise exception 'DUPLICATE_OPEN_TRIP_REQUEST'/);
 assert.match(migration,/before insert on public\.v31_trip_requests/);
 assert.doesNotMatch(migration,/\bdelete from public\.v31_trip_requests\b/i);
});

test('accepting Captain offers validates both schedules and stop order',()=>{
 assert.match(migration,/ELSIF request\.direction='return'/);
 assert.match(migration,/ELSIF request\.direction='round_trip'/);
 assert.match(migration,/route\.return_time IS DISTINCT FROM request\.return_time/);
 assert.match(migration,/request\.direction='return' AND o\.position>d\.position/);
 assert.match(migration,/request\.rider_id<>uid/);
 assert.match(migration,/route\.seat_capacity/);
 assert.match(migration,/revoke all on function public\.v31_accept_trip_offer\(uuid\) from public,anon/);
});
