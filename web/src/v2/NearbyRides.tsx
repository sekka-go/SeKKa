import AppSkeleton from './AppSkeleton';
import {inLaunchRegion,outsideCoverageMessage} from './geoPlace';
import {isInsideCairoDiscovery} from './discoveryCairo';
import {useEffect,useId,useState} from 'react';
import {client} from './api';
import {usePreferences} from './preferences';
import RiderStopMap from './RiderStopMap';
import './nearby-pickup-v4.css';
import {formatDistanceForLocale,approximateWalkMinutes} from './recurringGeo';
import {fetchPublishedSelection} from './LiveRouteSearch';
import type {LiveSelection} from './LiveRouteSearch';
import {nearbyPublishedStops,validCoordinates} from './nearbyRoutes';
import type {GeoPoint,NearbyStop,NearbyRoute,NearbyCandidate} from './nearbyRoutes';

type RouteRow=NearbyRoute&{
 title:string;category:string;period:string;outbound_time:string|null;
 return_time:string|null;seat_price_egp:number;
};
type StopRow=Omit<NearbyStop,'latitude'|'longitude'>&{latitude:number|string|null;longitude:number|string|null};
type Pick=NearbyCandidate&{route:RouteRow;remaining:number;pickupPoint:GeoPoint|null};
// Automatically search within the existing maximum supported nearby range.
const NEARBY_MAX_KM=10;

/** Discovery mounts this panel when the Rider opens nearby search. GPS stays
 * in memory and is used only for local matching against published stops. */
