import test from 'node:test';
import assert from 'node:assert/strict';
import {requestSharedPublic} from './sharedPublicRequests.ts';

const makeDeferred=()=>{
 let resolve,reject;
 const promise=new Promise((done,fail)=>{resolve=done;reject=fail;});
 return {promise,resolve,reject};
};
const unique=label=>'shared-public-test:'+label+':'+Math.random();

test('matching public requests share one backend call across independent screens',async()=>{
 const key=unique('dedupe');
 const work=makeDeferred();
 let started=0;
 const load=async()=>{started++;return work.promise;};
 const first=requestSharedPublic(key,new AbortController().signal,load);
 const second=requestSharedPublic(key,new AbortController().signal,load);
 await Promise.resolve();
 assert.equal(started,1);
 work.resolve(['public-area']);
 assert.deepEqual(await first,['public-area']);
 assert.deepEqual(await second,['public-area']);
});

test('cancelling one UI does not cancel another subscriber waiting for the same result',async()=>{
 const key=unique('subscribers');
 const firstController=new AbortController();
 const secondController=new AbortController();
 const work=makeDeferred();
 let upstream;
 const fetchPublic=async signal=>{upstream=signal;return work.promise;};
 const one=requestSharedPublic(key,firstController.signal,fetchPublic);
 const two=requestSharedPublic(key,secondController.signal,fetchPublic);
 await Promise.resolve();
 firstController.abort();
 await assert.rejects(one,err=>err.name==='AbortError');
 assert.equal(upstream.aborted,false);
 work.resolve({ok:true});
 assert.deepEqual(await two,{ok:true});
});

test('final subscriber leaving cancels the upstream fetch, and a new visit retries',async()=>{
 const key=unique('all-abort');
 const first=new AbortController();
 const d=makeDeferred();
 let upstream,calls=0;
 const loader=async signal=>{calls++;upstream=signal;return d.promise;};
 const old=requestSharedPublic(key,first.signal,loader);
 await Promise.resolve();
 first.abort();
 await assert.rejects(old,err=>err.name==='AbortError');
 assert.equal(upstream.aborted,true);
 assert.equal(calls,1);
 const current=await requestSharedPublic(key,new AbortController().signal,async()=>{
  calls++;return {latest:true};
 });
 assert.deepEqual(current,{latest:true});
 assert.equal(calls,2);
 d.resolve({stale:true});
});

test('public catalog TTL reuses successful results without persisting private requests',async()=>{
 const key=unique('ttl');
 let loads=0;
 const loader=async()=>{loads++;return ['Cairo','Giza'];};
 assert.deepEqual(await requestSharedPublic(key,new AbortController().signal,loader,120_000),['Cairo','Giza']);
 assert.deepEqual(await requestSharedPublic(key,new AbortController().signal,loader,120_000),['Cairo','Giza']);
 assert.equal(loads,1);
});

test('failed public lookups are not cached; next request can recover',async()=>{
 const key=unique('failure');
 let count=0;
 const loader=async()=>{count++;if(count===1)throw Error('temporary');return 'recovered';};
 await assert.rejects(requestSharedPublic(key,new AbortController().signal,loader,10_000),/temporary/);
 assert.equal(await requestSharedPublic(key,new AbortController().signal,loader,10_000),'recovered');
 assert.equal(count,2);
});

test('different geographies and languages never share one request',async()=>{
 const a=await requestSharedPublic(unique('Arabic'),new AbortController().signal,async()=>['العبور']);
 const b=await requestSharedPublic(unique('English'),new AbortController().signal,async()=>['Obour']);
 assert.deepEqual(a,['العبور']);assert.deepEqual(b,['Obour']);
});
