import {useEffect,useRef,useState} from 'react';
import {client} from './api';
import CaptainPlacePicker from './CaptainPlacePicker';
import {captainRouteError} from './captainRouteErrors';
import {inLaunchRegion,mapPlacesFromPhoton,placeMatchesArea} from './geoPlace';
import type {MapPlace} from './geoPlace';
import type {PlaceChoice} from './geoPlace';
import {straightLineKm} from './nearbyRoutes';
import {usePreferences} from './preferences';
import type {Category} from '../../../packages/domain/subscriptions';

type Area={id:number;name_ar:string;name_en:string;region?:string};
type StopInput={areaId:number;name:string;pickup:boolean;dropoff:boolean;latitude:number|null;longitude:number|null};
type Vehicle={id:string;model:string;plate_number:string;enabled_categories:string[]};
const categorySeats:Record<Category,number>={PRIME:3,SAVER:4,SPACE:9,MAX:13};

/** Authenticated draft creation only. Publishing requires a separate audited server operation. */
export default function LiveCaptainDraft({onSaved,onViewRoutes}:{onSaved?:(id:string)=>void;onViewRoutes?:()=>void}={}){
 const {language}=usePreferences(),en=language==='en';
 const t=(ar:string,english:string)=>en?english:ar;
 const [uid,setUid]=useState<string|null>(null);
 const [areas,setAreas]=useState<Area[]>([]);
 const [vehicles,setVehicles]=useState<Vehicle[]>([]);
 const [areaId,setAreaId]=useState('');
 const activeAreaId=useRef('');
 const [placeLabel,setPlaceLabel]=useState('');
 const [placeChoice,setPlaceChoice]=useState<PlaceChoice|null>(null);
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
 const [step,setStep]=useState<1|2|3|4>(1);
 const [vehicleCheck,setVehicleCheck]=useState<'checking'|'clear'|'conflict'|'unavailable'>('checking');
 const [vehicleConflict,setVehicleConflict]=useState<{id:string;title:string;status:string}|null>(null);
 const [vehicleCheckVersion,setVehicleCheckVersion]=useState(0);
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
     client.from('v31_service_areas').select('id,name_ar,name_en,region').order('id'),
     client.from('v31_vehicles').select('id,model,plate_number,enabled_categories')
      .eq('captain_id',user.id).eq('status','active').order('created_at',{ascending:false})
    ]);
    if(!live)return;
    if(areaResult.error||vehicleResult.error){
     setError(areaResult.error?.message||vehicleResult.error?.message||'LOAD_FAILED');return;
    }
    const availableVehicles=(vehicleResult.data||[]) as Vehicle[];
    setAreas((areaResult.data||[]) as Area[]);
    // Do not guess the Captain's operating area from the first database row.
    setAreaId('');
    setVehicles(availableVehicles);
    setVehicleId(availableVehicles[0]?.id||'');
    const firstCategory=availableVehicles[0]?.enabled_categories?.[0];
    if(firstCategory&&firstCategory in categorySeats)setCategory(firstCategory as Category);
   })();
   const {data:listener}=client.auth.onAuthStateChange((_event,session)=>setUid(session?.user.id??null));
   return ()=>{live=false;listener.subscription.unsubscribe();};
 },[]);
 const title=stops.length>=2?stops[0].name.slice(0,55)+' ← '+stops[stops.length-1].name.slice(0,55):'';
 const selectedArea=areas.find(area=>String(area.id)===areaId);
 const areaOrder=['6th of october','new cairo','dokki','maadi','nasr city','heliopolis','sheikh zayed','mohandessin','zamalek'];
 const orderedAreas=[...areas].sort((a,b)=>{
  const ia=areaOrder.indexOf(a.name_en.toLowerCase()),ib=areaOrder.indexOf(b.name_en.toLowerCase());
  return (ia<0?99:ia)-(ib<0?99:ib)||a.name_ar.localeCompare(b.name_ar,'ar');
 });
 const chooseArea=(id:string)=>{
  activeAreaId.current=id;setAreaId(id);setPlaceChoice(null);setPlaceLabel('');
  setError('');
 };
 const eligibleCategories=(vehicles.find(vehicle=>vehicle.id===vehicleId)?.enabled_categories||[])
  .filter((value):value is Category=>value in categorySeats);
 useEffect(()=>{
  if(eligibleCategories.length>0&&!eligibleCategories.includes(category as Category))
   setCategory(eligibleCategories[0]);
  else if(eligibleCategories.length===0)setCategory(null);
 },[vehicleId,eligibleCategories.join(':')]);
 // A helpful early warning, never a substitute for the server-side publish guard.
 // Every lookup is scoped to this signed-in Captain's vehicle and uses normal RLS.
 useEffect(()=>{
  if(!client||!uid||!vehicleId){
   setVehicleConflict(null);setVehicleCheck('unavailable');return;
  }
  let live=true;setVehicleCheck('checking');setVehicleConflict(null);
  void(async()=>{
   try{
    const {data,error:lookupError}=await client.from('v31_routes')
     .select('id,title,status,vehicle_id').eq('captain_id',uid)
     .eq('vehicle_id',vehicleId).in('status',['published','paused']).limit(1);
    if(!live)return;
    if(lookupError||!Array.isArray(data)){
     setVehicleCheck('unavailable');return;
    }
    // Status + vehicle checks also protect against incomplete mocked fixtures.
    const conflict=data.find(row=>row.vehicle_id===vehicleId&&
     (row.status==='published'||row.status==='paused'));
    setVehicleConflict(conflict?{id:conflict.id,title:conflict.title,status:conflict.status}:null);
    setVehicleCheck(conflict?'conflict':'clear');
   }catch{if(live)setVehicleCheck('unavailable');}
  })();
  return ()=>{live=false;};
 },[uid,vehicleId,vehicleCheckVersion]);
 const useMyStopPosition=()=>{
  setError('');
  if(!selectedArea){setError(t('اختار المنطقة الأول علشان نتحقق من مكانك.','Choose an area before locating your stop.'));return;}
  const checkedArea=selectedArea;
  if(!window.isSecureContext||!navigator.geolocation){
   setError(t('الموقع محتاج إذن GPS واتصال آمن.','Your location requires GPS permission and a secure connection.'));return;
  }
  setLocatingStop(true);
  navigator.geolocation.getCurrentPosition(
   position=>{void(async()=>{
    const point={latitude:position.coords.latitude,longitude:position.coords.longitude};
    if(position.coords.accuracy>100||!inLaunchRegion(point)){
     setLocatingStop(false);
     setError(t('دقة GPS مش كفاية أو الموقع خارج القاهرة والجيزة. فعّل الموقع الدقيق، أو ابحث عن مكان على الخريطة.',
      'GPS is not accurate enough or outside Cairo/Giza. Enable precise GPS or use map search.'));return;
    }
    try{
     const url=new URL('https://photon.komoot.io/reverse');
     url.searchParams.set('lat',String(point.latitude));url.searchParams.set('lon',String(point.longitude));
     url.searchParams.set('limit','10');
     const response=await fetch(url.toString(),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)});
     if(!response.ok)throw Error('REVERSE_UNAVAILABLE');
     const match=mapPlacesFromPhoton(await response.json()).find(place=>placeMatchesArea(place,checkedArea));
     if(activeAreaId.current!==String(checkedArea.id))return;
     if(!match){setError(t('GPS حدد مكانك لكن بيانات الخريطة ما أكدتش إنه في '+checkedArea.name_ar+'. اختار شارع أو معلم من بحث المنطقة.',
       'GPS located you but the map could not verify '+checkedArea.name_en+'. Pick a street or landmark in that area.'));return;}
     const verified={...match,latitude:point.latitude,longitude:point.longitude};
     addVerifiedStop(verified);
    }catch{if(activeAreaId.current===String(checkedArea.id))setError(t('تعذّر تأكيد المنطقة من الخريطة. جرّب البحث عن شارع أو معلم قريب.',
      'The map could not verify your area. Search for a nearby street or landmark.'));}
    finally{setLocatingStop(false);}
   })();},
   ()=>{setLocatingStop(false);setError(t('تعذّر الوصول للموقع. اسمح بالموقع الدقيق أو ابحث على الخريطة.',
    'Precise location access failed. Allow GPS or search the map.'));},
   {enableHighAccuracy:true,timeout:12000,maximumAge:0}
  );
 };
 const addVerifiedStop=(place:MapPlace)=>{
  setError('');setMessage('');
  if(!selectedArea){setError(t('اختار المنطقة الأول.','Choose an area first.'));return;}
  if(!inLaunchRegion(place)||!placeMatchesArea(place,selectedArea)){
   setError(t('المكان ده مش متأكد إنه في المنطقة دي.','Place is not verified inside this area.'));return;
  }
  const name=place.name.trim();
  if(name.length<3||name.length>100){setError(t('اختار مكان باسم واضح.','Choose a named place.'));return;}
  if(stops.length>=30){setError(t('وصلت لأقصى عدد نقاط.','Maximum stops reached.'));return;}
  if(stops.some(s=>s.areaId===selectedArea.id&&
    (s.name.toLocaleLowerCase()===name.toLocaleLowerCase()||
     s.latitude!==null&&s.longitude!==null&&straightLineKm({latitude:s.latitude,longitude:s.longitude},place)<0.03))){
   setError(t('المكان ده اتضاف بالفعل.','Stop is already added.'));return;
  }
  const next=[...stops,{areaId:selectedArea.id,name,pickup:true,dropoff:true,
   latitude:Number(place.latitude.toFixed(6)),longitude:Number(place.longitude.toFixed(6))}];
  setStops(next);setAreaId('');activeAreaId.current='';
  setPlaceLabel('');setPlaceChoice(null);
  if(next.length===2&&next[0].areaId!==next[1].areaId)setStep(2);
 };
 const save=async()=>{
   if(!client||!uid)return;
   setMessage('');setError('');
   if(title.length<3||title.length>120||stops.length<2||stops[0].areaId===stops.at(-1)?.areaId||
      stops.some(stop=>stop.latitude===null||stop.longitude===null||
       !inLaunchRegion({latitude:stop.latitude,longitude:stop.longitude}))||
      !vehicleId||!category||!eligibleCategories.includes(category)||vehicleCheck!=='clear'||
      !/^\d{1,7}$/.test(price)||!Number.isSafeInteger(Number(price))||Number(price)<=0||
      !['weekly','monthly'].includes(period)||!['outbound','return','round_trip'].includes(direction)||
      (direction!=='return'&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(departure))||
      (direction!=='outbound'&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(arrival))||
      (direction==='round_trip'&&!returnSupported)){
     setError(t('راجع المركبة والفئة والعنوان والسعر؛ يلزم نقطتان في منطقتين مختلفتين.','Check vehicle, category, title, price and at least two stops in distinct areas.'));return;
   }
   setBusy(true);
   try{
     // This is an approved Captain's route workflow, never enrollment.
     // The server RPC verifies approval again before inserting any draft.
     const {data:routeId,error:routeError}=await client.rpc('v31_create_geolocated_route_draft',{
       p_title:title.trim(),p_vehicle:vehicleId,p_category:category,
       p_direction:direction,p_period:period,
       p_outbound:direction==='return'?null:departure,
       p_return:direction==='outbound'?null:arrival,
       p_return_supported:direction==='round_trip'?returnSupported:false,
       p_price:Number(price),p_stops:stops.map(s=>({
         area_id:s.areaId,name:s.name,pickup:s.pickup,dropoff:s.dropoff,
         latitude:s.latitude,longitude:s.longitude
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
     // The new RPC commits the draft, stops and coordinates in one Postgres
     // transaction. Failure rolls back everything; no per-stop writes here.
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
     setStops([]);setPlaceLabel('');setPlaceChoice(null);setPrice('');
     setStep(1);
     onSaved?.(routeId);
   }catch(e){setError(captainRouteError(e,en?'en':'ar'));}
   finally{setBusy(false);}
 };
 if(!client)return <section className="d-box"><p>{t('ربط Supabase العام لم يكتمل بعد.','Public Supabase configuration is not ready yet.')}</p></section>;
 if(!uid)return <section className="d-box"><p>{t('سجّل دخولك بجوجل قبل حفظ خط حقيقي.','Sign in with Google to create a real route draft.')}</p><a href="?screen=4">{t('الدخول بجوجل','Google sign-in')}</a></section>;
 const canContinueRoute=stops.length>=2&&stops.length<=30&&
  stops[0].areaId!==stops[stops.length-1].areaId;
 const canContinueVehicle=Boolean(vehicleId)&&Boolean(category)&&eligibleCategories.includes(category as Category)&&vehicleCheck==='clear';
 const canContinueSchedule=(direction==='outbound'||direction==='return'||direction==='round_trip')&&
  (direction==='return'||Boolean(departure))&&
  (direction==='outbound'||Boolean(arrival))&&
  (direction!=='round_trip'||returnSupported);
 const canContinue=step===1?canContinueRoute:step===2?canContinueVehicle:canContinueSchedule;
 const nextStep=()=>{
  setError('');
  if(canContinue&&step<4)setStep((step+1) as 1|2|3|4);
 };
 const draftReady=stops.length>=2&&stops[0].areaId!==stops.at(-1)?.areaId&&
  title.length>=3&&title.length<=120&&Boolean(vehicleId)&&Boolean(category)&&
  eligibleCategories.includes(category as Category)&&vehicleCheck==='clear'&&/^\d{1,7}$/.test(price)&&Number(price)>0&&
  (direction!=='round_trip'||returnSupported);
 return <section className="d-box live-route-form sekka-captain-route-wizard">
  <header className="sekka-route-intro">
   <p className="sekka-route-eyebrow">{t('حساب كابتن معتمد','Approved Captain')}</p>
   <h2>{t('إنشاء رحلة جديدة','Create a new trip')}</h2>
   <p>{t('منين؟ لفين؟ اختار المنطقة والمكان، والباقي بسيط.','Where from and where to? Choose an area and a place.')}</p>
  </header>
  {error&&<p role="alert" className="cj-feedback">{error}</p>}
  {message&&<p role="status" className="cj-feedback">{message}</p>}

  {step===1&&<fieldset className="sekka-route-step">
   <legend><span>1</span> {t('مسار الرحلة','Route stops')}</legend>
   <p className="cj-route-hint">{t('اختار منطقة وبعدها مكان. الموقع بيتحدد تلقائيًا لما يتأكد من الخريطة.',
    'Choose an area, then a landmark. The location is verified automatically.')}</p>
   <div className="cj-easy-route-top">
    <strong>{stops.length===0?t('منين هتبدأ؟','Where from?'):stops.length===1?t('رايح فين؟','Where to?'):
      t('محطة إضافية','Additional stop')}</strong>
    <small>{stops.length===0?t('اختار منطقة البداية','Choose the pickup area'):
      stops.length===1?t('اختار منطقة الوصول','Choose the destination'):
      t('تقدر تضيف محطة تانية','Add another stop')}</small>
   </div>
   {stops.length>0&&<ol className="cj-easy-selected-stops" aria-label={t('نقط الرحلة','Trip stops')}>
    {stops.map((stop,index)=><li key={index}>
     <span className="cj-easy-stop-number">{index+1}</span>
     <div><strong>{stop.name}</strong><small>{en?areas.find(a=>a.id===stop.areaId)?.name_en:areas.find(a=>a.id===stop.areaId)?.name_ar}</small></div>
     <button type="button" onClick={()=>{setStops(old=>old.filter((_,i)=>i!==index));chooseArea('');}}
      aria-label={t('احذف ','Remove ')+stop.name}>{t('حذف','Remove')}</button>
    </li>)}
   </ol>}
   {!selectedArea?<>
    <div className="cj-easy-areas" role="group" aria-label={t('المناطق الرئيسية','Main areas')}>
     {orderedAreas.filter(area=>stops.length!==1||area.id!==stops[0].areaId).map(area=><button type="button"
      key={area.id} onClick={()=>chooseArea(String(area.id))}>
      <strong>{en?area.name_en:area.name_ar}</strong><span aria-hidden="true">‹</span>
     </button>)}
    </div>
   </>:<>
    <button type="button" className="cj-easy-change" onClick={()=>chooseArea('')}>
     <span>{t('المنطقة: ','Area: ')}<strong>{en?selectedArea.name_en:selectedArea.name_ar}</strong></span>
     <span>{t('تغيير','Change')}</span>
    </button>
    <CaptainPlacePicker label={t('ابحث عن شارع أو مكان','Search street or landmark')}
     value={placeLabel} choice={placeChoice} searchArea={selectedArea}
     onPick={(value,choice)=>{setPlaceLabel(value);setPlaceChoice(choice);setError('');}}
     onVerified={addVerifiedStop}/>
    <button type="button" className="cj-easy-gps" disabled={locatingStop}
     onClick={useMyStopPosition}>{locatingStop?t('بنحدد موقعك…','Locating…'):
      t('⌖ استخدم موقعي الحالي','⌖ Use my current location')}</button>
   </>}
   {stops.length<2&&<p className="cj-easy-help" role="status">{stops.length===0?
    t('اختار منطقة ثم مكان، وهتتضاف النقطة تلقائيًا.','Select an area and a place; the stop is added automatically.'):
    t('✓ نقطة البداية اتضافت. اختار الوجهة.','✓ Pickup added. Choose destination.')}</p>}
   {stops.length>=2&&<p className="sekka-route-generated-title">
    {t('اسم الخط تلقائيًا:','Automatic route name:')} <strong>{title}</strong>
   </p>}
  </fieldset>}

  {step===2&&<fieldset className="sekka-route-step">
   <legend><span>2</span> {t('العربية والمقاعد','Vehicle and seats')}</legend>
   <label className="sekka-route-field">{t('المركبة المعتمدة','Approved vehicle')}
    <select value={vehicleId} onChange={e=>setVehicleId(e.target.value)}>
     <option value="">{t('اختار عربية معتمدة','Select approved vehicle')}</option>
     {vehicles.map(vehicle=><option key={vehicle.id} value={vehicle.id}>{vehicle.model} — {vehicle.plate_number}</option>)}
    </select>
   </label>
   {vehicleId&&<div className="cj-vehicle-preflight" role="status">
    {vehicleCheck==='checking'&&<p>{t('بنراجع إذا كانت العربية متاحة للنشر…','Checking whether the vehicle is available…')}</p>}
    {vehicleCheck==='clear'&&<p>{t('✓ العربية متاحة لإنشاء خط جديد حسب البيانات الحالية. النشر بيتراجع تاني على السيرفر.','✓ No active route conflict found. Publication is verified again by the server.')}</p>}
    {vehicleCheck==='conflict'&&<div>
     <p role="alert">{captainRouteError('VEHICLE_HAS_ACTIVE_SERVICE',en?'en':'ar')}</p>
     {vehicleConflict&&<strong>{vehicleConflict.title}</strong>}
     {onViewRoutes&&<button type="button" onClick={onViewRoutes}>{t('افتح رحلاتي','Open My routes')}</button>}
    </div>}
    {vehicleCheck==='unavailable'&&<div>
     <p role="alert">{t('مش قادرين نتحقق من حالة العربية حاليًا. جرّب التحقق تاني قبل المتابعة.','Could not verify the vehicle state. Retry before continuing.')}</p>
     <button type="button" onClick={()=>setVehicleCheckVersion(v=>v+1)}>{t('تحقق مرة تانية','Check again')}</button>
    </div>}
   </div>}
   <div className="sekka-route-field">
    <strong>{t('فئة المركبة وعدد المقاعد','Vehicle category and seats')}</strong>
    <div className="cj-category-options" role="group" aria-label={t('فئة الخدمة','Service category')}>
     {(Object.keys(categorySeats) as Category[]).map(value=><button key={value} type="button"
      className="cj-category-option" aria-pressed={category===value}
      disabled={!eligibleCategories.includes(value)} onClick={()=>setCategory(value)}>
      <strong>{value}</strong>
      <small>{categorySeats[value]} {t('مقاعد للركاب','passenger seats')}</small>
      <small>{eligibleCategories.includes(value)?t('متاح لعربيتك','Eligible vehicle'):t('غير متاح للمركبة','Not eligible')}</small>
     </button>)}
    </div>
   </div>
   {category&&<p className="sekka-route-guidance">{t('الفئة والمقاعد متطابقين مع اعتماد العربية؛ مش ممكن تعديل السعة يدويًا.','Category and seats match the approved vehicle; capacity cannot be overridden.')} <strong>{categorySeats[category]} {t('مقاعد','seats')}</strong></p>}
   {!vehicles.length&&<p role="alert">{t('مفيش عربية معتمدة مضافة لحسابك. راجع حالة الاعتماد مع الإدارة.','No approved vehicle was found. Check your approval with Admin.')}</p>}
  </fieldset>}

  {step===3&&<fieldset className="sekka-route-step">
   <legend><span>3</span> {t('تفضيلات خط السير','Route preferences')}</legend>
   <p className="cj-schedule-warning">{t('الأوقات دي تفضيلات مبدئية للخط، مش موعد انطلاق مؤكد. تحديد الانطلاق الفعلي بيكون بعد اكتمال المقاعد وإبلاغ الركاب.', 'These are route preferences, not a confirmed departure. Actual departure is set after all seats fill and riders are notified.')}</p>
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
    {direction!=='return'&&<label className="sekka-route-field">{t('وقت ذهاب مفضل','Preferred outbound time')}
     <input type="time" value={departure} onChange={e=>setDeparture(e.target.value)}/></label>}
    {direction!=='outbound'&&<label className="sekka-route-field">{t('وقت عودة مفضل','Preferred return time')}
     <input type="time" value={arrival} onChange={e=>setArrival(e.target.value)}/></label>}
   </div>
   {direction==='round_trip'&&<label className="sekka-route-check">
    <input type="checkbox" checked={returnSupported} onChange={e=>setReturnSupported(e.target.checked)}/>
    {t('نفس نقاط الوقوف في العودة بترتيب عكسي','Return uses the same stops in reverse order')}
   </label>}
  </fieldset>}

  {step===4&&<fieldset className="sekka-route-step">
   <legend><span>4</span> {t('مراجعة الرحلة والسعر','Trip review and price')}</legend>
   <label className="sekka-route-field">{t('سعر المركبة بالكامل بالجنيه','Total vehicle price (EGP)')}
    <input type="number" inputMode="numeric" min="1" max="9999999" step="1"
     placeholder={t('اكتب سعر صحيح بالجنيه','Enter a whole EGP amount')}
     value={price} onChange={e=>setPrice(e.target.value)}/>
   </label>
   <p className="sekka-route-guidance">{t('السعر الإجمالي يخص المركبة بالكامل، وسعر المقعد بيحسبه النظام تلقائيًا. مش هيظهر للركاب كسعر مركبة.',
    'Enter the full vehicle price. The system calculates seat prices; passengers do not see the private vehicle total.')}</p>
   {stops.length>=2&&category&&price&&<div className="sekka-route-review" aria-label={t('ملخص المسودة','Draft summary')}>
    <strong>{title}</strong>
    <span>{t('نقاط الرحلة','Trip stops')}: {stops.map(stop=>stop.name).join(' ← ')}</span>
    <span>{t('المركبة','Vehicle')}: {vehicles.find(v=>v.id===vehicleId)?.model||'—'}</span>
    <span>{t('الفئة','Category')}: {category} · {categorySeats[category]} {t('مقاعد','seats')}</span>
    <span>{t('تفضيلات الخط','Route preferences')}: {period==='weekly'?t('أسبوعي','Weekly'):t('شهري','Monthly')}</span>
    <span>{t('سعر المركبة الخاص بالكابتن','Private whole-vehicle price')}: {Number(price).toLocaleString(en?'en':'ar-EG')} {t('جنيه','EGP')}</span>
    <small>{t('دي مسودة فقط؛ النشر بيتم بعد المراجعة والتحقق من السيرفر.','This saves only a draft. Publication requires server-verified approval.')}</small>
   </div>}
   <button type="button" className="d-primary sekka-route-save" disabled={busy||!draftReady} onClick={()=>void save()}>
    {busy?t('جارٍ الحفظ…','Saving…'):t('حفظ المسودة ومراجعة النشر','Save draft for publishing')}
   </button>
   {!draftReady&&<p className="sekka-route-guidance">
    {t('بعد تحديد نقطتي البداية والنهاية والعربية والمواعيد والسعر هتقدر تحفظ المسودة.',
      'Add origin and destination stops, an approved vehicle, valid schedule and a price to save.')}
   </p>}
  </fieldset>}

  <nav className="sekka-route-step-navigation" aria-label={t('الخطوات','Steps')}>
   <div className="sekka-route-step-progress" role="status">
    <strong>{t('الخطوة','Step')} {step} {t('من','of')} 4</strong>
    <div aria-hidden="true">{[1,2,3,4].map(n=><span key={n} className={n<=step?'is-current':''}/>)}</div>
   </div>
   <div className="sekka-route-step-buttons">
    {step>1&&<button type="button" className="sekka-route-secondary" disabled={busy}
     onClick={()=>{setError('');setStep((step-1) as 1|2|3|4)}}>{t('السابق','Back')}</button>}
    {((step===1&&canContinueRoute)||(step>1&&step<4))&&<button type="button" className="sekka-route-next" disabled={!canContinue||busy}
     onClick={nextStep}>{t('التالي','Continue')}</button>}
   </div>
  </nav>
 </section>;
}
