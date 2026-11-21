import {useEffect,useState} from 'react';
import {readSavedCommute,restoreCommuteDraft} from './riderCommute';
import type {SavedCommute} from './riderCommute';
import {riderHomeCopy} from './riderHomeCopy';
import NearbyRides from './NearbyRides';
import type {LiveSelection} from './LiveRouteSearch';
import {usePreferences} from './preferences';
import './rider-home.css';

type Area={id:number;name_ar:string;name_en:string};
type IconName='from'|'to'|'time'|'days'|'arrow'|'edit'|'nearby'|'ticket'|'chevron'|'star';
function RiderIcon({name,size=24}:{name:IconName;size?:number}){
 return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width={size} height={size}
  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  {name==='from'&&<><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.8"/></>}
  {name==='to'&&<><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.8"/></>}
  {name==='time'&&<><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>}
  {name==='days'&&<><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18"/></>}
  {name==='arrow'&&<><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>}
  {name==='edit'&&<><path d="m15 5 4 4"/><path d="M4 20h4l11-11a3 3 0 0 0-4-4L4 16z"/></>}
  {name==='nearby'&&<><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.7"/><circle cx="12" cy="10" r="6.5" strokeDasharray="1 3"/></>}
  {name==='ticket'&&<><path d="M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4Z"/><path d="M12 5v14" strokeDasharray="2 3"/></>}
  {name==='chevron'&&<path d="m9 5 7 7-7 7"/>}
  {name==='star'&&<path d="m12 2 3.1 6.3 7 1-5 4.9 1.2 7-6.3-3.3-6.3 3.3 1.2-7-5-4.9 7-1Z"/>}
 </svg>;
}
export function formatRiderClock(value:string,english:boolean):string{
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))return '';
 const [hours,minutes]=value.split(':').map(Number);
 const time=new Date(Date.UTC(2020,0,1,hours,minutes));
 return new Intl.DateTimeFormat(english?'en-US':'ar-EG',{
  timeZone:'UTC',hour:'numeric',minute:'2-digit',hour12:true
 }).format(time);
}
export default function RiderJourneyHome({riderId,serviceAreas,areasLoaded,areasFailed,onNavigate,onSelect}:{
 riderId:string;serviceAreas:Area[];areasLoaded:boolean;areasFailed:boolean;onNavigate:(screen:number)=>void;
 onSelect:(selection:LiveSelection)=>void;
}){
 const {language}=usePreferences(),en=language==='en',tr=en?riderHomeCopy.en:riderHomeCopy.ar;
 const [saved,setSaved]=useState<SavedCommute|null>(()=>readSavedCommute(riderId));
 const [nearbyOpen,setNearbyOpen]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{setSaved(readSavedCommute(riderId));setError('');setNearbyOpen(false);},[riderId]);
 const registered=(name:string)=>serviceAreas.some(a=>a.name_ar===name||a.name_en===name);
 const savedValid=Boolean(saved&&(saved.originPlace?.kind==='map'||registered(saved.origin))&&
  (saved.destinationPlace?.kind==='map'||registered(saved.destination)));
 const display=(name:string)=>en?(serviceAreas.find(a=>a.name_ar===name)?.name_en||name):name;
 const chooseSearch=()=>onNavigate(9);
 const openSaved=()=>{
  if(!saved||!savedValid){chooseSearch();return;}
  if(!restoreCommuteDraft(saved)){setError(tr.localFailure);return;}
  setError('');onNavigate(11);
 };
 const editSaved=()=>{
  if(saved&&!restoreCommuteDraft(saved)){setError(tr.localFailure);return;}
  chooseSearch();
 };
 const loadingSaved=Boolean(saved&&!areasLoaded&&!areasFailed);
 const valid=Boolean(saved&&savedValid&&!loadingSaved);
 const from=valid&&saved?display(saved.origin):tr.originPrompt;
 const to=valid&&saved?display(saved.destination):tr.destinationPrompt;
 const selectedTime=valid&&saved?
  (saved.direction==='return'?saved.returnTime:saved.outbound):'';
 const time=formatRiderClock(selectedTime,en);
 const fields=[
  {id:'from' as const,label:tr.pickup,value:from,filled:valid},
  {id:'to' as const,label:tr.dropoff,value:to,filled:valid},
  {id:'time' as const,label:tr.timeLabel,value:time||tr.timePrompt,filled:Boolean(time)},
  {id:'days' as const,label:tr.daysLabel,value:tr.daysPrompt,filled:false},
 ];
 return <div className="rh-home sekka-rider-home" dir={en?'ltr':'rtl'}>
  <section className="rh-hero" aria-labelledby="rh-home-title">
   <div className="rh-hero__map-lines" aria-hidden="true"/>
   <img className="rh-hero__artwork" src="/brand/sekka-rider-hero-scene.svg" alt=""
    width="520" height="374"/>
   <div className="rh-hero__copy">
    <h1 id="rh-home-title">{tr.title}</h1>
    <span className="rh-hero__underline" aria-hidden="true"/>
    <p>{tr.subtitle}</p>
   </div>
  </section>

  <section className="rh-journey" aria-label={tr.savedLabel}>
   <div className="rh-journey__ribbon"><RiderIcon name="star" size={18}/>{tr.savedLabel}</div>
   {loadingSaved?<p className="rh-journey__loading" role="status">{tr.loadingAreas}</p>:<>
    {saved&&!savedValid&&<p className="rh-journey__notice" role="status">
     {areasFailed?tr.noBackend:tr.unavailable}
    </p>}
    <div className="rh-journey__fields">
     {fields.map(item=><div className="rh-journey__field" key={item.id}>
      <span className={'rh-journey__field-icon rh-journey__field-icon--'+item.id}>
       <RiderIcon name={item.id} size={23}/>
      </span>
      <div className="rh-journey__field-copy">
       <span>{item.label}</span><strong dir="auto" className={!item.filled?'is-placeholder':''}>
        {item.value}
       </strong>
      </div>
     </div>)}
    </div>
    <button type="button" className="rh-button rh-button--primary" onClick={valid?openSaved:chooseSearch}>
     {valid?tr.searchSaved:tr.begin}<RiderIcon name="arrow" size={24}/>
    </button>
    <button type="button" className="rh-journey__edit" onClick={editSaved}>
     <RiderIcon name="edit" size={18}/>{valid?tr.change:tr.editInitial}
    </button>
   </>}
  </section>

  {error&&<p className="rh-home__alert" role="alert">{error}</p>}
  <section className="rh-shortcuts" aria-label={tr.quickActions}>
   <button type="button" className="rh-shortcut rh-shortcut--nearby"
    onClick={()=>setNearbyOpen(v=>!v)} aria-expanded={nearbyOpen}
    aria-controls="rh-nearby-results">
    <span className="rh-shortcut__icon"><RiderIcon name="nearby" size={36}/></span>
    <span>{tr.nearbyShortTitle}</span>
    <RiderIcon name="chevron" size={20}/>
   </button>
   <button type="button" className="rh-shortcut rh-shortcut--bookings" onClick={()=>onNavigate(29)}>
    <span className="rh-shortcut__icon"><RiderIcon name="ticket" size={36}/></span>
    <span>{tr.bookingsShortTitle}</span>
    <RiderIcon name="chevron" size={20}/>
   </button>
  </section>
  {nearbyOpen&&<section className="rh-nearby" id="rh-nearby-results" aria-label={tr.nearbyTitle}>
   <h2>{tr.nearbyTitle}</h2>
   <p>{tr.nearbyDesc}</p>
   <NearbyRides onSelect={onSelect}/>
  </section>}
 </div>;
}
