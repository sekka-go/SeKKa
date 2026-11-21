import {useEffect,useState} from 'react';
import {client} from './api';
import {usePreferences} from './preferences';
import {MAX_SEATS_PER_RIDER} from './reservations';
type RequestDirection='outbound'|'return'|'round_trip';
type RequestRow={id:string;rider_id:string;origin_area_id:number;destination_area_id:number;outbound_time:string|null;return_time:string|null;direction:RequestDirection;period:string;seats:number;status:string};
type OfferRow={id:string;request_id:string;captain_id:string;route_id:string;status:string};
type RouteRow={id:string;title:string};
type Area={id:number;name_ar:string;name_en:string};
type Search={origin:string;destination:string;outbound:string;returnTime:string;period:string;direction?:RequestDirection};
type RequestEdit={id:string;direction:RequestDirection;outbound:string;returnTime:string;period:'weekly'|'monthly';seats:number};
const validClock=(value:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const validSeats=(count:number)=>Number.isInteger(count)&&count>=1&&count<=MAX_SEATS_PER_RIDER;

export default function LiveTripRequests({mode,search,onSignIn,compact=false}:{mode:'rider'|'captain';search?:Search;onSignIn?:()=>void;compact?:boolean}){
 const {language}=usePreferences(),en=language==='en',t=(ar:string,english:string)=>en?english:ar;
 const [uid,setUid]=useState(''),[requests,setRequests]=useState<RequestRow[]>([]),[offers,setOffers]=useState<OfferRow[]>([]),[areas,setAreas]=useState<Area[]>([]),[routes,setRoutes]=useState<RouteRow[]>([]);
 const [seats,setSeats]=useState(1),[routeSelection,setRouteSelection]=useState<Record<string,string>>({});
 const [editing,setEditing]=useState<RequestEdit|null>(null);
 const [requestPeriod,setRequestPeriod]=useState<'weekly'|'monthly'>(search?.period==='weekly'?'weekly':'monthly');
 const [requestTime,setRequestTime]=useState(search?.outbound??'');
 const [requestReturnTime,setRequestReturnTime]=useState(search?.returnTime??'');
 const [requestDirection,setRequestDirection]=useState<RequestDirection>(search?.direction||'outbound');
 useEffect(()=>{
  if(!search)return;
  setRequestDirection(search.direction||'outbound');
  setRequestTime(search.outbound??'');
  setRequestReturnTime(search.returnTime??'');
  setRequestPeriod(search.period==='weekly'?'weekly':'monthly');
 },[search?.origin,search?.destination,search?.direction,search?.outbound,search?.returnTime,search?.period]);
 const [key,setKey]=useState(()=>crypto.randomUUID()),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[revision,setRevision]=useState(0);
 const [loadFailed,setLoadFailed]=useState(false);
 const retryLoad=()=>{setError('');refresh();};
 function refresh(){setLoading(true);setLoadFailed(false);setRevision(v=>v+1);}
 useEffect(()=>{let active=true;void(async()=>{
  try{
   if(!client)throw Error('BACKEND_NOT_CONFIGURED');
   const {data:{user},error:authError}=await client.auth.getUser();
   if(authError&&!(mode==='rider'&&!user&&authError.name==='AuthSessionMissingError'))throw authError;
   if(!user&&mode==='rider'){if(active){setUid('');setRequests([]);setError('');}return;}
   if(!user)throw Error('AUTH_REQUIRED');
   const [areasResult,requestResult,routesResult]=await Promise.all([
    client.from('v31_service_areas').select('id,name_ar,name_en').eq('active',true),
    compact&&mode==='rider'?Promise.resolve({data:[],error:null}):
     client.from('v31_trip_requests').select('id,rider_id,origin_area_id,destination_area_id,outbound_time,return_time,direction,period,seats,status').order('created_at',{ascending:false}).limit(100),
    mode==='captain'?client.from('v31_routes').select('id,title').eq('captain_id',user.id).eq('status','published'):Promise.resolve({data:[],error:null})
   ]);
   if(areasResult.error||requestResult.error||routesResult.error)throw Error(areasResult.error?.message||requestResult.error?.message||routesResult.error?.message);
   const ids=(requestResult.data||[]).map(r=>r.id);
   const offersResult=ids.length?await client.from('v31_trip_offers').select('id,request_id,captain_id,route_id,status').in('request_id',ids).limit(300):{data:[],error:null};
   if(offersResult.error)throw Error(offersResult.error.message);
   if(!active)return;
   setUid(user.id);setAreas((areasResult.data||[]) as Area[]);setRequests((requestResult.data||[]) as RequestRow[]);setRoutes((routesResult.data||[]) as RouteRow[]);setOffers((offersResult.data||[]) as OfferRow[]);
  }catch{if(active)setLoadFailed(true);}
  finally{if(active)setLoading(false);}
 })();return()=>{active=false;};},[mode,revision]);
 const action=async(task:()=>Promise<void>)=>{
  setBusy(true);setError('');setNotice('');
  try{await task();refresh();}
  catch(e){
   const message=e instanceof Error?e.message:String(e);
   setError(message.includes('RIDER_MAX_TWO_SEATS')?t('الحد الأقصى شخصين فقط لكل طلب.','Maximum two people per request.'):
    message.includes('DUPLICATE_OPEN_TRIP_REQUEST')?t('عندك بالفعل طلب نشط بنفس تفاصيل الرحلة. عدّله بدل تكراره.','A matching active request already exists. Edit it instead.'):
    message.includes('REQUEST_HAS_OFFERS')?t('وصلت عروض كباتن للطلب ده، ومش ممكن نغيّر تفاصيله بعد وصول العروض.','Captain offers have already been received, so this request can no longer be edited.'):
    message.includes('REQUEST_NOT_EDITABLE')?t('الطلب ده ما بقاش مفتوح للتعديل.','This request is no longer open for editing.'):message);
  }finally{setBusy(false);}
 };
 const create=async()=>{
  if(!client||!search)return;
  const from=areas.find(a=>a.name_ar===search.origin||a.name_en===search.origin);
  const to=areas.find(a=>a.name_ar===search.destination||a.name_en===search.destination);
  if(!uid){onSignIn?.();return;}
  if(!validSeats(seats)){
   setError(t('الحد الأقصى لطلب الرحلة شخصين فقط.','You can request a trip for at most two people.'));return;
  }
  const outbound=requestDirection==='return'?null:requestTime;
  const inbound=requestDirection==='outbound'?null:requestReturnTime;
  if(!from||!to||from.id===to.id||(outbound!==null&&!validClock(outbound))||
    (inbound!==null&&!validClock(inbound))||
    !['weekly','monthly'].includes(requestPeriod)||
    !['outbound','return','round_trip'].includes(requestDirection)){
   setError(t('راجع المناطق واتجاه الرحلة ومواعيد الذهاب والعودة.','Check areas, journey direction and departure/return times.'));return;
  }
  await action(async()=>{
   // Friendly preflight. Database advisory-lock guard is the final authority
   // for a race between tabs/devices. Seats may differ; the trip identity may not.
   const findExisting=async()=>{
    let query=client!.from('v31_trip_requests').select('id')
     .eq('rider_id',uid).eq('status','open')
     .eq('origin_area_id',from.id).eq('destination_area_id',to.id)
     .eq('period',requestPeriod).eq('direction',requestDirection);
    query=outbound===null?query.is('outbound_time',null):query.eq('outbound_time',outbound);
    query=inbound===null?query.is('return_time',null):query.eq('return_time',inbound);
    const {data,error:lookupError}=await query.order('created_at',{ascending:false}).limit(1);
    if(lookupError)throw lookupError;
    return data?.[0]?.id as string|undefined;
   };
   if(await findExisting()){
    setNotice('REQUEST_DUPLICATE');
    return;
   }
   const {error:insertError}=await client!.from('v31_trip_requests').insert({
    rider_id:uid,origin_area_id:from.id,destination_area_id:to.id,
    outbound_time:outbound,return_time:inbound,direction:requestDirection,
    period:requestPeriod,seats,request_key:key
   });
   if(insertError?.message.includes('DUPLICATE_OPEN_TRIP_REQUEST')){
    if(await findExisting()){
     setNotice('REQUEST_EXISTS');
     return;
    }
    throw insertError;
   }
   if(insertError&&insertError.code!=='23505')throw insertError;
   // Idempotent network retries are only successful if the owned row is real.
   const {data:saved,error:verifyError}=await client!.from('v31_trip_requests')
    .select('id,rider_id,origin_area_id,destination_area_id,outbound_time,return_time,direction,period,seats')
    .eq('rider_id',uid).eq('request_key',key).maybeSingle();
   if(verifyError||!saved||saved.rider_id!==uid||
     saved.origin_area_id!==from.id||saved.destination_area_id!==to.id||
     (saved.outbound_time?.slice(0,5)||null)!==outbound||
     (saved.return_time?.slice(0,5)||null)!==inbound||
     saved.direction!==requestDirection||
     saved.period!==requestPeriod||saved.seats!==seats)throw Error('REQUEST_SAVE_NOT_VERIFIED');
   setNotice('REQUEST_SAVED');
   setKey(crypto.randomUUID());
  });
 };
 const startEdit=(request:RequestRow)=>setEditing({
  id:request.id,direction:request.direction,outbound:request.outbound_time?.slice(0,5)||'07:30',
  returnTime:request.return_time?.slice(0,5)||'17:00',
  period:request.period==='weekly'?'weekly':'monthly',seats:request.seats
 });
 const canSaveEdit=Boolean(editing&&validSeats(editing.seats)&&
  (editing.direction==='return'||validClock(editing.outbound))&&
  (editing.direction==='outbound'||validClock(editing.returnTime)));
 const saveEdit=async()=>{
  if(!client||!editing||!uid)return;
  const draft=editing;
  const outbound=draft.direction==='return'?null:draft.outbound;
  const inbound=draft.direction==='outbound'?null:draft.returnTime;
  if(!canSaveEdit){
   setError(t('راجع عدد المقاعد ومواعيد الذهاب والعودة.','Check seats and departure/return times.'));return;
  }
  await action(async()=>{
   const {data:id,error:editError}=await client!.rpc('v31_edit_open_trip_request',{
    p_request:draft.id,p_direction:draft.direction,p_period:draft.period,
    p_outbound_time:outbound,p_return_time:inbound,p_seats:draft.seats
   });
   if(editError)throw editError;
   if(id!==draft.id)throw Error('REQUEST_EDIT_NOT_VERIFIED');
   const {data:saved,error:verifyError}=await client!.from('v31_trip_requests')
    .select('id,rider_id,direction,outbound_time,return_time,period,seats,status')
    .eq('id',draft.id).eq('rider_id',uid).maybeSingle();
   if(verifyError||!saved||saved.status!=='open'||saved.rider_id!==uid||
    saved.direction!==draft.direction||saved.period!==draft.period||saved.seats!==draft.seats||
    (saved.outbound_time?.slice(0,5)||null)!==outbound||
    (saved.return_time?.slice(0,5)||null)!==inbound)throw Error('REQUEST_EDIT_NOT_VERIFIED');
   setEditing(null);
   setNotice('REQUEST_UPDATED');
  });
 };
 const sendOffer=async(id:string)=>{
  if(!client)return;
  const routeId=routeSelection[id]||routes[0]?.id;
  if(!routeId){setError(t('انشر خط مناسب أولًا.','Publish a matching route first.'));return;}
  await action(async()=>{const {error:insertError}=await client!.from('v31_trip_offers').insert({request_id:id,captain_id:uid,route_id:routeId});if(insertError)throw insertError;});
 };
 const accept=async(id:string)=>{if(!client)return;await action(async()=>{const {data,error:rpcError}=await client!.rpc('v31_accept_trip_offer',{p_offer:id});if(rpcError)throw rpcError;setNotice(t('تم حجز المقاعد قيد الانتظار: '+data,'Pending seats booked: '+data));});};
 const cancel=async(id:string)=>{if(!client)return;await action(async()=>{const {error:rpcError}=await client!.rpc('v31_cancel_trip_request',{p_request:id});if(rpcError)throw rpcError;});};
 const offerStatus=(status:string)=>({
   offered:t('عرض متاح','Offered'),accepted:t('مقبول','Accepted'),
   rejected:t('مرفوض','Rejected'),withdrawn:t('مسحوب','Withdrawn')
  } as Record<string,string>)[status]||t('حالة غير معروفة','Unknown status');
 const area=(id:number)=>{const a=areas.find(x=>x.id===id);return a?(en?a.name_en:a.name_ar):String(id);};
 const visible=requests.filter(r=>mode==='captain'?r.status==='open':r.rider_id===uid);
 const active=visible.filter(r=>r.status==='open');
 const history=mode==='rider'?visible.filter(r=>r.status!=='open'):[];
 const requestList=(items:RequestRow[])=><ul className="sekka-request-list">{items.map(r=><li className="sekka-request-card" key={r.id}>
   <strong className="sekka-request-card__route">{area(r.origin_area_id)} ← {area(r.destination_area_id)}</strong>
   {' · '}{r.direction==='round_trip'?t('ذهاب وعودة','Round trip'):r.direction==='return'?t('عودة فقط','Return only'):t('ذهاب فقط','Outbound only')}
   {r.outbound_time&&' · '+t('الذهاب ','Outbound ')+r.outbound_time.slice(0,5)}
   {r.return_time&&' · '+t('العودة ','Return ')+r.return_time.slice(0,5)}
   {' · '}{r.period==='weekly'?t('أسبوعي','Weekly'):t('شهري','Monthly')}
   {' · '}{r.seats} {t('مقاعد','seats')}
   {' · '}{r.status==='open'?t('مفتوح','Open'):r.status==='accepted'?t('مقبول','Accepted'):r.status==='cancelled'?t('ملغي','Cancelled'):r.status}
   {mode==='rider'&&r.status==='open'&&<div className="sekka-request-card__actions">
    {!offers.some(o=>o.request_id===r.id)&&<button type="button" className="sekka-request-edit" aria-label={t('تعديل الطلب','Edit request')} disabled={busy}
     onClick={()=>startEdit(r)}>{t('تعديل','Edit')}</button>}
    <button type="button" className="sekka-request-cancel" aria-label={t('إلغاء الطلب','Cancel request')} disabled={busy} onClick={()=>void cancel(r.id)}>{t('إلغاء الطلب','Cancel request')}</button>
   </div>}
   {mode==='rider'&&editing?.id===r.id&&<div className="d-box" aria-label={t('تعديل تفاصيل الطلب','Edit request details')}>
    <p>{t('عدّل المقاعد والمواعيد بدل إنشاء طلب مكرر.','Change seats and times instead of submitting a duplicate.')}</p>
    <label>{t('اتجاه الرحلة','Journey direction')}<select value={editing.direction}
     onChange={e=>setEditing(v=>v?{...v,direction:e.target.value as RequestDirection}:v)}>
     <option value="outbound">{t('ذهاب فقط','Outbound only')}</option>
     <option value="return">{t('عودة فقط','Return only')}</option>
     <option value="round_trip">{t('ذهاب وعودة','Round trip')}</option>
    </select></label>
    {editing.direction!=='return'&&<label>{t('وقت الذهاب','Departure time')}
     <input type="time" value={editing.outbound} onChange={e=>setEditing(v=>v?{...v,outbound:e.target.value}:v)}/></label>}
    {editing.direction!=='outbound'&&<label>{t('وقت العودة','Return time')}
     <input type="time" value={editing.returnTime} onChange={e=>setEditing(v=>v?{...v,returnTime:e.target.value}:v)}/></label>}
    <label>{t('مدة الاشتراك','Subscription period')}<select value={editing.period}
     onChange={e=>setEditing(v=>v?{...v,period:e.target.value as 'weekly'|'monthly'}:v)}>
     <option value="weekly">{t('أسبوعي','Weekly')}</option>
     <option value="monthly">{t('شهري','Monthly')}</option></select></label>
    <label>{t('عدد المقاعد المطلوبة','Seats needed')}
     <input type="number" min={1} max={MAX_SEATS_PER_RIDER} value={editing.seats}
      onChange={e=>setEditing(v=>v?{...v,seats:Number(e.target.value)}:v)}/></label>
    <button type="button" disabled={busy||!canSaveEdit} onClick={()=>void saveEdit()}>{busy?t('جارٍ الحفظ…','Saving…'):t('حفظ التعديل','Save changes')}</button>
    <button type="button" disabled={busy} onClick={()=>setEditing(null)}>{t('رجوع','Back')}</button>
   </div>}
   {mode==='captain'&&routes.length>0&&<div>
    <select aria-label={t('الخط المراد عرضه','Offer route')} value={routeSelection[r.id]||routes[0]?.id||''}
     onChange={e=>setRouteSelection(v=>({...v,[r.id]:e.target.value}))}>
     {routes.map(route=><option key={route.id} value={route.id}>{route.title}</option>)}</select>
    <button type="button" disabled={busy||offers.some(o=>o.request_id===r.id&&o.captain_id===uid)}
     onClick={()=>void sendOffer(r.id)}>{t('إرسال عرض خط','Offer route')}</button>
   </div>}
   {mode==='rider'&&offers.filter(o=>o.request_id===r.id).map(o=><div key={o.id}>
    {t('عرض كابتن','Captain offer')} · {offerStatus(o.status)}
    {r.status==='open'&&o.status==='offered'&&<button type="button" disabled={busy}
     onClick={()=>void accept(o.id)}>{t('اقبل واحجز المقاعد','Accept and reserve seats')}</button>}
   </div>)}
  </li>)}</ul>;
 const noticeText=notice==='REQUEST_DUPLICATE'
  ?compact?t('عندك طلب مطابق مفتوح بالفعل. تابعه من حجوزاتي ← طلبات رحلاتي.','You already have this trip request. Find it in My bookings → My trip requests.'):t('عندك طلب مفتوح مطابق بالفعل. تابعه في القائمة بدل تكراره.','An identical trip request is already open. Follow it in the list below.')
  :notice==='REQUEST_EXISTS'
  ?compact?t('الطلب موجود بالفعل في حجوزاتي ← طلبات رحلاتي.','This request already exists in My bookings → My trip requests.'):t('الطلب ده مفتوح بالفعل. تابعه في القائمة بدل تكراره.','This trip is already requested. Follow it below.')
  :notice==='REQUEST_SAVED'
  ?compact?t('طلبك اتحفظ بنفس بيانات البحث. تابعه من حجوزاتي ← طلبات رحلاتي.','Your request was saved using your search details. Follow it in My bookings → My trip requests.'):t('اتحفظ طلبك بكامل تفاصيل الذهاب والعودة. تقدر تتابعه هنا.','Your request and journey schedule are saved. Follow it here.')
  :notice==='REQUEST_UPDATED'?t('تم تعديل الطلب والتحقق من حفظه.','Request updated and verified.'):notice;
 const loadError=loadFailed&&<div role="alert" className="d-feedback">
  <p>{t('مش قادرين نراجع حسابك أو الطلبات دلوقتي.','We couldn’t verify your account or load requests.')}</p>
  <button type="button" className="d-outline" onClick={retryLoad}>{t('حاول تاني','Try again')}</button>
 </div>;
 const areaLabel=(name:string)=>{
  const area=areas.find(item=>item.name_ar===name||item.name_en===name);
  return (en?area?.name_en:area?.name_ar)||name;
 };
 // No-match results reuse the passenger's original search. A single click
 // creates a one-seat request; account ownership, idempotency, and duplicate
 // prevention remain enforced by Supabase and verified after insertion.
 if(compact&&mode==='rider'&&search){
  return <div className="sekka-no-match-action" aria-label={t('طلب رحلة بالبحث الحالي','Trip request from current search')}>
   {loading&&<p role="status">{t('بنجهّز طلبك…','Getting your request ready…')}</p>}
   {loadError}
   {error&&!loadFailed&&<p role="alert">{error}</p>}
   {notice&&<p role="status">{noticeText}</p>}
   {!loading&&!loadFailed&&!notice&&uid&&<div className="sekka-request-summary">
    <p><strong><bdi>{areaLabel(search.origin)}</bdi> <span aria-hidden="true">·</span> <bdi>{areaLabel(search.destination)}</bdi></strong></p>
    <p>
     {requestDirection!=='return'&&<span>{t('ذهاب','Outbound')} <bdi>{requestTime}</bdi> · </span>}
     {requestDirection!=='outbound'&&<span>{t('عودة','Return')} <bdi>{requestReturnTime}</bdi> · </span>}
     {requestPeriod==='weekly'?t('أسبوعي','Weekly'):t('شهري','Monthly')}
    </p>
   </div>}
   {!loading&&!loadFailed&&!notice&&<button type="button" className="d-primary sekka-request-yellow-cta"
    disabled={busy||!search.origin||!search.destination}
    onClick={()=>void create()}>{busy?t('بنحفظ طلب رحلتك…','Saving your trip request…'):
     uid?t('اطلب مشوار','Request a ride'):
     t('اطلب مشوار','Request a ride')}</button>}
   {!loading&&!loadFailed&&!notice&&!uid&&<p>{t('الدخول بجوجل مطلوب لحفظ الطلب، وبيانات البحث هتفضل موجودة.','Google sign-in is required to save a request. Your search is retained.')}</p>}
  </div>;
 }
 return <section className="d-box live-trip-requests">
  <h2>{mode==='captain'?t('طلبات الركاب المفتوحة','Open passenger requests'):t('طلبات رحلاتي','My trip requests')}</h2>
  {loading&&<p role="status">{t('جارٍ التحميل…','Loading…')}</p>}
  {loadError}
  {error&&!loadFailed&&<div role="alert"><p>{error}</p><button type="button" onClick={retryLoad}>{t('إعادة المحاولة','Retry')}</button></div>}
  {notice&&<p role="status">{noticeText}</p>}
  {!loading&&!loadFailed&&visible.length===0&&mode==='captain'&&<p>{t('مفيش طلبات مفتوحة حاليًا.','No open requests right now.')}</p>}
  {mode==='rider'&&search&&!loading&&!loadFailed&&!uid&&<div className="d-feedback"><p>{t('سجّل بجوجل علشان تحفظ طلب رحلتك. البحث متاح من غير حساب.','Sign in with Google to save your trip request. Searching does not require an account.')}</p><button type="button" onClick={onSignIn}>{t('تسجيل الدخول والمتابعة','Sign in and continue')}</button></div>}
  {mode==='rider'&&search&&!loading&&!loadFailed&&Boolean(uid)&&<div>
   <h3>{t('لم تجد خطًا؟ راجع بيانات طلبك','No match? Review your request')}</h3>
   <p>{search.origin} ← {search.destination}</p>
   <label>{t('اتجاه الرحلة','Journey direction')}<select value={requestDirection}
    onChange={e=>setRequestDirection(e.target.value as RequestDirection)}>
    <option value="outbound">{t('ذهاب فقط','Outbound only')}</option>
    <option value="return">{t('عودة فقط','Return only')}</option>
    <option value="round_trip">{t('ذهاب وعودة','Round trip')}</option>
   </select></label>
   {requestDirection!=='return'&&<label>{t('وقت الذهاب','Departure time')}<input type="time" value={requestTime} onChange={e=>setRequestTime(e.target.value)} required/></label>}
   {requestDirection!=='outbound'&&<label>{t('وقت العودة','Return time')}<input type="time" value={requestReturnTime} onChange={e=>setRequestReturnTime(e.target.value)} required/></label>}
   <label>{t('مدة الاشتراك','Subscription period')}<select value={requestPeriod} onChange={e=>setRequestPeriod(e.target.value as 'weekly'|'monthly')}><option value="weekly">{t('أسبوعي','Weekly')}</option><option value="monthly">{t('شهري','Monthly')}</option></select></label>
   <label>{t('عدد المقاعد المطلوبة','Seats needed')}<input type="number" min={1} max={MAX_SEATS_PER_RIDER} value={seats} onChange={e=>setSeats(Number(e.target.value))}/></label>
   <p>{t('تقدر تطلب مقعد أو مقعدين فقط لكل حساب.','You can request one or two seats per account.')}</p>
   <button type="button" disabled={busy||!Number.isInteger(seats)||seats<1||seats>MAX_SEATS_PER_RIDER||
    (requestDirection!=='return'&&!requestTime)||(requestDirection!=='outbound'&&!requestReturnTime)} onClick={()=>void create()}>{busy?t('جارٍ حفظ الطلب…','Saving request…'):t('تأكيد وحفظ طلب الرحلة','Confirm and save trip request')}</button>
   <p>{t('الطلب مش حجز ومفيش أي دفع.','Requesting does not reserve seats or charge money.')}</p>
  </div>}
  {mode==='rider'&&<h3>{t('الطلبات النشطة','Active requests')} ({active.length})</h3>}
  {!loading&&!loadFailed&&active.length===0&&mode==='rider'&&<p>{t('مفيش طلبات نشطة حاليًا.','No active requests right now.')}</p>}
  {requestList(active)}
  {mode==='rider'&&history.length>0&&<details className="d-request-history">
   <summary>{t('الطلبات السابقة والملغية','Previous and cancelled requests')} ({history.length})</summary>
   {requestList(history)}
  </details>}
  <button type="button" onClick={refresh}>{t('تحديث الطلبات','Refresh requests')}</button>
 </section>;
}
