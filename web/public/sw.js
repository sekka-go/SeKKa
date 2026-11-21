/* seKKa PWA: only versioned/static app assets are cached.
   Auth/OAuth, Supabase requests, and HTML navigation are always network-only. */
const CACHE='sekka-static-v4-road-icon';
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const names=await caches.keys();await Promise.all(names.filter(n=>n.startsWith('sekka-static-')&&n!==CACHE).map(n=>caches.delete(n)));await self.clients.claim();})());});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin)return;
 if(req.mode==='navigate'||url.pathname.includes('/auth/')||url.pathname.startsWith('/dev/'))return;
 if(!url.pathname.startsWith('/assets/')&&!url.pathname.startsWith('/brand/'))return;
 event.respondWith((async()=>{
  const store=await caches.open(CACHE);
  const cached=await store.match(req);
  if(cached)return cached;
  const response=await fetch(req);
  if(response.ok&&response.type==='basic')await store.put(req,response.clone());
  return response;
 })());
});
