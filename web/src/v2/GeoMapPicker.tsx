import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {PointerEvent,WheelEvent,KeyboardEvent} from 'react';
import {usePreferences} from './preferences';
import {isInsideOperationalRegion,persistableOperationalPoint} from './greaterCairoBoundary';
import {localPlaceCatalog} from './locationCatalog';
import {mapProject,mapUnproject,mapMove,mapZoom,visibleTiles} from './geoMapMath';
import type {MapCoordinate} from './geoMapMath';
import type {MapPlace,ServiceArea} from './geoPlace';
import './geo-map-picker.css';

type MapPickerProps={
 initial?:MapPlace|null;
 focus?:MapCoordinate|null;
 area?:ServiceArea;
 onCancel:()=>void;
 onConfirm:(place:MapPlace)=>boolean|void|Promise<boolean|void>;
};
const CAIRO_CENTER={latitude:30.0443934,longitude:31.2357457}; // OSM way/30925727, verified Tahrir
function startingPoint(initial:MapPlace|null|undefined,focus:MapCoordinate|null|undefined,area:ServiceArea|undefined):MapCoordinate {
 if(initial&&isInsideOperationalRegion(initial))return {latitude:initial.latitude,longitude:initial.longitude};
 if(focus&&isInsideOperationalRegion(focus))return {latitude:focus.latitude,longitude:focus.longitude};
 const ref=localPlaceCatalog.find(p=>p.area===area?.name_en.toLowerCase()&&p.reference&&
  isInsideOperationalRegion(p.reference))?.reference;
 return ref?{latitude:ref.latitude,longitude:ref.longitude}:CAIRO_CENTER;
}
export default function GeoMapPicker({initial,focus,area,onCancel,onConfirm}:MapPickerProps){
 const {language}=usePreferences(),en=language==='en';
 const t=(ar:string,english:string)=>en?english:ar;
 const [center,setCenter]=useState<MapCoordinate>(()=>startingPoint(initial,focus,area));
 const [zoom,setZoom]=useState(initial?15:focus?14:area?13:11);
 const [pin,setPin]=useState<MapCoordinate|null>(initial?{latitude:initial.latitude,longitude:initial.longitude}:null);
 const [dimensions,setDimensions]=useState({width:360,height:440});
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
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
  const escape=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape'&&!busy)onCancel();};
  document.addEventListener('keydown',escape);
  return ()=>document.removeEventListener('keydown',escape);
 },[onCancel,busy]);
 const move=(dx:number,dy:number)=>setCenter(previous=>{
  const result=mapMove(previous,dx,dy,zoom);
  centerRef.current=result;
  return result;
 });
 const onDown=(event:PointerEvent<HTMLDivElement>)=>{
  if(event.button!==0||(event.target instanceof Element&&event.target.closest('button,a')))return;
  event.currentTarget.setPointerCapture(event.pointerId);
  active.current.set(event.pointerId,{x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,travel:0});
  if(active.current.size===2){
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
  if(current.travel>12||active.current.size>0)return;
  const box=event.currentTarget.getBoundingClientRect();
  const target=mapProject(centerRef.current,zoom);
  const point=mapUnproject(target.x+(event.clientX-box.left-box.width/2),
   target.y+(event.clientY-box.top-box.height/2),zoom);
  setPin(point);setMessage('');
 };
 const wheel=(event:WheelEvent<HTMLDivElement>)=>{
  event.preventDefault();
  setZoom(current=>mapZoom(current+(event.deltaY<0?1:-1)));
 };
 const keyboard=(event:KeyboardEvent<HTMLDivElement>)=>{
  const offsets:Record<string,[number,number]>={ArrowUp:[0,60],ArrowDown:[0,-60],ArrowRight:[-60,0],ArrowLeft:[60,0]};
  if(offsets[event.key]){event.preventDefault();move(...offsets[event.key]);}
  if(event.key==='Enter'){event.preventDefault();setPin(centerRef.current);setMessage('');}
 };
 const confirm=async()=>{
  if(!pin||busy)return;
  const normalized=persistableOperationalPoint(pin);
  if(!normalized){setMessage(t('النقطة دي خارج نطاق سِكّة الحالي.','This point is outside current seKKa coverage.'));return;}
  const coord=normalized.latitude.toFixed(6)+', '+normalized.longitude.toFixed(6);
  const place:MapPlace={id:'manual:'+normalized.latitude.toFixed(6)+','+normalized.longitude.toFixed(6),
   source:'manual_map_pin',name:t('نقطة محددة على الخريطة','Selected map point'),
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
 const projected=pin?mapProject(pin,zoom):null,focus=mapProject(center,zoom);
 const marker=projected?{left:dimensions.width/2+projected.x-focus.x,
  top:dimensions.height/2+projected.y-focus.y}:null;
 const allowed=Boolean(pin&&isInsideOperationalRegion(pin));
 return createPortal(<div className="sekka-map-picker" role="dialog" aria-modal="true"
  aria-label={t('حدد نقطة على الخريطة','Choose point on map')}>
  <div className="sekka-map-picker__header">
   <button type="button" onClick={onCancel} disabled={busy} aria-label={t('إغلاق الخريطة','Close map')}>✕</button>
   <strong>{t('حدد نقطة على الخريطة','Choose point on map')}</strong>
   <span aria-hidden="true">⌖</span>
  </div>
  <p className="sekka-map-picker__instructions">{t('حرّك الخريطة واضغط على النقطة المطلوبة.','Move the map and tap your desired point.')}</p>
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
    <button type="button" aria-label={t('حدد وسط الخريطة','Pin map center')}
     onClick={()=>{setPin(centerRef.current);setMessage('');}}>⌖</button>
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
 </div>,document.body);
}
