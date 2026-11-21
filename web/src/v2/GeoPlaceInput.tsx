import {useEffect,useRef,useState} from 'react';
import {usePreferences} from './preferences';
import {catalogMatches,locationContext,locationContextIcon,outsideCatalogMatch,noMatchingLocation,outsideCoverageMessage,isSearchableMapPlace,serviceMatches} from './geoPlace';
import {useLocationOptions,useLocationSearch} from './locationSearch';
import type {PlaceChoice,ServiceArea,MapPlace} from './geoPlace';
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
 const options=useLocationOptions();
 const inputRef=useRef<HTMLInputElement|null>(null);
 const shellRef=useRef<HTMLDivElement|null>(null);
 // Touch can blur the input before its suggestion button receives a click.
 // Outside-pointer and outside-focus dismissal preserves the original touch
 // target instead of collapsing the menu onto the optional map button.
 useEffect(()=>{
  const dismiss=(event:Event)=>{
   const target=event.target;
   if(target instanceof Node&&!shellRef.current?.contains(target))setOpen(false);
  };
  document.addEventListener('pointerdown',dismiss,true);
  document.addEventListener('focusin',dismiss,true);
  return ()=>{
   document.removeEventListener('pointerdown',dismiss,true);
   document.removeEventListener('focusin',dismiss,true);
  };
 },[]);
 useEffect(()=>{setQuery(choice?.kind==='service'?t(choice.area.name_ar,choice.area.name_en):value);},[value,choice,en]);
 const menu=open&&!disabled&&!choice&&Boolean(query.trim());
 const result=useLocationSearch(query.trim(),menu,searchArea,en,immediate);
 const local=menu?serviceMatches(areas,query):[];
 const hints=menu?catalogMatches(query,searchArea).filter(hint=>!hint.reference&&areas.some(area=>area.name_en.toLowerCase()===hint.area)):[];
 // Typed names are SEARCH anchors; the Captain's published nearby stop is the
 // actual pickup. No map modal or arbitrary stop coordinates are required.
 const broad=menu?locationContext(query,result.places,en,searchArea):[];
 const seenPlaces=new Set<string>();
 const foundPlaces=[...result.places,...broad].filter(place=>{
  if(!isSearchableMapPlace(place)||seenPlaces.has(place.id))return false;
  seenPlaces.add(place.id);return true;
 }).slice(0,10);
 const areasToPick=local;
 const categoryLabel=(place:MapPlace)=>{
  const kind=place.osmValue;
  return kind==='mall'?t('مول / مركز تسوق','Shopping mall'):
   kind==='school'?t('مدرسة','School'):
   ['kindergarten','childcare','nursery'].includes(kind??'')?t('حضانة','Nursery'):
   ['university','college'].includes(kind??'')?t('جامعة / كلية','University / college'):
   ['office','commercial','business'].includes(kind??'')?t('منطقة أعمال','Business district'):'';
 };
 const picks:PlaceChoice[]=[...areasToPick.map(area=>({kind:'service' as const,area})),
  ...foundPlaces.map(place=>({kind:'search' as const,place}))];
 const pick=(i:number)=>{
  const next=picks[i];
  if(!next)return;
  const name=next.kind==='service'?next.area.name_ar:next.place.name;
  inputRef.current?.blur();
  setQuery(name);onPick(name,next);setOpen(false);setImmediate(0);options.reset();
 };
 const search=()=>{setOpen(true);setImmediate(i=>i+1);};
 const msg=menu&&outsideCatalogMatch(query,searchArea)&&!picks.length
  ?t(outsideCoverageMessage.ar,outsideCoverageMessage.en)
  :result.status==='error'&&!picks.length
  ?t('تعذّر البحث الخارجي مؤقتًا. جرّب اسم منطقة تانية.','External location lookup is temporarily unavailable. Try another area.')
  :result.status==='done'&&!picks.length
    ?result.outside?t(outsideCoverageMessage.ar,outsideCoverageMessage.en):
     t(noMatchingLocation.ar,noMatchingLocation.en):'';
 return <div ref={shellRef} className="sekka-place-lookup">
  <label className="sekka-place-lookup__label">
   <span className="sr-only">{label}</span>
   <input ref={inputRef} type="search" role="combobox" aria-label={label} aria-autocomplete="list"
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
  {choice&&choice.kind!=='search'&&<span className="sekka-place-lookup__selected">{choice.kind==='map'
    ?t('✓ نقطة محددة على الخريطة','✓ Selected map point')
    :t('✓ منطقة خدمة مسجلة','✓ Registered service area')}</span>}
  {menu&&<div className="sekka-place-lookup__suggestions" role="group"
    aria-label={t('نتائج البحث عن المكان','Place search suggestions')}>
   {picks.length>0&&<div className="sekka-location-options" id={options.id} role="listbox" aria-label={label}>
    {picks.map((item,i)=><button type="button" role="option" key={item.kind==='service'?'area-'+item.area.id:item.place.id}
     id={options.optionId(i)} aria-selected={options.highlight===i}
     onMouseDown={e=>e.preventDefault()} onClick={()=>pick(i)}>
     {item.kind==='service'?<><span>{t(item.area.name_ar,item.area.name_en)}</span>
      <small>{t('بحث في منطقة الخدمة بالكامل','Search the whole service area')}</small></>
      :<><span dir="auto">{locationContextIcon(item.place)} {item.place.name}</span>
       <small dir="auto">{[categoryLabel(item.place),item.place.detail].filter(Boolean).join(' · ')}</small></>}
    </button>)}
   </div>}
   {!result.places.length&&hints.length>0&&<div className="sekka-location-prompts">
    {hints.map(item=><button type="button" key={item.key} onClick={()=>{
     const name=t(item.ar,item.en);
     setQuery(name);onPick(name,null);search();options.reset();
    }}>{t('ابحث عن ','Search for ')}{t(item.ar,item.en)}</button>)}
   </div>}
   {result.busy&&<p role="status">{t('بنجيب الأماكن من OpenStreetMap…','Looking up places on OpenStreetMap…')}</p>}
   {msg&&<p role="status" className="cj-place-error">{msg}</p>}
  </div>}

 </div>;
}
