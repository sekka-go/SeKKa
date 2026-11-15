/**
 * Real backend journey gate. Run ONLY against a disposable Supabase staging project:
 *
 * SEKKA_TEST_DATABASE=true VITE_SUPABASE_URL=https://<staging>.supabase.co \
 * VITE_SUPABASE_PUBLISHABLE_KEY=... \
 * SEKKA_CAPTAIN_ACCESS_TOKEN=<real Google-authenticated captain JWT> \
 * SEKKA_RIDER_ACCESS_TOKEN=<real Google-authenticated rider JWT> \
 * node scripts/real-journey.mjs
 *
 * Tokens are never logged. This script creates durable staging records.
 * It intentionally has NO password/OTP/payment-based login fallback.
 */
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const env=process.env;
assert.equal(env.SEKKA_TEST_DATABASE,'true','Explicit disposable staging opt-in required');
const url=env.VITE_SUPABASE_URL,key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url&&key,'Missing staging public config');
assert.equal(new URL(url).hostname,'zgcvumykzivsvnlflbyp.supabase.co','REFUSE_NON_STAGING_DATABASE');
assert.ok(env.SEKKA_CAPTAIN_ACCESS_TOKEN&&env.SEKKA_RIDER_ACCESS_TOKEN,'Two independently authenticated Google sessions required');
const actor=(token)=>createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const captain=actor(env.SEKKA_CAPTAIN_ACCESS_TOKEN),rider=actor(env.SEKKA_RIDER_ACCESS_TOKEN);
const must=(r,operation)=>{if(r.error)throw Error(`${operation}: ${r.error.message}`);return r.data;};
const captainUser=must(await captain.auth.getUser(env.SEKKA_CAPTAIN_ACCESS_TOKEN),'captain identity').user;
const riderUser=must(await rider.auth.getUser(env.SEKKA_RIDER_ACCESS_TOKEN),'rider identity').user;
assert.notEqual(captainUser.id,riderUser.id,'Sessions must represent different users');
const approval=must(await captain.from('v31_captain_profiles').select('approval_status').eq('user_id',captainUser.id).single(),'captain approval');
assert.equal(approval.approval_status,'approved');
const areas=must(await captain.from('v31_service_areas').select('id,name_ar').eq('active',true).order('id').limit(2),'areas');
assert.equal(areas.length,2,'Need two active areas');
const testTag=randomUUID().slice(0,8);
const vehicle=must(await captain.from('v31_vehicles').insert({captain_id:captainUser.id,model:'QA vehicle',plate_number:`STG-${testTag}`,category:'PRIME',seats:3}).select('id,seats,status').single(),'captain test vehicle registration');
assert.equal(vehicle.seats,3);
const title=`STAGING E2E ${testTag}`;
const routeId=must(await captain.rpc('v31_create_route_draft',{p_title:title,p_category:'PRIME',p_capacity:3,p_direction:'outbound',p_period:'monthly',p_outbound:'07:30',p_return:null,p_return_supported:false,p_price:800,p_stops:[{area_id:areas[0].id,name:'Test origin',pickup:true,dropoff:true},{area_id:areas[1].id,name:'Test destination',pickup:true,dropoff:true}]}),'draft creation');
assert.equal(typeof routeId,'string');
must(await captain.from('v31_routes').update({status:'published'}).eq('id',routeId).eq('captain_id',captainUser.id).select('id').single(),'publish');
const found=must(await rider.from('v31_routes').select('id,title,seat_capacity').eq('id',routeId).single(),'passenger search');
assert.equal(found.title,title);
const stops=must(await rider.from('v31_route_stops').select('id,area_id,position').eq('route_id',routeId).order('position'),'published stops');
assert.equal(stops.length,2);
const availability=async()=>must(await rider.rpc('v31_published_route_available_seats',{p_route:routeId}),'route availability');
assert.equal(await availability(),3,'Published test route starts with three available seats');
const key1=randomUUID();
const id1=must(await rider.rpc('v31_reserve_seats_with_stops',{p_route:routeId,p_seats:2,p_idempotency:key1,p_pickup:stops[0].id,p_dropoff:stops[1].id,p_reverse:false}),'first booking');
const id2=must(await rider.rpc('v31_reserve_seats',{p_route:routeId,p_seats:2,p_idempotency:key1}),'idempotent retry');
assert.equal(id1,id2);
assert.equal(await availability(),1,'Atomic 2-seat booking reduces availability to one');
const key2=randomUUID();
const exceeded=await rider.rpc('v31_reserve_seats_with_stops',{p_route:routeId,p_seats:2,p_idempotency:key2,p_pickup:stops[0].id,p_dropoff:stops[1].id,p_reverse:false});
assert.ok(exceeded.error,'Overselling capacity must fail');

