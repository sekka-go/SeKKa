import test from 'node:test';
import assert from 'node:assert/strict';
import {formatDistanceMeters,approximateWalkMinutes,orderStopsFarthestFirst,findDuplicateStop,coverageDistanceMetres,walkingEstimate,greatCircleDistanceMeters} from './recurringGeo.ts';
const p=(lat,lng,id='p')=>({lat,lng,id});
test('PostGIS-metre formatting rounds metres by 10, kilometres by 0.1',()=>{
 assert.equal(formatDistanceMeters(321),'320 م');
 assert.equal(formatDistanceMeters(995),'1000 م');
 assert.equal(formatDistanceMeters(1401),'1.4 كم');
 assert.throws(()=>formatDistanceMeters(-1),RangeError);
 assert.throws(()=>formatDistanceMeters(NaN),RangeError);
});
test('walking minutes are approximate with 1.3 detour and 80 metres per minute',()=>{
 assert.equal(approximateWalkMinutes(320),6);
 assert.equal(approximateWalkMinutes(0),0);
 assert.equal(approximateWalkMinutes(800),13);
});
test('stops automatically sort farthest from destination first with deterministic ties',()=>{
 const dest=p(30,31);
 const input=[p(30.01,31,'mid'),p(30.03,31,'far'),p(30.002,31,'near')];
 assert.deepEqual(orderStopsFarthestFirst(input,dest).map(x=>x.id),['far','mid','near']);
 assert.deepEqual(input.map(x=>x.id),['mid','far','near']);
});
test('50m dedupe reuses nearest existing place; does not merge outside radius',()=>{
 const candidate=p(30,31),within=p(30.0003,31,'near'),outside=p(30.001,31,'far');
 assert.equal(findDuplicateStop(candidate,[outside,within])?.id,'near');
 assert.equal(findDuplicateStop(candidate,[outside]),null);
 assert.equal(findDuplicateStop(candidate,[]),null);
});
test('no coverage points is not misreported as a 30km failure',()=>{
 assert.equal(coverageDistanceMetres(p(30,31),[]),null);
 assert.ok(coverageDistanceMetres(p(30,31),[p(31,31)])>30_000);
});
test('routing engine is optional; default is explicitly approximate',async()=>{
 const start=p(30,31),end=p(30.01,31);
 const direct=greatCircleDistanceMeters(start,end);
 const estimated=await walkingEstimate(start,end);
 assert.equal(estimated.approximate,true);
 assert.ok(Math.abs(estimated.metres-direct*1.3)<0.001);
 const routed=await walkingEstimate(start,end,{distanceMeters:async()=>1450});
 assert.equal(routed.approximate,false);
 assert.equal(routed.minutes,19);
});
