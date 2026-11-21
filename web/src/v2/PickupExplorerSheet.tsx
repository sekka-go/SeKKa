import {useEffect,useRef} from 'react';
import NearbyRides from './NearbyRides';
import type {LiveSelection} from './LiveRouteSearch';
import {usePreferences} from './preferences';
import './pickup-explorer-sheet.css';

/** One shared, reversible pickup-choice surface for Home and Search. */
export default function PickupExplorerSheet({onClose,onSelect,onManualSearch}:{
 onClose:()=>void;onSelect:(selection:LiveSelection)=>void;onManualSearch:()=>void;
}){
 const {language}=usePreferences(),en=language==='en',t=(ar:string,english:string)=>en?english:ar;
 const closeRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const priorOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  closeRef.current?.focus();
  const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};
  document.addEventListener('keydown',onKey);
  return()=>{
   document.removeEventListener('keydown',onKey);
   document.body.style.overflow=priorOverflow;
   previous?.focus();
  };
 },[onClose]);
 return <div className="np4-overlay">
  <button type="button" className="np4-overlay__scrim"
   aria-label={t('إغلاق مستكشف نقاط الركوب','Close pickup explorer')} onClick={onClose}/>
  <section className="np4-overlay__sheet" role="dialog" aria-modal="true"
   aria-label={t('اكتشف نقطة ركوب مناسبة','Explore pickup stops')} dir={en?'ltr':'rtl'}>
   <div className="np4-overlay__handle" aria-hidden="true"/>
   <div className="np4-overlay__top">
    <span>{t('على سِكّتك','ON YOUR ROUTE')}</span>
    <button type="button" ref={closeRef} onClick={onClose}
     aria-label={t('رجوع','Back')}>
     <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 5 19 19M19 5 5 19"/>
     </svg>
    </button>
   </div>
   <NearbyRides onSelect={onSelect}/>
   <button type="button" className="np4-overlay__manual" onClick={onManualSearch}>
    {t('أفضل أختار مكاني والوجهة بنفسي','Choose origin and destination manually')}
   </button>
  </section>
 </div>;
}
