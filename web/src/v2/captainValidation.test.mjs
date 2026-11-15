import test from 'node:test';
import assert from 'node:assert/strict';
import {
 captainPersonalErrors,captainVehicleErrors,normalizeNumerals
} from './captainValidation.ts';

const valid={
 fullName:'Mona Hassan',
 phone:'01012345678',
 professionalBackground:'Daily route captain',
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
