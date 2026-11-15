import {useEffect,useState} from 'react';
import {client} from './api';
import {usePreferences} from './preferences';
type RequestRow={id:string;rider_id:string;origin_area_id:number;destination_area_id:number;outbound_time:string;period:string;seats:number;status:string};
type OfferRow={id:string;request_id:string;captain_id:string;route_id:string;status:string};
type RouteRow={id:string;title:string};
type Area={id:number;name_ar:string;name_en:string};
type Search={origin:string;destination:string;outbound:string;period:string};
export default function LiveTripRequests({mode,search}:{mode:'rider'|'captain';search?:Search}){
 const {language}=usePreferences(),en=language==='en',t=(ar:string,english:string)=>en?english:ar;
 const [uid,setUid]=useState(''),[requests,setRequests]=useState<RequestRow[]>([]),[offers,setOffers]=useState<OfferRow[]>([]),[areas,setAreas]=useState<Area[]>([]),[routes,setRoutes]=useState<RouteRow[]>([]);
 const [seats,setSeats]=useState(1),[routeSelection,setRouteSelection]=useState<Record<string,string>>({});
 const [key,setKey]=useState(()=>crypto.randomUUID()),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[revision,setRevision]=useState(0);
 const refresh=()=>{setLoading(true);setRevision(v=>v+1);};
 useEffect(()=>{let active=true;void(async()=>{
  try{
   if(!client)throw Error('BACKEND_NOT_CONFIGURED');
   const {data:{user},error:authError}=await client.auth.getUser();
   if(authError||!user)throw Error('AUTH_REQUIRED');
   const [areasResult,requestResult,routesResult]=await Promise.all([
    client.from('v31_service_areas').select('id,name_ar,name_en').eq('active',true),
    client.from('v31_trip_requests').select('id,rider_id,origin_area_id,destination_area_id,outbound_time,period,seats,status').order('created_at',{ascending:false}).limit(100),
    mode==='captain'?client.from('v31_routes').select('id,title').eq('captain_id',user.id).eq('status','published'):Promise.resolve({data:[],error:null})
   ]);
   if(areasResult.error||requestResult.error||routesResult.error)throw Error(areasResult.error?.message||requestResult.error?.message||routesResult.error?.message);
   const ids=(requestResult.data||[]).map(r=>r.id);
   const offersResult=ids.length?await client.from('v31_trip_offers').select('id,request_id,captain_id,route_id,status').in('request_id',ids).limit(300):{data:[],error:null};
   if(offersResult.error)throw Error(offersResult.error.message);
   if(!active)return;
   setUid(user.id);setAreas((areasResult.data||[]) as Area[]);setRequests((requestResult.data||[]) as RequestRow[]);setRoutes((routesResult.data||[]) as RouteRow[]);setOffers((offersResult.data||[]) as OfferRow[]);
  }catch(e){if(active)setError(e instanceof Error?e.message:String(e));}
  finally{if(active)setLoading(false);}
 })();return()=>{active=false;};},[mode,revision]);
 const action=async(task:()=>Promise<void>)=>{setBusy(true);setError('');setNotice('');try{await task();refresh();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 const create=async()=>{
  if(!client||!search)return;
  const from=areas.find(a=>a.name_ar===search.origin||a.name_en===search.origin),to=areas.find(a=>a.name_ar===search.destination||a.name_en===search.destination);
  if(!from||!to||from.id===to.id||!/^\d{2}:\d{2}$/.test(search.outbound)||!['weekly','monthly'].includes(search.period)){setError(t('راجع بيانات البحث قبل الطلب.','Review your search details before requesting.'));return;}
  await action(async()=>{const {error:insertError}=await client!.from('v31_trip_requests').insert({rider_id:uid,origin_area_id:from.id,destination_area_id:to.id,outbound_time:search.outbound,period:search.period,seats,request_key:key});if(insertError&&insertError.code!=='23505')throw insertError;setNotice(t('طلبك اتحفظ. ده مش حجز مقعد.','Request saved. This is not a seat reservation.'));setKey(crypto.randomUUID());});
 };
 const sendOffer=async(id:string)=>{
  if(!client)return;
  const routeId=routeSelection[id]||routes[0]?.id;
  if(!routeId){setError(t('انشر خط مناسب أولًا.','Publish a matching route first.'));return;}
  await action(async()=>{const {error:insertError}=await client!.from('v31_trip_offers').insert({request_id:id,captain_id:uid,route_id:routeId});if(insertError)throw insertError;});
 };
 const accept=async(id:string)=>{if(!client)return;await action(async()=>{const {data,error:rpcError}=await client!.rpc('v31_accept_trip_offer',{p_offer:id});if(rpcError)throw rpcError;setNotice(t('تم حجز المقاعد قيد الانتظار: '+data,'Pending seats booked: '+data));});};
 const cancel=async(id:string)=>{if(!client)return;await action(async()=>{const {error:rpcError}=await client!.rpc('v31_cancel_trip_request',{p_request:id});if(rpcError)throw rpcError;});};
 const area=(id:number)=>{const a=areas.find(x=>x.id===id);return a?(en?a.name_en:a.name_ar):String(id);};
 const visible=requests.filter(r=>mode==='captain'?r.status==='open':r.rider_id===uid);
 return <section className="d-box live-trip-requests">
  <h2>{mode==='captain'?t('طلبات الركاب المفتوحة','Open passenger requests'):t('طلبات رحلاتي','My trip requests')}</h2>
  {loading&&<p role="status">{t('جارٍ التحميل…','Loading…')}</p>}
  {error&&<div role="alert"><p>{error}</p><button type="button" onClick={()=>{setError('');refresh();}}>{t('إعادة المحاولة','Retry')}</button></div>}
  {notice&&<p role="status">{notice}</p>}
  {!loading&&visible.length===0&&<p>{t('مفيش طلبات حاليًا.','No requests yet.')}</p>}
  {mode==='rider'&&search&&!loading&&<div>
   <h3>{t('لم تجد خطًا؟ راجع بيانات طلبك','No match? Review your request')}</h3>
   <p>{search.origin} ← {search.destination} · {search.outbound} · {search.period}</p>
   <label>{t('عدد المقاعد المطلوبة','Seats needed')}<input type="number" min={1} max={13} value={seats} onChange={e=>setSeats(Number(e.target.value))}/></label>
   <button type="button" disabled={busy||!Number.isInteger(seats)||seats<1||seats>13} onClick={()=>void create()}>{t('تأكيد طلب الرحلة','Confirm trip request')}</button>
   <p>{t('الطلب مش حجز ومفيش أي دفع.','Requesting does not reserve seats or charge money.')}</p>
  </div>}
  <ul>{visible.map(r=><li key={r.id}>
   <strong>{area(r.origin_area_id)} ← {area(r.destination_area_id)}</strong> · {r.outbound_time.slice(0,5)} · {r.period} · {r.seats} {t('مقاعد','seats')} · {r.status}
   {mode==='rider'&&r.status==='open'&&<button type="button" disabled={busy} onClick={()=>void cancel(r.id)}>{t('إلغاء الطلب','Cancel request')}</button>}
   {mode==='captain'&&routes.length>0&&<div>
    <select aria-label={t('الخط المراد عرضه','Offer route')} value={routeSelection[r.id]||routes[0]?.id||''} onChange={e=>setRouteSelection(v=>({...v,[r.id]:e.target.value}))}>{routes.map(route=><option key={route.id} value={route.id}>{route.title}</option>)}</select>
    <button type="button" disabled={busy||offers.some(o=>o.request_id===r.id&&o.captain_id===uid)} onClick={()=>void sendOffer(r.id)}>{t('إرسال عرض خط','Offer route')}</button>
   </div>}
   {mode==='rider'&&offers.filter(o=>o.request_id===r.id).map(o=><div key={o.id}>{t('عرض كابتن','Captain offer')} · {o.status}
    {r.status==='open'&&o.status==='offered'&&<button type="button" disabled={busy} onClick={()=>void accept(o.id)}>{t('اقبل واحجز المقاعد','Accept and reserve seats')}</button>}
   </div>)}
  </li>)}</ul>
  <button type="button" onClick={refresh}>{t('تحديث الطلبات','Refresh requests')}</button>
 </section>;
}
