/**
 * TRUE parallel last-seat acceptance using two DIFFERENT Google-authenticated
 * Riders and a dedicated approved Captain-owned staging QA route.
 *
 * This does NOT run in ordinary CI and NEVER runs against Production.
 * REQUIRE:
 *   SEKKA_TEST_DATABASE=true
 *   VITE_SUPABASE_URL=https://zgcvumykzivsvnlflbyp.supabase.co
 *   VITE_SUPABASE_PUBLISHABLE_KEY=<public key>
 *   SEKKA_QA_CAPTAIN_ACCESS_TOKEN=<approved Google captain JWT>
 *   SEKKA_RIDER_ONE_ACCESS_TOKEN=<Google rider 1 JWT>
 *   SEKKA_RIDER_TWO_ACCESS_TOKEN=<Google rider 2 JWT>
 *   SEKKA_QA_ROUTE_ID=<published QA route with title beginning STAGING CONCURRENCY QA>
 *
 * Only one seat must remain. One of two parallel requests must succeed,
 * the other must be rejected by the database. The successful booking is
 * cancelled in finally, restoring availability, but a cancelled QA booking
 * and audit notifications are intentionally kept in staging.
 * DO NOT use an active customer route.
 */
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';

const env=process.env;
assert.equal(env.SEKKA_TEST_DATABASE,'true','DISPOSABLE_STAGING_OPT_IN_REQUIRED');
assert.equal(new URL(env.VITE_SUPABASE_URL||'https://invalid.invalid').hostname,
 'zgcvumykzivsvnlflbyp.supabase.co','REFUSE_NON_STAGING');
for(const k of ['VITE_SUPABASE_PUBLISHABLE_KEY','SEKKA_QA_CAPTAIN_ACCESS_TOKEN',
 'SEKKA_RIDER_ONE_ACCESS_TOKEN','SEKKA_RIDER_TWO_ACCESS_TOKEN','SEKKA_QA_ROUTE_ID']){
 assert.ok(env[k],`MISSING_${k}`);
}
assert.match(env.SEKKA_QA_ROUTE_ID,/^[0-9a-f-]{36}$/i,'INVALID_QA_ROUTE_ID');
const client=(token)=>createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY,{
 global:{headers:{Authorization:`Bearer ${token}`}},
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const captain=client(env.SEKKA_QA_CAPTAIN_ACCESS_TOKEN);
const riders=[client(env.SEKKA_RIDER_ONE_ACCESS_TOKEN),client(env.SEKKA_RIDER_TWO_ACCESS_TOKEN)];
const check=(x,operation)=>{
 if(x.error)throw new Error(`${operation}: ${x.error.code||'ERROR'} ${x.error.message}`);
 return x.data;
};
const actors=await Promise.all([
 captain.auth.getUser(env.SEKKA_QA_CAPTAIN_ACCESS_TOKEN),
 riders[0].auth.getUser(env.SEKKA_RIDER_ONE_ACCESS_TOKEN),
 riders[1].auth.getUser(env.SEKKA_RIDER_TWO_ACCESS_TOKEN)
]);
const ids=actors.map((x,i)=>check(x,'Google user '+i)?.user?.id);
assert.equal(new Set(ids).size,3,'THREE_DISTINCT_GOOGLE_USERS_REQUIRED');
for(const [i,a] of actors.entries())
 assert.ok(a.data?.user?.app_metadata?.providers?.includes('google')||
  a.data?.user?.app_metadata?.provider==='google',`GOOGLE_SESSION_REQUIRED_${i}`);
const routeId=env.SEKKA_QA_ROUTE_ID;
const route=check(await captain.from('v31_routes').select('id,title,status,seat_capacity,captain_id,direction')
 .eq('id',routeId).eq('captain_id',ids[0]).single(),'Captain-owned QA route');
assert.equal(route.status,'published','QA_ROUTE_MUST_BE_PUBLISHED');
assert.ok(route.title.startsWith('STAGING CONCURRENCY QA'),'REFUSE_REAL_CUSTOMER_ROUTE');
assert.ok(route.direction==='outbound'||route.direction==='round_trip','QA_NEEDS_OUTBOUND_ROUTE');
const stops=check(await captain.from('v31_route_stops')
 .select('id,position,pickup_allowed,dropoff_allowed').eq('route_id',routeId)
 .order('position'),'QA route stops');
const origin=stops.find(s=>s.pickup_allowed);
const destination=[...stops].reverse().find(s=>s.dropoff_allowed&&s.position>(origin?.position??Infinity));
assert.ok(origin&&destination,'QA_PICKUP_AND_DROPOFF_REQUIRED');
const before=check(await riders[0].rpc('v31_published_route_available_seats',{p_route:routeId}),'initial seats');
assert.equal(before,1,'QA_ROUTE_MUST_HAVE_EXACTLY_ONE_REMAINING_SEAT');
for(let i=0;i<2;i++){
 const rows=check(await riders[i].from('v31_bookings').select('id,seats,status')
  .eq('route_id',routeId).eq('rider_id',ids[i+1]).in('status',['pending','confirmed']),
 `Rider ${i+1} active QA bookings`);
 assert.equal(rows.length,0,'QA_RIDERS_MUST_HAVE_NO_ACTIVE_BOOKING');
}
let winner=null;
let outcome=[];
try{
 outcome=await Promise.all(riders.map(r=>r.rpc('v31_reserve_seats_with_stops',{
  p_route:routeId,p_seats:1,p_idempotency:randomUUID(),
  p_pickup:origin.id,p_dropoff:destination.id,p_reverse:false
 })));
 const winners=outcome.map((r,i)=>({r,i})).filter(x=>!x.r.error);
 const rejected=outcome.filter(x=>x.error);
 assert.equal(winners.length,1,'CONCURRENT_LAST_SEAT_EXPECTED_EXACTLY_ONE_WINNER');
 assert.equal(rejected.length,1,'CONCURRENT_LAST_SEAT_EXPECTED_ONE_REJECTION');
 assert.match(rejected[0].error.message,/INSUFFICIENT_SEATS|VEHICLE_SEAT_CAPACITY_EXCEEDED/,
  'REJECTION_MUST_BE_CAPACITY_GUARD');
 winner={id:winners[0].r.data,actor:winners[0].i};
 const booked=check(await riders[winner.actor].from('v31_bookings')
  .select('id,status,seats').eq('id',winner.id).single(),'winning seat');
 assert.equal(booked.seats,1);
 assert.equal(booked.status,'pending');
 const fare=check(await riders[winner.actor].rpc('v31_rider_booking_fare_status',{p_booking:winner.id}),
  'exact immutable winning seat fare');
 assert.equal(fare.length,1);
 assert.equal(fare[0].is_exact,true);
 assert.ok(fare[0].amount_egp>0);
 assert.equal(check(await riders[0].rpc('v31_published_route_available_seats',{p_route:routeId}),
  'capacity after race'),0,'QA_ROUTE_MUST_BE_FULL_AFTER_ONE_WINNER');
 console.log('PASS: two different Google Rider sessions, simultaneous last-seat reservation, one exact-priced winner and one capacity rejection.');
}finally{
 if(winner?.id){
  check(await riders[winner.actor].rpc('v31_cancel_pending_booking',{p_booking:winner.id}),
   'cancel QA winning booking');
  assert.equal(check(await riders[0].rpc('v31_published_route_available_seats',{p_route:routeId}),
   'restored capacity'),1,'QA_CAPACITY_NOT_RESTORED');
  console.log('CLEANUP: winning QA booking cancelled, no active QA seats left; audit rows retained on Staging.');
 }
}
