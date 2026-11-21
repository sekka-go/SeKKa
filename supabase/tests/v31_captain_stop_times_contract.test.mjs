import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../migrations/20261121183500_v31_captain_stop_passing_times.sql',import.meta.url),'utf8');
const form=readFileSync(new URL('../../web/src/v2/LiveCaptainDraft.tsx',import.meta.url),'utf8');
const review=readFileSync(new URL('../../web/src/v2/LiveCaptainRouteList.tsx',import.meta.url),'utf8');
const rider=readFileSync(new URL('../../web/src/v2/LiveRouteSearch.tsx',import.meta.url),'utf8');
test('migration is additive and optional to existing stops and bookings',()=>{
 assert.match(sql,/add column if not exists outbound_stop_time time without time zone/i);
 assert.match(sql,/add column if not exists return_stop_time time without time zone/i);
 assert.doesNotMatch(sql,/drop table|delete from|truncate |alter table.+not null/i);
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.v31_create_geolocated_route_draft/i);
 assert.match(sql,/SECURITY DEFINER/i);
 assert.match(sql,/r\.captain_id=actor and r\.status='draft'/);
 assert.match(sql,/v31_set_draft_stop_coordinates/);
 assert.match(sql,/INVALID_STOP_PASSING_TIME/);
});
test('every stop has two optional time fields, carried atomically with existing request attempt digest',()=>{
 for(const key of ['outbound_stop_time','return_stop_time'])assert.match(form,new RegExp(key));
 assert.match(form,/v31_create_geolocated_route_draft/);
 assert.match(form,/p_attempt:attempt/);
 assert.match(form,/STOP_TIME_READBACK_FAILED/);
 assert.doesNotMatch(form,/client\.from\('v31_route_stops'\)\.update/);
 assert.match(review,/outbound_stop_time,return_stop_time/);
 assert.match(rider,/outbound_stop_time,return_stop_time/);
});
