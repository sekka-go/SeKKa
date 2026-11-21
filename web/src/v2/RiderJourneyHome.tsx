import {useEffect,useState} from 'react';
import {readSavedCommute,restoreCommuteDraft} from './riderCommute';
import type {SavedCommute} from './riderCommute';
import {riderHomeCopy} from './riderHomeCopy';
import NearbyRides from './NearbyRides';
import type {LiveSelection} from './LiveRouteSearch';
import {usePreferences} from './preferences';
import './rider-home.css';

type Area={id:number;name_ar:string;name_en:string};
export default function RiderJourneyHome({riderId,serviceAreas,onNavigate,onSelect}:{
 riderId:string;serviceAreas:Area[];onNavigate:(screen:number)=>void;
 onSelect:(selection:LiveSelection)=>void;
}){
 const {language}=usePreferences(),tr=language==='en'?riderHomeCopy.en:riderHomeCopy.ar;
 const [saved,setSaved]=useState<SavedCommute|null>(()=>readSavedCommute(riderId));
 const [nearbyOpen,setNearbyOpen]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{setSaved(readSavedCommute(riderId));setError('');},[riderId]);
 const registered=(name:string)=>serviceAreas.some(a=>a.name_ar===name||a.name_en===name);
 const valid=Boolean(saved&&(saved.originPlace?.kind==='map'||registered(saved.origin))&&
   (saved.destinationPlace?.kind==='map'||registered(saved.destination)));
 const display=(name:string)=>language==='en'?(serviceAreas.find(a=>a.name_ar===name)?.name_en||name):name;
 const startSaved=()=>{
  if(!saved||!valid){onNavigate(9);return;}
  if(!restoreCommuteDraft(saved)){setError(tr.localFailure);return;}
  setError('');onNavigate(11);
 };
 return <div className="sekka-rider-home" dir={language==='en'?'ltr':'rtl'}>
  <div className="sekka-rider-home__hero">
   <div className="sekka-rider-home__topline"><span className="sekka-rider-home__dot" aria-hidden="true"/>{tr.kicker}</div>
   <h1>{tr.title}</h1>
   <p>{tr.subtitle}</p>
   <svg aria-hidden="true" className="sekka-rider-home__road" viewBox="0 0 260 90" fill="none">
    <path d="M-10 72C63-8 143 153 270 0" stroke="#FFCD38" strokeWidth="29" strokeLinecap="round"/>
    <path d="M-10 72C63-8 143 153 270 0" stroke="#fff" strokeWidth="3" strokeDasharray="8 13" strokeLinecap="round"/>
    <circle cx="55" cy="37" r="10" fill="#00BEAD" stroke="#fff" strokeWidth="4"/>
    <circle cx="211" cy="58" r="10" fill="#FF663D" stroke="#fff" strokeWidth="4"/>
   </svg>
  </div>
  {saved&&valid?<section className="sekka-rider-home__card" aria-label={tr.savedLabel}>
   <div className="sekka-rider-home__card-title"><span className="sekka-rider-home__symbol" aria-hidden="true">↗</span><h2>{tr.savedLabel}</h2></div>
   <div className="sekka-rider-home__journey">
    <div className="sekka-rider-home__endpoint"><span className="sekka-rider-home__pin sekka-rider-home__pin--from"/><div><small>{tr.pickup}</small><strong dir="auto">{display(saved.origin)}</strong></div></div>
    <div className="sekka-rider-home__journey-line" aria-hidden="true"/>
    <div className="sekka-rider-home__endpoint"><span className="sekka-rider-home__pin sekka-rider-home__pin--to"/><div><small>{tr.dropoff}</small><strong dir="auto">{display(saved.destination)}</strong></div></div>
   </div>
   <div className="sekka-rider-home__chips">
    <span>{saved.direction==='round_trip'?tr.round_trip:saved.direction==='return'?tr.return:tr.outbound}</span>
    <span>{saved.period==='weekly'?tr.weekly:tr.monthly}</span>
    {saved.outbound&&saved.direction!=='return'&&<span>{tr.departure} <bdi>{saved.outbound}</bdi></span>}
    {saved.returnTime&&saved.direction!=='outbound'&&<span>{tr.arrival} <bdi>{saved.returnTime}</bdi></span>}
   </div>
   <button className="sekka-rider-home__primary" type="button" onClick={startSaved}>{tr.searchSaved}<span aria-hidden="true">←</span></button>
   <button className="sekka-rider-home__secondary" type="button" onClick={()=>{if(saved)restoreCommuteDraft(saved);onNavigate(9);}}>{tr.change}</button>
   <p className="sekka-rider-home__note">{tr.savedOnDevice}</p>
  </section>:<section className="sekka-rider-home__card sekka-rider-home__first">
   <div className="sekka-rider-home__symbol" aria-hidden="true">⌖</div>
   <h2>{saved?tr.unavailable:tr.firstTitle}</h2>
   <p>{tr.firstDesc}</p>
   <button className="sekka-rider-home__primary" type="button" onClick={()=>onNavigate(9)}>
    {tr.begin}<span aria-hidden="true">←</span>
   </button>
  </section>}
  {error&&<p className="sekka-rider-home__error" role="alert">{error}</p>}
  <p className="sekka-rider-home__progress">{tr.progress}</p>
  <section className="sekka-rider-home__extra">
   <div className="sekka-rider-home__extra-head"><span className="sekka-rider-home__symbol" aria-hidden="true">⌖</span><div><h2>{tr.nearbyTitle}</h2><p>{tr.nearbyDesc}</p></div></div>
   <button className="sekka-rider-home__outline" type="button" aria-expanded={nearbyOpen}
    onClick={()=>setNearbyOpen(value=>!value)}>{nearbyOpen?tr.nearbyClose:tr.nearbyAction}</button>
   {nearbyOpen&&<div className="sekka-rider-home__nearby"><p>{tr.mapHint}</p><NearbyRides onSelect={onSelect}/></div>}
  </section>
  <section className="sekka-rider-home__extra">
   <div className="sekka-rider-home__extra-head"><span className="sekka-rider-home__symbol" aria-hidden="true">▣</span><div><h2>{tr.bookingTitle}</h2><p>{tr.bookingDescription}</p></div></div>
   <button className="sekka-rider-home__outline" type="button" onClick={()=>onNavigate(29)}>{tr.bookingAction}</button>
  </section>
 </div>;
}
