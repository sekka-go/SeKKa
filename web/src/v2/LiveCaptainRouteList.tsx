import AppSkeleton from './AppSkeleton';
import {useEffect,useRef,useState} from 'react';
import {client} from './api';
import {captainRouteError} from './captainRouteErrors';
import {usePreferences} from './preferences';
import {useStaggeredReveal} from './staggerMotion';

type RouteRow={id:string;title:string;category:string;status:string;price_egp:number|null;seat_capacity:number;direction:string;period:string;outbound_time:string|null;return_time:string|null};
type CapacityRow={route_id:string;capacity:number;booked:number;remaining:number;is_full:boolean};
type RouteStop={id:string;name:string;position:number;outbound_stop_time:string|null;return_stop_time:string|null};
type Tab='all'|'published'|'draft'|'archived';

/** Real Captain routes: data is read from Supabase with server-enforced Captain RLS.
 * No preview records, invented booking numbers, or client-side approval grants. */
export default function LiveCaptainRouteList({initialReviewId=null}:{initialReviewId?:string|null}={}){
 const {language}=usePreferences(),en=language==='en';
 const t=(ar:string,english:string)=>en?english:ar;
 const revealCaptainRoute=useStaggeredReveal();
 const [uid,setUid]=useState<string|null>(null);
 const [approval,setApproval]=useState('pending');
 const [routes,setRoutes]=useState<RouteRow[]>([]);
 const [capacities,setCapacities]=useState<CapacityRow[]|null>(null);
 const [busy,setBusy]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const [canRetry,setCanRetry]=useState(true);
 const [revision,setRevision]=useState(0);
 const [tab,setTab]=useState<Tab>('all');
 const [expanded,setExpanded]=useState<string|null>(initialReviewId);
 const [pendingRemoval,setPendingRemoval]=useState<string|null>(null);
 const [loadedStops,setLoadedStops]=useState<{id:string;revision:number;rows:RouteStop[];failed:boolean}|null>(null);
 const currentStops=loadedStops&&loadedStops.id===expanded&&loadedStops.revision===revision?loadedStops:null;
 const stopsBusy=Boolean(expanded&&!currentStops);
 const routeStops=currentStops?.rows??[];
 const reviewRef=useRef<HTMLHeadingElement>(null);
 const focusedInitialReview=useRef(false);
 useEffect(()=>{
  if(!loading&&expanded&&expanded===initialReviewId&&!focusedInitialReview.current&&reviewRef.current){
   focusedInitialReview.current=true;
   reviewRef.current.focus();
  }
 },[loading,expanded,initialReviewId]);
 useEffect(()=>{
  if(!client){setLoading(false);setError(t('خدمة الرحلات غير متاحة حاليًا.','Routes service is not configured.'));return;}
  let active=true;
  setLoading(true);setCapacities(null);
  void (async()=>{
   try{
    const {data:identity,error:authError}=await client.auth.getUser();
    if(authError||!identity.user)throw Error('AUTH_REQUIRED');
    const userId=identity.user.id;
    if(!active)return;
    setUid(userId);
    const routeQuery=client.from('v31_routes')
     .select('id,title,category,status,seat_capacity,direction,period,outbound_time,return_time')
     .eq('captain_id',userId).order('created_at',{ascending:false}).limit(100);
    // Archived routes are kept as history, but do not crowd out active routes.
    const filteredQuery=tab==='archived'?routeQuery.eq('status','archived'):routeQuery.neq('status','archived');
    const [{data:captain,error:approvalError},{data:rows,error:listError},{data:priceRows,error:priceError}]=await Promise.all([
     client.from('v31_captain_profiles').select('approval_status').eq('user_id',userId).maybeSingle(),
     filteredQuery,
     client.rpc('v31_captain_private_prices')
    ]);
    if(approvalError||listError||priceError)throw Error(approvalError?.message||listError?.message||priceError?.message||'ROUTE_LOAD_FAILED');
    if(!active)return;
    if(!Array.isArray(rows))throw Error('ROUTES_RESPONSE_INVALID');
    const priceLookup=new Map((Array.isArray(priceRows)?priceRows:[]).map((p:{route_id:string;price_egp:number})=>[p.route_id,p.price_egp]));
    const next=(rows as Omit<RouteRow,'price_egp'>[]).map(row=>({...row,price_egp:priceLookup.get(row.id)??null}));
    setApproval(captain?.approval_status||'pending');
    setRoutes(next);
    if(next.length){
     const {data:seatRows,error:seatError}=await client.rpc('v31_captain_route_capacity_summary');
     if(active)setCapacities(seatError||!Array.isArray(seatRows)?null:seatRows as CapacityRow[]);
    }else setCapacities([]);
    setError('');
   }catch(e){if(active){setCanRetry(true);setError(captainRouteError(e,en?'en':'ar'));}}
   finally{if(active)setLoading(false);}
  })();
  return ()=>{active=false;};
 },[revision,language,tab]);
 useEffect(()=>{
  const api=client;
  if(!api||!expanded)return;
  const controller=new AbortController();
  const id=expanded;
  void (async()=>{
   try{
    const {data,error:readError}=await api.from('v31_route_stops').select('id,name,position,outbound_stop_time,return_stop_time')
     .eq('route_id',id).order('position').abortSignal(controller.signal);
    if(readError||!Array.isArray(data))throw Error('ROUTE_STOPS_READ_FAILED');
    if(!controller.signal.aborted)setLoadedStops({id,revision,rows:data as RouteStop[],failed:false});
   }catch{
    if(!controller.signal.aborted)setLoadedStops({id,revision,rows:[],failed:true});
   }
  })();
  return ()=>controller.abort();
 },[expanded,revision]);
 const changeStatus=async(id:string,status:'paused'|'published'|'archived')=>{
  if(!client||!uid||approval!=='approved')return;
  setBusy(id);setError('');setNotice('');
  try{
   const {data,error:rpcError}=await client.rpc('v31_set_route_status',{p_route:id,p_status:status});
   if(rpcError||data!==status)throw Error(rpcError?.message||'STATUS_UPDATE_NOT_CONFIRMED');
   const {data:saved,error:verifyError}=await client.from('v31_routes')
    .select('status').eq('id',id).eq('captain_id',uid).maybeSingle();
   if(verifyError||saved?.status!==status)throw Error(verifyError?.message||'STATUS_UPDATE_NOT_VERIFIED');
   setNotice(status==='published'
    ?t('الخط منشور ومتاح للركاب.','Route published and available to riders.')
    :t('تم تحديث حالة الخط.','Route status updated.'));
   setRevision(x=>x+1);
  }catch(e){setCanRetry(false);setError(captainRouteError(e,en?'en':'ar'));}
  finally{setBusy(null);}
 };
 const removeRoute=async(route:RouteRow)=>{
  if(!client||!uid||pendingRemoval!==route.id||busy!==null)return;
  setBusy(route.id);setError('');setNotice('');
  try{
   const {data,error:removeError}=await client.rpc('v31_remove_captain_route',{p_route:route.id});
   const expected=route.status==='draft'?'deleted':'archived';
   if(removeError||data!==expected)throw Error(removeError?.message||'ROUTE_REMOVAL_NOT_CONFIRMED');
   const {data:saved,error:verifyError}=await client.from('v31_routes')
    .select('status').eq('id',route.id).eq('captain_id',uid).maybeSingle();
   if(verifyError||(expected==='deleted'?saved!==null:saved?.status!=='archived'))
    throw Error(verifyError?.message||'ROUTE_REMOVAL_NOT_VERIFIED');
   setNotice(expected==='deleted'
    ?t('تم حذف المسودة.','Draft deleted.')
    :t('تمت إزالة الرحلة من رحلاتك الحالية ونقلها للأرشيف.','Trip moved from active routes to the archive.'));
   setPendingRemoval(null);setExpanded(current=>current===route.id?null:current);
   setRevision(value=>value+1);
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
 const visible=routes.filter(route=>tab==='all'||(tab==='archived'?route.status==='archived':
  tab==='draft'?route.status==='draft':route.status==='published'||route.status==='paused'));
 const capacityFor=(route:RouteRow)=>capacities?.find(row=>row.route_id===route.id)||null;
 const clock=(value:string|null)=>value?.slice(0,5)||t('غير متاح','Unavailable');
 return <section className="d-box live-route-list" aria-label={t('الرحلات المحفوظة','Saved Captain routes')}>
  <h2>{t('رحلاتي','My trips')}</h2>
  <p className="cj-subtitle">{t('كل خطوطك ومسوداتك في مكان واحد. السعر الإجمالي ظاهر ليك أنت بس.','Your routes and drafts in one place. Whole-vehicle price is private to you.')}</p>
  {approval!=='approved'&&!loading&&<p role="status" className="cj-feedback">{t('حسابك لسه مش معتمد. ممكن تراجع مسوداتك لكن النشر مش متاح.','Your Captain account is not approved. You can view drafts, but cannot publish.')}</p>}
  {error&&<div role="alert" className="cj-feedback"><p>{error}</p>{canRetry&&<button type="button" onClick={()=>{setError('');setRevision(v=>v+1)}}>{t('إعادة المحاولة','Retry')}</button>}</div>}
  {notice&&<p role="status" className="cj-feedback">{notice}</p>}
  <div className="cj-filter-tabs" role="group" aria-label={t('فلتر الرحلات','Filter routes')}>
   {([['all',t('الكل','All')],['published',t('المنشورة','Published')],['draft',t('المسودات','Drafts')],['archived',t('الأرشيف','Archive')]] as [Tab,string][]).map(([key,label])=>
    <button key={key} type="button" aria-pressed={tab===key} onClick={()=>{setTab(key);setPendingRemoval(null);setExpanded(null)}}>{label}</button>)}
  </div>
  {loading&&<AppSkeleton kind="routes" count={3} label={t('بنحمّل الرحلات...','Loading routes...')}/>}
  {!loading&&!error&&visible.length===0&&<div className="cj-empty">{tab==='all'
   ?t('لسه مفيش خطوط محفوظة. ابدأ بإنشاء أول رحلة من الزر اللي فوق.','No routes saved yet. Create your first trip above.')
   :t('مفيش رحلات في القسم ده حاليًا.','No trips in this section yet.')}</div>}
  <ul>{!loading&&visible.map(route=>{
   const counts=capacityFor(route);
   const used=counts?.booked??null;
   const fill=used===null?0:Math.min(route.seat_capacity,used);
   const full=counts?.is_full===true;
   const isDraft=route.status==='draft';
   const stopsInTravelOrder=route.direction==='return'?[...routeStops].reverse():routeStops;
   return <li ref={revealCaptainRoute} key={route.id}>
    <div className="cj-card-head"><strong>{route.title}</strong>
     <span className={'cj-status'+(route.status==='draft'?' is-draft':route.status==='paused'?' is-paused':'')}>{statusName(route.status)}</span></div>
    <div className="cj-route-meta">
     <span>{route.category}</span>
     <span>{route.seat_capacity} {t('مقاعد','seats')}</span>
     <span>{t('مركبة كاملة','Full vehicle')}: {route.price_egp===null?t('غير متاح','Unavailable'):route.price_egp.toLocaleString(en?'en-GB':'ar-EG')+' '+t('جنيه','EGP')}</span>
    </div>
    <div className="cj-capacity-line"><span>{t('المقاعد المحجوزة','Booked seats')}</span>
     <span>{used===null?t('غير متاح','Unavailable'):fill+' / '+route.seat_capacity}</span></div>
    <div className="cj-capacity-track" aria-hidden="true"><span className="cj-capacity-fill" style={{width:(used===null?0:route.seat_capacity?fill/route.seat_capacity*100:0)+'%'}}/></div>
    {used!==null&&!full&&route.status==='published'&&<p className="cj-progress-note">{t('متبقي','Seats remaining')}: {counts?.remaining??0} {t('مقاعد قبل اكتمال الخط','until full capacity')}</p>}
    {full&&<p className="cj-feedback">{t('اكتملت المقاعد. تحديد موعد الانطلاق يحتاج إجراءً مؤكدًا من النظام، وليس من شاشة المسودة.','Capacity reached. Actual departure scheduling requires a server-confirmed action.')}</p>}
    <div className="cj-card-actions">
     <button type="button" aria-expanded={expanded===route.id} onClick={()=>setExpanded(current=>current===route.id?null:route.id)}>{expanded===route.id?t('إخفاء التفاصيل','Hide details'):t('عرض التفاصيل','View details')}</button>
     {route.status==='draft'&&<button type="button" className="cj-primary" disabled={busy!==null||approval!=='approved'}
      onClick={()=>setExpanded(route.id)}>{t('مراجعة للنشر','Review to publish')}</button>}
     {['draft','published','paused'].includes(route.status)&&
      <button type="button" className="cj-remove-route-trigger"
       disabled={busy!==null} aria-expanded={pendingRemoval===route.id}
       onClick={()=>setPendingRemoval(current=>current===route.id?null:route.id)}>
       {isDraft?t('حذف المسودة','Delete draft'):t('إزالة الرحلة','Remove trip')}
      </button>}
    </div>
    {pendingRemoval===route.id&&<div className="cj-remove-route-confirm"
      role="group" aria-label={isDraft?t('تأكيد حذف المسودة','Confirm deleting draft'):t('تأكيد إزالة الرحلة','Confirm removing trip')}>
     <p>{isDraft
      ?t('هتحذف المسودة ومحطاتها نهائيًا. الإجراء ده ما ينفعش يتراجع عنه.','The draft and its stops will be permanently deleted. This cannot be undone.')
      :t('هننقل الرحلة للأرشيف ونخفيها من الرحلات الحالية، مع الاحتفاظ بتاريخها. لا يمكن إزالة رحلة فيها حجوزات نشطة.','This will archive the trip and hide it from active routes while preserving its history. Trips with active bookings cannot be removed.')}</p>
     {route.status!=='draft'&&used!==null&&used>0&&<p role="status">
      {t('في حجوزات نشطة على الرحلة. ممكن توقفها مؤقتًا بدل إزالتها.','This trip has active bookings. Pause it instead of removing it.')}
     </p>}
     <div className="cj-remove-route-confirm-actions">
      <button type="button" className="cj-remove-route-danger"
       disabled={busy!==null||(route.status!=='draft'&&used!==null&&used>0)}
       onClick={()=>void removeRoute(route)}>
       {busy===route.id?t('جارٍ التنفيذ…','Processing…'):isDraft?t('تأكيد حذف المسودة','Delete draft permanently'):t('تأكيد النقل للأرشيف','Confirm archive')}
      </button>
      <button type="button" disabled={busy!==null} onClick={()=>setPendingRemoval(null)}>
       {t('تراجع','Keep trip')}
      </button>
     </div>
    </div>}
    {expanded===route.id&&<section className="cj-route-details" aria-label={t('تفاصيل المسار','Route details')}>
     <h3 tabIndex={-1} ref={reviewRef}>{isDraft?t('راجع خطك قبل النشر','Review your route before publishing'):t('محطات الرحلة','Route stops')}</h3>
     {isDraft&&<dl className="cj-publish-facts">
      <div><dt>{t('الاشتراك','Subscription')}</dt><dd>{route.period==='weekly'?t('أسبوعي','Weekly'):route.period==='monthly'?t('شهري','Monthly'):t('غير متاح','Unavailable')}</dd></div>
      {route.direction!=='return'&&<div><dt>{t('موعد الذهاب','Outbound time')}</dt><dd><bdi>{clock(route.outbound_time)}</bdi></dd></div>}
      {route.direction!=='outbound'&&<div><dt>{t('موعد العودة','Return time')}</dt><dd><bdi>{clock(route.return_time)}</bdi></dd></div>}
     </dl>}
     {stopsBusy&&<AppSkeleton kind="stops" compact label={t('بنحمّل المحطات...','Loading stops...')}/>}
     {currentStops?.failed&&<div role="alert" className="cj-feedback">
      <p>{t('المحطات ما اتحمّلتش. حاول تاني قبل النشر.','Could not load the stops. Try again before publishing.')}</p>
      <button type="button" onClick={()=>setRevision(value=>value+1)}>{t('إعادة المحاولة','Retry loading stops')}</button>
     </div>}
     {currentStops&&!currentStops.failed&&routeStops.length===0&&<p>{t('مفيش نقاط متاحة للعرض.','No stops available.')}</p>}
     {stopsInTravelOrder.length>0&&<ol aria-label={t('ترتيب المحطات','Stop order')}>{stopsInTravelOrder.map(stop=><li key={stop.id}>
       <bdi>{stop.name}</bdi>
       {route.direction!=='return'&&stop.outbound_stop_time&&<small> · {t('مرور متوقع ذهاب','Estimated outbound')} <bdi>{stop.outbound_stop_time.slice(0,5)}</bdi></small>}
       {route.direction!=='outbound'&&stop.return_stop_time&&<small> · {t('مرور متوقع عودة','Estimated return')} <bdi>{stop.return_stop_time.slice(0,5)}</bdi></small>}
      </li>)}</ol>}
     {route.direction==='round_trip'&&stopsInTravelOrder.length>0&&<p>{t('العودة بنفس المحطات بالترتيب العكسي.','Return uses the same stops in reverse order.')}</p>}
     <p className="cj-private-price">{t('السعر الإجمالي للمركبة لا يظهر للركاب. سعر المقعد بيحسبه السيرفر.','The full-vehicle total is hidden from riders. Seat pricing is server-calculated.')}</p>
     <div className="cj-details-actions">
      {route.status==='draft'&&<button type="button" className="cj-primary"
       disabled={busy!==null||approval!=='approved'||!currentStops||currentStops.failed||routeStops.length<2}
       onClick={()=>void changeStatus(route.id,'published')}>{busy===route.id?t('جارٍ النشر...','Publishing...'):t('تأكيد ونشر الخط','Confirm and publish')}</button>}
      {route.status==='published'&&<button type="button" disabled={busy!==null} onClick={()=>void changeStatus(route.id,'paused')}>{t('إيقاف مؤقت','Pause route')}</button>}
      {route.status==='paused'&&<button type="button" disabled={busy!==null||approval!=='approved'} onClick={()=>void changeStatus(route.id,'published')}>{t('استئناف النشر','Resume route')}</button>}
     </div>
    </section>}
   </li>;
  })}</ul>
 </section>;
}
