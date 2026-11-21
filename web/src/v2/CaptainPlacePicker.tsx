import {useEffect,useState} from 'react';
import {greaterCairoAttribution} from './greaterCairoBoundary';
import {usePreferences} from './preferences';
import {catalogMatches,locationContext,locationContextIcon,outsideCatalogMatch,noMatchingLocation,outsideCoverageMessage,PHOTON_ATTRIBUTION,placeMatchesArea,selectOperationalMapPlace} from './geoPlace';
import {popularPlacesForArea} from './popularCaptainPlaces';
import {useLocationOptions,useLocationSearch} from './locationSearch';
import type {PlaceChoice,MapPlace,ServiceArea} from './geoPlace';
import type {PopularPlace} from './popularCaptainPlaces';
import './location-search.css';

export default function CaptainPlacePicker({label,value,choice,onPick,onVerified,disabled=false,searchArea}:{
 label:string;value:string;choice:PlaceChoice|null;
 onPick:(value:string,choice:PlaceChoice|null)=>void;
 onVerified?:(place:MapPlace)=>void;
 areas?:ServiceArea[];disabled?:boolean;searchArea?:ServiceArea;
}){
 const {language}=usePreferences(),en=language==='en';
 const t=(ar:string,english:string)=>en?english:ar;
 const [query,setQuery]=useState(value);
 const [showAll,setShowAll]=useState(false);
 const [open,setOpen]=useState(false);
 const [immediate,setImmediate]=useState(0);
 const options=useLocationOptions();
 useEffect(()=>{setQuery(value);},[value]);
 useEffect(()=>{setOpen(false);setImmediate(0);setShowAll(false);},[searchArea?.id]);
 const menu=Boolean(open&&!choice&&!disabled&&searchArea);
 const result=useLocationSearch(query,menu,searchArea,en,immediate);
 const points=result.places.filter(selectOperationalMapPlace);
 const broad=menu?locationContext(query,result.places,en,searchArea):[];
 const popularPriority:Record<PopularPlace['type'],number>={square:1,mall:2,university:3,gathering:4,neighborhood:5,mosque:6};
 const suggestions=searchArea?[...popularPlacesForArea(searchArea.name_en)].sort((a,b)=>popularPriority[a.type]-popularPriority[b.type]):[];
 const visible=showAll?suggestions:suggestions.slice(0,5);
 const catalog=menu&&query&&!result.places.length?catalogMatches(query,searchArea).filter(item=>!item.reference):[];
 const choose=(index:number)=>{
  const place=points[index];
  if(!place||!searchArea||!selectOperationalMapPlace(place)||!placeMatchesArea(place,searchArea))return;
  setQuery(place.name);setOpen(false);setImmediate(0);options.reset();
  if(onVerified)onVerified(place);
  else onPick(place.name,{kind:'map',place});
 };
 const search=(name?:string)=>{
  if(name){setQuery(name);onPick(name,null);}
  setOpen(true);setImmediate(i=>i+1);options.reset();
 };
 const error=menu&&outsideCatalogMatch(query,searchArea)&&!points.length&&!broad.length
  ?t(outsideCoverageMessage.ar,outsideCoverageMessage.en)
  :result.status==='error'
  ?t('البحث مش متاح دلوقتي. جرّب تاني.','Location search is unavailable. Try again.')
  :result.status==='done'&&!result.places.length&&!broad.length
    ?result.outside?t(outsideCoverageMessage.ar,outsideCoverageMessage.en):t(noMatchingLocation.ar,noMatchingLocation.en)
    :'';
 return <section className="cj-easy-place" aria-label={label}>
  {searchArea&&<>
   <div className="cj-easy-place-head">
    <strong>{t('أماكن معروفة في '+searchArea.name_ar,'Popular places in '+searchArea.name_en)}</strong>
    <small>{t('ابحث باسم المكان، وبعدها اختار نقطة من النتائج','Search by name, then choose a point from the results')}</small>
   </div>
   <div className="cj-easy-places">
    {visible.map(item=><button type="button" key={item.type+item.name_en}
     className="cj-easy-choice" disabled={disabled}
     aria-label={t('ابحث عن ','Find ')+t(item.name_ar,item.name_en)}
     onClick={()=>search(t(item.name_ar,item.name_en))}>
     <span>{t(item.name_ar,item.name_en)}</span><span aria-hidden="true">‹</span>
    </button>)}
   </div>
   {suggestions.length>5&&<button className="cj-easy-more" type="button"
     onClick={()=>setShowAll(x=>!x)}>{showAll?t('عرض أقل','Show fewer'):t('عرض أماكن أكتر','More places')}</button>}
  </>}
  <div className="cj-easy-search">
   <label htmlFor={options.id+'-input'}>{t('مكان تاني؟ اكتبه هنا','Another place? Search here')}</label>
   <div className="cj-easy-search-row">
    <input id={options.id+'-input'} type="search" role="combobox"
     aria-label={label} aria-expanded={menu&&points.length>0} aria-autocomplete="list"
     aria-controls={menu&&points.length?options.id:undefined}
     aria-activedescendant={menu&&options.highlight>=0&&options.highlight<points.length?options.optionId(options.highlight):undefined}
     autoComplete="off" placeholder={t('اسم شارع أو معلم مشهور','Street or landmark name')}
     value={query} disabled={disabled} maxLength={120}
     onChange={e=>{const next=e.target.value;setQuery(next);onPick(next,null);setOpen(true);setImmediate(0);options.reset();}}
     onKeyDown={e=>options.keys(e,menu,menu?points.length:0,choose,()=>setOpen(false),()=>search())}/>
    <button type="button" onClick={()=>search()} disabled={disabled||query.trim().length<3}>{t('بحث','Find')}</button>
   </div>
  </div>
  {catalog.length>0&&<div className="sekka-location-prompts">{catalog.map(item=>
   <button type="button" key={item.key} onClick={()=>search(t(item.ar,item.en))}>{t('ابحث عن ','Search for ')}{t(item.ar,item.en)}</button>)}</div>}
  {result.busy&&<p className="cj-easy-feedback" role="status">{t('بنحدد المكان…','Looking up locations…')}</p>}
  {error&&<p className="cj-easy-feedback" role="status">{error}</p>}
  {points.length>0&&<div id={options.id} className="cj-easy-results sekka-location-options" role="listbox"
    aria-label={t('اختار نقطة على الخريطة','Choose a map point')}>
   {points.map((place,i)=><button type="button" role="option" key={place.id}
     id={options.optionId(i)} aria-selected={options.highlight===i}
     onMouseDown={e=>e.preventDefault()} onClick={()=>choose(i)}>
    <span dir="auto">⌖ {place.name}</span><small dir="auto">{place.detail}</small>
   </button>)}
  </div>}
  {broad.length>0&&<ul className="sekka-location-context">
   {broad.map(place=><li key={place.id}><strong dir="auto"><span aria-hidden="true">{locationContextIcon(place)} </span>{place.name}</strong><small dir="auto">{place.detail}</small></li>)}
   <li>{t('اختار معلم محدد قريب عشان تضيف نقطة وقوف.','Choose a nearby landmark to add an exact stop.')}</li>
  </ul>}
  <small className="cj-easy-attribution">{PHOTON_ATTRIBUTION} · {greaterCairoAttribution}</small>
 </section>;
}
