import test from 'node:test';import assert from 'node:assert/strict';
import {parseSavedCommute,savedCommuteKey} from './riderCommute.ts';
const good={origin:'المعادي',destination:'التجمع',originPlace:null,destinationPlace:null,
 outbound:'07:30',returnTime:'17:00',period:'weekly',direction:'outbound',savedAt:'2026-11-21T00:00:00.000Z'};
test('valid account-scoped commute can be restored without demo data',()=>{
 assert.deepEqual(parseSavedCommute(good),good);
 assert.equal(savedCommuteKey('00000000-0000-4000-8000-000000000001'),
 'sekka.rider.recurringCommute.v1.00000000-0000-4000-8000-000000000001');
});
test('reject invalid times, same-place routes and untrusted coordinates',()=>{
 assert.equal(parseSavedCommute({...good,outbound:'27:90'}),null);
 assert.equal(parseSavedCommute({...good,destination:good.origin}),null);
 assert.equal(parseSavedCommute({...good,originPlace:{kind:'map',place:{id:'x',name:'X',latitude:129,longitude:45}}}),null);
 assert.equal(parseSavedCommute({...good,originPlace:{kind:'map',place:{id:'x',name:'X',latitude:30,longitude:31}}})?.origin,good.origin);
 assert.throws(()=>savedCommuteKey('../../another-user'),/INVALID_RIDER_ID/);
});
