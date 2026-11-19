import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const migration=readFileSync(new URL('../migrations/20261119121000_v31_published_pickup_stop_coordinates.sql',import.meta.url),'utf8');
const gps=readFileSync(new URL('../../web/src/v2/NearbyRides.tsx',import.meta.url),'utf8');
const captain=readFileSync(new URL('../../web/src/v2/LiveCaptainDraft.tsx',import.meta.url),'utf8');
test('nullable coordinates preserve historic routes, draft owner can set coordinates',()=>{
 assert.match(migration,/add column if not exists latitude numeric/);
 assert.match(migration,/add column if not exists longitude numeric/);
 assert.match(migration,/v31_stop_coordinates_pair_check/);
 assert.match(migration,/v31_set_draft_stop_coordinates/);
 assert.match(migration,/r\.captain_id=actor and r\.status='draft'/);
 assert.match(migration,/revoke all on function.*from public,anon/);
 assert.match(migration,/to authenticated/);
 assert.doesNotMatch(migration,/delete\s+from/i);
});
test('Rider GPS is requested on click and never persisted or transmitted',()=>{
 assert.match(gps,/navigator\.geolocation\.getCurrentPosition/);
 assert.match(gps,/const findMe=\(\)=>/);
 assert.match(gps,/maxDistanceKm|nearbyPublishedStops/);
 assert.match(gps,/v31_published_route_available_seats/);
 assert.match(gps,/fetchPublishedSelection/);
 assert.doesNotMatch(gps,/localStorage\.setItem|sessionStorage\.setItem/);
 assert.doesNotMatch(gps,/\.insert\(|\.upsert\(|\.update\(/);
});
test('Captain stop coordinate entry is saved only after draft and read back',()=>{
 assert.match(captain,/navigator\.geolocation\.getCurrentPosition/);
 assert.match(captain,/v31_set_draft_stop_coordinates/);
 assert.match(captain,/STOP_COORDINATE_READBACK_FAILED/);
});
