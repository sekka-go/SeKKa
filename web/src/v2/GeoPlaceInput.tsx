import {useEffect,useRef,useState} from 'react';
import {usePreferences} from './preferences';
import {mapPlacesFromPhoton,serviceMatches,placeMatchesArea,PHOTON_ATTRIBUTION} from './geoPlace';
import {filterPopularPlaces,popularPlacesForArea,popularPlaceTypes} from './popularCaptainPlaces';
import type {PlaceChoice,MapPlace,ServiceArea} from './geoPlace';
import type {PopularPlace,PopularPlaceType} from './popularCaptainPlaces';

const types:Record<PopularPlaceType,{ar:string;en:string;icon:string}>={
 neighborhood:{ar:'أحياء وشوارع',en:'Districts',icon:'⌂'},
 square:{ar:'ميادين',en:'Squares',icon:'◎'},
 university:{ar:'جامعات',en:'Universities',icon:'▤'},
 mall:{ar:'مولات',en:'Malls',icon:'▦'},
 mosque:{ar:'مساجد',en:'Mosques',icon:'◇'},
 gathering:{ar:'تجمعات ومعالم',en:'Landmarks',icon:'⌖'}
};

/** Area → popular place → verified OSM coordinate. Suggested places are NOT
 * pre-approved GPS coordinates. The rider will only see an explicit map result
 * that the Captain selects after the locality validation.
 */
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
 const [type,setType]=useState<PopularPlaceType|'all'>('all');
 const [expanded,setExpanded]=useState(false);
 const requestSerial=useRef(0);
 useEffect(()=>{
  setQuery(choice?.kind==='service'?(en?choice.area.name_en:choice.area.name_ar):value);
 },[value,choice,en]);
 useEffect(()=>{
  requestSerial.current++;
  setFound([]);setError('');setBusy(false);setOpen(false);
  setExpanded(false);setType('all');
 },[searchArea?.id]);
 const local=serviceMatches(areas,query);
 const suggestions=searchArea?popularPlacesForArea(searchArea.name_en):[];
 const visibleSuggestions=filterPopularPlaces(suggestions,type);
 const shownSuggestions=expanded?visibleSuggestions:visibleSuggestions.slice(0,6);
 const pick=(name:string,next:PlaceChoice)=>{
  requestSerial.current++;
  setQuery(name);onPick(name,next);setFound([]);setOpen(false);setError('');setBusy(false);
 };
 const searchMap=async(explicitQuery?:string)=>{
  const q=(explicitQuery??query).trim();
  if(q.length<3||q.length>120||disabled)return;
  const token=++requestSerial.current;
  setBusy(true);setError('');setFound([]);setOpen(true);
  try{
   // One deliberate request per click (plus one fallback if needed).
   // Photon is a fair-use OpenStreetMap service, not a production SLA.
   const url=new URL('https://photon.komoot.io/api/');
   const areaInQuery=searchArea&&[searchArea.name_ar,searchArea.name_en].some(name=>
    q.toLocaleLowerCase().includes(name.toLocaleLowerCase()));
   const contextual=Boolean(searchArea&&!areaInQuery);
   url.searchParams.set('q',contextual?q+', '+searchArea!.name_en+', Egypt':q);
   url.searchParams.set('bbox','30.45,29.45,31.95,30.45');
   url.searchParams.set('countrycode','EG');
   url.searchParams.set('limit','12');
   if(en)url.searchParams.set('lang','en');
   const response=await fetch(url.toString(),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)});
   if(!response.ok)throw Error('MAP_SEARCH_UNAVAILABLE');
   let places=mapPlacesFromPhoton(await response.json());
   if(requestSerial.current!==token)return;
   let matching=searchArea?places.filter(place=>placeMatchesArea(place,searchArea)):places;
   if(searchArea&&matching.length===0&&contextual){
    const fallback=new URL(url);fallback.searchParams.set('q',q);
    const second=await fetch(fallback.toString(),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)});
    if(second.ok)places=mapPlacesFromPhoton(await second.json());
    matching=places.filter(place=>placeMatchesArea(place,searchArea));
   }
   if(requestSerial.current!==token)return;
   setFound(matching);
   if(!matching.length)setError(searchArea
    ?t('مفيش موقع اتأكد داخل '+searchArea.name_ar+'. جرّب اسم المكان بالإنجليزي، أو شارع قريب منه، أو اختار اقتراح تاني.',
       'No verified location in '+searchArea.name_en+'. Try the English name, a nearby street or another suggestion.')
    :t('مفيش مكان مطابق في القاهرة والجيزة. جرّب اسم مختلف.',
       'No matching place in Cairo or Giza. Try another name.'));
  }catch{
   if(requestSerial.current!==token)return;
   setError(t('البحث على الخريطة مش متاح دلوقتي. جرّب تاني؛ مش هنضيف مكان من غير موقع مؤكد.',
    'Map search is temporarily unavailable. Retry; we cannot add an unverified location.'));
  }finally{if(requestSerial.current===token)setBusy(false);}
 };
 const lookupSuggestion=(item:PopularPlace)=>{
  const display=en?item.name_en:item.name_ar;
  setQuery(display);
  onPick(display,null);
  // The title is a search prompt. Never auto-confirm the first search result.
  void searchMap(item.name_en);
 };
 return <div className="sekka-place-lookup cj-place-picker">
  {searchArea&&suggestions.length>0&&<section className="cj-popular" aria-label={t('أماكن مشهورة','Popular places')}>
   <div className="cj-popular-heading">
    <strong>{t('أماكن معروفة في '+searchArea.name_ar,'Popular places in '+searchArea.name_en)}</strong>
    <small>{t('اختار نوع المكان، وبعدها حدده من نتائج الخريطة','Choose a category, then confirm a map result')}</small>
   </div>
   <div className="cj-popular-types" role="group" aria-label={t('نوع المكان','Place type')}>
    <button type="button" aria-pressed={type==='all'} onClick={()=>{setType('all');setExpanded(false);}}>
     {t('الكل','All')}</button>
    {popularPlaceTypes.map(key=><button key={key} type="button" aria-pressed={type===key}
      onClick={()=>{setType(key);setExpanded(true);}}>
      <span aria-hidden="true">{types[key].icon}</span> {en?types[key].en:types[key].ar}</button>)}
   </div>
   <div className="cj-popular-grid">
    {shownSuggestions.map(item=><button key={item.type+item.name_en} type="button"
      disabled={disabled||busy} className="cj-popular-place" onClick={()=>lookupSuggestion(item)}
      aria-label={t('ابحث عن ','Find ')+(en?item.name_en:item.name_ar)}>
      <span className="cj-popular-place-icon" aria-hidden="true">{types[item.type].icon}</span>
      <span className="cj-popular-place-copy"><strong>{en?item.name_en:item.name_ar}</strong>
       <small>{en?types[item.type].en:types[item.type].ar}</small></span>
    </button>)}
   </div>
   {!expanded&&visibleSuggestions.length>6&&<button className="cj-popular-more" type="button"
     onClick={()=>setExpanded(true)}>{t('عرض كل الأماكن','View all places')} ({visibleSuggestions.length})</button>}
   <p className="cj-popular-note">{t('دي اقتراحات للبحث، مش نقاط GPS محفوظة. هتختار المكان الصحيح من نتائج OpenStreetMap.',
     'These are search suggestions, not stored GPS points. Confirm the correct OpenStreetMap result.')}</p>
  </section>}
  <label className="sekka-place-lookup__label">
   <span className="sr-only">{label}</span>
   <input type="search" role="combobox" aria-label={label} aria-autocomplete="list"
    aria-expanded={open} autoComplete="off" disabled={disabled}
    placeholder={t('أو اكتب اسم شارع، مسجد، جامعة، مول…','Or search street, mosque, university, mall…')}
    value={query} maxLength={120}
    onFocus={()=>setOpen(true)} onChange={e=>{
     const next=e.target.value;setQuery(next);requestSerial.current++;
     setBusy(false);onPick(next,null);setFound([]);setError('');setOpen(true);
    }}
    onKeyDown={e=>{
     if(e.key==='Escape'){setOpen(false);setError('');}
     if(e.key==='Enter'){
      e.preventDefault();
      if(open&&local.length){const area=local[0];pick(area.name_ar,{kind:'service',area});}
      else if(query.trim().length>=3)void searchMap();
     }
    }}/>
  </label>
  {choice&&<span className="sekka-place-lookup__selected">{choice.kind==='map'?
    t('✓ موقع تم تحديده من خريطة OpenStreetMap','✓ Verified location selected · OpenStreetMap'):
    t('✓ منطقة خدمة مسجلة','✓ Registered service area')}</span>}
  {(open&&query.trim().length>0||busy||Boolean(error))&&<div className="sekka-place-lookup__suggestions"
    role="group" aria-label={t('نتائج البحث عن المكان','Place search suggestions')}>
   {local.map(area=><button type="button" key={area.id} disabled={disabled}
    onClick={()=>pick(area.name_ar,{kind:'service',area})}>
    <span>{en?area.name_en:area.name_ar}</span>
    <small>{t('منطقة خدمة','Service area')}</small>
   </button>)}
   {found.map(place=><button type="button" key={place.id} disabled={disabled}
    onClick={()=>pick(place.name+(place.detail?' — '+place.detail:''),{kind:'map',place})}>
    <span>⌖ {place.name}</span><small>{place.detail||t('موقع من الخريطة','Map location')} · OSM</small>
   </button>)}
   {busy&&<p role="status" className="cj-place-loading">{t('بنجيب الأماكن من OpenStreetMap…','Looking up locations on OpenStreetMap…')}</p>}
   <button type="button" className="sekka-place-lookup__map-search"
    disabled={busy||disabled||query.trim().length<3} onClick={()=>void searchMap()}>
    {busy?t('جارٍ البحث في الخريطة…','Searching map…'):
     t('ابحث عن الشارع أو المكان على الخريطة','Find this street or place on the map')}
   </button>
   {error&&<p role="status" className="cj-place-error">{error}</p>}
   <small className="sekka-place-lookup__attribution">{PHOTON_ATTRIBUTION}</small>
  </div>}
  {!open&&query&&!choice&&<p className="sekka-place-lookup__hint">{t(
   'اختار نتيجة حقيقية من الخريطة قبل المتابعة؛ الكتابة وحدها مش بتحدد مكان الركوب.',
   'Select a real map result before continuing. Typing alone does not confirm a stop.')}</p>}
 </div>;
}
