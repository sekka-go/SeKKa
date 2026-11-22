/* seKKa PWA — cache immutable *public static assets*, never user data.
 * This is the web equivalent of cached public images in the reference video.
 * Navigation/HTML, Google Auth, Supabase, live availability, personalized
 * images, and map tiles remain network / provider-cache controlled.
 *
 * OpenStreetMap tile policy: do NOT override the provider's own HTTP cache,
 * prefetch/bulk download tiles, or intercept cross-origin tile responses.
 */
const CACHE='sekka-static-v12-public-image-cache';
const referenceImage=/^\/references\/phase-1\/\d{2}\.png$/;
const isStatic=url=>url.pathname.startsWith('/assets/')||
 url.pathname.startsWith('/brand/')||referenceImage.test(url.pathname);
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{
 const names=await caches.keys();
 await Promise.all(names.filter(n=>n.startsWith('sekka-static-')&&n!==CACHE)
  .map(n=>caches.delete(n)));
 await self.clients.claim();
})());});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate'||url.pathname.includes('/auth/')||
   url.pathname.startsWith('/dev/')||!isStatic(url))return;
 event.respondWith((async()=>{
  let store;
  try{
   store=await caches.open(CACHE);
   const cached=await store.match(request);
   if(cached)return cached;
  }catch{/* Private mode / quota restrictions must not break images. */}
  const response=await fetch(request);
  const forbidStore=/\b(?:no-store|private)\b/i.test(
   response.headers.get('Cache-Control')||'');
  if(store&&response.ok&&response.type==='basic'&&!forbidStore){
   try{await store.put(request,response.clone());}
   catch{/* Storage quota full: use original network response. */}
  }
  return response;
 })());
});
