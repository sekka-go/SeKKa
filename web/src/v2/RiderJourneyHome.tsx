import AppSkeleton from './AppSkeleton';
import RiderHomePublishedRoutes from './RiderHomePublishedRoutes';
import {useEffect,useRef,useState} from 'react';
import {readSavedCommute,restoreCommuteDraft,saveCommute,readHomeDraft,saveHomeDraft,clearHomeDraft,WEEKDAY_IDS} from './riderCommute';
import type {SavedCommute} from './riderCommute';
import {sameJourneyEndpoint,isSearchableMapPlace,selectOperationalMapPlace} from './geoPlace';
import type {PlaceChoice} from './geoPlace';
import {riderHomeCopy} from './riderHomeCopy';
import GeoPlaceInput from './GeoPlaceInput';
import PickupExplorerSheet from './PickupExplorerSheet';
import type {LiveSelection} from './LiveRouteSearch';
import {usePreferences} from './preferences';
import './rider-home.css';
import {useStaggeredReveal} from './staggerMotion';

type Area={id:number;name_ar:string;name_en:string};
type Editor='from'|'to'|'time'|'days';
type Draft=Omit<SavedCommute,'savedAt'>;
type IconName=Editor|'arrow'|'nearby'|'ticket'|'chevron'|'star'|'close';
const AR_DAYS=['السبت','الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];
const EN_DAYS=['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];
function initialDraft(saved:SavedCommute|null):Draft{
 return {origin:saved?.origin??'',destination:saved?.destination??'',
  originPlace:saved?.originPlace??null,destinationPlace:saved?.destinationPlace??null,
  outbound:saved?.outbound??'',returnTime:saved?.direction==='outbound'?'':(saved?.returnTime??''),
  period:saved?.period??'weekly',
  direction:saved?.direction??'outbound',weekdays:saved?.weekdays??[]};
}
function RiderIcon({name,size=24}:{name:IconName;size?:number}){
 return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width={size} height={size}
  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  {(name==='from'||name==='to'||name==='nearby')&&<>
   <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0Z"/>
   <circle cx="12" cy="10" r="2.8"/>
  </>}
  {name==='time'&&<><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>}
  {name==='days'&&<><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18"/></>}
  {name==='arrow'&&<><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>}
  {name==='ticket'&&<><path d="M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4Z"/><path d="M12 5v14" strokeDasharray="2 3"/></>}
  {name==='chevron'&&<path d="m9 5 7 7-7 7"/>}
  {name==='star'&&<path d="m12 2 3.1 6.3 7 1-5 4.9 1.2 7-6.3-3.3-6.3 3.3 1.2-7-5-4.9 7-1Z"/>}
  {name==='close'&&<path d="M5 5l14 14M19 5 5 19"/>}
 </svg>;
}
export function formatRiderClock(value:string,english:boolean):string{
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))return '';
 const [hours,minutes]=value.split(':').map(Number);
 const date=new Date(Date.UTC(2020,0,1,hours,minutes));
 return new Intl.DateTimeFormat(english?'en-US':'ar-EG',{
  timeZone:'UTC',hour:'numeric',minute:'2-digit',hour12:true
 }).format(date);
}
export default function RiderJourneyHome({riderId,serviceAreas,areasLoaded,areasFailed,onNavigate,onSelect}:{
 riderId:string;serviceAreas:Area[];areasLoaded:boolean;areasFailed:boolean;onNavigate:(screen:number)=>void;
 onSelect:(selection:LiveSelection)=>void;
}){
 const {language}=usePreferences(),en=language==='en',tr=en?riderHomeCopy.en:riderHomeCopy.ar;
 const t=(ar:string,english:string)=>en?english:ar;
 const revealHome=useStaggeredReveal();
 const [stored,setStored]=useState<{owner:string;values:Draft}>(()=>({
  owner:riderId,values:readHomeDraft(riderId)??initialDraft(readSavedCommute(riderId))
 }));
 const draft=stored.owner===riderId?stored.values:
  (readHomeDraft(riderId)??initialDraft(readSavedCommute(riderId)));
 const setDraft=(update:(previous:Draft)=>Draft)=>setStored(previous=>({
  owner:riderId,values:update(previous.owner===riderId?previous.values:
   (readHomeDraft(riderId)??initialDraft(readSavedCommute(riderId))))
 }));
 const [editor,setEditor]=useState<Editor|null>(null);
 const [nearbyOpen,setNearbyOpen]=useState(false);
 const [error,setError]=useState('');
 const editorTitle=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{
  if(stored.owner===riderId)saveHomeDraft(riderId,stored.values);
 },[riderId,stored]);
 useEffect(()=>{
  setStored(previous=>previous.owner===riderId?previous:{
   owner:riderId,values:readHomeDraft(riderId)??initialDraft(readSavedCommute(riderId))});
  setError('');setNearbyOpen(false);setEditor(null);
 },[riderId]);
 useEffect(()=>{
  if(!editor)return;
  editorTitle.current?.focus();
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!event.defaultPrevented)setEditor(null);};
  window.addEventListener('keydown',escape);
  return()=>window.removeEventListener('keydown',escape);
 },[editor]);
 const registered=(name:string)=>serviceAreas.some(a=>a.name_ar===name||a.name_en===name);
 const selectable=(name:string,choice:PlaceChoice|null)=>choice?.kind==='map'?selectOperationalMapPlace(choice.place):
  choice?.kind==='search'?isSearchableMapPlace(choice.place):registered(name);
 const display=(name:string)=>en?(serviceAreas.find(a=>a.name_ar===name)?.name_en||name):name;
 const selectedDays=draft.weekdays??[];
 const count=selectedDays.length;
 const daysSummary=!count?tr.daysPrompt:en?
  (count===1?'1 day selected':count+' days selected'):
  (count===1?'يوم واحد':count===2?'يومين':new Intl.NumberFormat('ar-EG').format(count)+' أيام');
 const timeText=[draft.direction==='return'?'':formatRiderClock(draft.outbound,en),
  draft.direction!=='outbound'&&draft.returnTime?formatRiderClock(draft.returnTime,en):''].filter(Boolean).join(' – ');
 const fields=[
  {id:'from' as const,label:tr.pickup,value:draft.origin?display(draft.origin):tr.originPrompt,filled:selectable(draft.origin,draft.originPlace)},
  {id:'to' as const,label:tr.dropoff,value:draft.destination?display(draft.destination):tr.destinationPrompt,filled:selectable(draft.destination,draft.destinationPlace)},
  {id:'time' as const,label:tr.timeLabel,value:timeText||tr.timePrompt,filled:!!timeText},
  {id:'days' as const,label:tr.daysLabel,value:daysSummary,filled:count>0}
 ];
 const placePick=(which:'from'|'to',name:string,choice:PlaceChoice|null)=>{
  setDraft(previous=>which==='from'?{...previous,origin:name,originPlace:choice}:
   {...previous,destination:name,destinationPlace:choice});
  if(choice){setError('');setEditor(null);}
 };
 const search=()=>{
  setError('');
  if(!selectable(draft.origin,draft.originPlace)){setEditor('from');return;}
  if(!selectable(draft.destination,draft.destinationPlace)){setEditor('to');return;}
  if(sameJourneyEndpoint(draft.origin,draft.destination,draft.originPlace,draft.destinationPlace)){
   setError(tr.samePlaceError);setEditor('to');return;
  }
  // Weekdays are saved as rider preferences but the existing v31 route-search
  // RPC does not accept a weekday parameter: do NOT promise weekday filtering.
  const commute:SavedCommute={...draft,
   weekdays:[...selectedDays].sort((a,b)=>a-b),savedAt:new Date().toISOString()};
  const restored=restoreCommuteDraft(commute);
  if(!restored){setError(tr.localFailure);return;}
  saveCommute(riderId,{...commute});
  clearHomeDraft(riderId);
  onNavigate(11);
 };
 const title=editor==='from'?tr.originEditor:editor==='to'?tr.destinationEditor:
  editor==='time'?tr.timeEditor:tr.daysEditor;
 return <div className="rh-home sekka-rider-home" dir={en?'ltr':'rtl'}>
  <section className="rh-hero rh-showcase-hero" aria-label={t('أهلاً بيك في سِكَّة','Welcome to seKKa')}>
   <svg className="rh-showcase-hero__top-wave" viewBox="0 0 430 178" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 0H430V15C342 128 240 35 128 128C79 171 28 161 0 160Z" fill="#087FE9"/>
    <path d="M0 0H430V2C338 103 244 26 128 98C74 139 28 131 0 139Z" fill="#18E1EA" opacity=".82"/>
    <path d="M0 0H430V0C347 85 242 13 140 76C78 112 32 109 0 119Z" fill="#70F7F3" opacity=".45"/>
   </svg>
   <div className="rh-hero__copy">
    <span className="rh-hero__eyebrow">{t('سِكَّة · معاك في السِكَّة','seKKa · Along your way')}</span>
    <h2>{t('أهلاً بيك','Welcome')}</h2>
    <p>{t('جاهز لمشوار جديد؟','Ready for your next ride?')}</p>
   </div>
   <svg className="rh-hero__wave rh-showcase-hero__bottom-wave" viewBox="0 0 440 125" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 39C89 0 180 48 266 67S390 89 440 45V125H0Z" fill="#17D8E9"/>
    <path d="M0 57C91 11 183 62 266 78S385 107 440 64V125H0Z" fill="#A5F2FC"/>
    <path d="M0 78C102 32 180 81 271 96S390 115 440 85V125H0Z" fill="#F4FBFF"/>
   </svg>
  </section>
  <section className="rh-showcase-search" aria-labelledby="rh-home-title">
   <h1 id="rh-home-title">{tr.title}</h1>
   <button type="button" className="rh-showcase-search__card" onClick={()=>onNavigate(9)}>
    <span className="rh-showcase-search__icon" aria-hidden="true">
     <svg viewBox="0 0 66 66" fill="none"><circle cx="27" cy="27" r="19" stroke="currentColor" strokeWidth="6"/><path d="m42 42 16 16" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/></svg>
     <span className="rh-showcase-search__arrow"><RiderIcon name="arrow" size={18}/></span>
    </span>
    <span className="rh-showcase-search__label">{t('دور على رحلة','Find a ride')}</span>
   </button>
  </section>
  <RiderHomePublishedRoutes onSelect={onSelect} onSearch={()=>onNavigate(9)}/>
  <section className="rh-journey" aria-label={tr.savedLabel}>
   <div className="rh-journey__ribbon"><RiderIcon name="star" size={18}/>{draft.origin&&draft.destination?tr.savedLabel:t('ظبّط مشوارك','Plan your ride')}</div>
   <div className="rh-journey__heading"><strong>{t('مشوارك… على مزاجك','Your route, your choice')}</strong>
    <small>{t('اضغط على أي خانة علشان تختار','Tap any field to change it')}</small></div>
   {!areasLoaded&&!areasFailed&&draft.origin&&<AppSkeleton kind="stops" compact label={tr.loadingAreas}/>}
   {areasFailed&&<p className="rh-journey__notice" role="status">{tr.noBackend}</p>}
   <div className="rh-journey__fields">
    {fields.map(field=><button ref={revealHome} type="button" key={field.id}
     className="rh-journey__field" onClick={()=>setEditor(field.id)}
     aria-label={field.label+': '+field.value+'. '+tr.changeShort}>
     <span className={'rh-journey__field-icon rh-journey__field-icon--'+field.id}>
      <RiderIcon name={field.id} size={23}/></span>
     <span className="rh-journey__field-copy">
      <span>{field.label}</span><strong dir="auto" className={!field.filled?'is-placeholder':''}>{field.value}</strong>
     </span>
     <span className="rh-journey__field-affordance" aria-hidden="true"><RiderIcon name="chevron" size={17}/></span>
    </button>)}
   </div>
   <button type="button" className="rh-button rh-button--primary" onClick={search}>
    {tr.searchButton}<span className="rh-button__orbit" aria-hidden="true"><RiderIcon name="arrow" size={22}/></span>
   </button>
   <button type="button" className="rh-journey__advanced" onClick={()=>onNavigate(9)}>
    {t('بحث بمزيد من التفاصيل','More search options')} <span aria-hidden="true">↗</span>
   </button>
  </section>
  <div className="rh-home__steps" aria-label={t('مراحل الرحلة','How it works')}>
   <span><b>١</b>{t('حدّد','Choose')}</span><i aria-hidden="true"/><span><b>٢</b>{t('قارن','Compare')}</span><i aria-hidden="true"/><span><b>٣</b>{t('احجز','Reserve')}</span>
  </div>
  {error&&<p className="rh-home__alert" role="alert">{error}</p>}
  <div className="rh-home__actions-title"><h2>{t('استكشف سِكّتك','Explore more')}</h2><span>{t('حاجات تانية تهمك','More ways to go')}</span></div>
  <section className="rh-pickup-actions" aria-label={tr.quickActions}>
   <button ref={revealHome} type="button" className="rh-pickup-actions__explore" onClick={()=>setNearbyOpen(true)}
    aria-haspopup="dialog" aria-expanded={nearbyOpen}>
    <span className="rh-pickup-actions__symbol" aria-hidden="true"><RiderIcon name="nearby" size={26}/></span>
    <span className="rh-pickup-actions__copy">
     <strong>{t('نقط الركوب على الخريطة','Pickup spots on the map')}</strong>
     <small>{t('شوف أقرب نقطة منشورة على الخريطة','Explore real published stops nearby')}</small>
    </span>
    <span className="rh-pickup-actions__arrow" aria-hidden="true"><RiderIcon name="chevron" size={19}/></span>
   </button>
   <button ref={revealHome} type="button" className="rh-pickup-actions__bookings" onClick={()=>onNavigate(29)}>
    <span className="rh-pickup-actions__ticket" aria-hidden="true"><RiderIcon name="ticket" size={25}/></span>
    <span>{tr.bookingsShortTitle}</span>
   </button>
  </section>
  {nearbyOpen&&<PickupExplorerSheet onClose={()=>setNearbyOpen(false)}
   onManualSearch={()=>{setNearbyOpen(false);onNavigate(9);}}
   onSelect={selection=>{setNearbyOpen(false);onSelect(selection);}}/>}
   {editor&&<div className="rh-picker-backdrop" onClick={()=>setEditor(null)}>
   <section className="rh-picker" role="dialog" aria-modal="true" aria-labelledby="rh-picker-title"
    onClick={event=>event.stopPropagation()}>
    <div className="rh-picker__head">
     <h2 id="rh-picker-title" tabIndex={-1} ref={editorTitle}>{title}</h2>
     <button type="button" className="rh-picker__close" onClick={()=>setEditor(null)}
      aria-label={tr.close}><RiderIcon name="close" size={22}/></button>
    </div>
    {(editor==='from'||editor==='to')&&<div className="rh-picker__places">
     <p>{tr.placeHint}</p>
     <GeoPlaceInput key={editor} label={title} value={editor==='from'?draft.origin:draft.destination}
      choice={editor==='from'?draft.originPlace:draft.destinationPlace}
      areas={serviceAreas} onPick={(name,choice)=>placePick(editor,name,choice)}/>
    </div>}
    {editor==='time'&&<div className="rh-picker__times">
     <label>{tr.outboundTime}
      <input type="time" value={draft.outbound} onChange={event=>setDraft(prev=>({...prev,outbound:event.target.value}))}/>
     </label>
     <label>{tr.returnTimeOptional}
      <input type="time" value={draft.returnTime} onChange={event=>setDraft(prev=>({...prev,returnTime:event.target.value,direction:event.target.value?'round_trip':'outbound'}))}/>
     </label>
     <p>{tr.timeHint}</p>
     <button type="button" className="rh-picker__confirm" onClick={()=>setEditor(null)}>{tr.done}</button>
    </div>}
    {editor==='days'&&<div className="rh-picker__days">
     <p>{tr.daysHint}</p>
     <div className="rh-picker__week" role="group" aria-label={tr.daysEditor}>
      {WEEKDAY_IDS.map(day=><button type="button" key={day}
       aria-pressed={selectedDays.includes(day)}
       onClick={()=>setDraft(prev=>({...prev,weekdays:prev.weekdays?.includes(day)?
        (prev.weekdays??[]).filter(x=>x!==day):[...(prev.weekdays??[]),day]}))}>
       {en?EN_DAYS[day]:AR_DAYS[day]}
      </button>)}
     </div>
     <p className="rh-picker__count" role="status">{daysSummary}</p>
     <div className="rh-picker__period" role="group" aria-label={tr.periodLabel}>
      <button type="button" aria-pressed={draft.period==='weekly'}
       onClick={()=>setDraft(prev=>({...prev,period:'weekly'}))}>{tr.weekly}</button>
      <button type="button" aria-pressed={draft.period==='monthly'}
       onClick={()=>setDraft(prev=>({...prev,period:'monthly'}))}>{tr.monthly}</button>
     </div>
     <p className="rh-picker__hint">{tr.daysSearchHint}</p>
     <button type="button" className="rh-picker__confirm" onClick={()=>setEditor(null)}>{tr.done}</button>
    </div>}
   </section>
  </div>}
 </div>;
}
