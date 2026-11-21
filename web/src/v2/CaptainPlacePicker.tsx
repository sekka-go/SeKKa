import {useEffect,useRef,useState} from 'react';
import {usePreferences} from './preferences';
import {catalogMatches,locationContext,locationContextIcon,noMatchingLocation,mapPlacesFromPhoton,selectOperationalMapPlace,isSearchableMapPlace} from './geoPlace';
import {useLocationOptions,useLocationSearch,photonEndpoint} from './locationSearch';
import {straightLineKm} from './nearbyRoutes';
import GeoMapPicker from './GeoMapPicker';
import type {PlaceChoice,MapPlace} from './geoPlace';
import './location-search.css';

export default function CaptainPlacePicker({label,value,choice,onPick,onVerified,disabled=false}:{
 label:string;value:string;choice:PlaceChoice|null;
 onPick:(value:string,choice:PlaceChoice|null)=>void;
 onVerified?:(place:MapPlace)=>boolean;
 disabled?:boolean;
}){
 const {language}=usePreferences(),en=language==='en';
 const t=(ar:string,english:string)=>en?english:ar;
 const [query,setQuery]=useState(value);
 const [open,setOpen]=useState(false);
 const [immediate,setImmediate]=useState(0);
 const [mapOpen,setMapOpen]=useState(false);
 const inputRef=useRef<HTMLInputElement|null>(null);
 const shellRef=useRef<HTMLElement|null>(null);
 useEffect(()=>{
  const close=(event:Event)=>{if(event.target instanceof Node&&!shellRef.current?.contains(event.target))setOpen(false);};
  document.addEventListener('pointerdown',close,true);
  return ()=>document.removeEventListener('pointerdown',close,true);
 },[]);
 const options=useLocationOptions();
 useEffect(()=>{setQuery(value);},[value]);
 const menu=Boolean(open&&!choice&&!disabled);
 // Same wide-area search index as the Rider; area-selection is optional.
 const result=useLocationSearch(query,menu,undefined,en,immediate);
 const seen=new Set<string>();
 const points=(menu?[...result.places,...locationContext(query,result.places,en)]:[])
  .filter(place=>{
   if(!isSearchableMapPlace(place)||seen.has(place.id))return false;
   seen.add(place.id);return true;
  }).slice(0,12);
 const catalog=menu&&query&&!points.length?catalogMatches(query).filter(item=>!item.reference):[];
 const choose=(index:number)=>{
  const place=points[index];
  if(!place)return;
  inputRef.current?.blur();
  setOpen(false);setImmediate(0);options.reset();
  if(onVerified){
   // The selected stop is immediately appended by the parent. Clear the
   // local combobox directly: parent updates may batch back to the same value.
   if(!selectOperationalMapPlace(place)){
    setQuery(place.name);onPick(place.name,{kind:'search',place});return;
   }
   if(onVerified(place))setQuery('');
  }else{
   setQuery(place.name);onPick(place.name,{kind:'search',place});
  }
 };
 const verifyMapPin=async (place:MapPlace):Promise<boolean>=>{
  try{
   const url=new URL('/reverse',photonEndpoint);
   url.searchParams.set('lat',String(place.latitude));
   url.searchParams.set('lon',String(place.longitude));
   url.searchParams.set('limit','10');
   const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(7000)});
   if(!response.ok)return false;
   const nearby=mapPlacesFromPhoton(await response.json()).find(candidate=>
    straightLineKm(candidate,place)<=0.35);
   if(!nearby)return false;
   const verified={...place,name:t('نقطة قرب ','Point near ')+nearby.name,detail:nearby.detail,locality:nearby.locality};
   if(onVerified){if(!onVerified(verified))return false;setQuery('');}
   else {setQuery(verified.name);onPick(verified.name,{kind:'map',place:verified});}
   setMapOpen(false);setOpen(false);return true;
  }catch{return false;}
 };
 const search=(name?:string)=>{
  if(name){setQuery(name);onPick(name,null);}
  setOpen(true);setImmediate(i=>i+1);options.reset();
 };
 const error=menu&&result.status==='error'&&!points.length
  ?t('تعذّر البحث مؤقتًا. جرّب الاسم تاني.','Place search is temporarily unavailable. Try again.')
  :menu&&result.status==='done'&&!points.length
  ?t(noMatchingLocation.ar,noMatchingLocation.en):'';
 return <section ref={shellRef} className="cj-easy-place" aria-label={label}>
  {choice?.kind==='search'&&<p role="status">{t('اختار مدخل أو نقطة ركوب محددة على الخريطة.','Choose an entrance or an exact boarding point on the map.')}</p>}
  {!menu&&<button type="button" className="cj-easy-map-button"
   disabled={disabled} onClick={()=>{inputRef.current?.blur();setMapOpen(true);setOpen(false);}}>
   <span aria-hidden="true">⌖</span>{t('اختيار على الخريطة (اختياري)','Choose on map (optional)')}
  </button>}
  <div className="cj-easy-search">
   <label htmlFor={options.id+'-input'}>{t('ابحث عن محطة: منطقة، شارع، مول، جامعة أو مدرسة','Find a stop: area, street, mall, university or school')}</label>
   <div className="cj-easy-search-row">
    <input ref={inputRef} id={options.id+'-input'} type="search" role="combobox"
     aria-label={label} aria-expanded={menu&&points.length>0} aria-autocomplete="list"
     aria-controls={menu&&points.length?options.id:undefined}
     aria-activedescendant={menu&&options.highlight>=0&&options.highlight<points.length?options.optionId(options.highlight):undefined}
     autoComplete="off" placeholder={t('اكتب اسم المكان...','Start typing a place name...')}
     value={query} disabled={disabled} maxLength={120}
     onChange={e=>{const next=e.target.value;setQuery(next);onPick(next,null);setOpen(true);setImmediate(0);options.reset();}}
     onKeyDown={e=>options.keys(e,menu,menu?points.length:0,choose,()=>setOpen(false),()=>search())}/>

   </div>
  </div>
  {catalog.length>0&&<div className="sekka-location-prompts">{catalog.map(item=>
   <button type="button" key={item.key} onClick={()=>search(t(item.ar,item.en))}>{t('ابحث عن ','Search for ')}{t(item.ar,item.en)}</button>)}</div>}
  {result.busy&&<p className="cj-easy-feedback" role="status">{t('بنحدد المكان…','Looking up locations…')}</p>}
  {error&&<p className="cj-easy-feedback" role="status">{error}</p>}
  {points.length>0&&<div id={options.id} className="cj-easy-results sekka-location-options" role="listbox"
    aria-label={t('اقتراحات الأماكن','Place suggestions')}>
   {points.map((place,i)=><button type="button" role="option" key={place.id}
     id={options.optionId(i)} aria-selected={options.highlight===i}
     onMouseDown={e=>e.preventDefault()} onClick={()=>choose(i)}>
    <span dir="auto">{locationContextIcon(place)} {place.name}</span><small dir="auto">{place.detail}</small>
   </button>)}
  </div>}
  {mapOpen&&<GeoMapPicker focus={choice?.kind==='search'?choice.place:null}
   focusLabel={query} initial={choice?.kind==='map'?choice.place:null} onCancel={()=>setMapOpen(false)}
   onConfirm={verifyMapPin}/>}
 </section>;
}
