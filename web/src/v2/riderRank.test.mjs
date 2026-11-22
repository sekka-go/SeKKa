import test from 'node:test';import assert from 'node:assert/strict';
import {sortRealRides} from './riderRank.ts';
const route=(id,pickupDistanceKm,time='07:30',price=100,remaining=2)=>({
 id,route:{seat_price_egp:price,outbound_time:time,return_time:null},
 reverse:false,remaining,pickupDistanceKm
});
test('closest real pickup wins; missing geodistance never ranks first',()=>{
 const data=[route('unknown',null,'06:30'),route('far',2.3,'06:45'),route('near',0.3,'08:15')];
 assert.deepEqual(sortRealRides(data,'recommended',true).map(x=>x.id),['near','far','unknown']);
 assert.deepEqual(data.map(x=>x.id),['unknown','far','near']);
});
test('without location only actual departure order applies',()=>{
 assert.deepEqual(sortRealRides([route('b',null,'08:00'),route('a',null,'07:00')],'recommended',false)
  .map(x=>x.id),['a','b']);
});
test('price and seat count sort modes operate on server-returned values',()=>{
 const items=[route('a',0.1,'08:00',150,1),route('b',1.5,'07:00',100,3)];
 assert.deepEqual(sortRealRides(items,'price',true).map(x=>x.id),['b','a']);
 assert.deepEqual(sortRealRides(items,'seats',true).map(x=>x.id),['b','a']);
});
