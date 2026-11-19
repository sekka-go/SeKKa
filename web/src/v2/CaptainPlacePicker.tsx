import {useEffect,useRef,useState} from 'react';
import {usePreferences} from './preferences';
import {mapPlacesFromPhoton,placeMatchesArea,normalizedPlace,PHOTON_ATTRIBUTION} from './geoPlace';
import {popularPlacesForArea} from './popularCaptainPlaces';
import type {PlaceChoice,MapPlace,ServiceArea} from './geoPlace';
import type {PopularPlace} from './popularCaptainPlaces';

const sameNamedPlace=(item:PopularPlace,place:MapPlace):boolean=>{
 const result=normalizedPlace(place.name);
 const names=[item.name_en,item.name_ar].map(normalizedPlace);
 // A single verified result is auto-accepted ONLY if the place name itself
 // matches the chosen suggestion; never auto-book a nearby unrelated business.
 return result.length>=5&&names.some(name=>result===name||name.startsWith(result+' ')||result.startsWith(name+' '));
};

/** One tap on a landmark attempts a verified OSM lookup. If ambiguous, user
 * chooses a real search result. No fabricated coordinates or auto area IDs. */
export default function CaptainPlacePicker({label,value,choice,onPick,onVerified,disabled=false,searchArea}:{
 label:string;value:string;choice:PlaceChoice|null;
 onPick:(value:string,choice:PlaceChoice|null)=>void;
 onVerified?:(place:MapPlace)=>void;
 areas?:ServiceArea[];disabled?:boolean;searchArea?:ServiceArea;
}){
 const {language}=usePreferences(),en=language==='en';
 const t=(ar:string,english:string)=>en?english:ar;
 const [query,setQuery]=useState(value);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [found,setFound]=useState<MapPlace[]>([]);
 const [showAll,setShowAll]=useState(false);
 const requestSerial=useRef(0);
 useEffect(()=>{setQuery(value);},[value]);
 useEffect(()=>{
  requestSerial.current++;
  setQuery('');setFound([]);setError('');setBusy(false);setShowAll(false);
 },[searchArea?.id]);
 const suggestions=searchArea?[...popularPlacesForArea(searchArea.name_en)].sort((a,b)=>{
  const priority:Record<PopularPlace['type'],number>={square:1,mall:2,university:3,gathering:4,neighborhood:5,mosque:6};
  return priority[a.type]-priority[b.type];
 }):[];
 const visible=showAll?suggestions:suggestions.slice(0,5);
 const choose=(place:MapPlace)=>{
  requestSerial.current++;
  setFound([]);setError('');setBusy(false);
  setQuery(place.name);
  if(onVerified)onVerified(place);
  else onPick(place.name+(place.detail?' — '+place.detail:''),{kind:'map',place});
 };
 const searchMap=async(explicitQuery?:string,suggested?:PopularPlace)=>{
  const q=(explicitQuery??query).trim();
  if(q.length<3||q.length>120||!searchArea||disabled)return;
  const token=++requestSerial.current;
  setBusy(true);setError('');setFound([]);
  try{
   const url=new URL('https://photon.komoot.io/api/');
   const scoped=!([searchArea.name_ar,searchArea.name_en].some(name=>
    normalizedPlace(q).includes(normalizedPlace(name))));
   url.searchParams.set('q',scoped?q+', '+searchArea.name_en+', Egypt':q);
   url.searchParams.set('bbox','30.45,29.45,31.95,30.45');
   url.searchParams.set('countrycode','EG');url.searchParams.set('limit','12');
   if(en)url.searchParams.set('lang','en');
   const getPlaces=async(target:URL)=>{
    const response=await fetch(target.toString(),{headers:{Accept:'application/json'},
     signal:AbortSignal.timeout(9000)});
    if(!response.ok)throw Error('MAP_SEARCH_UNAVAILABLE');
    return mapPlacesFromPhoton(await response.json()).filter(p=>placeMatchesArea(p,searchArea));
   };
   let matching=await getPlaces(url);
   if(token!==requestSerial.current)return;
   if(matching.length===0&&scoped){
    const retry=new URL(url);retry.searchParams.set('q',q);
    matching=await getPlaces(retry);
   }
   if(token!==requestSerial.current)return;
   if(suggested){
    const exact=matching.filter(place=>sameNamedPlace(suggested,place));
    if(exact.length===1){choose(exact[0]);return;}
   }
   setFound(matching);
   if(!matching.length)setError(t('ملقيناش المكان ده في المنطقة. جرّب مكان قريب أو اكتب اسم تاني.',
    'We could not locate that place in this area. Try another nearby landmark.'));
  }catch{
   if(token!==requestSerial.current)return;
   setError(t('البحث مش متاح دلوقتي. جرّب تاني أو اختار مكان مختلف.',
    'Location search is unavailable. Retry or choose another place.'));
  }finally{if(token===requestSerial.current)setBusy(false);}
 };
 const selectSuggestion=(item:PopularPlace)=>{
  const display=en?item.name_en:item.name_ar;
  setQuery(display);onPick(display,null);
  void searchMap(item.name_en,item);
 };
 return <section className="cj-easy-place" aria-label={label}>
  {searchArea&&<>
   <div className="cj-easy-place-head">
    <strong>{t('اختار مكان مشهور في '+searchArea.name_ar,'Choose a place in '+searchArea.name_en)}</strong>
    <small>{t('ضغطة واحدة على المكان؛ سِكّة هتحدد موقعه','Tap a place — seKKa checks its map location')}</small>
   </div>
   <div className="cj-easy-places">
    {visible.map(item=><button type="button" key={item.type+item.name_en}
     className="cj-easy-choice" disabled={busy||disabled}
     aria-label={t('اختار ','Choose ')+(en?item.name_en:item.name_ar)}
     onClick={()=>selectSuggestion(item)}>
     <span>{en?item.name_en:item.name_ar}</span><span aria-hidden="true">‹</span>
    </button>)}
   </div>
   {suggestions.length>5&&<button className="cj-easy-more" type="button"
     onClick={()=>setShowAll(x=>!x)}>{showAll?t('عرض أقل','Show fewer'):
      t('عرض أماكن أكتر','More places')}</button>}
  </>}
  <div className="cj-easy-search">
   <label htmlFor="cj-easy-place-search">{t('مكان تاني؟ اكتبه هنا','Another place? Search here')}</label>
   <div className="cj-easy-search-row">
    <input id="cj-easy-place-search" type="search" role="combobox"
     aria-label={label} aria-expanded={found.length>0} autoComplete="off"
     placeholder={t('اسم شارع أو معلم مشهور','Street or landmark name')}
     value={query} disabled={disabled} maxLength={120}
     onChange={e=>{const next=e.target.value;requestSerial.current++;setQuery(next);
      onPick(next,null);setFound([]);setError('');setBusy(false);}}
     onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void searchMap();}}}/>
    <button type="button" onClick={()=>void searchMap()}
     disabled={disabled||busy||query.trim().length<3}>{t('بحث','Find')}</button>
   </div>
  </div>
  {busy&&<p className="cj-easy-feedback" role="status">{t('بنحدد المكان…','Locating…')}</p>}
  {error&&<p className="cj-easy-feedback" role="status">{error}</p>}
  {found.length>0&&<div className="cj-easy-results"
    role="group" aria-label={t('اختار النتيجة الصح','Choose the right location')}>
   <strong>{t('اختار الموقع الصحيح','Choose the right place')}</strong>
   {found.map(place=><button type="button" key={place.id}
     onClick={()=>choose(place)} disabled={disabled}>
    <span>{place.name}</span><small>{place.detail}</small>
   </button>)}
  </div>}
  <small className="cj-easy-attribution">{PHOTON_ATTRIBUTION}</small>
  {choice?.kind==='map'&&!onVerified&&<span role="status">
   {t('✓ الموقع اتحدد','Location selected')}</span>}
 </section>;
}
