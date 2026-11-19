import {useEffect,useRef,useState} from 'react';
import {usePreferences} from './preferences';
import {mapPlacesFromPhoton,serviceMatches,placeMatchesArea,PHOTON_ATTRIBUTION} from './geoPlace';
import type {PlaceChoice,MapPlace,ServiceArea} from './geoPlace';

export default function GeoPlaceInput({label,value,choice,areas,onPick,disabled=false,searchArea}:{
 label:string;value:string;choice:PlaceChoice|null;areas:ServiceArea[];
 onPick:(value:string,choice:PlaceChoice|null)=>void;disabled?:boolean;searchArea?:ServiceArea
}){
 const {language}=usePreferences(),en=language==='en';
 const t=(ar:string,english:string)=>en?english:ar;
 const [query,setQuery]=useState(value);
 const [open,setOpen]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [found,setFound]=useState<MapPlace[]>([]);
 const requestSerial=useRef(0);
 useEffect(()=>{setQuery(choice?.kind==='service'?(en?choice.area.name_en:choice.area.name_ar):value);},[value,choice,en]);
 const local=serviceMatches(areas,query);
 const pick=(name:string,next:PlaceChoice)=>{
  requestSerial.current++;
  setQuery(name);onPick(name,next);setFound([]);setOpen(false);setError('');
 };
 const searchMap=async()=>{
  const q=query.trim();
  if(q.length<3||q.length>120)return;
  const token=++requestSerial.current;
  setBusy(true);setError('');setFound([]);setOpen(true);
  try{
   // Explicit action only (no keystroke requests). Public Photon is a
   // best-effort, fair-use staging service, never a launch SLA.
   // No Rider GPS coordinates are transmitted for search.
   const url=new URL('https://photon.komoot.io/api/');
   const scoped=Boolean(searchArea)&&![searchArea!.name_ar,searchArea!.name_en].some(name=>q.toLocaleLowerCase().includes(name.toLocaleLowerCase()));
   url.searchParams.set('q',scoped?q+', '+searchArea!.name_en+', Egypt':q);
   url.searchParams.set('bbox','30.45,29.45,31.95,30.45');
   url.searchParams.set('limit','10');
   if(en)url.searchParams.set('lang','en'); // Arabic falls back to native OSM names if not indexed.
   const response=await fetch(url.toString(),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)});
   if(!response.ok)throw Error('MAP_SEARCH_UNAVAILABLE');
   let places=mapPlacesFromPhoton(await response.json());
   // Provider locality must confirm the chosen area. A text query alone is not proof.
   // Some Photon records are ambiguous for contextual queries: retry the raw
   // street name once, but still require that the resulting locality matches.
   let matching=searchArea?places.filter(place=>placeMatchesArea(place,searchArea)):places;
   if(searchArea&&matching.length===0&&scoped){
    const fallback=new URL(url);
    fallback.searchParams.set('q',q);
    const second=await fetch(fallback.toString(),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)});
    if(second.ok){
     places=mapPlacesFromPhoton(await second.json());
     matching=places.filter(place=>placeMatchesArea(place,searchArea));
    }
   }
   if(requestSerial.current!==token)return;
   setFound(matching);
   if(!matching.length)setError(searchArea
    ?t('مش قادرين نأكد إن المكان ده داخل المنطقة المختارة. جرّب اسم شارع واضح أو معلم داخل '+searchArea.name_ar+'.',
      'No verified place found inside '+searchArea.name_en+'. Try an exact street or landmark in this area.')
    :t('مفيش مكان مطابق في القاهرة والجيزة. جرّب اسم منطقة أو شارع تاني.',
       'No matching place found in Cairo or Giza. Try a different street or district.'));
  }catch{
   if(requestSerial.current!==token)return;
   setError(t('بحث الخريطة مش متاح مؤقتًا. جرّب مرة تانية؛ مينفعش نضيف مكان من غير نتيجة مؤكدة.',
    'Map search is temporarily unavailable. Retry: a place must be verified before adding it.'));
  }finally{if(requestSerial.current===token)setBusy(false);}
 };
 return <div className="sekka-place-lookup">
  <label className="sekka-place-lookup__label">
   <span className="sr-only">{label}</span>
   <input type="search" role="combobox" aria-label={label} aria-autocomplete="list"
    aria-expanded={open} autoComplete="off" disabled={disabled}
    placeholder={label} value={query} maxLength={120}
    onFocus={()=>setOpen(true)} onChange={e=>{const next=e.target.value;setQuery(next);
      requestSerial.current++;setBusy(false);
      onPick(next,null);setFound([]);setError('');setOpen(true);
    }}
    onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);setError('');}
      if(e.key==='Enter'&&open&&local.length>0){e.preventDefault();
       const area=local[0];pick(area.name_ar,{kind:'service',area});
      }
    }}/>
  </label>
  {choice&&<span className="sekka-place-lookup__selected">{choice.kind==='map'?
    t('📍 مكان محدد على الخريطة · © OpenStreetMap','📍 Map place selected · © OpenStreetMap'):
    t('✓ منطقة خدمة مسجلة','✓ Registered service area')}</span>}
  {open&&query.trim().length>0&&<div className="sekka-place-lookup__suggestions" role="group"
    aria-label={t('نتائج البحث عن المكان','Place search suggestions')}>
   {local.map(area=><button type="button" key={area.id} disabled={disabled}
    onClick={()=>pick(area.name_ar,{kind:'service',area})}>
    <span>{en?area.name_en:area.name_ar}</span>
    <small>{t('منطقة خدمة','Service area')}</small>
   </button>)}
   {found.map(place=><button type="button" key={place.id} disabled={disabled}
    onClick={()=>pick(place.name+(place.detail?' — '+place.detail:''),{kind:'map',place})}>
    <span>{place.name}</span><small>{place.detail||t('موقع من الخريطة','Map location')} · GPS</small>
   </button>)}
   <button type="button" className="sekka-place-lookup__map-search"
    disabled={busy||query.trim().length<3} onClick={()=>void searchMap()}>
    {busy?t('جارٍ البحث في الخريطة…','Searching map…'):
     t('ابحث عن الشارع أو المكان على الخريطة','Find this street or place on the map')}
   </button>
   {error&&<p role="status">{error}</p>}
   <small className="sekka-place-lookup__attribution">{PHOTON_ATTRIBUTION}</small>
  </div>}
  {!open&&query&& !choice&&<p className="sekka-place-lookup__hint">{t(
   'اختار نتيجة من البحث قبل المتابعة. الكتابة وحدها مش بتحدد نقطة ركوب.',
   'Choose a search result before continuing. Typing alone does not confirm a pickup point.')}</p>}
 </div>;
}
