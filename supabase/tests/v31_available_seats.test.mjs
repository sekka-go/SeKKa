import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const migration=readFileSync(new URL('../migrations/20261115110000_v31_staging_public_route_capacity.sql',import.meta.url),'utf8');
test('available capacity only exposes aggregate for published routes',()=>{
 assert.match(migration,/WHERE r\.id = p_route[\s\S]*r\.status = 'published'/i);
 assert.match(migration,/SUM\(b\.seats\)/i);
 assert.match(migration,/b\.status IN \('pending','confirmed'\)/i);
 assert.match(migration,/GREATEST\([\s\S]*0,/i);
});
test('availability function hides booking rows and has deliberate function grants',()=>{
 assert.match(migration,/SECURITY DEFINER/i);
 assert.match(migration,/SET search_path = ''/i);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.v31_published_route_available_seats\(uuid\) FROM PUBLIC/i);
 assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.v31_published_route_available_seats\(uuid\) TO anon, authenticated/i);
 assert.doesNotMatch(migration,/SELECT\s+\*/i);
});
