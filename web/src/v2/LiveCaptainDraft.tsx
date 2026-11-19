import {useEffect,useState} from 'react';
import {client} from './api';
import GeoPlaceInput from './GeoPlaceInput';
import {inLaunchRegion} from './geoPlace';
import type {PlaceChoice} from './geoPlace';
import {straightLineKm} from './nearbyRoutes';
import type {GeoPoint} from './nearbyRoutes';
import {usePreferences} from './preferences';
import type {Category} from '../../../packages/domain/subscriptions';

type Area={id:number;name_ar:string;name_en:string};
type StopInput={areaId:number;name:string;pickup:boolean;dropoff:boolean;latitude:number|null;longitude:number|null};
type Vehicle={id:string;model:string;plate_number:string;enabled_categories:string[]};
const categorySeats:Record<Category,number>={PRIME:3,SAVER:4,SPACE:9,MAX:13};

/** Authenticated draft creation only. Publishing requires a separate audited server operation. */
export default function LiveCaptainDraft(){
 const {language}=usePreferences(),en=language==='en';
 const t=(ar:string,english:string)=>en?english:ar;
 const [uid,setUid]=useState<string|null>(null);
 const [areas,setAreas]=useState<Area[]>([]);
 const [vehicles,setVehicles]=useState<Vehicle[]>([]);
 const [areaId,setAreaId]=useState('');
 const [placeLabel,setPlaceLabel]=useState('');
 const [placeChoice,setPlaceChoice]=useState<PlaceChoice|null>(null);
 const [stopPoint,setStopPoint]=useState<GeoPoint|null>(null);
 const [locatingStop,setLocatingStop]=useState(false);
 const [stops,setStops]=useState<StopInput[]>([]);
 const [vehicleId,setVehicleId]=useState('');
 const [category,setCategory]=useState<Category|null>(null);
 const [period,setPeriod]=useState('monthly');
 const [direction,setDirection]=useState('outbound');
 const [departure,setDeparture]=useState('07:30');
 const [arrival,setArrival]=useState('17:00');
 const [returnSupported,setReturnSupported]=useState(false);
 const [price,setPrice]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 useEffect(()=>{
   if(!client)return;
   let live=true;
   void(async()=>{
    const {data:{user},error:authError}=await client.auth.getUser();
    if(!live)return;
    if(authError){setError(authError.message);return;}
    setUid(user?.id??null);
    if(!user)return;
    const [areaResult,vehicleResult]=await Promise.all([
     client.from('v31_service_areas').select('id,name_ar,name_en').order('id'),
     client.from('v31_vehicles').select('id,model,plate_number,enabled_categories')
      .eq('captain_id',user.id).eq('status','active').order('created_at',{ascending:false})
    ]);
    if(!live)return;
    if(areaResult.error||vehicleResult.error){
     setError(areaResult.error?.message||vehicleResult.error?.message||'LOAD_FAILED');return;
    }
    const availableVehicles=(vehicleResult.data||[]) as Vehicle[];
    setAreas((areaResult.data||[]) as Area[]);
    setAreaId(String(areaResult.data?.[0]?.id||''));
    setVehicles(availableVehicles);
    setVehicleId(availableVehicles[0]?.id||'');
    const firstCategory=availableVehicles[0]?.enabled_categories?.[0];
    if(firstCategory&&firstCategory in categorySeats)setCategory(firstCategory as Category);
   })();
   const {data:listener}=client.auth.onAuthStateChange((_event,session)=>setUid(session?.user.id??null));
   return ()=>{live=false;listener.subscription.unsubscribe();};
 },[]);
 const title=stops.length>=2?stops[0].name+' ← '+stops[stops.length-1].name:'';
 const selectedArea=areas.find(area=>String(area.id)===areaId);
 const eligibleCategories=(vehicles.find(vehicle=>vehicle.id===vehicleId)?.enabled_categories||[])
  .filter((value):value is Category=>value in categorySeats);
 useEffect(()=>{
  if(eligibleCategories.length>0&&!eligibleCategories.includes(category as Category))
   setCategory(eligibleCategories[0]);
  else if(eligibleCategories.length===0)setCategory(null);
 },[vehicleId,eligibleCategories.join(':')]);
 const useMyStopPosition=()=>{
  setError('');
  if(!window.isSecureContext||!navigator.geolocation){
   setError(t('الموقع محتاج إذن GPS واتصال آمن.','Your location requires GPS permission and a secure connection.'));return;
  }
  setLocatingStop(true);
  navigator.geolocation.getCurrentPosition(
   position=>{
    setLocatingStop(false);
    const point={latitude:position.coords.latitude,longitude:position.coords.longitude};
    if(position.coords.accuracy>250||!inLaunchRegion(point)){
     setError(t('مش قادرين نحدد مكان دقيق داخل القاهرة والجيزة. جرّب تاني أو ابحث عن الموقع بالاسم.',
      'We could not locate an accurate Cairo/Giza stop. Retry or search for the place by name.'));return;
    }
    setStopPoint(point);
    setPlaceChoice(null);
    setPlaceLabel((en?'Pickup point — ':'نقطة ركوب — ')+(en?selectedArea?.name_en||'My location':selectedArea?.name_ar||'موقعي'));
   },
   ()=>{setLocatingStop(false);setError(t('GPS مش متاح. ابحث عن نقطة الوقوف بالاسم على الخريطة.','GPS is unavailable. Search for the stop on the map.'));},
   {enableHighAccuracy:true,timeout:12000,maximumAge:0}
  );
 };
 const addStop=()=>{
  setError('');setMessage('');
  const name=placeChoice?.kind==='map'?placeChoice.place.name.trim():placeLabel.trim();
  const point=placeChoice?.kind==='map'?placeChoice.place:stopPoint;
  if(!areaId||!selectedArea){setError(t('اختار منطقة الخدمة أولًا.','Choose the service area first.'));return;}
  if(!point||!inLaunchRegion(point)||name.length<3||name.length>100){
   setError(t('حدد نقطة الوقوف من نتائج بحث الخريطة أو GPS. الكتابة وحدها مش كفاية.',
    'Choose a stop from map results or GPS. Typing alone is not enough.'));return;
  }
  if(stops.length>=30){setError(t('الحد الأقصى 30 نقطة للخط.','A route supports up to 30 stops.'));return;}
  if(stops.some(s=>s.areaId===Number(areaId)&&
    (s.name.toLocaleLowerCase()===name.toLocaleLowerCase()||
     s.latitude!==null&&s.longitude!==null&&straightLineKm({latitude:s.latitude,longitude:s.longitude},point)<0.03))){
   setError(t('نقطة الوقوف دي مضافة بالفعل.','This stop is already on the route.'));return;
  }
  setStops(current=>[...current,{areaId:Number(areaId),name,pickup:true,dropoff:true,
   latitude:Number(point.latitude.toFixed(6)),longitude:Number(point.longitude.toFixed(6))}]);
  setPlaceLabel('');setPlaceChoice(null);setStopPoint(null);
 };
 const save=async()=>{
   if(!client||!uid)return;
   setMessage('');setError('');
   if(title.length<3||title.length>120||stops.length<2||stops[0].areaId===stops.at(-1)?.areaId||
      stops.some(stop=>stop.latitude===null||stop.longitude===null||
       !inLaunchRegion({latitude:stop.latitude,longitude:stop.longitude}))||
      !vehicleId||!category||!eligibleCategories.includes(category)||
      !/^\\d{1,7}$/.test(price)||!Number.isSafeInteger(Number(price))||Number(price)<=0||
      !['weekly','monthly'].includes(period)||!['outbound','return','round_trip'].includes(direction)||
      (direction!=='return'&&!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(departure))||
      (direction!=='outbound'&&!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(arrival))||
      (direction==='round_trip'&&!returnSupported)){
     setError(t('راجع المركبة والفئة والعنوان والسعر؛ يلزم نقطتان في منطقتين مختلفتين.','Check vehicle, category, title, price and at least two stops in distinct areas.'));return;
   }
   setBusy(true);
   try{
     // This is an approved Captain's route workflow, never enrollment.
     // The server RPC verifies approval again before inserting any draft.
     const {data:routeId,error:routeError}=await client.rpc('v31_create_vehicle_route_draft',{
       p_title:title.trim(),p_vehicle:vehicleId,p_category:category,
       p_direction:direction,p_period:period,
       p_outbound:direction==='return'?null:departure,
       p_return:direction==='outbound'?null:arrival,
       p_return_supported:direction==='round_trip'?returnSupported:false,
       p_price:Number(price),p_stops:stops.map(s=>({
         area_id:s.areaId,name:s.name,pickup:s.pickup,dropoff:s.dropoff
       }))
     });
     if(routeError)throw routeError;
     if(typeof routeId!=='string')throw Error('DRAFT_NOT_CONFIRMED');
     const [{data:saved,error:savedError},{data:savedStops,error:stopsError}]=await Promise.all([
       client.from('v31_routes').select('id,status,vehicle_id,category,seat_capacity,price_egp').eq('id',routeId).eq('captain_id',uid).maybeSingle(),
       client.from('v31_route_stops').select('id,area_id,name,position,latitude,longitude').eq('route_id',routeId).order('position')
     ]);
     if(savedError||stopsError)throw Error(savedError?.message||stopsError?.message||'DRAFT_READ_FAILED');
     if(!saved||saved.status!=='draft'||saved.vehicle_id!==vehicleId||saved.category!==category||
        saved.seat_capacity!==categorySeats[category]||saved.price_egp!==Number(price)||
        !savedStops||savedStops.length!==stops.length||savedStops.some((s,i)=>s.area_id!==stops[i].areaId||s.position!==i||s.name!==stops[i].name)){
       throw Error('DRAFT_PERSISTENCE_NOT_VERIFIED');
     }
     // Coordinates are optional for saving a route, but only geolocated
     // pickup stops can appear in Rider's GPS nearby list.
     for(const [i,stop] of stops.entries()){
      if(stop.latitude===null||stop.longitude===null)continue;
      const savedStop=savedStops[i];
      const {data:confirmed,error:locationError}=await client.rpc('v31_set_draft_stop_coordinates',{
       p_stop:savedStop.id,p_latitude:stop.latitude,p_longitude:stop.longitude
      });
      if(locationError||confirmed!==savedStop.id)throw Error('STOP_COORDINATE_SAVE_FAILED');
     }
     const {data:located,error:readbackError}=await client.from('v31_route_stops')
      .select('id,position,latitude,longitude').eq('route_id',routeId).order('position');
     if(readbackError||!located||located.length!==stops.length||
       located.some((entry,i)=>stops[i].latitude===null
         ?entry.latitude!==null||entry.longitude!==null
         :Math.abs(Number(entry.latitude)-stops[i].latitude!)>0.000001||
          Math.abs(Number(entry.longitude)-stops[i].longitude!)>0.000001))
      throw Error('STOP_COORDINATE_READBACK_FAILED');
     setMessage(stops.some(stop=>stop.latitude!==null)
      ?t('تم حفظ المسودة وإحداثيات نقاط الوقوف. لما الخط يُنشر، الركاب القريبين هيقدروا يلاقوه بالـGPS.',
       'Draft and stop coordinates verified. When published, nearby Riders can find these pickup points by GPS.')
      :t('المسودة اتحفظت، لكن من غير إحداثيات، الخط مش هيظهر في نتائج GPS القريبة.',
       'Draft saved without GPS coordinates. It will not appear in nearby GPS results.'));
     setStops([]);setPlaceLabel('');setPlaceChoice(null);setStopPoint(null);setPrice('');
   }catch(e){setError(e instanceof Error?e.message:String(e));}
   finally{setBusy(false);}
 };
 if(!client)return <section className="d-box"><p>{t('ربط Supabase العام لم يكتمل بعد.','Public Supabase configuration is not ready yet.')}</p></section>;
 if(!uid)return <section className="d-box"><p>{t('سجّل دخولك بجوجل قبل حفظ خط حقيقي.','Sign in with Google to create a real route draft.')}</p><a href="?screen=4">{t('الدخول بجوجل','Google sign-in')}</a></section>;
 const draftReady=stops.length>=2&&stops[0].areaId!==stops.at(-1)?.areaId&&
  title.length>=3&&title.length<=120&&Boolean(vehicleId)&&Boolean(category)&&
  eligibleCategories.includes(category as Category)&&/^\\d{1,7}$/.test(price)&&Number(price)>0&&
  (direction!=='round_trip'||returnSupported);
 return <section className="d-box live-route-form sekka-captain-route-wizard">
  <header className="sekka-route-intro">
   <p className="sekka-route-eyebrow">{t('حساب كابتن معتمد','Approved Captain')}</p>
   <h2>{t('إنشاء خط جديد','Create a route')}</h2>
   <p>{t('حدد نقاط الرحلة على الخريطة، وبعدها المواعيد والسعر. مش محتاج تكتب اسم الخط أو أي إحداثيات.',
    'Choose stops on the map, then set schedule and price. No route title or coordinates to type.')}</p>
  </header>

  <fieldset className="sekka-route-step">
   <legend><span>1</span> {t('مسار الرحلة','Route stops')}</legend>
   <p>{t('ابحث عن الشارع أو المعلم عند نقطة الركوب الفعلية. اختار النتيجة من الخريطة، مش مجرد كتابة اسم.',
     'Search for the actual pickup street or landmark and select a map result.')}</p>
   <label className="sekka-route-field">{t('منطقة الخدمة','Service area')}
    <select aria-label={t('منطقة الخدمة','Service area')} value={areaId}
     onChange={e=>{setAreaId(e.target.value);setPlaceChoice(null);setPlaceLabel('');setStopPoint(null);}}>
     <option value="">{t('اختار منطقة','Select an area')}</option>
     {areas.map(area=><option key={area.id} value={area.id}>{en?area.name_en:area.name_ar}</option>)}
    </select>
   </label>
   <div className="sekka-route-field">
    <span>{t('نقطة الوقوف على الخريطة','Stop on the map')}</span>
    <GeoPlaceInput label={t('ابحث عن شارع أو مكان','Search street or landmark')} value={placeLabel}
     choice={placeChoice} areas={[]}
     onPick={(value,choice)=>{
      setPlaceLabel(value);setPlaceChoice(choice);
      setStopPoint(choice?.kind==='map'?choice.place:null);setError('');
     }}/>
   </div>
   <div className="sekka-route-stop-tools">
    <button type="button" className="sekka-route-secondary" disabled={locatingStop||!areaId} onClick={useMyStopPosition}>
     {locatingStop?t('جارٍ تحديد الموقع…','Locating…'):t('📍 أنا واقف عند النقطة','📍 I am at this stop')}
    </button>
    {stopPoint&&<span className="sekka-route-map-confirm">
     {t('تم تحديد الموقع','Location selected')} · <a target="_blank" rel="noopener noreferrer"
      href={`https://www.openstreetmap.org/?mlat=${stopPoint.latitude}&mlon=${stopPoint.longitude}#map=16/${stopPoint.latitude}/${stopPoint.longitude}`}>
      {t('معاينة الموقع على الخريطة','Preview on OpenStreetMap')}</a>
    </span>}
   </div>
   <button type="button" className="sekka-route-add" disabled={!areaId||!stopPoint||!placeLabel.trim()||busy}
    onClick={addStop}>{t('إضافة النقطة للخط','Add this stop')}</button>
   {stops.length>0&&<ol className="live-route-stops sekka-route-stop-list">{stops.map((stop,index)=><li key={index}>
    <div className="sekka-route-stop-copy">
     <span className="sekka-route-stop-order">{index+1}</span>
     <div><strong>{stop.name}</strong><small>{en?areas.find(a=>a.id===stop.areaId)?.name_en:areas.find(a=>a.id===stop.areaId)?.name_ar}</small></div>
    </div>
    <div className="live-route-controls">
     <button type="button" disabled={index===0} onClick={()=>setStops(v=>{const next=[...v];[next[index-1],next[index]]=[next[index],next[index-1]];return next;})}>{t('↑ أعلى','↑ Up')}</button>
     <button type="button" disabled={index===stops.length-1} onClick={()=>setStops(v=>{const next=[...v];[next[index+1],next[index]]=[next[index],next[index+1]];return next;})}>{t('↓ أسفل','↓ Down')}</button>
     <button type="button" onClick={()=>setStops(v=>v.filter((_,i)=>i!==index))}>{t('حذف','Remove')}</button>
    </div>
   </li>)}</ol>}
   {stops.length<2&&<p className="sekka-route-guidance">{t('لازم تضيف نقطتين على الأقل: بداية الخط ونهايته.','Add at least an origin and a destination.')}</p>}
   {stops.length>=2&&<p className="sekka-route-generated-title">
    {t('اسم الخط تلقائيًا:','Automatic route name:')} <strong>{title}</strong>
   </p>}
  </fieldset>

  <fieldset className="sekka-route-step">
   <legend><span>2</span> {t('العربية والمقاعد','Vehicle and seats')}</legend>
   <label className="sekka-route-field">{t('المركبة المعتمدة','Approved vehicle')}
    <select value={vehicleId} onChange={e=>setVehicleId(e.target.value)}>
     <option value="">{t('اختار عربية معتمدة','Select approved vehicle')}</option>
     {vehicles.map(vehicle=><option key={vehicle.id} value={vehicle.id}>{vehicle.model} — {vehicle.plate_number}</option>)}
    </select>
   </label>
   <label className="sekka-route-field">{t('فئة الخدمة','Service category')}
    <select value={category||''} disabled={!eligibleCategories.length} onChange={e=>setCategory((e.target.value||null) as Category|null)}>
     <option value="">{t('لا توجد فئة مفعّلة','No category enabled')}</option>
     {eligibleCategories.map(value=><option key={value} value={value}>{value}</option>)}
    </select>
   </label>
   {category&&<p className="sekka-route-guidance">{t('المقاعد بتتحدد تلقائيًا من اعتماد المركبة:','Passenger seats are assigned from approved vehicle details:')} <strong>{categorySeats[category]}</strong></p>}
   {!vehicles.length&&<p role="alert">{t('مفيش عربية معتمدة مضافة لحسابك. راجع حالة الاعتماد مع الإدارة.','No approved vehicle was found. Check your approval with Admin.')}</p>}
  </fieldset>

  <fieldset className="sekka-route-step">
   <legend><span>3</span> {t('المواعيد والاشتراك','Schedule')}</legend>
   <div className="sekka-route-pair">
    <label className="sekka-route-field">{t('مدة الاشتراك','Subscription period')}
     <select value={period} onChange={e=>setPeriod(e.target.value)}>
      <option value="weekly">{t('أسبوعي','Weekly')}</option><option value="monthly">{t('شهري','Monthly')}</option>
     </select>
    </label>
    <label className="sekka-route-field">{t('اتجاه الرحلة','Journey direction')}
     <select value={direction} onChange={e=>setDirection(e.target.value)}>
      <option value="outbound">{t('ذهاب','Outbound')}</option><option value="return">{t('عودة','Return')}</option>
      <option value="round_trip">{t('ذهاب وعودة','Round trip')}</option>
     </select>
    </label>
   </div>
   <div className="sekka-route-pair">
    {direction!=='return'&&<label className="sekka-route-field">{t('ميعاد الذهاب','Departure time')}
     <input type="time" value={departure} onChange={e=>setDeparture(e.target.value)}/></label>}
    {direction!=='outbound'&&<label className="sekka-route-field">{t('ميعاد العودة','Return time')}
     <input type="time" value={arrival} onChange={e=>setArrival(e.target.value)}/></label>}
   </div>
   {direction==='round_trip'&&<label className="sekka-route-check">
    <input type="checkbox" checked={returnSupported} onChange={e=>setReturnSupported(e.target.checked)}/>
    {t('نفس نقاط الوقوف في العودة بترتيب عكسي','Return uses the same stops in reverse order')}
   </label>}
  </fieldset>

  <fieldset className="sekka-route-step">
   <legend><span>4</span> {t('السعر والمراجعة','Price and review')}</legend>
   <label className="sekka-route-field">{t('سعر المركبة بالكامل بالجنيه','Total vehicle price (EGP)')}
    <input type="number" inputMode="numeric" min="1" max="9999999" step="1"
     placeholder={t('اكتب سعر صحيح بالجنيه','Enter a whole EGP amount')}
     value={price} onChange={e=>setPrice(e.target.value)}/>
   </label>
   <p className="sekka-route-guidance">{t('السعر الإجمالي يخص المركبة بالكامل، وسعر المقعد بيحسبه النظام تلقائيًا. مش هيظهر للركاب كسعر مركبة.',
    'Enter the full vehicle price. The system calculates seat prices; passengers do not see the private vehicle total.')}</p>
   {stops.length>=2&&category&&price&&<div className="sekka-route-review">
    <strong>{title}</strong><span>{category} · {categorySeats[category]} {t('مقاعد','seats')}</span>
    <span>{period==='weekly'?t('أسبوعي','Weekly'):t('شهري','Monthly')} · {Number(price).toLocaleString(en?'en':'ar-EG')} {t('جنيه','EGP')}</span>
   </div>}
   {error&&<p role="alert" className="sekka-route-alert">{error}</p>}
   {message&&<p role="status" className="sekka-route-success">{message}</p>}
   <button type="button" className="d-primary sekka-route-save" disabled={busy||!draftReady} onClick={()=>void save()}>
    {busy?t('جارٍ الحفظ…','Saving…'):t('حفظ مسودة الخط','Save route draft')}
   </button>
   {!draftReady&&<p className="sekka-route-guidance">
    {t('بعد تحديد نقطتي البداية والنهاية والعربية والمواعيد والسعر هتقدر تحفظ المسودة.',
      'Add origin and destination stops, an approved vehicle, valid schedule and a price to save.')}
   </p>}
  </fieldset>
 </section>;
}
