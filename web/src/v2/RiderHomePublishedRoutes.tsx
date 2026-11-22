import {useEffect,useState} from 'react';
import {client} from './api';
import {fetchPublishedSelection} from './LiveRouteSearch';
import type {LiveSelection,Route} from './LiveRouteSearch';
import {usePreferences} from './preferences';

type Offer=Pick<Route,'id'|'title'|'category'|'seat_capacity'|'period'|'direction'|'outbound_time'|'return_time'|'seat_price_egp'|'return_supported'>;
type Available=Offer&{remaining:number};
type State={status:'loading'|'ready'|'empty'|'error';rides:Available[]};
type StopRow={id:string;position:number;pickup_allowed:boolean;dropoff_allowed:boolean};

// Every displayed amount and seat count comes from public Supabase reads/RPCs.
// No decorative sample rides, guessed prices or fabricated availability.
export default function RiderHomePublishedRoutes({onSelect,onSearch}:{onSelect:(selection:LiveSelection)=>void;onSearch:()=>void}){
 const {language}=usePreferences();
 const en=language==='en',t=(ar:string,english:string)=>en?english:ar;
 const [state,setState]=useState<State>({status:'loading',rides:[]});
 const [opening,setOpening]=useState<string|null>(null);
 const [openError,setOpenError]=useState('');
 useEffect(()=>{
  const api=client;
  if(!api){setState({status:'error',rides:[]});return;}
  const controller=new AbortController();
  void (async()=>{
   try{
    const response=await api.from('v31_public_route_offers')
     .select('id,title,category,seat_capacity,period,direction,outbound_time,return_time,seat_price_egp,return_supported')
     .eq('status','published').limit(4).abortSignal(controller.signal);
    if(response.error)throw response.error;
    const rows=(response.data||[]) as Offer[];
    // The server is authoritative for *remaining* seats, never use vehicle capacity.
    let failedAvailability=false;
    const checked=await Promise.all(rows.map(async route=>{
     const seats=await api.rpc('v31_published_route_available_seats',{p_route:route.id}).abortSignal(controller.signal);
     if(seats.error||typeof seats.data!=='number'){
      failedAvailability=true;
      return null;
     }
     return seats.data>0?{...route,remaining:seats.data} as Available:null;
    }));
    if(!controller.signal.aborted){
     const rides=checked.filter((row):row is Available=>row!==null).slice(0,2);
     setState({status:rides.length?'ready':failedAvailability?'error':'empty',rides});
    }
   }catch{
    if(!controller.signal.aborted)setState({status:'error',rides:[]});
   }
  })();
  return ()=>controller.abort();
 },[]);
 const openRide=async(route:Available)=>{
  const api=client;
  if(!api)return;
  setOpening(route.id);setOpenError('');
  try{
   const {data,error}=await api.from('v31_route_stops')
    .select('id,position,pickup_allowed,dropoff_allowed')
    .eq('route_id',route.id).order('position');
   if(error)throw error;
   const stops=(data||[]) as StopRow[];
   const start=stops.find(stop=>stop.pickup_allowed);
   const finish=[...stops].reverse().find(stop=>stop.dropoff_allowed&&(!start||stop.position>start.position));
   if(!start||!finish)throw Error('STOPS_UNAVAILABLE');
   const selected=await fetchPublishedSelection(route.id,start.id,finish.id,false);
   if(selected.remaining<1)throw Error('FULL_ROUTE');
   onSelect(selected);
  }catch{
   setOpenError(t('تعذّر فتح الرحلة دي حاليًا. ممكن تبحث عن رحلة تانية.','This trip cannot be opened right now. Try searching for another.'));
  }finally{setOpening(null);}
 };
 return <section className="rh-showcase-routes" aria-labelledby="rh-showcase-routes-title">
  <div className="rh-showcase-routes__heading">
   <h2 id="rh-showcase-routes-title">{t('رحلات منشورة حاليًا','Currently published rides')}</h2>
   <button type="button" onClick={onSearch}>{t('كل الرحلات','Explore rides')}</button>
  </div>
  {state.status==='loading'&&<p className="rh-showcase-routes__message" role="status">{t('بنراجع الرحلات المتاحة…','Checking published rides…')}</p>}
  {state.status==='error'&&<p className="rh-showcase-routes__message" role="status">{t('الرحلات مش متاحة للعرض دلوقتي. تقدر تبحث عن مشوارك مباشرة.','Rides cannot be previewed right now. You can still search directly.')}</p>}
  {state.status==='empty'&&<p className="rh-showcase-routes__message" role="status">{t('مفيش رحلات منشورة بمقاعد متاحة حاليًا. جرّب البحث عن خطك.','No published rides with open seats right now. Search for your route.')}</p>}
  {state.rides.length>0&&<div className="rh-showcase-routes__list">
   {state.rides.map(route=><button type="button" className="rh-showcase-ride"
    disabled={opening!==null} key={route.id} onClick={()=>void openRide(route)}
    aria-label={t('تفاصيل رحلة ','Details for ride ')+route.title}>
    <span className="rh-showcase-ride__vehicle" aria-hidden="true">
     <svg viewBox="0 0 48 40" fill="none"><path d="M8 16 13 7q2-3 6-3h11q4 0 6 4l5 11v11H6V20l2-4Z" fill="#FFFFFF" stroke="#057DAD" strokeWidth="2"/><path d="m15 10-3 9h26l-4-9H15Z" fill="#B1F0FB"/><path d="M7 28h34" stroke="#057DAD" strokeWidth="2"/><circle cx="14" cy="31" r="4" fill="#163A53"/><circle cx="34" cy="31" r="4" fill="#163A53"/></svg>
    </span>
    <span className="rh-showcase-ride__details">
     <strong dir="auto">{route.title}</strong>
     <small>{route.outbound_time?<bdi dir="ltr">{route.outbound_time.slice(0,5)}</bdi>:t('ميعاد حسب تفاصيل الرحلة','Time in trip details')} · {new Intl.NumberFormat(en?'en-EG':'ar-EG').format(route.remaining)} {t('مقاعد متاحة','seats available')}</small>
    </span>
    <span className="rh-showcase-ride__price"><bdi>{new Intl.NumberFormat(en?'en-EG':'ar-EG',{maximumFractionDigits:2}).format(route.seat_price_egp)}</bdi> {t('ج.م','EGP')}</span>
   </button>)}
  </div>}
  {openError&&<p role="alert" className="rh-showcase-routes__message">{openError}</p>}
 </section>;
}
