import {usePreferences} from './preferences';
import './rider-filters-v3.css';

type VehicleCategory={name:string;seats:number};
type Direction='outbound'|'return'|'round_trip'|'';
export default function RiderFiltersV3({available,categories,period,direction,maxPrice,onlyAvailable,
 onCategories,onPeriod,onDirection,onMaxPrice,onOnlyAvailable,onReset,onApply}:{
 available:VehicleCategory[];categories:string[];period:string;direction:string;
 maxPrice:string;onlyAvailable:boolean;
 onCategories:(value:string[])=>void;onPeriod:(period:'weekly'|'monthly'|'')=>void;
 onDirection:(value:Direction)=>void;onMaxPrice:(price:string)=>void;
 onOnlyAvailable:(checked:boolean)=>void;onReset:()=>void;onApply:()=>void;
}){
 const {language}=usePreferences(),en=language==='en',t=(ar:string,english:string)=>en?english:ar;
 const toggle=(name:string)=>onCategories(categories.includes(name)?
  categories.filter(category=>category!==name):[...categories,name]);
 return <section className="rf3" aria-labelledby="rf3-title">
  <header className="rf3__hero">
   <span>{t('خلّي النتائج على مزاجك','REFINE YOUR RESULTS')}</span>
   <h2 id="rf3-title">{t('اختار اللي يناسبك','Find your best fit')}</h2>
   <p>{t('فلتر الرحلات من غير ما تعيد بحثك من الأول.','Refine the published rides without starting over.')}</p>
  </header>
  <section className="rf3__panel">
   <h3>{t('فئة العربية','Vehicle class')}</h3>
   <div className="rf3__categories" role="group" aria-label={t('فئات العربيات','Vehicle categories')}>
    {available.map(item=><button type="button" key={item.name}
      aria-pressed={categories.includes(item.name)} onClick={()=>toggle(item.name)}>
      <strong>{item.name}</strong>
      <span>{new Intl.NumberFormat(en?'en-EG':'ar-EG').format(item.seats)} {t('مقاعد','seats')}</span>
    </button>)}
   </div>
  </section>
  <section className="rf3__panel">
   <h3>{t('نظام الرحلة','Subscription period')}</h3>
   <div className="rf3__choices" role="group" aria-label={t('مدة الاشتراك','Subscription period')}>
    {([{value:'',ar:'كل المدد',en:'All'},{value:'weekly',ar:'أسبوعي',en:'Weekly'},
      {value:'monthly',ar:'شهري',en:'Monthly'}] as const).map(item=>
     <button type="button" key={item.value||'all'} aria-pressed={period===item.value}
      onClick={()=>onPeriod(item.value)}>{en?item.en:item.ar}</button>)}
   </div>
  </section>
  <section className="rf3__panel">
   <h3>{t('اتجاه الرحلة','Journey direction')}</h3>
   <div className="rf3__choices" role="group" aria-label={t('اتجاه الرحلة','Journey direction')}>
    {([{value:'',ar:'الكل',en:'All'},{value:'outbound',ar:'ذهاب',en:'Outbound'},
      {value:'return',ar:'عودة',en:'Return'},
      {value:'round_trip',ar:'ذهاب وعودة',en:'Round trip'}] as const).map(item=>
     <button type="button" key={item.value||'all'} aria-pressed={direction===item.value}
      onClick={()=>onDirection(item.value)}>{en?item.en:item.ar}</button>)}
   </div>
  </section>
  <section className="rf3__panel">
   <label className="rf3__price">{t('أقصى سعر للمقعد بالجنيه','Max seat price (EGP)')}
    <input type="number" inputMode="numeric" min="0" step="1" max="1000000" value={maxPrice}
     placeholder={t('من غير حد أقصى','No maximum')} onChange={event=>onMaxPrice(event.target.value)}/>
   </label>
   <label className="rf3__availability">
    <span><strong>{t('مقاعد متاحة فقط','Only rides with seats')}</strong>
     <small>{t('إخفاء الرحلات اللي المقاعد فيها خلصت','Hide sold-out rides')}</small></span>
    <input type="checkbox" checked={onlyAvailable} onChange={event=>onOnlyAvailable(event.target.checked)}/>
   </label>
  </section>
  <button type="button" className="rf3__apply" onClick={onApply}>{t('عرض الرحلات','Show rides')}</button>
  <button type="button" className="rf3__reset" onClick={onReset}>{t('مسح الفلاتر','Clear filters')}</button>
 </section>;
}
