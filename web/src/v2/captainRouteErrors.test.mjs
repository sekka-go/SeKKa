import test from 'node:test';
import assert from 'node:assert/strict';
import {captainRouteError} from './captainRouteErrors.ts';

test('known vehicle conflict returns actionable Arabic and English, no raw DB code',()=>{
 const ar=captainRouteError({message:'VEHICLE_HAS_ACTIVE_SERVICE',code:'P0001'},'ar');
 const en=captainRouteError('ERROR: VEHICLE_HAS_ACTIVE_SERVICE at trigger','en');
 assert.match(ar,/العربية/);assert.match(ar,/رحلاتي/);
 assert.match(en,/vehicle/i);assert.match(en,/My routes/);
 assert.doesNotMatch(ar,/VEHICLE_HAS_ACTIVE_SERVICE/);
});
test('unknown SQL and network errors stay private',()=>{
 assert.doesNotMatch(captainRouteError({message:'secret internal stack trace'}),/secret/);
 assert.match(captainRouteError('AUTH_REQUIRED','ar'),/جوجل/);
 assert.match(captainRouteError('STOP_COORDINATES_REQUIRED','en'),/location/);
});