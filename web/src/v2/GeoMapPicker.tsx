import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {PointerEvent,WheelEvent,KeyboardEvent} from 'react';
import {usePreferences} from './preferences';
import {isInsideOperationalRegion,persistableOperationalPoint} from './greaterCairoBoundary';
import {localPlaceCatalog} from './locationCatalog';
import {isInsideCairoDiscovery} from './discoveryCairo';
import {useLocationSearch,useLocationOptions} from './locationSearch';
import {straightLineKm} from './nearbyRoutes';
import {mapProject,mapUnproject,mapMove,mapZoom,visibleTiles} from './geoMapMath';
import type {MapCoordinate} from './geoMapMath';
import type {MapPlace,ServiceArea} from './geoPlace';
import './geo-map-picker.css';

type MapPickerProps={
 initial?:MapPlace|null;
 focus?:MapCoordinate|null;
 focusLabel?:string;
 area?:ServiceArea;
 onCancel:()=>void;
 onConfirm:(place:MapPlace)=>boolean|void|Promise<boolean|void>;
};
const CAIRO_CENTER={latitude:30.0443934,longitude:31.2357457}; // OSM way/30925727, verified Tahrir
function startingPoint(initial:MapPlace|null|undefined,focus:MapCoordinate|null|undefined,area:ServiceArea|undefined):MapCoordinate {
 if(initial&&isInsideOperationalRegion(initial))return {latitude:initial.latitude,longitude:initial.longitude};
 if(focus&&isInsideCairoDiscovery(focus))return {latitude:focus.latitude,longitude:focus.longitude};
 const ref=localPlaceCatalog.find(p=>p.area===area?.name_en.toLowerCase()&&p.reference&&
  isInsideOperationalRegion(p.reference))?.reference;
 return ref?{latitude:ref.latitude,longitude:ref.longitude}:CAIRO_CENTER;
}
export default function GeoMapPicker({initial,focus,focusLabel,area,onCancel,onConfirm}:MapPickerProps){
 const {language}=usePreferences(),en=language==='en';
 const t=(ar:string,english:string)=>en?english:ar;
 const [center,setCenter]=useState<MapCoordinate>(()=>startingPoint(initial,focus,area));
 const [zoom,setZoom]=useState(initial?15:focus?14:area?13:11);
 const [pin,setPin]=useState<MapCoordinate|null>(initial?{latitude:initial.latitude,longitude:initial.longitude}:null);
 const [dimensions,setDimensions]=useState({width:360,height:440});
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [mapSearch,setMapSearch]=useState(focusLabel??'');
 const [searchOpen,setSearchOpen]=useState(false);
 const options=useLocationOptions();
 const dialogRef=useRef<HTMLDialogElement>(null);
 const wasPinch=useRef(false);
 const search=useLocationSearch(mapSearch,searchOpen,area,en,0);
 const [placeName,setPlaceName]=useState(focusLabel??'');
 const [placePoint,setPlacePoint]=useState<MapCoordinate|null>(focus??null);
 const [gpsPin,setGpsPin]=useState(false);
 const [gpsBusy,setGpsBusy]=useState(false);
 const mapRef=useRef<HTMLDivElement|null>(null);
 const centerRef=useRef(center);
 const active=useRef(new Map<number,{x:number;y:number;startX:number;startY:number;travel:number}>());
 const lastPinch=useRef<number|null>(null);
  useEffect(()=>{centerRef.current=center;},[center]);
 useEffect(()=>{
  const element=mapRef.current;
  if(!element)return;
  const measure=()=>setDimensions({width:Math.max(1,element.clientWidth),height:Math.max(1,element.clientHeight)});
  measure();
  const observer=new ResizeObserver(measure);
  observer.observe(element);
  return ()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  const node=dialogRef.current;
  node?.showModal();
  return ()=>node?.close();
 },[]);
 const move=(dx:number,dy:number)=>setCenter(previous=>{
  const result=mapMove(previous,dx,dy,zoom);
  centerRef.current=result;
  return result;
 });
 const onDown=(event:PointerEvent<HTMLDivElement>)=>{
  if(event.button!==0||(event.target instanceof Element&&event.target.closest('button,a')))return;
  event.currentTarget.setPointerCapture(event.pointerId);
  active.current.set(event.pointerId,{x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,travel:0});
  if(active.current.size===1)wasPinch.current=false;
  if(active.current.size===2){
   wasPinch.current=true;
   const pair=[...active.current.values()];
   lastPinch.current=Math.hypot(pair[0].x-pair[1].x,pair[0].y-pair[1].y);
  }
 };
 const onMoving=(event:PointerEvent<HTMLDivElement>)=>{
  const current=active.current.get(event.pointerId);
  if(!current)return;
  const dx=event.clientX-current.x,dy=event.clientY-current.y;
  current.x=event.clientX;current.y=event.clientY;current.travel+=Math.abs(dx)+Math.abs(dy);
  if(active.current.size===1)move(dx,dy);
  else if(active.current.size===2){
   const pair=[...active.current.values()];
   const distance=Math.hypot(pair[0].x-pair[1].x,pair[0].y-pair[1].y);
   if(lastPinch.current!==null&&distance>lastPinch.current*1.35){
    setZoom(z=>mapZoom(z+1));lastPinch.current=distance;
   }else if(lastPinch.current!==null&&distance<lastPinch.current*.7){
    setZoom(z=>mapZoom(z-1));lastPinch.current=distance;
   }
  }
 };
 const onUp=(event:PointerEvent<HTMLDivElement>)=>{
  const current=active.current.get(event.pointerId);
  if(!current)return;
  active.current.delete(event.pointerId);
  if(active.current.size<2)lastPinch.current=null;
  if(wasPinch.current||current.travel>12||active.current.size>0)return;
  const box=event.currentTarget.getBoundingClientRect();
  const target=mapProject(centerRef.current,zoom);
  const point=mapUnproject(target.x+(event.clientX-box.left-box.width/2),
   target.y+(event.clientY-box.top-box.height/2),zoom);
  setPin(point);setGpsPin(false);setMessage('');
 };
 const wheel=(event:WheelEvent<HTMLDivElement>)=>{
  event.preventDefault();
  setZoom(current=>mapZoom(current+(event.deltaY<0?1:-1)));
 };
 const keyboard=(event:KeyboardEvent<HTMLDivElement>)=>{
  if(event.target!==event.currentTarget)return;
  const offsets:Record<string,[number,number]>={ArrowUp:[0,60],ArrowDown:[0,-60],ArrowRight:[-60,0],ArrowLeft:[60,0]};
  if(offsets[event.key]){event.preventDefault();move(...offsets[event.key]);}
  if(event.key==='Enter'){event.preventDefault();setPin(centerRef.current);setGpsPin(false);setMessage('');}
 };
 const focusPlace=(place:MapPlace)=>{
  const point={latitude:place.latitude,longitude:place.longitude};
  if(!isInsideCairoDiscovery(point))return;
  setCenter(point);centerRef.current=point;setZoom(16);setPin(null);setGpsPin(false);
  setPlaceName(place.name);setPlacePoint(point);setMapSearch(place.name);setSearchOpen(false);
  setMessage(t('وصلنا للمكان؛ اضغط على الخريطة لاختيار نقطة الركوب.','Place found; tap the map for an exact pickup point.'));
 };
 const locateMe=()=>{
  if(!navigator.geolocation){setMessage(t('المتصفح لا يدعم تحديد الموقع.','Browser geolocation is unavailable.'));return;}
  setGpsBusy(true);setMessage(t('بنحدد موقعك…','Locating you…'));
  navigator.geolocation.getCurrentPosition(({coords})=>{
   const p={latitude:coords.latitude,longitude:coords.longitude};
   setGpsBusy(false);
   if(!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude)){
    setMessage(t('تعذّر قراءة موقعك.','Unable to read your location.'));return;
   }
   setCenter(p);centerRef.current=p;setZoom(16);setPin(p);setGpsPin(true);
   setPlaceName(t('موقعي الحالي','My current location'));setPlacePoint(p);setSearchOpen(false);
   setMessage(isInsideOperationalRegion(p)
    ?t('تم تحديد موقعك. يمكنك تأكيده أو اختيار نقطة قريبة.','Location found. Confirm or pick a nearby point.')
    :t('موقعك خارج نطاق الرحلات الحالي.','Your location is outside the current ride coverage.'));
  },error=>{
   setGpsBusy(false);
   setMessage(error.code===1?t('اسمح بالوصول للموقع من المتصفح وجرب تاني.','Allow location access in your browser and retry.'):
    error.code===3?t('تحديد الموقع اتأخر. شغّل GPS وجرب تاني.','Location timed out. Enable GPS and retry.'):
    t('تعذّر تحديد موقعك. تأكد إن GPS شغال.','Location unavailable. Check that GPS is on.'));
  },{enableHighAccuracy:true,timeout:15000,maximumAge:15000});
 };
 const confirm=async()=>{
  if(!pin||busy)return;
  const normalized=persistableOperationalPoint(pin);
  if(!normalized){setMessage(t('النقطة دي خارج نطاق سِكّة الحالي.','This point is outside current seKKa coverage.'));return;}
  const coord=normalized.latitude.toFixed(6)+', '+normalized.longitude.toFixed(6);
  const nearPlace=placePoint&&placeName&&straightLineKm(normalized,placePoint)<=0.65;
  const displayName=gpsPin?t('موقعي الحالي','My current location'):nearPlace?
   t('نقطة قرب ','Point near ')+placeName:t('نقطة محددة على الخريطة','Selected map point');
  const place:MapPlace={id:'manual:'+normalized.latitude.toFixed(6)+','+normalized.longitude.toFixed(6),
   source:'manual_map_pin',name:displayName,
   detail:coord,kind:'point',latitude:normalized.latitude,longitude:normalized.longitude,
   locality:[]};
  setBusy(true);
  try{
   const accepted=await onConfirm(place);
   if(accepted===false)setMessage(t('تعذّر تأكيد النقطة في المنطقة المختارة. جرّب نقطة أخرى.','Could not verify this point in the selected area. Choose another.'));
  }catch{
   setMessage(t('تعذّر تأكيد النقطة دلوقتي. جرّب تاني.','Could not confirm this point. Try again.'));
  }finally{setBusy(false);}
 };
 const projected=pin?mapProject(pin,zoom):null,projectedCenter=mapProject(center,zoom);
 const marker=projected?{left:dimensions.width/2+projected.x-projectedCenter.x,
  top:dimensions.height/2+projected.y-projectedCenter.y}:null;
 const allowed=Boolean(pin&&persistableOperationalPoint(pin));
 return createPortal(<dialog ref={dialogRef} className="sekka-map-picker" dir={en?'ltr':'rtl'} aria-modal="true"
  onCancel={e=>{e.preventDefault();if(searchOpen)setSearchOpen(false);else if(!busy)onCancel();}}
  aria-label={t('حدد نقطة على الخريطة','Choose point on map')}>
  <div className="sekka-map-picker__header">
   <button type="button" onClick={onCancel} disabled={busy} aria-label={t('إغلاق الخريطة','Close map')}>✕</button>
   <strong>{t('حدد نقطة على الخريطة','Choose point on map')}</strong>
   <span aria-hidden="true">⌖</span>
  </div>
  <div className="sekka-map-picker__search">
   <label htmlFor="sekka-map-place-search">{t('ابحث عن مكان','Search for a place')}</label>
   <input id="sekka-map-place-search" type="search" role="combobox"
    aria-label={t('ابحث داخل الخريطة','Search within map')} aria-autocomplete="list"
    aria-expanded={searchOpen&&search.places.length>0}
    aria-controls={searchOpen&&search.places.length?options.id:undefined}
    aria-activedescendant={searchOpen&&options.highlight>=0?options.optionId(options.highlight):undefined}
    placeholder={t('شارع، مول، مدرسة…','Street, mall, school…')} value={mapSearch}
    onFocus={()=>setSearchOpen(true)} onChange={e=>{setMapSearch(e.target.value);setSearchOpen(true);options.reset();}}
    onKeyDown={e=>options.keys(e,searchOpen,searchOpen?Math.min(6,search.places.length):0,i=>{
     focusPlace(search.places[i]);options.reset();
    },()=>setSearchOpen(false),()=>setSearchOpen(true))}/>
   {searchOpen&&<div className="sekka-map-picker__search-results">
    {search.busy&&<p role="status">{t('بنبحث عن المكان…','Searching…')}</p>}
    {search.places.length>0&&<div id={options.id} role="listbox" aria-label={t('نتائج البحث داخل الخريطة','Map search results')}>
     {search.places.slice(0,6).map((place,i)=><button key={place.id} id={options.optionId(i)} type="button" role="option"
      aria-selected={options.highlight===i} onMouseDown={e=>e.preventDefault()} onClick={()=>focusPlace(place)}>
      <strong dir="auto">{place.name}</strong><small dir="auto">{place.detail}</small>
     </button>)}
    </div>}
    {search.status==='done'&&!search.places.length&&<p role="status">{t('ملقيناش المكان. جرّب اسم تاني.','No place found. Try another name.')}</p>}
    {search.status==='error'&&<p role="status">{t('البحث مش متاح. حرّك الخريطة أو استخدم موقعي الحالي.','Search unavailable. Move the map or locate yourself.')}</p>}
   </div>}
  </div>
  <p className="sekka-map-picker__instructions">{t('اضغط على الخريطة لتحديد نقطة دقيقة.','Tap the map to choose an exact point.')}</p>
  <div className="sekka-map-picker__map" ref={mapRef} tabIndex={0}
   role="application" aria-label={t('خريطة تفاعلية. اضغط لاختيار نقطة.','Interactive map. Tap to select a point.')}
   onPointerDown={onDown} onPointerMove={onMoving} onPointerUp={onUp}
   onPointerCancel={e=>active.current.delete(e.pointerId)}
   onWheel={wheel} onKeyDown={keyboard}>
   {visibleTiles(center,zoom,dimensions.width,dimensions.height).map(tile=>
    <img key={tile.id} src={tile.url} alt="" draggable={false}
     style={{position:'absolute',left:tile.left,top:tile.top,width:256,height:256,pointerEvents:'none'}}/>
   )}
   {marker&&<div className="sekka-map-picker__pin" aria-hidden="true"
    style={{left:marker.left,top:marker.top}}>📍</div>}
   <div className="sekka-map-picker__controls">
    <button type="button" aria-label={t('تكبير','Zoom in')} onClick={()=>setZoom(z=>mapZoom(z+1))}>+</button>
    <button type="button" aria-label={t('تصغير','Zoom out')} onClick={()=>setZoom(z=>mapZoom(z-1))}>−</button>
    <button type="button" className="sekka-map-picker__locate"
     disabled={gpsBusy} aria-label={t('موقعي الحالي','My current location')}
     onClick={locateMe}>{gpsBusy?t('جاري التحديد…','Locating…'):t('📍 موقعي الحالي','📍 My location')}</button>
   </div>
   <a className="sekka-map-picker__credit" href="https://www.openstreetmap.org/copyright"
    target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
  </div>
  <div className="sekka-map-picker__footer">
   {pin?<p role="status">{allowed?t('✓ النقطة داخل نطاق سِكّة','✓ Point is within seKKa coverage'):
    t('النقطة خارج نطاق سِكّة الحالي','Point is outside current seKKa coverage')}
    <small dir="ltr">{pin.latitude.toFixed(6)}, {pin.longitude.toFixed(6)}</small></p>
    :<p>{t('اضغط على الخريطة لاختيار نقطة.','Tap the map to choose a point.')}</p>}
   {message&&<p className="sekka-map-picker__error" role="alert">{message}</p>}
   <button type="button" className="sekka-map-picker__confirm"
    onClick={()=>void confirm()} disabled={!allowed||busy}>
    {busy?t('جاري التأكيد...','Confirming...'):t('تأكيد النقطة','Confirm point')}
   </button>
  </div>
 </dialog>,document.body);
}
