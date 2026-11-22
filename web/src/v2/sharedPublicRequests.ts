/**
 * Stable, public/reference-only request coordinator for the mobile PWA.
 *
 * - A React rerender (including opening the keyboard) never starts an
 *   identical in-flight request a second time.
 * - Each consumer can cancel independently. The upstream fetch is aborted
 *   only when the final consumer leaves.
 * - Optional memory cache, strictly bounded and short lived, is for PUBLIC
 *   REFERENCE data. Never use for seat availability, offers, bookings,
 *   notifications, payment states, auth, role permissions, or private data.
 * - No localStorage, IndexedDB or service-worker persistence of user queries.
 */
type CacheRecord={value:unknown;until:number};
type Pending={controller:AbortController;readers:number;promise:Promise<unknown>};
const completed=new Map<string,CacheRecord>();
const inFlight=new Map<string,Pending>();
const MAX_PUBLIC_ENTRIES=64;
const MAX_TTL_MS=300_000;

function abortError(){
 return new DOMException('Request cancelled','AbortError');
}
function remember(key:string,value:unknown,ttlMs:number){
 if(ttlMs<=0)return;
 if(completed.has(key))completed.delete(key);
 while(completed.size>=MAX_PUBLIC_ENTRIES){
  const oldest=completed.keys().next().value;
  if(oldest===undefined)break;
  completed.delete(oldest);
 }
 completed.set(key,{value,until:Date.now()+Math.min(ttlMs,MAX_TTL_MS)});
}
export function requestSharedPublic<T>(
 key:string,signal:AbortSignal,load:(upstream:AbortSignal)=>Promise<T>,
 ttlMs=0
):Promise<T>{
 if(signal.aborted)return Promise.reject(abortError());
 const cached=completed.get(key);
 if(cached){
  if(cached.until>Date.now())return Promise.resolve(cached.value as T);
  completed.delete(key);
 }
 let entry=inFlight.get(key);
 if(!entry||entry.controller.signal.aborted){
  const controller=new AbortController();
  const next:Pending={controller,readers:0,promise:Promise.resolve()};
  const work=Promise.resolve().then(()=>load(controller.signal)).then(value=>{
   if(!controller.signal.aborted)remember(key,value,ttlMs);
   return value;
  }).finally(()=>{
   if(inFlight.get(key)===next)inFlight.delete(key);
  });
  next.promise=work;
  // If every subscriber aborts, the upstream may reject afterwards.
  // Keep its rejection handled without hiding errors from live consumers.
  void work.catch(()=>{});
  entry=next;
  inFlight.set(key,next);
 }
 const flight=entry;
 flight.readers++;
 return new Promise<T>((resolve,reject)=>{
  let active=true;
  const release=()=>{
   if(!active)return false;
   active=false;
   signal.removeEventListener('abort',onAbort);
   flight.readers--;
   if(flight.readers===0&&inFlight.get(key)===flight){
    inFlight.delete(key);
    flight.controller.abort();
   }
   return true;
  };
  const onAbort=()=>{if(release())reject(abortError());};
  signal.addEventListener('abort',onAbort,{once:true});
  if(signal.aborted){onAbort();return;}
  flight.promise.then(
   data=>{if(release())resolve(data as T);},
   error=>{if(release())reject(error);}
  );
 });
}
