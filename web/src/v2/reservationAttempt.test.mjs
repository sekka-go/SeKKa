import test from 'node:test';
import assert from 'node:assert/strict';
import {clearReservationAttempt,reservationIdempotencyKey} from './reservationAttempt.ts';

const uuidA='123e4567-e89b-42d3-a456-426614174000';
const uuidB='223e4567-e89b-42d3-a456-426614174000';
const uuidC='323e4567-e89b-42d3-a456-426614174000';

function storage(){
 const values=new Map();
 return {
  getItem:key=>values.get(key)??null,
  setItem:(key,value)=>values.set(key,value),
  removeItem:key=>values.delete(key),
 };
}

test('reservation retries retain their key while a different request gets an independent key',()=>{
 const session=storage();
 assert.equal(reservationIdempotencyKey(session,'route-a:one',()=>uuidA),uuidA);
 assert.equal(reservationIdempotencyKey(session,'route-b:two',()=>uuidB),uuidB);
 assert.equal(reservationIdempotencyKey(session,'route-a:one',()=>{throw Error('must reuse retry key');}),uuidA);
 assert.equal(reservationIdempotencyKey(session,'route-b:two',()=>{throw Error('must reuse retry key');}),uuidB);
});

test('successful verification clears only that request retry key',()=>{
 const session=storage();
 reservationIdempotencyKey(session,'route-a:one',()=>uuidA);
 reservationIdempotencyKey(session,'route-b:two',()=>uuidB);
 clearReservationAttempt(session,'route-a:one');
 assert.equal(reservationIdempotencyKey(session,'route-b:two',()=>{throw Error('must preserve other request');}),uuidB);
 assert.equal(reservationIdempotencyKey(session,'route-a:one',()=>uuidC),uuidC);
});

test('existing single-attempt session state remains retryable after upgrade',()=>{
 const session=storage();
 session.setItem('sekka.v31.reservationAttempt',JSON.stringify({signature:'route-a:one',idempotency:uuidA}));
 assert.equal(reservationIdempotencyKey(session,'route-a:one',()=>{throw Error('must reuse legacy key');}),uuidA);
});
