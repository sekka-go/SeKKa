import LiveTripRequests from './LiveTripRequests';
import {reserveSeatsWithStops,MAX_SEATS_PER_RIDER} from './reservations';
import {useEffect,useState} from 'react';
import {client} from './api';
import {usePreferences} from './preferences';

export type Route={id:string;title:string;category:string;seat_capacity:number;period:string;direction:string;outbound_time:string|null;return_time:string|null;price_egp:number;return_supported:boolean};
export type Stop={id:string;route_id:string;area_id:number;position:number;name:string;pickup_allowed:boolean;dropoff_allowed:boolean};
type Area={id:number;name_ar:string;name_en:string};
export type LiveSelection={route:Route;from:Stop;to:Stop;reverse:boolean;stops:Stop[];remaining:number};
type Match=Omit<LiveSelection,'remaining'>;
export async function fetchPublishedSelection(routeId:string,fromId:string,toId:string,reverse:boolean):Promise<LiveSelection>{
 if(!client)throw Error('BACKEND_NOT_CONFIGURED');
 const {data:route,error:routeError}=await client.from('v31_routes').select('id,title,category,seat_capacity,period,direction,outbound_time,return_time,price_egp,return_supported').eq('id',routeId).eq('status','published').maybeSingle();
 if(routeError)throw routeError;
 if(!route)throw Error('ROUTE_NOT_AVAILABLE');
 const {data:rows,error:stopsError}=await client.from('v31_route_stops').select('id,route_id,area_id,position,name,pickup_allowed,dropoff_allowed').eq('route_id',routeId).order('position');
 if(stopsError)throw stopsError;
 const stops=(rows||[]) as Stop[];
 const ordered=reverse?[...stops].reverse():stops;
 const from=ordered.find(s=>s.id===fromId),to=ordered.find(s=>s.id===toId);
 if(!from||!to||ordered.indexOf(from)>=ordered.indexOf(to)||
   !(reverse?route.return_supported&&route.direction!=='outbound'&&from.dropoff_allowed&&to.pickup_allowed:route.direction!=='return'&&from.pickup_allowed&&to.dropoff_allowed))throw Error('INVALID_ROUTE_STOPS');
 const {data:remaining,error:capacityError}=await client.rpc('v31_published_route_available_seats',{p_route:routeId});
 if(capacityError)throw capacityError;
 if(typeof remaining!=='number'||remaining<0)throw Error('CAPACITY_UNAVAILABLE');
 return {route:route as Route,from,to,reverse,stops,remaining};
}
export default function LiveRouteSearch({origin,destination,outbound,returnTime,period,requestPeriod,direction,categories,onSelect,onSignIn}:{
 origin:string;destination:string;outbound:string;returnTime:string;period:string;requestPeriod:string;direction:string;categories:string[];onSelect?:(selection:LiveSelection)=>void;onSignIn?:()=>void;
}){
 const {language}=usePreferences(),en=language==='en';
 const t=(ar:string,english:string)=>en?english:ar;
 const [items,setItems]=useState<LiveSelection[]>([]);
 const [loading,setLoading]=useState(Boolean(client));
 const [error,setError]=useState('');
 const [retry,setRetry]=useState(0);
 const [bookingBusy,setBookingBusy]=useState<string|null>(null);
 const [bookingError,setBookingError]=useState('');
 const [bookingSuccess,setBookingSuccess]=useState('');
 const [seatCounts,setSeatCounts]=useState<Record<string,number>>({});
 const [bookingKeys,setBookingKeys]=useState<Record<string,string>>({});
 const book=async(routeId:string,pickupStopId:string,dropoffStopId:string,reverse:boolean)=>{
  const seats=seatCounts[routeId]||1;
  if(!Number.isInteger(seats)||seats<1||seats>MAX_SEATS_PER_RIDER){setBookingError(t('الحد الأقصى للحجز شخصين فقط.','A maximum of two people per booking.'));return;}
  const key=bookingKeys[routeId]||crypto.randomUUID();
  setBookingKeys(v=>({...v,[routeId]:key}));setBookingBusy(routeId);setBookingError('');setBookingSuccess('');
  try{const result=await reserveSeatsWithStops(routeId,seats,key,pickupStopId,dropoffStopId,reverse);setBookingSuccess(t('تم تسجيل طلب الحجز برقم '+result.bookingId+'. حالته قيد الانتظار.','Booking requested: '+result.bookingId+'. Status: pending.'));setBookingKeys(v=>{const next={...v};delete next[routeId];return next;});setRetry(v=>v+1);}
  catch(e){const message=e instanceof Error?e.message:String(e);setBookingError(message.includes('RIDER_MAX_TWO_SEATS')||message.includes('MAX_TWO_SEATS_PER_RIDER')?t('كل حساب يقدر يحجز لشخصين فقط على نفس الخط.','At most two seats per account on the same route.'):message);}
  finally{setBookingBusy(null);}
 };
 useEffect(()=>{
  if(!client){setLoading(false);return;}
  let active=true;
  setLoading(true);setError('');
  void (async()=>{
   try{
    const [{data:areas,error:areaError},{data:routes,error:routeError}]=await Promise.all([
     client!.from('v31_service_areas').select('id,name_ar,name_en').eq('active',true),
     client!.from('v31_routes').select('id,title,category,seat_capacity,period,direction,outbound_time,return_time,price_egp,return_supported').eq('status','published').limit(100)
    ]);
    if(areaError||routeError)throw new Error(areaError?.message||routeError?.message);
    const areaRows=(areas||[]) as Area[],routeRows=(routes||[]) as Route[];
    const areaFor=(name:string)=>areaRows.find(a=>a.name_ar===name||a.name_en===name)?.id;
    const fromId=areaFor(origin),toId=areaFor(destination);
    if(!fromId||!toId||fromId===toId){if(active)setItems([]);return;}
    const ids=routeRows.map(r=>r.id);
    if(!ids.length){if(active)setItems([]);return;}
    const {data:stops,error:stopsError}=await client!.from('v31_route_stops')
      .select('id,route_id,area_id,position,name,pickup_allowed,dropoff_allowed')
      .in('route_id',ids).order('position').limit(3000);
    if(stopsError)throw stopsError;
    const all=(stops||[]) as Stop[];
    const matched:Match[]=[];
    for(const route of routeRows){
     if(period&&route.period!==period)continue;
     if(categories.length&&!categories.includes(route.category))continue;
     const sequence=all.filter(s=>s.route_id===route.id).sort((a,b)=>a.position-b.position);
     // Only use stop pairs that are valid in the advertised journey direction.
     const directions: {reverse:boolean;time:string|null}[]=[];
     if(route.direction!=='return')directions.push({reverse:false,time:route.outbound_time});
     if(route.direction!=='outbound'&&route.return_supported)directions.push({reverse:true,time:route.return_time});
     for(const candidate of directions){
      if(candidate.reverse? (returnTime&&candidate.time?.slice(0,5)!==returnTime) : (outbound&&candidate.time?.slice(0,5)!==outbound))continue;
      const ordered=candidate.reverse?[...sequence].reverse():sequence;
      for(let i=0;i<ordered.length;i++){
       const s=ordered[i];
       if(s.area_id!==fromId||(candidate.reverse?!s.dropoff_allowed:!s.pickup_allowed))continue;
       const next=ordered.slice(i+1).find(d=>d.area_id===toId&&(candidate.reverse?d.pickup_allowed:d.dropoff_allowed));
       if(next){matched.push({route,from:s,to:next,reverse:candidate.reverse,stops:sequence});break;}
      }
     }
    }
    // Passenger RLS intentionally hides other riders' bookings.
    // Fetch a server-owned aggregate, never derive availability from seat_capacity.
    const uniqueIds=[...new Set(matched.map(m=>m.route.id))];
    const capacities=await Promise.all(uniqueIds.map(async id=>{
      const {data,error:capError}=await client!.rpc('v31_published_route_available_seats',{p_route:id});
      if(capError)throw capError;
      if(typeof data!=='number'||data<0)throw Error('CAPACITY_UNAVAILABLE');
      return [id,data] as const;
    }));
    const availableByRoute=new Map(capacities);
    if(active)setItems(matched.map(m=>({...m,remaining:availableByRoute.get(m.route.id)??0})));
   }catch(e){if(active)setError(e instanceof Error?e.message:String(e));}
   finally{if(active)setLoading(false);}
  })();
  return ()=>{active=false;};
 },[origin,destination,outbound,returnTime,period,categories.join(','),retry]);
 return <section className="d-live-search">
  <p>{t('نتائج فعلية من الخطوط المنشورة للكباتن المعتمدين فقط.','Live results from published routes only.')}</p>
  {!client&&<p role="status">{t('البحث الحقيقي محتاج ربط إعدادات Supabase العامة.','Live search requires public Supabase configuration.')}</p>}
  {loading&&<p role="status">{t('بنبحث عن خطوط مطابقة…','Searching published routes…')}</p>}
  {error&&<div role="alert"><p>{t('تعذر تحميل الخطوط.','Unable to load routes.')} {error}</p><button onClick={()=>setRetry(v=>v+1)}>{t('حاول تاني','Retry')}</button></div>}
  {!loading&&!error&&items.length===0&&<div role="status"><p>{t('لسه مفيش خط مناسب.','No suitable route yet.')}</p><p>{t('لسه مفيش خطوط منشورة مطابقة لنقط الركوب والنزول ومواعيدك.','No published routes match your pickup, drop-off and schedule yet.')}</p></div>}
  {!loading&&!error&&items.length===0&&origin&&destination&&<LiveTripRequests mode="rider" search={{
   origin,destination,outbound,returnTime,period:requestPeriod,
   direction:direction==='outbound'||direction==='return'||direction==='round_trip'?direction:(returnTime?'round_trip':'outbound')
  }} onSignIn={onSignIn}/>}
  {bookingError&&<p role="alert">{bookingError}</p>}
  {bookingSuccess&&<p role="status">{bookingSuccess}</p>}
  {items.map((selection)=><article className="d-box d-result" key={selection.route.id+String(selection.reverse)+selection.from.id+selection.to.id}>{(()=>{const {route,from,to,reverse}=selection;return <>
   <h2>{route.title}</h2>
   <p>{from.name} ← {to.name}</p>
   <p>{route.category} · {selection.remaining} {t('مقاعد متاحة الآن من','seats currently available out of')} {route.seat_capacity} · {route.price_egp} {t('جنيه','EGP')}</p>
   {onSelect&&<button type="button" className="d-offer-select" onClick={()=>onSelect(selection)}>{t('عرض تفاصيل الخط','View route details')}</button>}
   {!onSelect&&<>
   <p>{reverse?t('العودة','Return'):t('الذهاب','Outbound')} · {(reverse?route.return_time:route.outbound_time)?.slice(0,5)} · {period==='weekly'?t('أسبوعي','Weekly'):t('شهري','Monthly')}</p>
   <label>{t('المقاعد المطلوبة','Seats to reserve')} <input type="number" min={1} max={Math.min(MAX_SEATS_PER_RIDER,selection.remaining)} value={seatCounts[route.id]||1} onChange={e=>setSeatCounts(v=>({...v,[route.id]:Number(e.target.value)}))}/></label>
   <button type="button" disabled={bookingBusy!==null||!Number.isInteger(seatCounts[route.id]||1)||(seatCounts[route.id]||1)<1||(seatCounts[route.id]||1)>MAX_SEATS_PER_RIDER||(seatCounts[route.id]||1)>selection.remaining} onClick={()=>void book(route.id,from.id,to.id,reverse)}>{bookingBusy===route.id?t('جارٍ حجز المقاعد…','Reserving seats…'):t('احجز مقاعد حقيقية','Reserve seats')}</button>
   <p>{t('الحجز يسجل قيد الانتظار، من غير OTP أو دفع.','Reservation is saved as pending, without OTP or payment.')}</p></>}
  </>})()}</article>)}
 </section>;
}
