import {useEffect,useId,useState} from 'react';
import {client} from './api';
import {usePreferences} from './preferences';
import RiderStopMap from './RiderStopMap';
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
const RADIUS_OPTIONS=[1,3,5,10] as const;

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
 const [radius,setRadius]=useState<number>(5);
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
    }));
    const matched=nearbyPublishedStops(point,rows,stops,radius).slice(0,12);
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
 },[point?.latitude,point?.longitude,radius,retry]);
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
 return <section className="d-box sekka-nearby" aria-labelledby={headingId}>
  <div className="sekka-nearby__heading">
   <h2 id={headingId}>{t('رحلات قريبة مني','Routes near me')}</h2>
   <button type="button" className="sekka-nearby__locate" disabled={permissionBusy}
    onClick={findMe}>{permissionBusy?t('بنحدد موقعك…','Locating…'):point?t('تحديث GPS','Update GPS'):t('📍 تفعيل الموقع','📍 Enable GPS')}</button>
  </div>
  {!point&&!permissionBusy&&!permissionDenied&&<p className="sekka-nearby__intro">{t('وافق على إذن الموقع لعرض أقرب نقط ركوب. مش بنحتفظ بمكانك.',
   'Allow location to find nearby pickup points. We never store your position.')}</p>}
  {permissionDenied&&<div className="sekka-nearby__permission" role="status">
   <strong>{t('إذن الموقع محظور في المتصفح','Location is blocked in your browser')}</strong>
   <p>{t('Chrome مش بيسمح للموقع إنه يفتح طلب السماح تاني بعد الحظر. افتح رمز القفل أو الإعدادات جنب عنوان سِكّة، وبعدها أذونات الموقع ← سماح، وارجع هنا.',
    'Chrome will not show the Allow popup again after you block the site. Tap the site controls next to the address, choose Permissions → Location → Allow, then return here.')}</p>
   <p>{t('اتأكد كمان إن «الموقع» مفتوح في إعدادات الموبايل، وإن Chrome مسموح له يستخدمه.',
    'Also turn on Location on your phone and allow location access for Chrome.')}</p>
   <button type="button" disabled={permissionBusy} onClick={findMe}>{t('جرّب تفعيل الموقع تاني','Retry location permission')}</button>
  </div>}
  {deviceLocationUnavailable&&<p role="status">{t('شغّل الموقع (Location) من اختصارات الموبايل، وبعدها اضغط زر GPS تاني.',
   'Enable Location in your phone’s Quick Settings, then try GPS again.')}</p>}
  {point&&<details className="sekka-nearby__filters">
   <summary>{t('نطاق البحث','Search radius')}: {radius} {t('كم','km')} · {t('تغيير','Change')}</summary>
   <div className="sekka-nearby__controls">
    <label>{t('أقصى مسافة لنقطة الركوب','Maximum pickup distance')}
     <select value={radius} onChange={event=>setRadius(Number(event.target.value))}>
      {RADIUS_OPTIONS.map(value=><option key={value} value={value}>{value} {t('كم','km')}</option>)}
     </select>
    </label>
    <button type="button" disabled={loading} onClick={()=>setRetry(v=>v+1)}>{t('تحديث الرحلات','Refresh routes')}</button>
   </div>
  </details>}
  {point&&candidates.length>0&&<p className="sekka-nearby__hint">{t('المسافة خط مستقيم تقريبية، مش وقت مشي أو مسافة طريق.',
   'Distances are approximate straight-line values, not walking times or road distances.')}
   {accuracy!==null&&accuracy>250&&' · '+t('دقة GPS حوالي ','GPS accuracy about ')+Math.round(accuracy)+' '+t('متر','m')}</p>}
  {point&&!loading&&mappedPick?.pickupPoint&&
    <RiderStopMap pickup={mappedPick.pickupPoint} name={mappedPick.pickupName}/>}
  {loading&&<p role="status">{t('بندور على أقرب نقط ركوب منشورة…','Finding nearby published pickup points…')}</p>}
  {error&&<div role="alert"><p>{error}</p></div>}
  {point&&!loading&&!error&&candidates.length===0&&<p role="status">{t(
   'مفيش رحلات قريبة متاحة حاليًا. تقدر توسّع النطاق أو تبحث بالمنطقة.',
   'No nearby rides are available yet. Widen the radius or search by area.')}</p>}
  {point&&!loading&&candidates.length>0&&<div className="sekka-nearby__results">
   <p>{t('مرتبة من أقرب نقطة ركوب للأبعد','Sorted by nearest eligible pickup point')}</p>
   <ul>{candidates.map((pick,index)=><li key={pick.routeId+pick.pickupStopId+String(pick.reverse)}>
    {index===0&&<span className="sekka-rider-recommended">{t('الأقرب لنقطة ركوبك','Nearest pickup option')}</span>}
    <strong>{pick.route.title}</strong>
    <span>{pick.pickupName} ← {pick.dropoffName}</span>
    <span>{formatDistanceForLocale(pick.distanceKm*1000,en)} {t('بخط مستقيم من موقعك','straight-line from your location')}
     {' · '}{t('مشي حوالي','Walking about')} {approximateWalkMinutes(pick.distanceKm*1000)} {t('دقيقة تقريبًا','minutes approx.')}
     {' · '}{pick.route.category}</span>
    <span>{(pick.reverse?pick.route.return_time:pick.route.outbound_time)?.slice(0,5)||'—'}
     {' · '}{pick.route.period==='weekly'?t('أسبوعي','Weekly'):t('شهري','Monthly')}
     {' · '}{pick.remaining} {t('مقاعد متاحة','seats available')}</span>
    {pick.pickupPoint&&<button type="button" aria-pressed={mappedPick?.pickupStopId===pick.pickupStopId}
     onClick={()=>setMapStopId(pick.pickupStopId)}>
      {t('شوف نقطة الركوب على الخريطة','Show pickup on map')}
    </button>}
    <button type="button" disabled={!onSelect||opening!==null} onClick={()=>void open(pick)}>
     {opening===pick.routeId+String(pick.reverse)?t('بنفتح الخط…','Opening…'):t('عرض تفاصيل الخط','View route details')}
    </button>
   </li>)}</ul>
  </div>}
 </section>;
}
