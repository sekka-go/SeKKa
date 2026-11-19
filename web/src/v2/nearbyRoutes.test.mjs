import test from 'node:test';
import assert from 'node:assert/strict';
import {straightLineKm,nearbyPublishedStops,validCoordinates} from './nearbyRoutes.ts';

const stop=(route_id,id,position,latitude,longitude,pickup_allowed=true,dropoff_allowed=true)=>({
 route_id,id,position,latitude,longitude,pickup_allowed,dropoff_allowed,
 area_id:1,name:id
});
const route={id:'a',direction:'round_trip',return_supported:true};

test('GPS distances are real straight-line kilometres and reject invalid coordinates',()=>{
 assert.equal(straightLineKm({latitude:30,longitude:31},{latitude:30,longitude:31}),0);
 const about1Km=straightLineKm({latitude:30,longitude:31},{latitude:30.009,longitude:31});
 assert.ok(about1Km>0.9&&about1Km<1.1);
 assert.equal(validCoordinates({latitude:91,longitude:31}),false);
 assert.equal(validCoordinates({latitude:30,longitude:NaN}),false);
});
test('nearby search honours actual pickup permission, directions, and stop order',()=>{
 const point={latitude:30,longitude:31};
 const stops=[
  stop('a','first',0,30.001,31,false,true),
  stop('a','second',1,30.01,31,true,true),
  stop('a','last',2,30.02,31,true,false)
 ];
 const ranked=nearbyPublishedStops(point,[route],stops,5);
 assert.equal(ranked.length,2);
 assert.equal(ranked[0].reverse,false);
 assert.equal(ranked[0].pickupStopId,'second');
 assert.equal(ranked[0].dropoffStopId,'last');
 assert.equal(ranked[1].reverse,true);
 assert.equal(ranked[1].pickupStopId,'second');
 assert.equal(ranked[1].dropoffStopId,'first');
 assert.ok(ranked[0].distanceKm>0);
});
test('missing coordinates never produce invented proximity or points outside radius',()=>{
 const point={latitude:30,longitude:31};
 const stops=[stop('a','missing',0,NaN,NaN),stop('a','far',1,30.2,31)];
 assert.deepEqual(nearbyPublishedStops(point,[route],stops,5),[]);
 assert.deepEqual(nearbyPublishedStops(point,[route],stops,0),[]);
});
test('only actual published route input is eligible and nearest valid pickup is selected',()=>{
 const point={latitude:30,longitude:31};
 const rows=[
  stop('a','further',0,30.018,31),
  stop('a','near',1,30.003,31),
  stop('a','end',2,30.03,31)
 ];
 const ranked=nearbyPublishedStops(point,[{...route,direction:'outbound'}],rows,5);
 assert.equal(ranked.length,1);
 assert.equal(ranked[0].pickupStopId,'near');
 assert.equal(ranked[0].dropoffStopId,'end');
});
