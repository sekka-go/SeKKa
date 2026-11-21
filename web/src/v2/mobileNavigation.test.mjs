import test from 'node:test';
import assert from 'node:assert/strict';
import {mobileRouteHref,readMobileRoute} from './mobileNavigation.ts';

test('refresh and browser history restore validated journey-specific destinations',()=>{
 assert.deepEqual(readMobileRoute('https://sekka.example/?tab=login&view=4'),{tab:'login',view:4});
 assert.deepEqual(readMobileRoute('https://sekka.example/?tab=captain-onboarding&view=38'),
  {tab:'captain-onboarding',view:38});
 assert.deepEqual(readMobileRoute('https://sekka.example/?tab=routes&view=63'),{tab:'routes',view:42});
 assert.deepEqual(readMobileRoute('https://sekka.example/?tab=unknown&view=64'),{tab:'home'});
});

test('screen IDs are constrained to their owning journey',()=>{
 assert.deepEqual(readMobileRoute('https://sekka.example/?tab=search&view=35'),{tab:'search',view:9});
 assert.deepEqual(readMobileRoute('https://sekka.example/?tab=captain-onboarding&view=12'),
  {tab:'captain-onboarding',view:35});
 assert.deepEqual(readMobileRoute('https://sekka.example/?tab=admin&view=38'),{tab:'admin',view:62});
});

test('route changes discard stale booking data while booking destinations retain selected stops',()=>{
 const current='https://sekka.example/?tab=booking&view=12&route=old&pickup=p1&dropoff=d1&booking=b1';
 assert.equal(mobileRouteHref({tab:'home'},current),'/');
 assert.equal(mobileRouteHref({tab:'booking'},current),
  '/?tab=booking&route=old&pickup=p1&dropoff=d1&booking=b1');
 assert.equal(mobileRouteHref({tab:'booking'},'https://sekka.example/',{
  routeId:'r2',pickupId:'p2',dropoffId:'d2',reverse:true
 }),'/?tab=booking&route=r2&pickup=p2&dropoff=d2&reverse=1');
});

test('canonicalizing the active search detail URL never erases its selected stop pair',()=>{
 const active='https://sekka.example/?tab=search&view=12&route=r7&pickup=p3&dropoff=d8&reverse=1';
 const screen=readMobileRoute(active);
 assert.equal(mobileRouteHref(screen,active),
  '/?tab=search&view=12&route=r7&pickup=p3&dropoff=d8&reverse=1');
 const booking='https://sekka.example/?tab=booking&route=r7&pickup=p3&dropoff=d8&booking=b9';
 assert.equal(mobileRouteHref(readMobileRoute(booking),booking),
  '/?tab=booking&route=r7&pickup=p3&dropoff=d8&booking=b9');
 // Different sections must still discard sensitive, stale booking arguments.
 assert.equal(mobileRouteHref({tab:'notifications'},active),'/?tab=notifications');
 assert.equal(mobileRouteHref({tab:'bookings'},booking),'/?tab=bookings');
});

test('opening a saved booking removes the previous ride selection and preserves only its booking ID',()=>{
 const active='https://sekka.example/?tab=booking&route=old&pickup=p1&dropoff=d1&reverse=1&booking=b1';
 assert.equal(mobileRouteHref({tab:'booking'},active,undefined,'b2'),'/?tab=booking&booking=b2');
 const review=mobileRouteHref({tab:'search',view:12},active);
 const u=new URL(review,'https://sekka.example');
 assert.equal(u.searchParams.get('booking'),null);
 assert.equal(u.searchParams.get('route'),'old');
});
