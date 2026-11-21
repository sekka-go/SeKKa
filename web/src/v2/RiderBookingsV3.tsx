import {useEffect,useState} from 'react';
import {client} from './api';
import {cancelPendingBooking} from './reservations';
import {usePreferences} from './preferences';
import './rider-bookings-v3.css';

type RiderBooking={id:string;route_id:string;seats:number;status:string;created_at:string};
type Filter='active'|'past'|'all';
const pastStatuses=new Set(['completed','cancelled']);
export default function RiderBookingsV3({onFindRide,onOpenBooking}:{
 onFindRide:()=>void;onOpenBooking:(id:string)=>void;
}){
 const {language}=usePreferences(),en=language==='en',t=(ar:string,english:string)=>en?english:ar;
 const [items,setItems]=useState<RiderBooking[]>([]);
 const [titles,setTitles]=useState<Record<string,string>>({});
 const [filter,setFilter]=useState<Filter>('active');
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0);
 const [cancelIntent,setCancelIntent]=useState<string|null>(null);
 const [busy,setBusy]=useState('');
 useEffect(()=>{
  let active=true;
  setLoading(true);setError('');
  void(async()=>{
   try{
    if(!client)throw Error('BACKEND_NOT_CONFIGURED');
    const {data:{user},error:authError}=await client.auth.getUser();
    if(authError||!user)throw Error('AUTH_REQUIRED');
    const {data,error:readError}=await client.from('v31_bookings')
     .select('id,route_id,seats,status,created_at')
     .eq('rider_id',user.id).order('created_at',{ascending:false}).limit(100);
    if(readError)throw readError;
    const bookings=(data||[]) as RiderBooking[];
    if(!active)return;
    setItems(bookings);
    // A public title can disappear when the route is unpublished; never fail
    // to display an owned booking because this optional metadata is unavailable.
    const ids=[...new Set(bookings.map(row=>row.route_id))];
    if(ids.length){
     const titlesResponse=await client.from('v31_public_route_offers')
      .select('id,title').in('id',ids);
     if(active&&!titlesResponse.error&&titlesResponse.data){
      setTitles(Object.fromEntries(titlesResponse.data.map(row=>[row.id,row.title])));
     }
    }else setTitles({});
   }catch(e){if(active)setError(e instanceof Error?e.message:String(e));}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[refresh]);
 const shown=items.filter(b=>filter==='all'||(filter==='past'?pastStatuses.has(b.status):!pastStatuses.has(b.status)));
 const status=(value:string)=>{
  const labels:Record<string,string>={
   pending:t('قيد الانتظار','Pending'),
   confirmed:t('مؤكّد','Confirmed'),
   cancelled:t('ملغي','Cancelled'),
   completed:t('مكتمل','Completed')
  };
  return labels[value]||t('حالة قيد المراجعة','Status under review');
 };
 const cancel=async(id:string)=>{
  setBusy(id);setError('');
  try{await cancelPendingBooking(id);setCancelIntent(null);setRefresh(v=>v+1);}
  catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setBusy('');}
 };
 return <section className="rb3" aria-labelledby="rb3-title">
  <header className="rb3__hero">
   <span>{t('كل مشاويرك في مكان واحد','YOUR RIDES')}</span>
   <h1 id="rb3-title">{t('رحلاتي','My rides')}</h1>
   <p>{t('حجوزاتك الحقيقية وحالتها، من غير ما تدور عليها.','Your real seat reservations and their current status.')}</p>
  </header>
  <div className="rb3__filters" role="group" aria-label={t('تصفية الحجوزات','Booking filters')}>
   {(['active','past','all'] as const).map(value=><button type="button" key={value}
    aria-pressed={filter===value} onClick={()=>{setFilter(value);setCancelIntent(null);}}>
    {value==='active'?t('الحالية','Current'):value==='past'?t('السابقة','Past'):t('الكل','All')}
   </button>)}
  </div>
  {loading&&<div role="status" className="rb3__loading">
   <div aria-hidden="true"/><div aria-hidden="true"/><span>{t('بنجيب حجوزاتك…','Loading your bookings…')}</span>
  </div>}
  {error&&<div role="alert" className="rb3__error">
   <p>{t('مش قادرين نحمّل الحجوزات أو نكمل العملية. جرّب تاني.','Could not load bookings or complete the action. Try again.')}</p>
   <small dir="auto">{error}</small>
   <button type="button" onClick={()=>{setLoading(true);setRefresh(v=>v+1);}}>{t('إعادة المحاولة','Retry')}</button>
  </div>}
  {!loading&&!error&&shown.length===0&&<section className="rb3__empty">
   <div className="rb3__empty-icon" aria-hidden="true">⌖</div>
   <h2>{filter==='past'?t('مفيش رحلات سابقة','No previous rides'):t('لسه مفيش حجوزات هنا','No rides here yet')}</h2>
   <p>{t('أول ما تحجز مقعد في رحلة منشورة هتظهر هنا بحالتها الحقيقية.',
    'When you reserve a seat on a published ride, it appears here with its real status.')}</p>
   <button type="button" onClick={onFindRide}>{t('دور على رحلة','Find a ride')}</button>
  </section>}
  {!loading&&!error&&shown.length>0&&<ul className="rb3__list">
   {shown.map(b=><li key={b.id} className="rb3__card">
    <div className="rb3__card-top">
     <span className={'rb3__status rb3__status--'+b.status}>{status(b.status)}</span>
     <small>{new Date(b.created_at).toLocaleDateString(en?'en-GB':'ar-EG',{day:'numeric',month:'short',year:'numeric'})}</small>
    </div>
    <h2 dir="auto">{titles[b.route_id]||t('حجز رحلة مشتركة','Shared-ride booking')}</h2>
    <div className="rb3__meta">
     <span>{t('المقاعد','Seats')} <strong>{new Intl.NumberFormat(en?'en-EG':'ar-EG').format(b.seats)}</strong></span>
     <span>{t('مرجع الحجز','Reference')} <bdi>{b.id.slice(0,8)}</bdi></span>
    </div>
    <button type="button" className="rb3__details" onClick={()=>onOpenBooking(b.id)}>
     {t('عرض تفاصيل الحجز','View booking details')}
    </button>
    {b.status==='pending'&&<div className="rb3__cancel">
     {cancelIntent===b.id?<div className="rb3__confirm" role="group"
       aria-label={t('تأكيد إلغاء الحجز','Confirm cancellation')}>
       <p>{t('متأكد إنك عاوز تلغي؟ المقاعد هترجع للإتاحة حسب قواعد النظام.',
        'Cancel this booking? Seats will be released according to system rules.')}</p>
       <div>
        <button type="button" disabled={!!busy} onClick={()=>void cancel(b.id)}>
         {busy===b.id?t('جارٍ الإلغاء…','Cancelling…'):t('تأكيد الإلغاء','Confirm cancellation')}
        </button>
        <button type="button" disabled={!!busy} onClick={()=>setCancelIntent(null)}>
         {t('تراجع','Keep booking')}
        </button>
       </div>
      </div>:<button type="button" className="rb3__cancel-trigger"
        onClick={()=>setCancelIntent(b.id)}>{t('إلغاء الحجز','Cancel booking')}</button>}
     </div>}
   </li>)}
  </ul>}
  {!loading&&!error&&items.length>0&&<button type="button" className="rb3__refresh"
   onClick={()=>{setLoading(true);setRefresh(v=>v+1);}}>{t('تحديث الحجوزات','Refresh bookings')}</button>}
 </section>;
}
