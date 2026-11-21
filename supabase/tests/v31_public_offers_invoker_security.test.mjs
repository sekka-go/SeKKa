import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../migrations/20261120195000_v31_public_offers_security_invoker.sql',import.meta.url),'utf8');

test('public seat price is a generated column, private whole-vehicle total still excluded',()=>{
 assert.match(sql,/add column if not exists seat_price_egp integer/);
 assert.match(sql,/generated always as/);
 assert.match(sql,/ceil\(price_egp::numeric/);
 assert.match(sql,/grant select\(seat_price_egp\) on public\.v31_routes to anon,authenticated/);
 assert.doesNotMatch(sql,/grant select\(price_egp\) on public\.v31_routes/);
});
test('published route projection executes with caller permissions, enforcing underlying RLS',()=>{
 assert.match(sql,/with \(security_invoker=true,security_barrier=true\)/);
 assert.match(sql,/where r\.status='published'/);
 assert.match(sql,/grant select on public\.v31_public_route_offers to anon,authenticated/);
 assert.doesNotMatch(sql,/select[\s\S]*r\.price_egp[\s\S]*from public\.v31_routes r/);
});
