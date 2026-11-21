import type {Line} from './Discovery';
import type {Stop} from '../../../packages/domain/stops';
import {usePreferences} from './preferences';
import './rider-details-v3.css';

export default function RiderTripDetailsV3({line,stops,pickup,dropoff,pickupPosition,
 lastDropoffPosition,validDropoff,onPickupChange,onDropoffChange,onProceed,onBack}:{
 line:Line;stops:Stop[];pickup:string;dropoff:string;pickupPosition:number;
 lastDropoffPosition:number;validDropoff:boolean;
 onPickupChange:(id:string)=>void;onDropoffChange:(id:string)=>void;
 onProceed:()=>void;onBack:()=>void;
}){
 const {language}=usePreferences(),en=language==='en',t=(ar:string,english:string)=>en?english:ar;
 const numeric=new Intl.NumberFormat(en?'en-EG':'ar-EG');
 const price=line.amount===null?t('غير متاح','Unavailable'):
  numeric.format(line.amount)+' '+t('جنيه','EGP');
 const round=line.direction==='round_trip';
 const reverse=line.direction==='return';
 const outbound=line.outbound||'',returned=line.returnTime||'';
 return <section className="rd3" aria-labelledby="rd3-title">
  <header className="rd3__hero">
   <span className="rd3__step">{t('الخطوة ٣ من ٣','STEP 3 OF 3')}</span>
   <h2 id="rd3-title">{t('تفاصيل رحلتك','Review your ride')}</h2>
   <p>{t('كل التفاصيل المهمة قبل ما تكمّل الحجز.','Check the pickup, drop-off and seats before you continue.')}</p>
  </header>
  <section className="rd3__route" aria-label={t('مسار الرحلة','Ride route')}>
   <div className="rd3__route-line" aria-hidden="true"><span/><i/><span/></div>
   <div className="rd3__route-stops">
    <div><small>{t('من','From')}</small><strong dir="auto">{line.origin}</strong></div>
    <div><small>{t('إلى','To')}</small><strong dir="auto">{line.destination}</strong></div>
   </div>
  </section>
  <div className="rd3__facts">
   <div><span>{t('الفئة','Vehicle class')}</span><strong dir="auto">{line.category}</strong></div>
   <div><span>{t('المقاعد المتاحة الآن','Seats available now')}</span><strong>{numeric.format(line.available)}</strong></div>
   <div><span>{t('نظام الرحلة','Plan')}</span><strong>{line.period==='weekly'?t('أسبوعي','Weekly'):t('شهري','Monthly')}</strong></div>
   <div><span>{t('ميعاد الرحلة','Time')}</span><strong dir="ltr">{reverse?returned||'—':outbound||'—'}</strong></div>
  </div>
  {round&&returned&&<p className="rd3__return">
   {t('يدعم ذهاب وعودة','Round trip supported')} · {t('ميعاد العودة','Return time')}{' '}
   <bdi>{returned}</bdi>
  </p>}
  <section className="rd3__stops" aria-labelledby="rd3-stops-title">
   <div className="rd3__section-title"><span className="rd3__section-icon" aria-hidden="true">⌖</span>
    <div><h3 id="rd3-stops-title">{t('منين هتركب وهتنزل؟','Pickup and drop-off')}</h3>
     <p>{t('اتأكد إن المحطتين على نفس اتجاه الرحلة.','Choose stops along this ride in the right order.')}</p></div>
   </div>
   <label><span>{t('نقطة الركوب','Pickup point')}</span>
    <select aria-label={t('نقطة الركوب','Pickup point')} value={pickup}
     onChange={event=>onPickupChange(event.target.value)}>
     <option value="">{t('اختار نقطة الركوب','Choose pickup')}</option>
     {stops.filter((stop,i)=>stop.pickup&&i<lastDropoffPosition).map(stop=>
      <option key={stop.id} value={stop.id}>{stop.name}</option>)}
    </select>
   </label>
   <label><span>{t('نقطة النزول','Drop-off point')}</span>
    <select aria-label={t('نقطة النزول','Drop-off point')} value={dropoff}
     disabled={pickupPosition<0} onChange={event=>onDropoffChange(event.target.value)}>
     <option value="">{t('اختار نقطة النزول','Choose drop-off')}</option>
     {stops.filter((stop,i)=>stop.dropoff&&i>pickupPosition).map(stop=>
      <option key={stop.id} value={stop.id}>{stop.name}</option>)}
    </select>
   </label>
   <details className="rd3__all-stops">
    <summary>{t('عرض المحطات على الخط','View all route stops')} ({numeric.format(stops.length)})</summary>
    <ol>{stops.map((stop,i)=><li key={stop.id}><span>{numeric.format(i+1)}</span>
     <span dir="auto">{stop.name}</span></li>)}</ol>
   </details>
   {round&&validDropoff&&<p className="rd3__return-stops">
    {t('مسار العودة:','Return direction:')}{' '}
    <bdi>{stops.find(stop=>stop.id===dropoff)?.name}</bdi> ← <bdi>{stops[pickupPosition]?.name}</bdi>
   </p>}
  </section>
  <section className="rd3__price" aria-label={t('سعر المقعد','Seat price')}>
   <div><small>{t('سعر المقعد الاسترشادي','Indicative seat price')}</small>
    <strong dir="auto">{price}</strong></div>
   <span>{t('يتأكد الإجمالي قبل الحجز','Confirm total before reserving')}</span>
  </section>
  <p className="rd3__notice">{t('راجع شروط الرحلة ومواعيدها. الحجز يخضع للتحقق من المقاعد عند التأكيد، ومفيش دفع داخل التطبيق حاليًا.',
   'Check the ride terms and times. Seat availability is rechecked when you confirm; there is no in-app payment currently.')}</p>
  {line.available<1&&<p role="status" className="rd3__unavailable">
   {t('المقاعد خلصت حاليًا. ارجع لنتائج البحث.','No seats left right now. Return to other results.')}
  </p>}
  <button type="button" className="rd3__primary"
   disabled={line.amount===null||line.available<1||!pickup||!validDropoff}
   onClick={onProceed}>{t('كمّل للحجز','Continue to booking')}</button>
  <button type="button" className="rd3__back" onClick={onBack}>{t('رجوع','Back')}</button>
 </section>;
}
