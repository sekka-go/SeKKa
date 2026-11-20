import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migrations=new URL('../migrations/',import.meta.url);
const ddl=readFileSync(new URL('20261120232000_v31_revoke_client_trigger_references.sql',migrations),'utf8');
const old=readFileSync(new URL('20261120204500_v31_revoke_client_truncate.sql',migrations),'utf8');
const ui=readFileSync(new URL('../../web/src/v2/LiveNotifications.tsx',import.meta.url),'utf8');
const qa=readFileSync(new URL('../../web/scripts/staging-parallel-last-seat.mjs',import.meta.url),'utf8');
const preflight=readFileSync(new URL('../../web/scripts/staging-preflight.mjs',import.meta.url),'utf8');

test('the app roles cannot control database triggers, foreign keys or bulk table deletion',()=>{
 assert.match(ddl,/revoke references, trigger on all tables in schema public from anon,authenticated/i);
 assert.match(ddl,/alter default privileges for role postgres in schema public/i);
 assert.match(old,/revoke truncate on all tables in schema public from anon,authenticated/i);
});
test('real booking concurrency harness only targets dedicated staging QA route and checks both idempotency keys for cleanup',()=>{
 assert.match(qa,/DISPOSABLE_STAGING_OPT_IN_REQUIRED/);
 assert.match(qa,/REFUSE_NON_STAGING/);
 assert.match(qa,/REFUSE_REAL_CUSTOMER_ROUTE/);
 assert.match(qa,/Promise\.allSettled\(/);
 assert.match(qa,/attemptKeys=\[randomUUID\(\),randomUUID\(\)\]/);
 assert.match(qa,/cleanupQaSeatAttempts\(/);
 assert.match(preflight,/ANON_PRIVATE_COLUMN_READ_ALLOWED/);
 assert.match(preflight,/v31_captain_route_capacity_summary/);
 assert.match(preflight,/v31_rider_booking_fare_status/);
});
test('Captain receives direct actions for full and reopened seating only',()=>{
 assert.match(ui,/n\.kind==='route_capacity_full'/);
 assert.match(ui,/n\.kind==='route_seat_reopened'/);
 assert.match(ui,/href="\/\?tab=routes&view=44"/);
 assert.doesNotMatch(ui,/scheduleDepartureAutomatically|autoSetDeparture/);
});
