import {useEffect,useState} from 'react';
import {client} from './api';
import {cancelPendingBooking} from './reservations';
import {usePreferences} from './preferences';
type Booking={id:string;route_id:string;rider_id:string;seats:number;status:string;created_at:string;v31_routes?:{title:string}|null};
export default function LiveBookings({mode,onFindRide}:{
 mode:'rider'|'captain';onFindRide?:()=>void;
}){
 const {language}=usePreferences(),en=language==='en',t=(ar:string,english:string)=>en?english:ar;
 const [routeTitles,setRouteTitles]=useState<Record<string,string>>({});
 const [filter,setFilter]=useState<'all'|'pending'|'confirmed'>('all');
 const [items,setItems]=useState<Booking[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[refresh,setRefresh]=useState(0);
 useEffect(()=>{let active=true;void(async()=>{
  try{
   if(!client)throw Error('BACKEND_NOT_CONFIGURED');
   const {data:{user},error:authError}=await client.auth.getUser();
   if(authError||!user)throw Error('AUTH_REQUIRED');
   let ids:string[]=[];
   if(mode==='captain'){
    const {data:routes,error:routeError}=await client.from('v31_routes').select('id,title').eq('captain_id',user.id);
    if(routeError)throw routeError;
    ids=(routes||[]).map(x=>x.id);
    if(active)setRouteTitles(Object.fromEntries((routes||[]).map(route=>[route.id,route.title])));
    if(!ids.length){if(active)setItems([]);return;}
   }
   let query=client.from('v31_bookings').select('id,route_id,rider_id,seats,status,created_at').order('created_at',{ascending:false}).limit(100);
   if(mode==='rider')query=query.eq('rider_id',user.id);
   else query=query.in('route_id',ids);
   const {data,error:readError}=await query;
   if(readError)throw readError;
   if(active)setItems((data||[]) as Booking[]);
  }catch(e){if(active)setError(e instanceof Error?e.message:String(e));}
  finally{if(active)setLoading(false);}
 })();return()=>{active=false;};},[mode,refresh]);
 const statusLabel=(status:string)=>({
  pending:t('قيد الانتظار','Pending'),
  confirmed:t('مؤكد','Confirmed'),
  cancelled:t('ملغي','Cancelled'),
  completed:t('مكتمل','Completed')
 } as Record<string,string>)[status]||t('حالة غير معروفة','Unknown status');
 const cancel=async(id:string)=>{setBusy(id);setError('');try{await cancelPendingBooking(id);setRefresh(v=>v+1);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy('');}};
 const shown=mode==='captain'&&filter!=='all'?items.filter(b=>b.status===filter):items;
 return <section className="d-box live-bookings">
  <h2>{mode==='captain'?t('حجوزات خطوطك','Reservations on your routes'):t('حجوزاتي','My bookings')}</h2>
  {loading&&<p role="status">{t('جارٍ التحميل…','Loading…')}</p>}
  {error&&<div role="alert"><p>{error}</p><button onClick={()=>{setError('');setLoading(true);setRefresh(v=>v+1);}}>{t('إعادة المحاولة','Retry')}</button></div>}
  {mode==='captain'&&<div className="cj-filter-tabs" role="group" aria-label={t('تصفية الحجوزات','Booking filters')}>
   {(['all','pending','confirmed'] as const).map(value=><button key={value} type="button" aria-pressed={filter===value} onClick={()=>setFilter(value)}>{value==='all'?t('الكل','All'):value==='pending'?t('قيد الانتظار','Pending'):t('المؤكدة','Confirmed')}</button>)}
  </div>}
  {!loading&&!error&&shown.length===0&&<>
   <p>{filter==='all'?t('ما عندكش حجوزات لسه.','No bookings yet.'):t('مفيش حجوزات بالحالة المختارة.','No bookings with this status.')}</p>
   {mode==='rider'&&onFindRide&&<button type="button" className="d-primary" onClick={onFindRide}>
    {t('دوّر على مشوار','Find a ride')}
   </button>}
  </>}
  <ul>{shown.map(b=><li key={b.id}>
   <div className="cj-card-head"><strong>{mode==='captain'?routeTitles[b.route_id]||t('خط محفوظ','Saved route'):t('حجز','Booking')+' '+b.id.slice(0,8)}</strong><span className={'cj-status'+(b.status==='pending'?' is-draft':'')}>{statusLabel(b.status)}</span></div>
   <div className="cj-route-meta"><span>{b.seats} {t('مقاعد محجوزة','booked seats')}</span><span>{t('رقم الحجز','Booking ID')}: {b.id.slice(0,8)}</span></div>
   <small>{new Date(b.created_at).toLocaleString(en?'en-GB':'ar-EG')}</small>
    {mode==='rider'&&<a className="d-outline" href={`/?tab=booking&booking=${encodeURIComponent(b.id)}`}>{t('عرض تفاصيل الحجز','View booking details')}</a>}
    {mode==='rider'&&b.status==='pending'&&<button type="button" disabled={Boolean(busy)} onClick={()=>void cancel(b.id)}>{busy===b.id?t('جارٍ الإلغاء…','Cancelling…'):t('إلغاء الحجز','Cancel booking')}</button>}
  </li>)}</ul>
  <button type="button" onClick={()=>{setLoading(true);setRefresh(v=>v+1);}}>{t('تحديث الحجوزات','Refresh reservations')}</button>
 </section>;
}
