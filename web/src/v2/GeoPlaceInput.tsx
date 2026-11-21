import {useEffect,useState} from 'react';
import {usePreferences} from './preferences';
import {catalogMatches,exactCatalogMatches,locationContext,locationContextIcon,outsideCatalogMatch,noMatchingLocation,outsideCoverageMessage,selectOperationalMapPlace,serviceMatches,placeMatchesArea} from './geoPlace';
import {useLocationOptions,useLocationSearch} from './locationSearch';
import type {PlaceChoice,ServiceArea} from './geoPlace';
import GeoMapPicker from './GeoMapPicker';
import './location-search.css';

export default function GeoPlaceInput({label,value,choice,areas,onPick,disabled=false,searchArea}:{
 label:string;value:string;choice:PlaceChoice|null;areas:ServiceArea[];
 onPick:(value:string,choice:PlaceChoice|null)=>void;disabled?:boolean;searchArea?:ServiceArea
}){
 const {language}=usePreferences(),en=language==='en';
 const t=(ar:string,english:string)=>en?english:ar;
 const [query,setQuery]=useState(value);
 const [open,setOpen]=useState(false);
 const [immediate,setImmediate]=useState(0);
 const [mapOpen,setMapOpen]=useState(false);
 const [mapFocus,setMapFocus]=useState<{latitude:number;longitude:number}|null>(null);
 const options=useLocationOptions();
 useEffect(()=>{setQuery(choice?.kind==='service'?t(choice.area.name_ar,choice.area.name_en):value);},[value,choice,en]);
 const menu=open&&!disabled&&!choice&&Boolean(query.trim());
 const result=useLocationSearch(query.trim(),menu,searchArea,en,immediate);
 const local=menu?serviceMatches(areas,query):[];
 const hints=menu?catalogMatches(query,searchArea).filter(hint=>!hint.reference&&areas.some(area=>area.name_en.toLowerCase()===hint.area)):[];
 const points=result.places.filter(selectOperationalMapPlace);
 const broad=menu?locationContext(query,result.places,en,searchArea):[];
 // An exact landmark can offer its one registered parent as an explicit
 // whole-area search. It never carries the landmark's representative GPS.
 const parentKeys=new Set(exactCatalogMatches(query,searchArea)
  .filter(item=>broad.some(place=>place.catalogKey===item.key)).map(item=>item.area));
 const parent=parentKeys.size===1?areas.find(area=>parentKeys.has(area.name_en.toLowerCase())):undefined;
 const areasToPick=parent&&!local.some(area=>area.id===parent.id)?[...local,parent]:local;
 const picks:PlaceChoice[]=[...areasToPick.map(area=>({kind:'service' as const,area})),
  ...points.map(place=>({kind:'map' as const,place}))];
 const pick=(i:number)=>{
  const next=picks[i];
  if(!next||(next.kind==='map'&&!selectOperationalMapPlace(next.place)))return;
  const name=next.kind==='service'?next.area.name_ar:next.place.name;
  setQuery(name);onPick(name,next);setOpen(false);setImmediate(0);options.reset();
 };
 const search=()=>{setOpen(true);setImmediate(i=>i+1);};
 const msg=menu&&outsideCatalogMatch(query,searchArea)&&!picks.length&&!broad.length
  ?t(outsideCoverageMessage.ar,outsideCoverageMessage.en)
  :result.status==='error'
  ?t('البحث على الخريطة مش متاح دلوقتي. جرّب تاني.','Map search is temporarily unavailable. Try again.')
  :result.status==='done'&&!picks.length&&!broad.length
    ?t(noMatchingLocation.ar,noMatchingLocation.en):'';
 return <div className="sekka-place-lookup" onBlur={e=>{
  if(!e.currentTarget.contains(e.relatedTarget)){setOpen(false);options.reset();}
 }}>
  <label className="sekka-place-lookup__label">
   <span className="sr-only">{label}</span>
   <input type="search" role="combobox" aria-label={label} aria-autocomplete="list"
    aria-expanded={menu&&picks.length>0} aria-controls={menu&&picks.length?options.id:undefined}
    aria-activedescendant={menu&&options.highlight>=0&&options.highlight<picks.length?options.optionId(options.highlight):undefined}
    autoComplete="off" disabled={disabled}
    placeholder={t('اكتب اسم منطقة أو شارع أو معلم','Search for a district, street or landmark')}
    value={query} maxLength={120} onFocus={()=>setOpen(true)}
    onChange={e=>{
     const next=e.target.value;
     setQuery(next);onPick(next,null);setImmediate(0);setOpen(true);options.reset();
    }}
    onKeyDown={e=>options.keys(e,menu,menu?picks.length:0,pick,()=>setOpen(false),search)}/>
  </label>
  {choice&&<span className="sekka-place-lookup__selected">{choice.kind==='map'?
    choice.place.source==='manual_map_pin'?t('✓ نقطة محددة على الخريطة','✓ Selected map point'):t('✓ موقع محدد','✓ Selected location'):
    t('✓ منطقة خدمة مسجلة','✓ Registered service area')}</span>}
  {menu&&<div className="sekka-place-lookup__suggestions" role="group"
    aria-label={t('نتائج البحث عن المكان','Place search suggestions')}>
   {picks.length>0&&<div className="sekka-location-options" id={options.id} role="listbox" aria-label={label}>
    {picks.map((item,i)=><button type="button" role="option" key={item.kind==='service'?'area-'+item.area.id:item.place.id}
     id={options.optionId(i)} aria-selected={options.highlight===i}
     onMouseDown={e=>e.preventDefault()} onClick={()=>pick(i)}>
     {item.kind==='service'?<><span>{t(item.area.name_ar,item.area.name_en)}</span>
      <small>{t('بحث في منطقة الخدمة بالكامل','Search the whole service area')}</small></>
      :<><span dir="auto">⌖ {item.place.name}</span><small dir="auto">{item.place.detail}</small></>}
    </button>)}
   </div>}
   {!result.places.length&&hints.length>0&&<div className="sekka-location-prompts">
    {hints.map(item=><button type="button" key={item.key} onClick={()=>{
     const name=t(item.ar,item.en);
     setQuery(name);onPick(name,null);search();options.reset();
    }}>{t('ابحث عن ','Search for ')}{t(item.ar,item.en)}</button>)}
   </div>}
   {broad.length>0&&<ul className="sekka-location-context">
    {broad.map(place=>{
     const matches=areas.filter(area=>placeMatchesArea(place,area));
     const registered=matches.length===1?matches[0]:null;
     return <li key={place.id}>
      {registered?<button type="button" className="sekka-location-context__select"
       onMouseDown={event=>event.preventDefault()} onClick={()=>{
        setQuery(registered.name_ar);onPick(registered.name_ar,{kind:'service',area:registered});
        setOpen(false);options.reset();
       }}>
       <strong dir="auto"><span aria-hidden="true">{locationContextIcon(place)} </span>{place.name}</strong>
       <small dir="auto">{place.detail}</small>
       <small>{t('بحث عن رحلات في '+registered.name_ar,'Search trips in '+registered.name_en)}</small>
      </button>:<>
       <strong dir="auto"><span aria-hidden="true">{locationContextIcon(place)} </span>{place.name}</strong>
       <small dir="auto">{place.detail}</small>
       <small>{t('حدد نقطة دقيقة على الخريطة للبحث هنا','Choose an exact map point to search here')}</small>
      </>}
     </li>;
    })}
   </ul>}
   {result.busy&&<p role="status">{t('بنجيب الأماكن من OpenStreetMap…','Looking up places on OpenStreetMap…')}</p>}
   {msg&&<p role="status" className="cj-place-error">{msg}</p>}
  </div>}
  <button type="button" className="sekka-place-lookup__map-search"
   disabled={disabled} onClick={()=>{setMapFocus(broad[0]??result.places[0]??null);setMapOpen(true);setOpen(false);}}>
   <span aria-hidden="true">⌖</span>{t('حدد نقطة على الخريطة','Choose point on map')}
  </button>
  {mapOpen&&<GeoMapPicker area={searchArea} focus={mapFocus}
   initial={choice?.kind==='map'?choice.place:null} onCancel={()=>setMapOpen(false)}
   onConfirm={place=>{const selected={kind:'map' as const,place};
    setQuery(place.name);onPick(place.name,selected);setMapOpen(false);setOpen(false);return true;}}/>}
 </div>;
}
