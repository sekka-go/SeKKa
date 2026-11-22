import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration=readFileSync(new URL('../migrations/20261115140000_v31_idempotent_reservation_retry.sql',import.meta.url),'utf8');
const routeList=readFileSync(new URL('../../web/src/v2/LiveCaptainRouteList.tsx',import.meta.url),'utf8');
const journey=readFileSync(new URL('../../web/scripts/real-journey.mjs',import.meta.url),'utf8');

test('reservation retry serializes same-route calls and recovers unique-key races',()=>{
 assert.match(migration,/SECURITY DEFINER/i);
 assert.match(migration,/SET search_path\s*=\s*''/i);
 assert.match(migration,/SELECT \* INTO v_route[\s\S]*FOR UPDATE/i);
 assert.match(migration,/Recheck after the route lock[\s\S]*SELECT \* INTO v_existing/i);
 assert.match(migration,/ON CONFLICT \(rider_id,idempotency_key\) DO NOTHING/i);
 assert.match(migration,/IDEMPOTENCY_CONFLICT/);
 assert.match(migration,/INSUFFICIENT_SEATS/);
});

test('Captain publishing uses the approved server status transition in UI and real staging journey',()=>{
 assert.match(routeList,/rpc\('v31_set_route_status',\{p_route:id,p_status:status\}\)/);
 assert.match(routeList,/onClick=\{\(\)=>void changeStatus\(route\.id,'published'\)\}[^<]*Confirm and publish/);
 assert.doesNotMatch(routeList,/from\('v31_routes'\)\s*\.update\(\{status:'published'\}\)/);
 assert.match(journey,/rpc\('v31_set_route_status',\{p_route:routeId,p_status:'published'\}\)/);
 assert.doesNotMatch(journey,/from\('v31_routes'\)\.update\(\{status:'published'\}\)/);
});
