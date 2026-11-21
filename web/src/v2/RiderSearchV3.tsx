import {useState,type FormEvent,type ReactNode} from 'react';
import GeoPlaceInput from './GeoPlaceInput';
import GeoMapPicker from './GeoMapPicker';
import PickupExplorerSheet from './PickupExplorerSheet';
import type {LiveSelection} from './LiveRouteSearch';
import type {PlaceChoice,ServiceArea} from './geoPlace';
import {usePreferences} from './preferences';
import './rider-search-v3.css';

const names={
 ar:['السبت','الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'],
 en:['Sat','Sun','Mon','Tue','Wed','Thu','Fri']
};
export default function RiderSearchV3({origin,destination,originPlace,destinationPlace,
 areas,outbound,returnTime,weekdays,onOrigin,onDestination,onSwap,onOutbound,onReturn,
 onWeekdays,onSearch,onLiveSelect,shortcuts}:{
 origin:string;destination:string;originPlace:PlaceChoice|null;destinationPlace:PlaceChoice|null;
 areas:ServiceArea[];outbound:string;returnTime:string;weekdays:number[];
 onOrigin:(name:string,choice:PlaceChoice|null)=>void;
 onDestination:(name:string,choice:PlaceChoice|null)=>void;onSwap:()=>void;
 onOutbound:(time:string)=>void;onReturn:(time:string)=>void;
 onWeekdays:(value:number[])=>void;
 onSearch:()=>void;onLiveSelect?:(selection:LiveSelection)=>void;shortcuts?:ReactNode;
}){
 const {language}=usePreferences(),en=language==='en',t=(ar:string,english:string)=>en?english:ar;
 const [nearby,setNearby]=useState(false);
 const [mapMenuOpen,setMapMenuOpen]=useState(false);
 const [mapTarget,setMapTarget]=useState<'origin'|'destination'|null>(null);
 const mapChoice=mapTarget==='origin'?originPlace:mapTarget==='destination'?destinationPlace:null;
 const mapFocus=mapChoice?.kind==='search'||mapChoice?.kind==='map'?mapChoice.place:null;
 const mapLabel=mapTarget==='origin'?origin:destination;
 const [returnOpen,setReturnOpen]=useState(Boolean(returnTime));
 const [daysOpen,setDaysOpen]=useState(Boolean(weekdays.length));
 const toggleDay=(day:number)=>onWeekdays(weekdays.includes(day)?weekdays.filter(n=>n!==day):[...weekdays,day].sort((a,b)=>a-b));
 const submit=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();onSearch();};
 const dayCount=weekdays.length;
 return <section className="rs3" aria-labelledby="rs3-title">
  <header className="rs3__head">
   <span className="rs3__eyebrow">{t('الخطوة ١ من ٣','STEP 1 OF 3')}</span>
   <h2 id="rs3-title">{t('هنوصّلك في سِكّتك','Find a ride your way')}</h2>
   <p>{t('منين، لفين، وإمتى؟ ٣ حاجات ونبدأ ندور.','Choose where and when. We’ll show actual published rides.')}</p>
  </header>
  <form className="rs3__form" onSubmit={submit}>
   <div className="rs3__section-label"><span className="rs3__number">01</span>
    <h3>{t('مشوارك منين لفين؟','Where are you travelling?')}</h3></div>
   <div className="rs3__places">
    <div className="rs3__place">
     <span className="rs3__marker rs3__marker--start" aria-hidden="true"/>
     <div className="rs3__place-content">
      <span className="rs3__label">{t('من','From')}</span>
      <GeoPlaceInput label={t('نقطة الانطلاق','Starting point')} value={origin}
       choice={originPlace} areas={areas} onPick={onOrigin}/>
     </div>
    </div>
    <button type="button" className="rs3__swap" onClick={onSwap}
     aria-label={t('بدّل مكان الانطلاق والوصول','Swap start and destination')}>
     <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 5v14m0 0-4-4m4 4 4-4M17 19V5m0 0-4 4m4-4 4 4"/>
     </svg>
    </button>
    <div className="rs3__place">
     <span className="rs3__marker rs3__marker--end" aria-hidden="true"/>
     <div className="rs3__place-content">
      <span className="rs3__label">{t('إلى','To')}</span>
      <GeoPlaceInput label={t('الوجهة','Destination')} value={destination}
       choice={destinationPlace} areas={areas} onPick={onDestination}/>
     </div>
    </div>
   </div>
   {/* Map is not a field autocomplete behavior. It requires two separate
       explicit user actions and is never mounted during ordinary typing. */}
   <div className="rs3__optional-map">
    <button type="button" className="rs3__optional-map-toggle"
     aria-expanded={mapMenuOpen} aria-controls="rs3-map-actions"
     onClick={()=>{setMapMenuOpen(value=>!value);}}>
     <span aria-hidden="true">⌖</span>
     {t('عايز تحدد نقطة بنفسك على الخريطة؟ (اختياري)',
        'Want to choose an exact point on the map? (optional)')}
    </button>
    {mapMenuOpen&&<div id="rs3-map-actions" className="rs3__optional-map-actions"
      role="group" aria-label={t('اختيار نقطة من الخريطة','Choose point from map')}>
     <button type="button" onClick={()=>setMapTarget('origin')}>
      {t('حدد الانطلاق على الخريطة','Choose origin on map')}
     </button>
     <button type="button" onClick={()=>setMapTarget('destination')}>
      {t('حدد الوصول على الخريطة','Choose destination on map')}
     </button>
    </div>}
   </div>
   {mapTarget&&<GeoMapPicker
    focus={mapFocus} focusLabel={mapLabel}
    initial={mapChoice?.kind==='map'?mapChoice.place:null}
    onCancel={()=>setMapTarget(null)}
    onConfirm={place=>{
     const selected:PlaceChoice={kind:'map',place};
     if(mapTarget==='origin')onOrigin(place.name,selected);
     else onDestination(place.name,selected);
     setMapTarget(null);setMapMenuOpen(false);
     return true;
    }}/>}
   {shortcuts}
   <div className="rs3__section-label rs3__section-label--space"><span className="rs3__number">02</span>
    <h3>{t('الوقت اللي يناسبك','Your preferred time')}</h3></div>
   <div className="rs3__times">
    <label className="rs3__time">
     <span>{t('ميعاد الذهاب','Departure')}</span>
     <input type="time" value={outbound} onChange={event=>onOutbound(event.target.value)}/>
    </label>
    <button className="rs3__return-toggle" type="button" aria-expanded={returnOpen}
     onClick={()=>{setReturnOpen(!returnOpen);if(returnOpen)onReturn('');}}>
     <span>{returnOpen?t('إخفاء العودة','Remove return'):t('هترجع في نفس الرحلة؟','Need a return trip?')}</span>
     <span aria-hidden="true">{returnOpen?'−':'+'}</span>
    </button>
    {returnOpen&&<label className="rs3__time">
     <span>{t('ميعاد العودة','Return time')}</span>
     <input type="time" value={returnTime} onChange={event=>onReturn(event.target.value)}/>
    </label>}
   </div>
   <div className="rs3__section-label rs3__section-label--space"><span className="rs3__number">03</span>
    <h3>{t('أيام مشوارك','Travel days')}</h3></div>
   <button type="button" className="rs3__days-toggle" onClick={()=>setDaysOpen(!daysOpen)}
    aria-expanded={daysOpen} aria-controls="rs3-weekdays">
    <span>{dayCount?t('اخترت ','Selected ')+new Intl.NumberFormat(en?'en-EG':'ar-EG').format(dayCount)+' '+t('أيام','days'):
     t('كل الأيام — أو حدّد أيامك','Any day — or choose preferred days')}</span>
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none"
     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 10 5 5 5-5"/></svg>
   </button>
   {daysOpen&&<div id="rs3-weekdays" className="rs3__days-panel">
    <div className="rs3__days" role="group" aria-label={t('أيام الأسبوع','Weekdays')}>
     {names[language].map((name,index)=><button type="button" key={index}
      aria-pressed={weekdays.includes(index)} onClick={()=>toggleDay(index)}>{name}</button>)}
    </div>
    <p>{t('الأيام اللي تختارها هتتحفظ عندك، لكن نتائج البحث لسه مش بتتفلتر بالأيام تلقائيًا.',
     'Your selected days are saved, but search cannot filter by weekday yet.')}</p>
   </div>}
   <button type="submit" className="rs3__submit">
    {t('شوف الرحلات المتاحة','See available rides')}
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none"
     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
     <path d="M5 12h14m-6-6 6 6-6 6"/>
    </svg>
   </button>
   <p className="rs3__truth">{t('هنعرض رحلات منشورة فعلًا؛ مش مجرد نتائج تجريبية.',
    'We only show genuinely published rides, never demo availability.')}</p>
  </form>
  <div className="rs3__pickup-link">
   <button type="button" onClick={()=>setNearby(true)}
    aria-haspopup="dialog" aria-expanded={nearby}>
    <span className="rs3__pickup-icon" aria-hidden="true">
     <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0Z"/>
      <circle cx="12" cy="10" r="3"/>
     </svg>
    </span>
    <span className="rs3__pickup-copy">
     <strong>{t('مش عارف تركب منين؟','Not sure where to board?')}</strong>
     <small>{t('اكتشف نقط الركوب الحقيقية حولك','Explore real pickup spots around you')}</small>
    </span>
    <span className="rs3__pickup-chevron" aria-hidden="true">←</span>
   </button>
  </div>
  {nearby&&<PickupExplorerSheet onClose={()=>setNearby(false)}
   onManualSearch={()=>setNearby(false)}
   onSelect={selection=>{setNearby(false);onLiveSelect?.(selection);}}/>}
 </section>;
}
