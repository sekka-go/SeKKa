import test from 'node:test';
import assert from 'node:assert/strict';
import {v31BookingError} from './v31BookingErrors.ts';

test('full capacity gives an actionable message, never raw SQL or PostgREST',()=>{
 for(const error of ['INSUFFICIENT_SEATS','VEHICLE_SEAT_CAPACITY_EXCEEDED']){
  const ar=v31BookingError({message:'ERROR: '+error+' at function'},'ar');
  const en=v31BookingError(error,'en');
  assert.match(ar,/المقاعد|العربية/);
  assert.match(en,/seat|vehicle/i);
  assert.doesNotMatch(ar,/INSUFFICIENT_SEATS|VEHICLE_SEAT_CAPACITY_EXCEEDED/);
 }
});
test('idempotent retry and cancellation failures remain understandable',()=>{
 assert.match(v31BookingError('IDEMPOTENCY_STOPS_CONFLICT'),/نقاط/);
 assert.match(v31BookingError('BOOKING_ALREADY_CANCELLED','en'),/cancelled/);
 assert.match(v31BookingError('BOOKING_NOT_VERIFIED'),/حجوزاتي/);
});
test('unknown database messages are never passed to the UI',()=>{
 const x=v31BookingError(new Error('sensitive database stack trace'));
 assert.doesNotMatch(x,/database|stack|sensitive/);
});
