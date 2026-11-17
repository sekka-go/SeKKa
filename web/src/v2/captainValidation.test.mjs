import test from 'node:test';
import assert from 'node:assert/strict';
import {
 captainPersonalErrors,captainVehicleErrors,normalizeNumerals,canonicalEgyptianPlate
} from './captainValidation.ts';

const valid={
 fullName:'Mona Hassan Ali',
 phone:'01012345678',
 professionalBackground:'Experienced driver on daily passenger routes',
 experienceYears:'0'
};

test('accepts a complete Captain profile with zero years of experience',()=>{
 assert.deepEqual(captainPersonalErrors(valid),{});
});

test('reports invalid Captain details by field and accepts localized digits',()=>{
 assert.deepEqual(captainPersonalErrors({
  ...valid,fullName:'Mona',phone:'010123',professionalBackground:'x',experienceYears:'800000'
 }),{
  fullName:'invalid',phone:'invalid',professionalBackground:'invalid',experienceYears:'invalid'
 });
 assert.equal(normalizeNumerals('٠١۲۳'), '0123');
 assert.deepEqual(captainPersonalErrors({
  ...valid,phone:'٠١٠١٢٣٤٥٦٧٨',experienceYears:'٠'
 }),{});
});

test('distinguishes blank draft fields from invalid entered values',()=>{
 assert.deepEqual(captainPersonalErrors({
  fullName:'',phone:'',professionalBackground:'',experienceYears:''
 }),{
  fullName:'required',phone:'required',professionalBackground:'required',experienceYears:'required'
 });
 assert.equal(captainPersonalErrors({...valid,experienceYears:'-1'}).experienceYears,'invalid');
 assert.equal(captainPersonalErrors({...valid,experienceYears:'31'}).experienceYears,'invalid');
 assert.equal(captainPersonalErrors({...valid,experienceYears:'30'}).experienceYears,undefined);
 assert.equal(captainPersonalErrors({...valid,fullName:'Mona Hassan'}).fullName,'invalid');
 assert.equal(captainPersonalErrors({...valid,professionalBackground:'abcdef'}).professionalBackground,'invalid');
 assert.equal(captainPersonalErrors({...valid,professionalBackground:'كلام كلام كلام'}).professionalBackground,'invalid');
});

test('requires a valid selected vehicle and rejects out-of-range years or malformed plates',()=>{
 const vehicle={
  vehicleType:'private_car',makeId:'1',modelId:'2',year:'2010',
  colorCode:'white',colorOther:'',plate:'س ب ك 123'
 };
 assert.deepEqual(captainVehicleErrors(vehicle,2026),{});
 assert.deepEqual(captainVehicleErrors({
  ...vehicle,year:'3000',colorCode:'other',colorOther:'',plate:'x'
 },2026),{
  year:'invalid',colorOther:'required',plate:'invalid'
 });
 assert.equal(captainVehicleErrors({...vehicle,year:''},2026).year,'required');
});

test('ordinary Egyptian plate patterns: Cairo, Giza and other governorates',()=>{
 for(const plate of ['أ ب ج ١٢٣','م س ٦٥٨٧','س ص ج 6541','123 أ ب ج','م-س-6587']){
  const v={vehicleType:'private_car',makeId:'1',modelId:'2',year:'2020',colorCode:'white',colorOther:'',plate};
  assert.equal(captainVehicleErrors(v,2026).plate,undefined,plate);
 }
 for(const plate of ['عبث','ABCD','12345','أب123','أبجد1234','أبج12345','ابج12']){
  const v={vehicleType:'private_car',makeId:'1',modelId:'2',year:'2020',colorCode:'white',colorOther:'',plate};
  assert.equal(captainVehicleErrors(v,2026).plate,'invalid',plate);
 }
 assert.equal(canonicalEgyptianPlate('١٢٣ أ ب ج'),'أبج123');
 assert.equal(canonicalEgyptianPlate('٦٥٨٧ م س'),'مس6587');
});
