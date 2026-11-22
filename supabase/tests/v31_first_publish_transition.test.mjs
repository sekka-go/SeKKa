import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration=readFileSync(new URL('../migrations/20261115123648_v31_first_publish_transition.sql',import.meta.url),'utf8');

test('approved route owner can publish the first validated draft via server RPC',()=>{
 assert.match(migration,/CREATE OR REPLACE FUNCTION public\.v31_set_route_status/i);
 assert.match(migration,/SECURITY DEFINER/i);
 assert.match(migration,/SET search_path TO ''/i);
 assert.match(migration,/v_route\.captain_id<>v_uid/);
 assert.match(migration,/v_route\.status='draft' AND p_status='published'/);
 assert.match(migration,/ROUTE_STOPS_REQUIRED/);
 assert.match(migration,/SAME_ORIGIN_DESTINATION/);
 assert.match(migration,/CAPTAIN_NOT_APPROVED/);
 assert.match(migration,/ACTIVE_BOOKINGS_PREVENT_ARCHIVE/);
 assert.match(migration,/INVALID_TRANSITION/);
});
