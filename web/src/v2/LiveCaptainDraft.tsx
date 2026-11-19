import {useEffect,useRef,useState} from 'react';
import {client} from './api';
import GeoPlaceInput from './GeoPlaceInput';
import {inLaunchRegion,mapPlacesFromPhoton,placeMatchesArea} from './geoPlace';
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
export default function LiveCaptainDraft({onSaved}:{onSaved?:(id:string)=>void}={}){
 const {language}=usePreferences(),en=language==='en';
 const t=(ar:string,english:string)=>en?english:ar;
 const [uid,setUid]=useState<string|null>(null);
 const [areas,setAreas]=useState<Area[]>([]);
 const [vehicles,setVehicles]=useState<Vehicle[]>([]);
 const [areaId,setAreaId]=useState('');
 const [showAllAreas,setShowAllAreas]=useState(false);
 const activeAreaId=useRef('');
 const [placeLabel,setPlaceLabel]=useState('');
 const [placeChoice,setPlaceChoice]=useState<PlaceChoice|null>(null);
 const [stopPoint,setStopPoint]=useState<GeoPoint|null>(null);
 const [locatingStop,setLocatingStop]=useState(false);
 const [showMapPreview,setShowMapPreview]=useState(false);
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
  setStopPoint(null);setShowMapPreview(false);setError('');
 };
 const mapPreviewPoint=stopPoint||(stops.length>0?stops[stops.length-1]:null);
 const canPreviewMap=mapPreviewPoint?.latitude!=null&&mapPreviewPoint?.longitude!=null;
 const previewLat=mapPreviewPoint?.latitude??0;
 const previewLng=mapPreviewPoint?.longitude??0;
 const mapBBox=canPreviewMap?[previewLng-0.008,previewLat-0.006,previewLng+0.008,previewLat+0.006]
  .map(value=>value.toFixed(6)).join(','):'';
 const eligibleCategories=(vehicles.find(vehicle=>vehicle.id===vehicleId)?.enabled_categories||[])
  .filter((value):value is Category=>value in categorySeats);
 useEffect(()=>{
  if(eligibleCategories.length>0&&!eligibleCategories.includes(category as Category))
   setCategory(eligibleCategories[0]);
  else if(eligibleCategories.length===0)setCategory(null);
 },[vehicleId,eligibleCategories.join(':')]);
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
     setStopPoint(point);setPlaceChoice({kind:'map',place:verified});
     setPlaceLabel(t('موقعي — ','My location — ')+match.name);setShowMapPreview(false);
    }catch{if(activeAreaId.current===String(checkedArea.id))setError(t('تعذّر تأكيد المنطقة من الخريطة. جرّب البحث عن شارع أو معلم قريب.',
      'The map could not verify your area. Search for a nearby street or landmark.'));}
    finally{setLocatingStop(false);}
   })();},
   ()=>{setLocatingStop(false);setError(t('تعذّر الوصول للموقع. اسمح بالموقع الدقيق أو ابحث على الخريطة.',
    'Precise location access failed. Allow GPS or search the map.'));},
   {enableHighAccuracy:true,timeout:12000,maximumAge:0}
  );
 };
 const addStop=()=>{
  setError('');setMessage('');
  const name=placeChoice?.kind==='map'?placeChoice.place.name.trim():placeLabel.trim();
  const point=placeChoice?.kind==='map'?placeChoice.place:stopPoint;
  if(!areaId||!selectedArea){setError(t('اختار منطقة الخدمة أولًا.','Choose the service area first.'));return;}
  if(placeChoice?.kind==='map'&&!placeMatchesArea(placeChoice.place,selectedArea)){
   setError(t('المكان ده مش متحقق داخل المنطقة المختارة؛ اختار نتيجة من بحث المنطقة.','This location is not verified inside your selected area.'));return;
  }
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
     setStep(1);
     onSaved?.(routeId);
   }catch(e){setError(e instanceof Error?e.message:String(e));}
   finally{setBusy(false);}
 };
 if(!client)return <section className="d-box"><p>{t('ربط Supabase العام لم يكتمل بعد.','Public Supabase configuration is not ready yet.')}</p></section>;
 if(!uid)return <section className="d-box"><p>{t('سجّل دخولك بجوجل قبل حفظ خط حقيقي.','Sign in with Google to create a real route draft.')}</p><a href="?screen=4">{t('الدخول بجوجل','Google sign-in')}</a></section>;
 const canContinueRoute=stops.length>=2&&stops.length<=30&&
  stops[0].areaId!==stops[stops.length-1].areaId;
 const canContinueVehicle=Boolean(vehicleId)&&Boolean(category)&&eligibleCategories.includes(category as Category);
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
  eligibleCategories.includes(category as Category)&&/^\d{1,7}$/.test(price)&&Number(price)>0&&
  (direction!=='round_trip'||returnSupported);
 return <section className="d-box live-route-form sekka-captain-route-wizard">
  <header className="sekka-route-intro">
   <p className="sekka-route-eyebrow">{t('حساب كابتن معتمد','Approved Captain')}</p>
   <h2>{t('إنشاء رحلة جديدة','Create a new trip')}</h2>
   <p>{t('حدد البداية والوجهة من الخريطة، اختار عربيتك المعتمدة وراجع السعر. اسم الخط وعدد المقاعد بيتحددوا تلقائيًا.',
    'Choose map stops, your approved vehicle and private vehicle price. Route name and capacity are automatic.')}</p>
  </header>
  {error&&<p role="alert" className="cj-feedback">{error}</p>}
  {message&&<p role="status" className="cj-feedback">{message}</p>}

  {step===1&&<fieldset className="sekka-route-step">
   <legend><span>1</span> {t('مسار الرحلة','Route stops')}</legend>
   <p>{t('اختار منطقة الخدمة وبعدها شارع أو معلم بداخلها. البحث بيتحقق من المنطقة على OpenStreetMap قبل إضافة النقطة.',
     'Choose a service area, then a verified street or landmark inside it using OpenStreetMap.')}</p>
   <div className="cj-place-step-label"><span>01</span>
    <div><strong>{t('اختار المنطقة الرئيسية','Choose the main area')}</strong>
    <small>{t('أكتوبر، التجمع، الدقي، المعادي، وغيرها','October City, New Cairo, Dokki, Maadi and more')}</small></div>
   </div>
   <div className="cj-area-grid" role="group" aria-label={t('المناطق الرئيسية','Main areas')}>
    {(showAllAreas?orderedAreas:orderedAreas.slice(0,6)).map(area=><button
     key={area.id} type="button" aria-pressed={areaId===String(area.id)}
     onClick={()=>chooseArea(String(area.id))}>
     <span className="cj-area-icon" aria-hidden="true">⌖</span>
     <span><strong>{en?area.name_en:area.name_ar}</strong>
      <small>{en?(area.name_en==='Dokki'||area.name_en==='Sheikh Zayed'||area.name_en==='6th of October'||area.name_en==='Mohandessin'?'Giza':'Cairo'):(area.name_en==='Dokki'||area.name_en==='Sheikh Zayed'||area.name_en==='6th of October'||area.name_en==='Mohandessin'?'الجيزة':'القاهرة')}</small>
     </span>
     {areaId===String(area.id)&&<span className="cj-area-check" aria-hidden="true">✓</span>}
    </button>)}
   </div>
   {!showAllAreas&&orderedAreas.length>6&&<button type="button" className="cj-area-more" onClick={()=>setShowAllAreas(true)}>
    {t('عرض باقي المناطق','See more areas')} ({orderedAreas.length-6})
   </button>}
   <label className="sekka-route-field cj-area-select">{t('أو اختار من قائمة المناطق','Or choose from the area list')}
    <select aria-label={t('منطقة الخدمة','Service area')} value={areaId} onChange={e=>chooseArea(e.target.value)}>
     <option value="">{t('اختار المنطقة الرئيسية','Choose main area')}</option>
     {orderedAreas.map(area=><option key={area.id} value={area.id}>{en?area.name_en:area.name_ar}</option>)}
    </select>
   </label>
   {selectedArea&&<div className="cj-selected-area" role="status">
     <span aria-hidden="true">✓</span><strong>{en?selectedArea.name_en:selectedArea.name_ar}</strong>
     <small>{t('دلوقتي اختار مكان معروف جوّاها','Now choose a well-known place inside it')}</small>
   </div>}
   <div className="cj-place-step-label"><span>02</span>
    <div><strong>{t('اختار الحي أو الميدان أو المعلم','Choose a district or landmark')}</strong>
     <small>{t('من المقترحات أو ابحث باسم أي مكان','Use a suggestion or search any place by name')}</small>
    </div>
   </div>
   <div className="sekka-route-field">
    <span>{stops.length===0?t('مكان الانطلاق على الخريطة','Origin on the map'):t('مكان الوجهة أو محطة الطريق','Destination or route stop')}</span>
    <GeoPlaceInput label={t('ابحث عن شارع أو مكان','Search street or landmark')} value={placeLabel}
     choice={placeChoice} areas={[]} searchArea={selectedArea} disabled={!selectedArea}
     onPick={(value,choice)=>{
      setPlaceLabel(value);setPlaceChoice(choice);
      setStopPoint(choice?.kind==='map'?choice.place:null);setShowMapPreview(false);setError('');
     }}/>
   </div>
   <div className="sekka-route-stop-tools">
    <button type="button" className="sekka-route-secondary" disabled={locatingStop||!areaId} onClick={useMyStopPosition}>
     {locatingStop?t('جارٍ تحديد الموقع…','Locating…'):t('📍 أنا واقف عند النقطة','📍 I am at this stop')}
    </button>
    {stopPoint&&<span className="sekka-route-map-confirm">✓ {t('تم تحديد مكان النقطة','Stop location confirmed')}</span>}
   </div>
   {canPreviewMap&&<section className="sekka-route-map-card" aria-label={t('معاينة الموقع على OpenStreetMap','OpenStreetMap location preview')}>
    <div className="sekka-route-map-card__heading">
     <div><strong>{t('مكان نقطة الوقوف','Stop location')}</strong><small>{t('خريطة OpenStreetMap · عرض تفاعلي','OpenStreetMap · interactive preview')}</small></div>
     <button type="button" className="sekka-route-secondary" aria-expanded={showMapPreview}
      onClick={()=>setShowMapPreview(value=>!value)}>
      {showMapPreview?t('إخفاء الخريطة','Hide map'):t('عرض الخريطة','Show map')}
     </button>
    </div>
    {showMapPreview&&<>
     <iframe title={t('خريطة تفاعلية لموقع الوقوف','Interactive map of the stop')}
      loading="lazy" referrerPolicy="no-referrer" className="sekka-route-map-card__frame"
      src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapBBox}&layer=mapnik&marker=${previewLat.toFixed(6)},${previewLng.toFixed(6)}`}/>
     <p className="sekka-route-map-card__note">{t('الخريطة للمعاينة. تحديد النقطة الفعلية بيكون من نتيجة البحث أو GPS؛ فتح المعاينة بيشارك الموقع مع OpenStreetMap.',
      'Preview only. Select stops through search or GPS. Opening the map shares this location with OpenStreetMap.')}</p>
    </>}
   </section>}
   <button type="button" className="sekka-route-add" disabled={!areaId||!stopPoint||!placeLabel.trim()||busy}
    onClick={addStop}>{t('تأكيد وإضافة نقطة الوقوف','Add this stop')}</button>
   {stops.length>0&&<div className="cj-added-stops-head"><strong>{t('نقط الرحلة اللي ضفتها','Added trip stops')}</strong><span>{stops.length} / 30</span></div>}
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
   {stops.length<2&&<p className="sekka-route-guidance" role="status">{stops.length===0?
    t('اختار منطقة الانطلاق، ثم حدد مكانًا واضغط «تأكيد وإضافة نقطة الوقوف».','Choose an origin area, select its location, then Add this stop.'):
    t('تم إضافة الانطلاق. اختار منطقة وجهة مختلفة وحدد موقعها، ثم اضغط إضافة النقطة لتفعيل «التالي».','Origin added. Choose a different destination area, verify its location and add it to enable Continue.')}</p>}
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
    {step<4&&<button type="button" className="sekka-route-next" disabled={!canContinue||busy}
     onClick={nextStep}>{t('التالي','Continue')}</button>}
   </div>
  </nav>
 </section>;
}
