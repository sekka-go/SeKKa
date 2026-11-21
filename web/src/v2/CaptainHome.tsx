import {useEffect,useState} from 'react';
import {client} from './api';
import {usePreferences} from './preferences';
import {captainHomePhoto} from './captainHomePhoto';
import './captain-home.css';

type CaptainStats={routes:number;riders:number};
type RouteId={id:string};
type RiderBooking={rider_id:string};
const initialStats:CaptainStats={routes:0,riders:0};
function HomeSymbol({name}:{name:'pin'|'car'|'calendar'|'star'|'road'|'people'|'plus'}){
 const attrs={viewBox:'0 0 32 32',fill:'none',stroke:'currentColor',
  strokeWidth:2.2,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,
  'aria-hidden':true as const};
 if(name==='pin')return <svg {...attrs}><path d="M16 29s10-9.5 10-17a10 10 0 0 0-20 0c0 7.5 10 17 10 17Z"/><circle cx="16" cy="12" r="3.4"/></svg>;
 if(name==='car')return <svg {...attrs}><path d="m5 18 2.5-8a3 3 0 0 1 3-2h11a3 3 0 0 1 3 2l2.5 8v9h-4v-3H9v3H5v-9Z"/><path d="M5 18h22M3 14l4 1m22-1-4 1"/><circle cx="10" cy="20" r="1.4"/><circle cx="22" cy="20" r="1.4"/></svg>;
 if(name==='calendar')return <svg {...attrs}><rect x="4" y="7" width="24" height="21" rx="3"/><path d="M10 4v6m12-6v6M4 13h24m-18 7 4 4 7-7"/></svg>;
 if(name==='star')return <svg {...attrs} fill="currentColor" stroke="none"><path d="m16 2 4.5 9 10 1.5-7.25 7 1.75 10-9-4.7-9 4.7 1.75-10-7.25-7 10-1.5Z"/></svg>;
 if(name==='road')return <svg {...attrs}><path d="m12 3-6 26m14-26 6 26M16 4v5m0 6v5m0 6v3"/></svg>;
 if(name==='people')return <svg {...attrs}><circle cx="12" cy="10" r="4"/><path d="M3 27v-2a9 9 0 0 1 18 0v2H3Zm18-19a4 4 0 0 1 0 8m2 4a8 8 0 0 1 6 7h-6"/></svg>;
 return <svg {...attrs}><path d="M16 5v22M5 16h22"/></svg>;
}

/** The Captain home intentionally does not display private vehicle price,
 * payment amounts, fabricated activity, or an unimplemented live rating.
 * 5.0 is the owner-approved starting rating; missing counts start at zero.
 */
