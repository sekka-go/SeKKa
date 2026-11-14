import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectStops,matchesStops} from './stops.ts';
const stops=[{id:'a',name:'A',area:'A',pickup:true,dropoff:false},{id:'b',name:'B',area:'B',pickup:true,dropoff:true},{id:'c',name:'C',area:'C',pickup:false,dropoff:true}];
const back=[...stops].reverse().map(s=>({...s,pickup:s.dropoff,dropoff:s.pickup}));
test('ordered stops support intermediate area matching',()=>{assert.equal(matchesStops(stops,'B','C'),true);assert.equal(matchesStops(stops,'C','A'),false);});
test('round trip reverses selections without separate rider choices',()=>{const s=selectStops(stops,'a','c',back);assert.equal(s.returnPickup.id,'c');assert.equal(s.returnDropoff.id,'a');assert.ok(Object.isFrozen(s));});
test('invalid, same, ineligible and unsupported return stops rejected',()=>{for(const [a,b] of [['a','a'],['c','a'],['x','b'],['b','a']])assert.throws(()=>selectStops(stops,a,b));assert.throws(()=>selectStops(stops,'a','c',stops),/RETURN_STOPS_UNSUPPORTED/);});
