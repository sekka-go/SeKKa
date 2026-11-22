import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

function setup(){
 const handlers={};
 const store=new Map();
 let fetchCount=0;
 const context={
  URL,
  caches:{
   keys:async()=>['sekka-static-v11-splash-physical-wheels'],
   delete:async()=>true,
   open:async()=>({
    match:async req=>store.get(req.url)||undefined,
    put:async(req,response)=>{store.set(req.url,response);}
   })
  },
  self:{
   location:{origin:'https://sekka.example'},
   addEventListener(name,fn){handlers[name]=fn;},
   skipWaiting:async()=>{},
   clients:{claim:async()=>{}}
  },
  fetch:async(req)=>{
   fetchCount++;
   return {
    ok:true,type:'basic',headers:{get:()=>null},
    clone(){return this;},
    url:req.url
   };
  }
 };
 const source=readFileSync(new URL('../../public/sw.js',import.meta.url),'utf8');
 runInNewContext(source,context);
 const dispatch=(url,opts={})=>{
  let response=null;
  handlers.fetch({
   request:{url,method:'GET',mode:'cors',...opts},
   respondWith(p){response=Promise.resolve(p);}
  });
  return response;
 };
 return {dispatch,store,count:()=>fetchCount};
}
test('public onboarding art is cached after first network fetch',async()=>{
 const {dispatch,count}=setup();
 const url='https://sekka.example/references/phase-1/01.png';
 assert.ok(await dispatch(url));
 assert.ok(await dispatch(url));
 assert.equal(count(),1);
});
test('private, auth, dynamic and third-party image requests are not intercepted',()=>{
 const {dispatch}=setup();
 for(const url of [
  'https://sekka.example/api/private-bookings',
  'https://sekka.example/auth/callback',
  'https://sekka.example/references/not-public/portrait.png',
  'https://tile.openstreetmap.org/12/2175/1588.png',
  'https://sekka.example/search?tab=bookings'
 ]){
  const opts=url.includes('search?')?{mode:'navigate'}:{};
  assert.equal(dispatch(url,opts),null,url);
 }
});
test('hashed app assets and official brand icons remain cacheable',async()=>{
 const {dispatch,count}=setup();
 const urls=[
  'https://sekka.example/assets/index.123.js',
  'https://sekka.example/brand/sekka-go-road-192.png'
 ];
 for(const url of urls){await dispatch(url);await dispatch(url);}
 assert.equal(count(),2);
});