const raceKeys=[randomUUID(),randomUUID()];
const race=await Promise.all(raceKeys.map(p_idempotency=>
 rider.rpc('v31_reserve_seats_with_stops',{
  p_route:routeId,p_seats:1,p_idempotency,
  p_pickup:stops[0].id,p_dropoff:stops[1].id,p_reverse:false
 })
));
const winners=race.filter(r=>!r.error);
const denied=race.filter(r=>Boolean(r.error));
assert.equal(winners.length,1,'Concurrent attempts for last seat must yield exactly one booking');
assert.equal(denied.length,1,'Concurrent overbooking attempt must be rejected by PostgreSQL');
const raceBookingId=must(winners[0],'concurrent winning booking');
const winnerRow=must(await rider.from('v31_bookings').select('status,seats').eq('id',raceBookingId).single(),'concurrent winner persisted');
assert.equal(winnerRow.status,'pending');
assert.equal(winnerRow.seats,1);
assert.equal(await availability(),0,'Last seat cannot be overbooked');
must(await rider.rpc('v31_cancel_pending_booking',{p_booking:raceBookingId}),'release concurrent winner');
assert.equal(await availability(),1,'Released contested seat is visible again');
// Without a second independently authenticated passenger, this probes PostgreSQL
// row locking using two simultaneous requests from one rider; do not label it
// a cross-account concurrency acceptance.

const cRefreshed=actor(env.SEKKA_CAPTAIN_ACCESS_TOKEN),rRefreshed=actor(env.SEKKA_RIDER_ACCESS_TOKEN);
const captainBooking=must(await cRefreshed.from('v31_bookings').select('id,seats,status,pickup_stop_id,dropoff_stop_id,price_snapshot_egp,period_snapshot').eq('id',id1).single(),'captain persisted booking read');
const riderBooking=must(await rRefreshed.from('v31_bookings').select('id,seats,status').eq('id',id1).single(),'rider persisted booking read');
assert.equal(captainBooking.id,riderBooking.id);
assert.equal(captainBooking.status,riderBooking.status);
assert.equal(captainBooking.seats,riderBooking.seats);
assert.equal(captainBooking.status,'pending');
assert.equal(captainBooking.seats,2);
assert.equal(captainBooking.pickup_stop_id,stops[0].id);
assert.equal(captainBooking.dropoff_stop_id,stops[1].id);
assert.equal(captainBooking.price_snapshot_egp,800);
assert.equal(captainBooking.period_snapshot,'monthly');
// Demand and offer handoff uses the same separate Google sessions.
const reqKey=randomUUID();
const request=must(await rider.from('v31_trip_requests').insert({
 rider_id:riderUser.id,origin_area_id:areas[0].id,destination_area_id:areas[1].id,
 outbound_time:'07:30',period:'monthly',seats:1,request_key:reqKey
}).select('id').single(),'passenger demand');
const captainRequest=must(await cRefreshed.from('v31_trip_requests').select('id').eq('id',request.id).single(),'captain sees open demand');
assert.equal(captainRequest.id,request.id);
const offer=must(await captain.from('v31_trip_offers').insert({request_id:request.id,captain_id:captainUser.id,route_id:routeId}).select('id').single(),'captain offer');
const riderOffer=must(await rRefreshed.from('v31_trip_offers').select('id').eq('id',offer.id).single(),'rider sees offer');
assert.equal(riderOffer.id,offer.id);
const acceptedBooking=must(await rider.rpc('v31_accept_trip_offer',{p_offer:offer.id}),'accept offer and reserve final seat');
assert.equal(must(await rider.rpc('v31_accept_trip_offer',{p_offer:offer.id}),'idempotent offer acceptance'),acceptedBooking);
const acceptedState=must(await rRefreshed.from('v31_trip_requests').select('status,accepted_offer_id').eq('id',request.id).single(),'persist accepted demand');
assert.equal(acceptedState.status,'accepted');
assert.equal(acceptedState.accepted_offer_id,offer.id);
const captainAccepted=must(await cRefreshed.from('v31_bookings').select('id,seats,status').eq('id',acceptedBooking).single(),'captain sees accepted offer booking');
assert.equal(captainAccepted.seats,1);
const captainAdmin=await captain.rpc('v31_is_admin');
assert.equal(must(captainAdmin,'captain admin status'),false,'Captain must not be admin');
const riderAdmin=await rider.rpc('v31_is_admin');
assert.equal(must(riderAdmin,'passenger admin status'),false,'Passenger must not be admin');
const unauthorizedAdmin=await rider.rpc('v31_admin_overview');
assert.ok(unauthorizedAdmin.error,'Passenger must not access admin data');
const unread=must(await rRefreshed.from('v31_notifications').select('id,kind').eq('kind','new_offer').limit(20),'rider notifications');
assert.ok(unread.some(n=>n.kind==='new_offer'),'Offer notification should persist');
must(await rider.rpc('v31_cancel_pending_booking',{p_booking:acceptedBooking}),'cancel accepted booking');
must(await rider.rpc('v31_cancel_pending_booking',{p_booking:id1}),'cancel');
const cancelled=must(await rRefreshed.from('v31_bookings').select('status').eq('id',id1).single(),'persisted cancellation');
assert.equal(cancelled.status,'cancelled');
assert.equal(await availability(),3,'Cancellation of both reservations restores all three seats');
process.stdout.write('PASS: two independent Google sessions, captain publish, rider route visibility, single-rider concurrent last-seat attempts, atomic booking, notifications, admin restriction, persistence, cancellation and seat restoration. Cross-account concurrency and browser UI acceptance require additional authorized sessions and must not be inferred. Test route remains in staging.\n');
