import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanupQaSeatAttempts} from './staging-parallel-cleanup.mjs';

function harness(bookingStatuses=[[],[]],initialAvailable=1){
 const cancelled=[];
 const rows=bookingStatuses.map((xs,i)=>xs.map((status,j)=>({
  id:`rider-${i}-booking-${j}`,status
 })));
 const riders=rows.map((ownRows,i)=>({
  from(table){
   assert.equal(table,'v31_bookings');
   const query={
    select(){return query;},
    eq(){return query;},
    then(resolve){return Promise.resolve({data:ownRows,error:null}).then(resolve);}
   };
   return query;
  },
  async rpc(name,{p_booking}={}){
   if(name==='v31_cancel_pending_booking'){
    const row=ownRows.find(x=>x.id===p_booking);
    assert.ok(row&&row.status==='pending');
    row.status='cancelled';cancelled.push(p_booking);
    return {data:true,error:null};
   }
   assert.equal(name,'v31_published_route_available_seats');
   const stillActive=rows.flat().filter(x=>x.status==='pending'||x.status==='confirmed').length;
   return {data:initialAvailable-stillActive,error:null};
  }
 }));
 return {riders,cancelled,rows};
}
const check=(response,operation)=>{
 if(response.error)throw Error(operation+': '+response.error.message);
 return response.data;
};
function args(h){
 return {riders:h.riders,riderIds:['rider1','rider2'],
  routeId:'qa-route',attemptKeys:['unique-1','unique-2'],check};
}

test('cleanup cancels BOTH unexpected winning bookings',async()=>{
 const h=harness([['pending'],['pending']],1);
 const result=await cleanupQaSeatAttempts(args(h));
 assert.equal(result.cancelled,2);
 assert.equal(h.cancelled.length,2);
 assert.ok(h.rows.flat().every(x=>x.status==='cancelled'));
});
test('cleanup finds a committed booking even if its RPC response was lost',async()=>{
 const h=harness([[],['pending']],1);
 assert.deepEqual(await cleanupQaSeatAttempts(args(h)),{cancelled:1});
 assert.deepEqual(h.cancelled,['rider-1-booking-0']);
});
test('cleanup requires capacity restoration, flags confirmed bookings',async()=>{
 const h=harness([['confirmed'],[]],1);
 await assert.rejects(cleanupQaSeatAttempts(args(h)),/REQUIRES_REVIEW.*QA_CAPACITY_NOT_RESTORED/);
 assert.equal(h.cancelled.length,0);
});
test('cleanup leaves test-only account route with no additional bookings alone',async()=>{
 const h=harness([[],[]],1);
 assert.deepEqual(await cleanupQaSeatAttempts(args(h)),{cancelled:0});
});
