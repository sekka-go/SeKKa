import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../migrations/20261119110000_v31_edit_open_trip_requests_and_history.sql',import.meta.url),'utf8');
const ui=readFileSync(new URL('../../web/src/v2/LiveTripRequests.tsx',import.meta.url),'utf8');

test('Staging-first migration never deletes old Rider requests or opens direct table updates',()=>{
 assert.match(sql,/create or replace function public\.v31_edit_open_trip_request\(/i);
 assert.match(sql,/security definer/i);
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/where id = p_request and rider_id = actor\s+for update/i);
 assert.match(sql,/current_request\.status <> 'open'/);
 assert.match(sql,/v31_trip_offers where request_id = p_request/);
 assert.match(sql,/raise exception 'REQUEST_HAS_OFFERS'/);
 assert.match(sql,/p_seats > 2/);
 assert.match(sql,/grant execute on function public\.v31_edit_open_trip_request/);
 assert.match(sql,/to authenticated;/);
 assert.doesNotMatch(sql,/delete\s+from\s+public\.v31_trip_requests/i);
 assert.doesNotMatch(sql,/create\s+policy/i);
 assert.doesNotMatch(sql,/grant\s+update\s+on\s+public\.v31_trip_requests/i);
});

test('duplicate-trip guard handles both insert and edit without matching current row',()=>{
 assert.match(sql,/pg_catalog\.pg_advisory_xact_lock\(7531/);
 assert.match(sql,/existing_request\.id <> new\.id/);
 assert.match(sql,/existing_request\.outbound_time is not distinct from new\.outbound_time/);
 assert.match(sql,/existing_request\.return_time is not distinct from new\.return_time/);
 assert.match(sql,/before insert or update of origin_area_id,destination_area_id,outbound_time,return_time,period,direction,seats/i);
 assert.match(sql,/DUPLICATE_OPEN_TRIP_REQUEST/);
});

test('Rider UI edits requests rather than multiplying them, separates history, and verifies write',()=>{
 assert.match(ui,/v31_edit_open_trip_request/);
 assert.match(ui,/REQUEST_EDIT_NOT_VERIFIED/);
 assert.match(ui,/const active=visible\.filter\(r=>r\.status==='open'\)/);
 assert.match(ui,/const history=mode==='rider'\?visible\.filter\(r=>r\.status!=='open'\)/);
 assert.match(ui,/<details className="d-request-history">/);
 assert.match(ui,/REQUEST_HAS_OFFERS/);
 assert.match(ui,/!offers\.some\(o=>o\.request_id===r\.id\)/);
});
