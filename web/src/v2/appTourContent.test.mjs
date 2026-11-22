import test from 'node:test';
import assert from 'node:assert/strict';
import {specsForPage} from './appTourContent.ts';

const pageCases=[
 ['rider-home',{tab:'home',view:0},'rider','journey'],
 ['rider-search',{tab:'search',view:9},'rider','places'],
 ['rider-filters',{tab:'search',view:10},'rider','category'],
 ['rider-results',{tab:'search',view:11},'rider','offers'],
 ['rider-details',{tab:'search',view:12},'rider','route'],
 ['rider-booking',{tab:'booking',view:0},'rider','seats'],
 ['rider-reservations',{tab:'bookings',view:0,section:'bookings'},'rider','items'],
 ['rider-requests',{tab:'bookings',view:0,section:'requests'},'rider','requests'],
 ['rider-notifications',{tab:'notifications',view:0},'rider','updates'],
 ['rider-profile',{tab:'profile',view:0},'rider','account'],
 ['captain-onboarding',{tab:'captain-onboarding',view:35},'captain','captainProgress'],
 ['captain-home',{tab:'routes',view:42},'captain','createTrip'],
 ['captain-create',{tab:'routes',view:43},'captain','draftNext'],
 ['captain-routes',{tab:'routes',view:44},'captain','captainRoutes'],
 ['captain-progress',{tab:'routes',view:48},'captain','captainRoutes'],
 ['admin-home',{tab:'admin',view:62},'admin','adminNav'],
 ['admin-users',{tab:'admin',view:64},'admin','adminData'],
 ['admin-last-screen',{tab:'admin',view:73},'admin','adminControls']
];
for(const [name,page,role,required] of pageCases){
 test('tour covers '+name,()=>{
  const steps=specsForPage(page,role);
  assert.ok(steps.length>=2,'No useful guidance for '+name);
  assert.ok(steps.some(step=>step.id===required),name+' missing essential guidance');
  assert.equal(new Set(steps.map(step=>step.id)).size,steps.length,'Duplicate step identifiers');
  for(const item of steps){
   assert.ok(item.selectors.length,'step must have a DOM anchor');
   assert.ok(item.arTitle&&item.enTitle&&item.arBody&&item.enBody,'bilingual copy');
  }
 });
}
test('all actual Captain application and Admin screen numbers have guidance',()=>{
 for(let n=35;n<=41;n++){
  assert.ok(specsForPage({tab:'captain-onboarding',view:n},'captain').length>=3);
 }
 for(let n=42;n<=49;n++){
  assert.ok(specsForPage({tab:'routes',view:n},'captain').length>=3);
 }
 for(let n=62;n<=73;n++){
  assert.ok(specsForPage({tab:'admin',view:n},'admin').length>=3);
 }
});