export default function NearbyRides({onSelect}:{onSelect?:(selection:LiveSelection)=>void}){
 const {language}=usePreferences(),en=language==='en',t=(ar:string,english:string)=>en?english:ar;
 const headingId=useId();
 const [point,setPoint]=useState<GeoPoint|null>(null);
 const [accuracy,setAccuracy]=useState<number|null>(null);
 const [permissionBusy,setPermissionBusy]=useState(false);
 const [permissionDenied,setPermissionDenied]=useState(false);
 const [deviceLocationUnavailable,setDeviceLocationUnavailable]=useState(false);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [candidates,setCandidates]=useState<Pick[]>([]);
 const [retry,setRetry]=useState(0);
 const [opening,setOpening]=useState<string|null>(null);
 const [mapStopId,setMapStopId]=useState<string|null>(null);
 const findMe=()=>{
  setError('');setDeviceLocationUnavailable(false);
  if(!window.isSecureContext||!navigator.geolocation){
   setError(t('خدمة الموقع محتاجة HTTPS ومتصفح بيدعم GPS. تقدر تبحث يدويًا بدلها.',
    'Location requires HTTPS and a browser with GPS support. You can still search manually.'));
   return;
  }
  setPermissionBusy(true);
  navigator.geolocation.getCurrentPosition(
   result=>{
    setPermissionBusy(false);setPermissionDenied(false);setDeviceLocationUnavailable(false);
    const next={latitude:result.coords.latitude,longitude:result.coords.longitude};
    if(!validCoordinates(next)||!Number.isFinite(result.coords.accuracy)){
     setError(t('الموقع غير دقيق، جرّب تاني أو اختار المنطقة يدويًا.','Location was not reliable. Try again or use manual search.'));
     return;
    }
    // The passenger's device location is ONLY a search origin.
    // The approved Captain-stop geofence is separately enforced below.
    if(!isInsideCairoDiscovery(next)){
     setPoint(null);setAccuracy(null);setCandidates([]);
     setError(t(outsideCoverageMessage.ar,outsideCoverageMessage.en));return;
    }
    setPoint(next);setAccuracy(result.coords.accuracy);setRetry(v=>v+1);
   },
   issue=>{
    setPermissionBusy(false);
    setPermissionDenied(issue.code===1);
    setDeviceLocationUnavailable(issue.code===2);
    setPoint(null);setAccuracy(null);setCandidates([]);
    setError(issue.code===1
     ?t('تم رفض إذن الموقع. اسمح للموقع من إعدادات Chrome أو استخدم البحث اليدوي.',
        'Location permission was denied. Allow it in Chrome settings or search manually.')
     :issue.code===3
      ?t('تحديد الموقع أخد وقت طويل. جرّب في مكان فيه إشارة أقوى.',
          'GPS timed out. Try again somewhere with a stronger signal.')
      :t('مش قادرين نحدد موقعك دلوقتي. البحث اليدوي لسه متاح.',
          'Your location is unavailable. Manual search still works.'));
   },{enableHighAccuracy:true,timeout:12000,maximumAge:0}
  );
 };
 // When a Rider has already granted location in a previous visit,
 // automatically find nearby pickup stops without another click.
 useEffect(()=>{
  if(!window.isSecureContext||!navigator.geolocation||!navigator.permissions)return;
  let active=true;
  void navigator.permissions.query({name:'geolocation'}).then(status=>{
   if(active&&status.state==='granted')findMe();
  }).catch(()=>{/* Explicit button remains available. */});
  return()=>{active=false;};
 },[]);
 // If the Rider manually unblocks the site in Chrome settings and returns,
 // pick up the location immediately, without asking for a second tap.
 // Only after an earlier explicit request, never on first page load.
 useEffect(()=>{
  if(!permissionDenied||!navigator.permissions)return;
  let active=true;
  const check=()=>{
   if(document.visibilityState!=='visible')return;
   void navigator.permissions.query({name:'geolocation'}).then(status=>{
    if(active&&status.state==='granted'){setPermissionDenied(false);findMe();}
   }).catch(()=>{/* Permission API unsupported: the manual retry still works. */});
  };
  window.addEventListener('focus',check);
  document.addEventListener('visibilitychange',check);
  return()=>{active=false;window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check);};
 },[permissionDenied]);
 useEffect(()=>{
  if(!point||!client)return;
  let active=true;
  setLoading(true);setError('');setCandidates([]);
  void (async()=>{
   try{
    const {data:routes,error:routeError}=await client.from('v31_public_route_offers')
     .select('id,title,category,period,direction,outbound_time,return_time,seat_price_egp,return_supported')
     .eq('status','published').limit(100);
    if(routeError)throw routeError;
    const rows=(routes||[]) as RouteRow[];
    if(!rows.length){if(active)setCandidates([]);return;}
    const {data:stopRows,error:stopError}=await client.from('v31_route_stops')
     .select('id,route_id,position,name,area_id,pickup_allowed,dropoff_allowed,latitude,longitude')
     .in('route_id',rows.map(row=>row.id)).order('position').limit(3000);
    if(stopError)throw stopError;
    const stops:NearbyStop[]=(stopRows||[] as StopRow[]).map(raw=>({
     ...raw,latitude:raw.latitude===null?NaN:Number(raw.latitude),
     longitude:raw.longitude===null?NaN:Number(raw.longitude)
    })).filter(stop=>inLaunchRegion(stop));
    const matched=nearbyPublishedStops(point,rows,stops,NEARBY_MAX_KM).slice(0,12);
    // Availability remains a server-owned aggregate, never inferred from
    // hidden bookings. Only show actual capacity-confirmed route offers.
    const results=await Promise.all(matched.map(async candidate=>{
     const {data:available,error:capacityError}=await client!.rpc('v31_published_route_available_seats',{p_route:candidate.routeId});
     if(capacityError||typeof available!=='number')throw capacityError||Error('CAPACITY_UNAVAILABLE');
     const route=rows.find(row=>row.id===candidate.routeId);
     const pickup=stops.find(stop=>stop.id===candidate.pickupStopId);
     return route&&available>0?{...candidate,route,remaining:available,
      pickupPoint:pickup&&validCoordinates(pickup)?{latitude:pickup.latitude,longitude:pickup.longitude}:null}:null;
    }));
    if(active)setCandidates(results.filter((item):item is Pick=>item!==null));
   }catch(e){if(active)setError(t('تعذر تحميل الرحلات القريبة. جرّب تاني.','Could not load nearby routes. Please retry.')+' '+(e instanceof Error?e.message:''));}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[point?.latitude,point?.longitude,retry]);
 const mappedPick=candidates.find(pick=>pick.pickupStopId===mapStopId&&pick.pickupPoint)||
   candidates.find(pick=>pick.pickupPoint)||null;
 const open=async(pick:Pick)=>{
  if(!onSelect)return;
  setError('');setOpening(pick.routeId+String(pick.reverse));
  try{
   // Revalidate stop order, publication and capacity before opening details.
   const selected=await fetchPublishedSelection(
    pick.routeId,pick.pickupStopId,pick.dropoffStopId,pick.reverse);
   if(selected.remaining<1)throw Error('NO_AVAILABLE_SEATS');
   onSelect(selected);
  }catch{
   setError(t('الخط اتغير أو المقاعد خلصت. حدّث النتائج وحاول تاني.',
    'The route changed or seats sold out. Refresh nearby routes and retry.'));
  }finally{setOpening(null);}
 };
 return <section className="sekka-nearby np4" aria-labelledby={headingId}>
  <div className="np4__hero">
   <div className="np4__hero-top">
    <span className="np4__eyebrow">{t('اختار نقطة ركوبك','YOUR PICKUP SPOT')}</span>
    <span className="np4__mini-route" aria-hidden="true"><i/><i/><i/></span>
   </div>
   <h2 id={headingId}>{t('هتركب منين؟','Where will you board?')}</h2>
   <p>{t('هنشوف نقط الركوب اللي الكباتن نشروها فعلًا حوالينك، من غير ما نحفظ مكانك.',
    'Find real published pickup stops around you, without saving your location.')}</p>
   <button type="button" className="sekka-nearby__locate np4__locate" disabled={permissionBusy}
    onClick={findMe}>
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none"
     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
     <circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/>
     <path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>
    </svg>
    {permissionBusy?t('بنحدد مكانك…','Getting your location…'):
     point?t('حدّث موقعي','Update my location'):t('استخدم موقعي الحالي','Use my location')}
   </button>
   {point&&<div className="np4__gps-status" role="status">
    <span className="np4__live-dot" aria-hidden="true"/>
    {t('موقعك جاهز — النتائج حسب نقاط الركوب المنشورة','Location ready — matching published pickup stops')}
   </div>}
  </div>
  {permissionDenied&&<div className="sekka-nearby__permission np4__notice" role="alert">
   <strong>{t('الموقع مقفول من المتصفح','Location is blocked')}</strong>
   <p>{t('افتح أذونات الموقع لسِكّة من إعدادات المتصفح، أو كمّل بحثك بالمكان والوجهة من غير GPS.',
    'Allow location in your browser settings, or search by your origin and destination without GPS.')}</p>
   <button type="button" onClick={findMe} disabled={permissionBusy}>
    {t('جرّب الموقع تاني','Try location again')}
   </button>
  </div>}
  {deviceLocationUnavailable&&!permissionDenied&&<p className="np4__notice" role="status">
   {t('شغّل تحديد الموقع من إعدادات الموبايل وجرّب تاني.', 'Turn on your phone location and try again.')}
  </p>}
  {error&&!permissionDenied&&<p className="np4__notice np4__notice--error" role="alert">{error}</p>}
  {point&&<>
   <div className="np4__results-bar">
    <strong>{loading?t('بندور حواليك…','Searching nearby…'):t('أقرب نقط ركوب ليك','Nearby pickup spots')}</strong>
   </div>
   {accuracy!==null&&accuracy>250&&<p className="np4__accuracy" role="status">
    {t('دقة موقعك تقريبًا ','Your location accuracy is about ')}
    {formatDistanceForLocale(accuracy,en)}
   </p>}
   {loading&&<AppSkeleton kind="routes" count={2} compact label={t('بنجمع أقرب الرحلات المنشورة…','Finding nearby published rides…')}/>} 
   {!loading&&!error&&candidates.length===0&&<div className="np4__empty" role="status">
    <span className="np4__empty-illustration" aria-hidden="true">
     <svg viewBox="0 0 88 76" fill="none" width="88" height="76">
      <circle cx="45" cy="35" r="31" stroke="#58D1E1" strokeWidth="3" strokeDasharray="4 5"/>
      <path d="M45 11c-11 0-19 9-19 19 0 14 19 34 19 34s19-20 19-34c0-10-8-19-19-19Z" fill="#FFCC24"/>
      <circle cx="45" cy="30" r="8" fill="#FFF4D7"/>
     </svg>
    </span>
    <h3>{t('لسه مفيش ركوبة قريبة هنا','No pickups nearby yet')}</h3>
    <p>{t('جرّب تبحث باسم المنطقة والوجهة، أو حدّث موقعك.',
      'Try searching by area and destination, or update your location.')}</p>
   </div>}
   {!loading&&!error&&candidates.length>0&&<div className="np4__results">
    <p className="np4__results-caption">{t('مرتبة حسب أقصر مسافة مباشرة لنقطة الركوب · المشي تقديري',
      'Ordered by straight-line distance to pickup · walking time is estimated')}</p>
    <ol className="np4__list">{candidates.map((pick,index)=>{
     const isMapped=mappedPick?.pickupStopId===pick.pickupStopId&&
      mappedPick.routeId===pick.routeId&&mappedPick.reverse===pick.reverse;
     return <li key={pick.routeId+pick.pickupStopId+String(pick.reverse)}
      className={'np4__card'+(index===0?' np4__card--first':'')}>
      <div className="np4__card-top">
       <div className="np4__card-badges">
        {index===0&&<span className="np4__featured">{t('من أقرب النتائج','ONE OF THE NEAREST')}</span>}
        <span className="np4__category">{pick.route.category}</span>
       </div>
       <strong className="np4__price">{Number.isFinite(pick.route.seat_price_egp)&&pick.route.seat_price_egp>=0?new Intl.NumberFormat(en?'en-EG':'ar-EG').format(pick.route.seat_price_egp):t('غير متاح','Unavailable')}
        <small>{t('جنيه / مقعد','EGP / seat')}</small>
       </strong>
      </div>
      <h3 dir="auto">{pick.route.title}</h3>
      <div className="np4__timeline">
       <div><span className="np4__route-dot" aria-hidden="true"/>
        <small>{t('هتركب من','Pickup')}</small><strong dir="auto">{pick.pickupName}</strong>
       </div>
       <div><span className="np4__route-dot np4__route-dot--end" aria-hidden="true"/>
        <small>{t('هتنزل في','Drop-off')}</small><strong dir="auto">{pick.dropoffName}</strong>
       </div>
      </div>
      <div className="np4__metrics">
       <span><b>{formatDistanceForLocale(pick.distanceKm*1000,en)}</b>
        {t('مسافة مباشرة','straight line')}</span>
       <span><b>{new Intl.NumberFormat(en?'en-EG':'ar-EG').format(approximateWalkMinutes(pick.distanceKm*1000))}
        {t(' د',' min')}</b>{t('مشي تقديري','estimated walk')}</span>
       <span><b dir="ltr">{(pick.reverse?pick.route.return_time:pick.route.outbound_time)?.slice(0,5)||'—'}</b>
        {t('الميعاد','departure')}</span>
       <span><b>{new Intl.NumberFormat(en?'en-EG':'ar-EG').format(pick.remaining)}</b>
        {t('مقاعد فاضية','seats left')}</span>
      </div>
      <div className="np4__actions">
       {onSelect&&<button className="np4__open" type="button"
        disabled={opening!==null} onClick={()=>void open(pick)}>
        {opening===pick.routeId+String(pick.reverse)?t('بنفتح الرحلة…','Opening ride…'):t('شوف تفاصيل الرحلة','View ride details')}
       </button>}
       {pick.pickupPoint&&<button type="button" className="np4__map-button"
        aria-expanded={isMapped&&mapStopId!==null} onClick={()=>setMapStopId(isMapped&&mapStopId!==null?null:pick.pickupStopId)}>
        {t('الخريطة','Map')}
       </button>}
      </div>
      {pick.pickupPoint&&mapStopId!==null&&isMapped&&<div className="np4__inline-map">
       <RiderStopMap pickup={pick.pickupPoint} name={pick.pickupName}/>
      </div>}
     </li>;
    })}</ol>
   </div>}
  </>}
  <p className="np4__privacy">{t('مكانك بيُستخدم على جهازك للمقارنة مع نقاط الركوب العامة، مش بيتحفظ في حسابك.',
   'Your position is compared on this device with public pickup points and is not saved to your account.')}</p>
 </section>;
}
