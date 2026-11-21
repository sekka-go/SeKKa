import {useEffect,useState} from 'react';
import {readSavedCommute,restoreCommuteDraft} from './riderCommute';
import type {SavedCommute} from './riderCommute';
import {riderHomeCopy} from './riderHomeCopy';
import NearbyRides from './NearbyRides';
import type {LiveSelection} from './LiveRouteSearch';
import {usePreferences} from './preferences';
import './rider-home.css';

type Area={id:number;name_ar:string;name_en:string};

function RoadArtwork(){
 return <svg className="rh-artwork" viewBox="0 0 236 196" aria-hidden="true" focusable="false">
  <defs>
   <linearGradient id="rh-road" x1="0" y1="0" x2="1" y2="1">
    <stop stopColor="#FFDB63"/><stop offset="1" stopColor="#FF864B"/>
   </linearGradient>
   <linearGradient id="rh-car" x1="0" y1="0" x2="1" y2="1">
    <stop stopColor="#FF845D"/><stop offset="1" stopColor="#FF456F"/>
   </linearGradient>
  </defs>
  <circle cx="118" cy="96" r="85" fill="#FFFFFF" opacity=".1"/>
  <circle cx="118" cy="96" r="58" fill="#FFFFFF" opacity=".08"/>
  <path d="M-10 159C48 108 65 222 119 159S182 67 246 111" stroke="url(#rh-road)"
   strokeWidth="23" fill="none" strokeLinecap="round"/>
  <path d="M-10 159C48 108 65 222 119 159S182 67 246 111" stroke="#fff"
   strokeWidth="3" strokeDasharray="8 12" fill="none" strokeLinecap="round"/>
  <g transform="translate(45 44) rotate(-7 71 54)">
   <path d="M22 54L34 32c4-7 10-11 20-11h53c10 0 15 4 19 12l11 21v29H20V63c0-5 0-7 2-9Z"
     fill="url(#rh-car)"/>
   <path d="M42 33h60c6 0 9 2 13 9l6 12H32l7-16c1-3 3-5 3-5Z" fill="#B5F3E5"/>
   <path d="M73 33v21" stroke="#F36067" strokeWidth="4"/>
   <circle cx="46" cy="86" r="16" fill="#2C1251"/><circle cx="46" cy="86" r="7" fill="#FAEFFC"/>
   <circle cx="111" cy="86" r="16" fill="#2C1251"/><circle cx="111" cy="86" r="7" fill="#FAEFFC"/>
   <rect x="22" y="62" width="11" height="8" rx="3" fill="#FFE8A1"/>
   <rect x="124" y="62" width="11" height="8" rx="3" fill="#FFE8A1"/>
  </g>
  <g transform="translate(163 24)">
   <path d="M17 1C-5 1-4 28 17 47 38 28 40 1 17 1Z" fill="#FFCD38"/>
   <circle cx="17" cy="17" r="8" fill="#6212A5"/>
  </g>
  <circle cx="29" cy="52" r="7" fill="#FFCD38"/>
  <path d="M23 24h23M36 13v23" stroke="#FFE9D7" strokeWidth="3" strokeLinecap="round" opacity=".7"/>
 </svg>;
}
function HomeIcon({name,size=21}:{name:'arrow'|'edit'|'pin'|'nearby'|'ticket'|'chevron'|'clock';size?:number}){
 return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width={size} height={size}
  fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
  {name==='arrow'&&<><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>}
  {name==='edit'&&<><path d="m15 5 4 4"/><path d="M4 20h4l11-11a3 3 0 0 0-4-4L4 16z"/></>}
  {name==='pin'&&<><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.4"/></>}
  {name==='nearby'&&<><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/></>}
  {name==='ticket'&&<><path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4Z"/><path d="M12 5v14" strokeDasharray="2 3"/></>}
  {name==='chevron'&&<path d="m9 5 7 7-7 7"/>}
  {name==='clock'&&<><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>}
 </svg>;
}

export default function RiderJourneyHome({riderId,serviceAreas,areasLoaded,areasFailed,onNavigate,onSelect}:{
 riderId:string;serviceAreas:Area[];areasLoaded:boolean;areasFailed:boolean;onNavigate:(screen:number)=>void;
 onSelect:(selection:LiveSelection)=>void;
}){
 const {language}=usePreferences();
 const en=language==='en',tr=en?riderHomeCopy.en:riderHomeCopy.ar;
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
 return <div className="rh-home sekka-rider-home" dir={en?'ltr':'rtl'}>
  <section className="rh-hero" aria-labelledby="rh-home-title">
   <div className="rh-hero__content">
    <span className="rh-hero__eyebrow"><span aria-hidden="true" className="rh-hero__spark">✳</span>{tr.kicker}</span>
    <h1 id="rh-home-title">{tr.title}</h1>
    <p>{tr.subtitle}</p>
   </div>
   <RoadArtwork/>
  </section>

  <section className="rh-journey" aria-label={saved&&savedValid?tr.savedLabel:tr.firstTitle}>
   {loadingSaved?<div className="rh-journey__loading" role="status">{tr.loadingAreas}</div>:
    saved&&savedValid?<>
     <div className="rh-journey__head">
      <div><span className="rh-journey__eyebrow">{tr.homeCaption}</span><h2>{tr.savedLabel}</h2></div>
      <button type="button" onClick={editSaved} className="rh-journey__edit">
       <HomeIcon name="edit" size={17}/>{tr.changeShort}
      </button>
     </div>
     <div className="rh-route" aria-label={tr.savedLabel}>
      <div className="rh-route__track" aria-hidden="true"><span/><i/><span/></div>
      <div className="rh-route__stops">
       <div><small>{tr.pickup}</small><strong dir="auto">{display(saved.origin)}</strong></div>
       <div><small>{tr.dropoff}</small><strong dir="auto">{display(saved.destination)}</strong></div>
      </div>
     </div>
     <div className="rh-journey__tags" aria-label={tr.savedLabel}>
      <span><HomeIcon name="clock" size={16}/><bdi>{saved.direction==='return'?saved.returnTime:saved.outbound}</bdi></span>
      <span>{saved.period==='weekly'?tr.weekly:tr.monthly}</span>
      <span>{saved.direction==='round_trip'?tr.round_trip:saved.direction==='return'?tr.return:tr.outbound}</span>
     </div>
     <button type="button" className="rh-button rh-button--primary" onClick={openSaved}>
      {tr.searchSaved}<HomeIcon name="arrow"/>
     </button>
    </>:<>
     <div className="rh-journey__head">
      <div><span className="rh-journey__eyebrow">{tr.homeCaption}</span><h2>{tr.firstTitle}</h2></div>
      <div className="rh-journey__new-icon" aria-hidden="true"><HomeIcon name="pin" size={22}/></div>
     </div>
     <p className="rh-journey__helper">
      {saved&&areasFailed?tr.noBackend:saved?tr.unavailable:tr.firstDesc}
     </p>
     <div className="rh-route rh-route--empty" aria-hidden="true">
      <div className="rh-route__track"><span/><i/><span/></div>
      <div className="rh-route__stops">
       <div><small>{tr.pickup}</small><strong>{tr.originPrompt}</strong></div>
       <div><small>{tr.dropoff}</small><strong>{tr.destinationPrompt}</strong></div>
      </div>
     </div>
     <button type="button" className="rh-button rh-button--primary" onClick={chooseSearch}>
      {tr.begin}<HomeIcon name="arrow"/>
     </button>
    </>}
  </section>
  {error&&<p className="rh-home__alert" role="alert">{error}</p>}

  <section className="rh-next" aria-labelledby="rh-next-heading">
   <div className="rh-section-heading"><h2 id="rh-next-heading">{tr.nextHeading}</h2>
    <span>{tr.nextHint}</span></div>
   <button type="button" className="rh-tile" aria-expanded={nearbyOpen}
    aria-controls="rh-nearby-results" onClick={()=>setNearbyOpen(value=>!value)}>
    <span className="rh-tile__icon rh-tile__icon--near"><HomeIcon name="nearby" size={24}/></span>
    <span className="rh-tile__content"><strong>{tr.nearbyTitle}</strong><small>{tr.nearbyShort}</small></span>
    <span className="rh-tile__chevron"><HomeIcon name="chevron"/></span>
   </button>
   {nearbyOpen&&<div id="rh-nearby-results" className="rh-nearby">
    <NearbyRides onSelect={onSelect}/>
   </div>}
   <button type="button" className="rh-tile" onClick={()=>onNavigate(29)}>
    <span className="rh-tile__icon rh-tile__icon--ticket"><HomeIcon name="ticket" size={24}/></span>
    <span className="rh-tile__content"><strong>{tr.bookingTitle}</strong><small>{tr.bookingsShort}</small></span>
    <span className="rh-tile__chevron"><HomeIcon name="chevron"/></span>
   </button>
  </section>
  <p className="rh-home__footer-note">{tr.footerMessage}</p>
 </div>;
}
