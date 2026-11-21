import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../migrations/20261120192000_v31_immutable_seat_index_pricing.sql',import.meta.url),'utf8');
const legacy=readFileSync(new URL('../migrations/20261120185000_v31_private_price_access_boundary.sql',import.meta.url),'utf8');

test('private seat claim table has RLS and is inaccessible to browser roles',()=>{
 assert.match(sql,/alter table public\.v31_booking_seat_claims enable row level security/);
 assert.match(sql,/revoke all on public\.v31_booking_seat_claims from public,anon,authenticated/);
 assert.match(sql,/create unique index if not exists v31_active_seat_index/);
 assert.match(sql,/where released_at is null/);
 assert.match(sql,/primary key \(booking_id,seat_index\)/);
});
test('new booking allocates exact seat-index prices under route lock before return',()=>{
 assert.match(sql,/select \* into route from public\.v31_routes where id=p_route for update/);
 assert.match(sql,/perform public\.v31_allocate_booking_seat_prices\(booking\)/);
 assert.match(sql,/generate_series\(1,v_route\.seat_capacity\)/);
 assert.match(sql,/v_route\.price_egp\/v_route\.seat_capacity/);
 assert.match(sql,/v_route\.price_egp%v_route\.seat_capacity/);
 assert.match(sql,/update public\.v31_bookings set price_snapshot_egp=v_total/);
 assert.match(sql,/if v_claims<>v_booking\.seats then/);
 assert.match(sql,/v_booking\.rider_id is distinct from \(select auth\.uid\(\)\)/);
});
test('stop and cancellation flows do not reprice accepted bookings',()=>{
 const wrapper=sql.slice(sql.indexOf('create or replace function public.v31_reserve_seats_with_stops'),sql.indexOf('-- Release only'));
 assert.match(wrapper,/v_booking:=public\.v31_reserve_seats/);
 assert.doesNotMatch(wrapper,/price_snapshot_egp\s*=/);
 assert.match(sql,/after update of status on public\.v31_bookings/);
 assert.match(sql,/released_at=now\(\)/);
 assert.match(sql,/where booking_id=new\.id and released_at is null/);
 assert.doesNotMatch(sql,/update public\.v31_bookings set price_snapshot_egp\s*=\s*v_route\.price_egp/);
 assert.match(legacy,/revoke select on public\.v31_bookings from public,anon,authenticated/);
});
test('remainder distribution sums to exact private total for every approved capacity',()=>{
 for(const cap of [3,4,9,13]){
  for(const total of [cap,cap+1,cap*7+2,1000,13999]){
   const amounts=Array.from({length:cap},(_,index)=>
    Math.floor(total/cap)+(index<total%cap?1:0));
   assert.equal(amounts.reduce((sum,x)=>sum+x,0),total);
   assert.ok(Math.max(...amounts)-Math.min(...amounts)<=1);
   assert.ok(amounts.every(v=>v>=1));
  }
 }
});
