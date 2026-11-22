import {usePreferences} from './preferences';
import './rider-results-v3.css';

export default function RiderResultsHero({origin,destination,outbound,returnTime,onEdit}:{
 origin:string;destination:string;outbound:string;returnTime:string;onEdit:()=>void;
}){
 const {language}=usePreferences(),en=language==='en',t=(ar:string,english:string)=>en?english:ar;
 return <section className="rr3-hero" aria-label={t('ملخص بحثك','Your search')}>
  <div className="rr3-hero__heading"><span>{t('PoNo / نتائج البحث','PoNo / Search results')}</span>
   <h2>{t('الرحلات اللي على طريقك','Rides along your route')}</h2>
  </div>
  <div className="rr3-hero__progress" aria-label={t('الخطوة الثانية: النتائج','Step two: results')}>
   <span className="is-done">01</span><i/><span className="is-current">02</span><i/><span>03</span>
  </div>
  <div className="rr3-hero__route"><span className="rr3-hero__route-line" aria-hidden="true"/>
   <div><span className="rr3-hero__dot"/><small>{t('من','From')}</small><strong dir="auto">{origin}</strong></div>
   <div><span className="rr3-hero__dot rr3-hero__dot--end"/><small>{t('إلى','To')}</small><strong dir="auto">{destination}</strong></div>
  </div>
  <div className="rr3-hero__bottom">
   <span>{outbound?t('الذهاب ','Departure ')+outbound.slice(0,5):t('كل المواعيد','Any departure time')}
    {returnTime?' · '+t('العودة ','Return ')+returnTime.slice(0,5):''}</span>
   <button type="button" onClick={onEdit}>{t('غيّر البحث','Edit search')} <span aria-hidden="true">↗</span></button>
  </div>
 </section>;
}