export default function CaptainHome({onCreate,onRoutes,onBookings}:{
 onCreate:()=>void;onRoutes:()=>void;onBookings:()=>void;
}){
 const {language}=usePreferences(),en=language==='en';
 const t=(ar:string,english:string)=>en?english:ar;
 const [stats,setStats]=useState<CaptainStats>(initialStats);
 useEffect(()=>{
  let active=true;
  if(!client)return;
  void(async()=>{
   try{
    const {data:{user},error:identityError}=await client.auth.getUser();
    if(identityError||!user||!active)return;
    const {data:routeRows,error:routeError,count}=await client.from('v31_routes')
     .select('id',{count:'exact'}).eq('captain_id',user.id).neq('status','archived')
     .order('created_at',{ascending:false}).limit(1000);
    if(routeError||!active)return;
    const routes=(routeRows||[]) as RouteId[];
    const countRoutes=Math.max(0,count??routes.length);
    if(active)setStats({routes:countRoutes,riders:0});
    if(!routes.length)return;
    const monthStart=new Date();
    monthStart.setDate(1);monthStart.setHours(0,0,0,0);
    // Route IDs must belong to the current authenticated Captain (RLS enforced).
    // Paginated lists beyond this bound cannot be safely represented as
    // complete rider totals; keep the display at 0 rather than invent totals.
    if(countRoutes>routes.length)return;
    const {data:rows,error:bookingsError}=await client.from('v31_bookings')
     .select('rider_id').in('route_id',routes.map(route=>route.id))
     .neq('status','cancelled').gte('created_at',monthStart.toISOString()).limit(1000);
    if(bookingsError||!active)return;
    const bookings=(rows||[]) as RiderBooking[];
    const riders=bookings.length===1000?0:new Set(bookings.map(row=>row.rider_id)).size;
    setStats({routes:countRoutes,riders});
   }catch{/* Missing backend data is presented as the owner-requested zero. */}
  })();
  return()=>{active=false};
 },[]);
 const digits=(n:number)=>n.toLocaleString(en?'en-GB':'ar-EG',{useGrouping:false});
 return <div className="cj-home" aria-label={t('الرئيسية للكابتن','Captain home')}>
  <section className="cj-home-welcome" aria-labelledby="cj-home-greeting">
   <div className="cj-home-welcome-copy">
    <span className="cj-home-welcome-kicker">{t('رحلتك تبدأ هنا','Your journey starts here')}</span>
    <h1 id="cj-home-greeting">{t('مرحبًا بك','Welcome')} <mark>{t('يا كابتن','Captain')}</mark></h1>
    <p>{t('أنشئ رحلتك وحقق دخل ثابت طول الشهر','Create your trip and earn a steady income all month')}</p>
   </div>
   <img src={captainHomePhoto} alt={t('كابتن داخل عربيته','Captain in his car')}
     className="cj-home-driver" loading="eager" decoding="async"/>
  </section>

  <section className="cj-home-how" aria-labelledby="cj-home-how-title">
   <h2 id="cj-home-how-title"><span>{t('كيف تبدأ؟','How to start')}</span></h2>
   <div className="cj-home-how-items">
    <div className="cj-home-how-step">
     <div className="cj-home-step-symbol"><HomeSymbol name="pin"/><b>1</b></div>
     <strong>{t('حدد المسار','Set your route')}</strong>
     <small>{t('من أين إلى أين؟','From where to where?')}</small>
    </div>
    <div className="cj-home-how-step">
     <div className="cj-home-step-symbol"><HomeSymbol name="car"/><b>2</b></div>
     <strong>{t('اختر سيارتك','Choose your car')}</strong>
     <small>{t('والسعة المناسبة','And seat capacity')}</small>
    </div>
    <div className="cj-home-how-step">
     <div className="cj-home-step-symbol"><HomeSymbol name="calendar"/><b>3</b></div>
     <strong>{t('انشر الرحلة','Publish the trip')}</strong>
     <small>{t('واستقبل الحجوزات','Receive bookings')}</small>
    </div>
   </div>
  </section>

  <button type="button" className="cj-home-main-action" onClick={onCreate}>
   <HomeSymbol name="plus"/><strong>{t('إنشاء رحلة جديدة','Create a new trip')}</strong>
   <HomeSymbol name="car"/>
  </button>

  <section className="cj-home-metrics" aria-label={t('ملخص نشاط الكابتن','Captain activity summary')}>
   <div className="cj-home-metric" aria-label={t('تقييمك المبدئي خمس نجوم','Your starting rating is five stars')}>
    <span className="cj-home-metric-icon cj-home-metric-icon-star"><HomeSymbol name="star"/></span>
    <strong>{t('تقييمك','Your rating')}</strong>
    <b>5.0</b>
   </div>
   <button type="button" className="cj-home-metric" onClick={onRoutes}>
    <span className="cj-home-metric-icon"><HomeSymbol name="road"/></span>
    <strong>{t('رحلاتك','Your trips')}</strong>
    <b>{digits(stats.routes)}</b>
   </button>
   <button type="button" className="cj-home-metric" onClick={onBookings}>
    <span className="cj-home-metric-icon"><HomeSymbol name="people"/></span>
    <strong>{t('ركاب هذا الشهر','Riders this month')}</strong>
    <b>{digits(stats.riders)}</b>
   </button>
  </section>
 </div>;
}
