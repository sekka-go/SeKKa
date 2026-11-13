import test from 'node:test';import assert from 'node:assert/strict';
import {reservePreview,confirmPreview} from './previewBooking.ts';
const initial=()=>({available:150,reserved:0,bookings:[]});
const input=()=>({id:'booking-1',offerId:'offer-1',availableSeats:1,offer:{price:2800,pickup:{id:'a',name:'A'},dropoff:{id:'b',name:'B'}},quote:{price:1400,start:'2026-11-15',endExclusive:'2026-12-01'}});
test('preview confirmation locks independent offer/stop/price snapshots and reserves only security',()=>{
 const data=input(),state=reservePreview(initial(),data);data.offer.price=999;data.offer.pickup.name='Changed';data.quote.start='2027-01-01';
 assert.equal(state.bookings[0].offer.price,2800);assert.equal(state.bookings[0].offer.pickup.name,'A');assert.equal(state.bookings[0].quote.start,'2026-11-15');assert.equal(state.available,50);assert.equal(state.reserved,100);
 assert.deepEqual(JSON.parse(JSON.stringify(state)),state);
 assert.strictEqual(reservePreview(state,input()),state);
});
test('preview security requires both confirmations and releases exactly once in either order',()=>{
 for(const actors of [['rider','captain'],['captain','rider']]){
 let state=reservePreview(initial(),input());state=confirmPreview(state,'booking-1',actors[0]);assert.equal(state.reserved,100);assert.equal(state.available,50);
 state=confirmPreview(state,'booking-1',actors[1]);assert.equal(state.reserved,0);assert.equal(state.available,150);
 state=confirmPreview(state,'booking-1',actors[1]);assert.equal(state.available,150);
 }
});
test('preview prevents insufficient security and over-capacity bookings',()=>{
 assert.throws(()=>reservePreview({...initial(),available:99},input()),/INSUFFICIENT_SECURITY/);
 const state=reservePreview({...initial(),available:300},input());assert.throws(()=>reservePreview(state,{...input(),id:'booking-2'}),/SOLD_OUT/);
});
