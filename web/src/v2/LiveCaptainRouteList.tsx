import {useEffect,useState} from 'react';
import {client} from './api';
import {captainRouteError} from './captainRouteErrors';
import {usePreferences} from './preferences';

type RouteRow={id:string;title:string;category:string;status:string;price_egp:number;seat_capacity:number};
type BookingSeat={route_id:string;seats:number;status:string};
type RouteStop={id:string;name:string;position:number};
type Tab='all'|'published'|'draft';
const activeBooking=(status:string)=>status==='pending'||status==='confirmed';

/** Real Captain routes: data is read from Supabase with server-enforced Captain RLS.
 * No preview records, invented booking numbers, or client-side approval grants. */
export default function LiveCaptainRouteList(){
 const {language}=usePreferences(),en=language==='en';
 const t=(ar:string,english:string)=>en?english:ar;
 const [uid,setUid]=useState<string|null>(null);
 const [approval,setApproval]=useState('pending');
 const [routes,setRoutes]=useState<RouteRow[]>([]);
 const [bookings,setBookings]=useState<BookingSeat[]|null>(null);
 const [busy,setBusy]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const [canRetry,setCanRetry]=useState(true);
 const [revision,setRevision]=useState(0);
 const [tab,setTab]=useState<Tab>('all');
 const [expanded,setExpanded]=useState<string|null>(null);
 const [routeStops,setRouteStops]=useState<RouteStop[]>([]);
 const [stopsBusy,setStopsBusy]=useState(false);
 const [stopsError,setStopsError]=useState('');
 useEffect(()=>{
  if(!client){setLoading(false);setError(t('خدمة الرحلات غير متاحة حاليًا.','Routes service is not configured.'));return;}
  let active=true;
  setLoading(true);
  void (async()=>{
   try{
    const {data:identity,error:authError}=await client.auth.getUser();
    if(authError||!identity.user)throw Error('AUTH_REQUIRED');
    const userId=identity.user.id;
    if(!active)return;
    setUid(userId);
    const [{data:captain,error:approvalError},{data:rows,error:listError}]=await Promise.all([
     client.from('v31_captain_profiles').select('approval_status').eq('user_id',userId).maybeSingle(),
     client.from('v31_routes').select('id,title,category,status,price_egp,seat_capacity').eq('captain_id',userId).order('created_at',{ascending:false}).limit(50)
    ]);
    if(approvalError||listError)throw Error(approvalError?.message||listError?.message||'ROUTE_LOAD_FAILED');
    if(!active)return;
    if(!Array.isArray(rows))throw Error('ROUTES_RESPONSE_INVALID');
    const next=rows as RouteRow[];
    setApproval(captain?.approval_status||'pending');
    setRoutes(next);
    if(next.length){
     const {data:seatRows,error:seatError}=await client.from('v31_bookings')
      .select('route_id,seats,status').in('route_id',next.map(route=>route.id)).limit(500);
     if(active)setBookings(seatError||!Array.isArray(seatRows)?null:seatRows as BookingSeat[]);
    }else setBookings([]);
    setError('');
   }catch(e){if(active){setCanRetry(true);setError(captainRouteError(e,en?'en':'ar'));}}
   finally{if(active)setLoading(false);}
  })();
  return ()=>{active=false;};
 },[revision,language]);
 useEffect(()=>{
  if(!client||!expanded){setRouteStops([]);setStopsError('');return;}
  let active=true;setStopsBusy(true);setStopsError('');
  void client.from('v31_route_stops').select('id,name,position').eq('route_id',expanded).order('position').then(({data,error})=>{
   if(!active)return;
   if(error){setStopsError(captainRouteError(error,en?'en':'ar'));setRouteStops([]);}
   else if(!Array.isArray(data)){setStopsError('ROUTE_STOPS_RESPONSE_INVALID');setRouteStops([]);}
   else setRouteStops(data as RouteStop[]);
   setStopsBusy(false);
  });
  return ()=>{active=false;};
 },[expanded,revision]);
 const publish=async(id:string)=>{
  if(!client||!uid||approval!=='approved')return;
  setBusy(id);setError('');setNotice('');
  try{
   const {data,error:publishError}=await client.rpc('v31_set_route_status',{p_route:id,p_status:'published'});
   if(publishError||data!=='published')throw Error(publishError?.message||'ROUTE_PUBLICATION_NOT_CONFIRMED');
   const {data:saved,error:verifyError}=await client.from('v31_routes')
    .select('id,status').eq('id',id).eq('captain_id',uid).maybeSingle();
   if(verifyError||!saved||saved.status!=='published')throw Error(verifyError?.message||'ROUTE_PUBLICATION_NOT_VERIFIED');
   setNotice(t('تم نشر الخط بنجاح. هيظهر للركاب المؤهلين.','Route published and available to eligible riders.'));
   setRevision(x=>x+1);
  }catch(e){setCanRetry(false);setError(captainRouteError(e,en?'en':'ar'));}
  finally{setBusy(null);}
 };
 const changeStatus=async(id:string,status:'paused'|'published'|'archived')=>{
  if(!client||!uid||approval!=='approved')return;
  setBusy(id);setError('');setNotice('');
  try{
   const {data,error:rpcError}=await client.rpc('v31_set_route_status',{p_route:id,p_status:status});
   if(rpcError||data!==status)throw Error(rpcError?.message||'STATUS_UPDATE_NOT_CONFIRMED');
   const {data:saved,error:verifyError}=await client.from('v31_routes')
    .select('status').eq('id',id).eq('captain_id',uid).maybeSingle();
   if(verifyError||saved?.status!==status)throw Error(verifyError?.message||'STATUS_UPDATE_NOT_VERIFIED');
   setNotice(t('تم تحديث حالة الخط.','Route status updated.'));
   setRevision(x=>x+1);
  }catch(e){setCanRetry(false);setError(captainRouteError(e,en?'en':'ar'));}
  finally{setBusy(null);}
 };
 const statusName=(status:string)=>{
  if(status==='published')return t('منشور','Published');
  if(status==='paused')return t('متوقف مؤقتًا','Paused');
  if(status==='archived')return t('مؤرشف','Archived');
  if(status==='draft')return t('مسودة','Draft');
  return t('بانتظار المراجعة','Under review');
 };
 const visible=routes.filter(route=>tab==='all'||(tab==='draft'?route.status==='draft':route.status==='published'||route.status==='paused'));
 const seatsFor=(route:RouteRow)=>bookings===null?null:bookings.filter(booking=>booking.route_id===route.id&&activeBooking(booking.status))
  .reduce((total,booking)=>total+Math.max(0,booking.seats),0);
 return <section className="d-box live-route-list" aria-label={t('الرحلات المحفوظة','Saved Captain routes')}>
  <h2>{t('رحلاتي','My trips')}</h2>
  <p className="cj-subtitle">{t('كل خطوطك ومسوداتك في مكان واحد. السعر الإجمالي ظاهر ليك أنت بس.','Your routes and drafts in one place. Whole-vehicle price is private to you.')}</p>
  {approval!=='approved'&&!loading&&<p role="status" className="cj-feedback">{t('حسابك لسه مش معتمد. ممكن تراجع مسوداتك لكن النشر مش متاح.','Your Captain account is not approved. You can view drafts, but cannot publish.')}</p>}
  {error&&<div role="alert" className="cj-feedback"><p>{error}</p>{canRetry&&<button type="button" onClick={()=>{setError('');setRevision(v=>v+1)}}>{t('إعادة المحاولة','Retry')}</button>}</div>}
  {notice&&<p role="status" className="cj-feedback">{notice}</p>}
  <div className="cj-filter-tabs" role="group" aria-label={t('فلتر الرحلات','Filter routes')}>
   {([['all',t('الكل','All')],['published',t('المنشورة','Published')],['draft',t('المسودات','Drafts')]] as [Tab,string][]).map(([key,label])=>
    <button key={key} type="button" aria-pressed={tab===key} onClick={()=>setTab(key)}>{label}</button>)}
  </div>
  {loading&&<p role="status">{t('بنحمّل الرحلات...','Loading routes...')}</p>}
  {!loading&&!error&&visible.length===0&&<div className="cj-empty">{tab==='all'
   ?t('لسه مفيش خطوط محفوظة. ابدأ بإنشاء أول رحلة من الزر اللي فوق.','No routes saved yet. Create your first trip above.')
   :t('مفيش رحلات في القسم ده حاليًا.','No trips in this section yet.')}</div>}
  <ul>{!loading&&visible.map(route=>{
   const used=seatsFor(route);
   const fill=used===null?0:Math.min(route.seat_capacity,used);
   const full=used!==null&&route.seat_capacity>0&&fill>=route.seat_capacity;
   return <li key={route.id}>
    <div className="cj-card-head"><strong>{route.title}</strong>
     <span className={'cj-status'+(route.status==='draft'?' is-draft':route.status==='paused'?' is-paused':'')}>{statusName(route.status)}</span></div>
    <div className="cj-route-meta">
     <span>{route.category}</span>
     <span>{route.seat_capacity} {t('مقاعد','seats')}</span>
     <span>{t('مركبة كاملة','Full vehicle')}: {Number(route.price_egp).toLocaleString(en?'en-GB':'ar-EG')} {t('جنيه','EGP')}</span>
    </div>
    <div className="cj-capacity-line"><span>{t('المقاعد المحجوزة','Booked seats')}</span>
     <span>{used===null?t('غير متاح','Unavailable'):fill+' / '+route.seat_capacity}</span></div>
    <div className="cj-capacity-track" aria-hidden="true"><span className="cj-capacity-fill" style={{width:(used===null?0:route.seat_capacity?fill/route.seat_capacity*100:0)+'%'}}/></div>
    {full&&<p className="cj-feedback">{t('اكتملت المقاعد. تحديد موعد الانطلاق يحتاج إجراءً مؤكدًا من النظام، وليس من شاشة المسودة.','Capacity reached. Actual departure scheduling requires a server-confirmed action.')}</p>}
    <div className="cj-card-actions">
     <button type="button" aria-expanded={expanded===route.id} onClick={()=>setExpanded(current=>current===route.id?null:route.id)}>{expanded===route.id?t('إخفاء التفاصيل','Hide details'):t('عرض التفاصيل','View details')}</button>
     {route.status==='draft'&&<button type="button" className="cj-primary" disabled={busy!==null||approval!=='approved'}
      onClick={()=>setExpanded(route.id)}>{t('مراجعة للنشر','Review to publish')}</button>}
    </div>
    {expanded===route.id&&<section className="cj-route-details" aria-label={t('تفاصيل المسار','Route details')}>
     <h3>{t('محطات الرحلة','Route stops')}</h3>
     {stopsBusy&&<p role="status">{t('بنحمّل المحطات...','Loading stops...')}</p>}
     {stopsError&&<p role="alert">{stopsError}</p>}
     {!stopsBusy&&!stopsError&&routeStops.length===0&&<p>{t('مفيش نقاط متاحة للعرض.','No stops available.')}</p>}
     {!stopsBusy&&!stopsError&&routeStops.length>0&&<ol>{routeStops.map(stop=><li key={stop.id}>{stop.name}</li>)}</ol>}
     <p className="cj-private-price">{t('السعر الإجمالي للمركبة لا يظهر للركاب. سعر المقعد بيحسبه السيرفر.','The full-vehicle total is hidden from riders. Seat pricing is server-calculated.')}</p>
     <div className="cj-details-actions">
      {route.status==='draft'&&<button type="button" className="cj-primary"
       disabled={busy!==null||approval!=='approved'||stopsBusy||routeStops.length<2||Boolean(stopsError)}
       onClick={()=>void publish(route.id)}>{busy===route.id?t('جارٍ النشر...','Publishing...'):t('تأكيد ونشر الخط','Confirm and publish')}</button>}
      {route.status==='published'&&<button type="button" disabled={busy!==null} onClick={()=>void changeStatus(route.id,'paused')}>{t('إيقاف مؤقت','Pause route')}</button>}
      {route.status==='paused'&&<button type="button" disabled={busy!==null||approval!=='approved'} onClick={()=>void changeStatus(route.id,'published')}>{t('استئناف النشر','Resume route')}</button>}
      {(route.status==='published'||route.status==='paused')&&<button type="button"
       disabled={busy!==null} onClick={()=>void changeStatus(route.id,'archived')}>{t('أرشفة الخط','Archive route')}</button>}
     </div>
    </section>}
   </li>;
  })}</ul>
 </section>;
}
