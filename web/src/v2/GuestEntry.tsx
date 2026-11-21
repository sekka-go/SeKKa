import {useEffect,useRef,useState} from 'react';
import {entryCopy} from './guestEntryCopy';
import {approvedSplashSceneUri} from './approvedSplashScene';
import './guest-entry.css';

type Role='rider'|'captain';
type Props={
 screen:2|3;
 language:string;
 role:string;
 onRole:(role:Role)=>void;
 go:(screen:number)=>void;
};
function RideIllustration({variant}:{variant:0|1|2}){
 return <svg className="sekka-entry__illustration" viewBox="0 0 340 300" role="img"
   aria-label="" focusable="false" aria-hidden="true">
  <defs>
   <linearGradient id="se-road" x1="0" y1="0" x2="1" y2="1">
    <stop stopColor="#FFCD38"/><stop offset="1" stopColor="#FFCA27"/>
   </linearGradient>
   <linearGradient id="se-car" x1="0" y1="0" x2="1" y2="1">
    <stop stopColor="#FFCA27"/><stop offset="1" stopColor="#0DBFD3"/>
   </linearGradient>
  </defs>
  <circle cx="170" cy="140" r="119" fill={variant===0?"#FFF2DF":variant===1?"#E3F8FE":"#D9F9FA"}/>
  <circle cx="44" cy="88" r="11" fill="#FFCD38"/>
  <circle cx="301" cy="78" r="13" fill="#BCEEF7"/>
  <circle cx="297" cy="220" r="9" fill="#B9E6DF"/>
  <path d="M0 244 C70 169,97 309,174 235 S262 174,340 239" fill="none"
    stroke="url(#se-road)" strokeWidth="23" strokeLinecap="round"/>
  <path d="M7 242 C70 171,97 307,174 235 S262 176,333 240" fill="none"
    stroke="#FFF8EF" strokeWidth="3" strokeDasharray="12 13" strokeLinecap="round"/>
  <g className="sekka-entry__float">
   <path d="M60 178v-31c0-11 9-20 20-20h151c14 0 25 8 30 20l13 31v35H60z" fill="url(#se-car)"/>
   <path d="M96 130h123c9 0 15 5 19 13l11 29H74v-15c0-15 9-27 22-27" fill="#FFAF9A"/>
   <rect x="101" y="139" width="45" height="29" rx="9" fill="#E8F8FF"/>
   <rect x="155" y="139" width="61" height="29" rx="9" fill="#E8F8FF"/>
   <rect x="64" y="182" width="209" height="21" rx="9" fill="#FE7250"/>
   <circle cx="102" cy="211" r="26" fill="#17405A"/>
   <circle cx="102" cy="211" r="14" fill="#FFF5EF"/>
   <circle cx="233" cy="211" r="26" fill="#17405A"/>
   <circle cx="233" cy="211" r="14" fill="#FFF5EF"/>
   <circle cx="185" cy="151" r="10" fill="#E9A37E"/>
   <path d="M170 165q15-16 30 0" fill="#078BEA"/>
   <circle cx="126" cy="151" r="10" fill="#AD715A"/>
   <path d="M111 165q15-16 30 0" fill="#FFCC24"/>
  </g>
  {variant===0&&<>
   <g transform="translate(22 42)"><rect width="110" height="39" rx="19.5" fill="#fff"/>
    <circle cx="23" cy="19" r="10" fill="#00BEAD"/><path d="M20 19l3 3 6-8" stroke="#fff" fill="none" strokeWidth="3" strokeLinecap="round"/>
    <path d="M46 15h52M46 24h40" stroke="#E1C768" strokeWidth="5" strokeLinecap="round"/>
   </g>
   <g transform="translate(242 25)"><rect width="80" height="41" rx="18" fill="#fff"/>
    <path d="M18 20h43" stroke="#FF663D" strokeWidth="6" strokeLinecap="round"/>
   </g>
  </>}
  {variant===1&&<>
   <g transform="translate(22 32)"><rect width="120" height="44" rx="19" fill="#fff"/>
    <circle cx="24" cy="22" r="11" fill="#078BEA"/><path d="M24 14v16m-8-8h16" stroke="#fff" strokeWidth="3"/>
    <path d="M49 16h55M49 27h44" stroke="#E1C768" strokeLinecap="round" strokeWidth="5"/>
   </g>
   <path d="M282 123c9-21 23-21 31 0 4 16-17 27-17 27s-19-11-14-27Z" fill="#078BEA"/>
   <circle cx="296" cy="120" r="7" fill="#FFCD38"/>
  </>}
  {variant===2&&<>
   <g transform="translate(32 25)"><rect width="98" height="48" rx="18" fill="#fff"/>
    <path d="M19 17h60M19 29h44" stroke="#078BEA" strokeWidth="6" strokeLinecap="round"/>
   </g>
   <g transform="translate(249 39)"><rect width="73" height="53" rx="18" fill="#fff"/>
    <path d="M20 27l10 10 20-23" fill="none" stroke="#00A998" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
   </g>
  </>}
 </svg>;
}
function PersonIcon({captain}:{captain:boolean}){
 return captain
 ?<svg viewBox="0 0 56 56" fill="none" aria-hidden="true"><rect x="6" y="20" width="44" height="23" rx="9" fill="#0DBFD3"/><path d="M16 20l7-10h12l7 10" stroke="#078BEA" strokeWidth="4"/><circle cx="17" cy="42" r="6" fill="#17405A"/><circle cx="40" cy="42" r="6" fill="#17405A"/><path d="M23 26h10" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></svg>
 :<svg viewBox="0 0 56 56" fill="none" aria-hidden="true"><circle cx="28" cy="17" r="11" fill="#FFCD38"/><path d="M9 51v-7c0-11 7-18 19-18s19 7 19 18v7" fill="#078BEA"/><path d="M23 18l4 4 8-8" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></svg>;
}
export default function GuestEntry({screen,language,role,onRole,go}:Props){
 const tr=language==='en'?entryCopy.en:entryCopy.ar;
 const [step,setStep]=useState<0|1|2>(0);
 const titleRef=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{titleRef.current?.focus();},[screen,step]);
 const roleScreen=screen===3;
 const current=roleScreen?3:step;
 const title=roleScreen?tr.chooseTitle:step===0?tr.welcomeTitle:step===1?tr.explainerTitle:tr.detailsTitle;
 const tag=roleScreen?tr.chooseTag:step===0?tr.welcomeTag:step===1?tr.explainerTag:tr.detailsTag;
 const description=roleScreen?tr.chooseDescription:step===0?tr.welcomeDescription:step===1?tr.explainerDescription:tr.detailsDescription;
 const next=()=>{
  if(roleScreen){go(4);return;}
  if(step===2){go(3);return;}
  setStep((step+1) as 0|1|2);
 };
 const back=()=>{
  if(roleScreen){go(2);return;}
  if(step>0)setStep((step-1) as 0|1|2);
 };
 return <div className="phase-one-stage sekka-entry-stage">
  <main className={"phase-canvas phase-screen-"+screen+" sekka-entry"} dir={language==='en'?'ltr':'rtl'}>
   <div className="sekka-entry__header">
    <strong className="sekka-entry__brand sekka-entry__brand--text" role="img" aria-label={tr.brand} dir="rtl">{tr.brand}</strong>
    <div className="sekka-entry__header-actions">
     {(roleScreen||step>0)&&<button type="button" className="sekka-entry__back" onClick={back}
       aria-label={tr.back}>‹ <span>{tr.back}</span></button>}
     {!roleScreen&&<button type="button" className="sekka-entry__skip" onClick={()=>go(3)}>{tr.skip}</button>}
    </div>
   </div>
   <nav className="sekka-entry__progress" aria-label={tr.step+" "+(current+1)+" "+tr.of+" 4"}>
    {[0,1,2,3].map(index=><span key={index} className={index<=current?'is-active':''}
      aria-current={index===current?'step':undefined}/>)}
   </nav>
   <div className="sekka-entry__content" key={roleScreen?'roles':step}>
    <p className="sekka-entry__eyebrow">{tag}</p>
    <h1 className="phase-title sekka-entry__title" tabIndex={-1} ref={titleRef}>{title}</h1>
    <p className="sekka-entry__description">{description}</p>
    {roleScreen
     ?<div className="sekka-entry__roles" role="radiogroup" aria-label={tr.chooseTitle}>
       {([{id:'rider',title:tr.riderTitle,description:tr.riderDesc,label:tr.rider},
          {id:'captain',title:tr.captainTitle,description:tr.captainDesc,label:tr.captain}] as const)
        .map(item=><button type="button" key={item.id}
         role="radio" aria-label={item.label} aria-checked={role===item.id}
         className={"sekka-entry__role phase-role-card"+(role===item.id?' is-selected':'')}
         onClick={()=>onRole(item.id)}>
          <span className="sekka-entry__role-icon"><PersonIcon captain={item.id==='captain'}/></span>
          <span className="sekka-entry__role-text"><strong>{item.title}</strong><small>{item.description}</small></span>
          <span className="sekka-entry__check" aria-hidden="true">{role===item.id?'✓':''}</span>
        </button>)}
      </div>
     :step===2
       ?<ul className="sekka-entry__details">
        {[tr.detailOne,tr.detailTwo,tr.detailThree].map((text,index)=><li key={text}><span>{index+1}</span><strong>{text}</strong></li>)}
       </ul>
       :<div className="sekka-entry__art">{step===0||step===1
         ?<img className="sekka-entry__approved-scene" src={approvedSplashSceneUri}
           alt="" draggable={false} aria-hidden="true"/>
         :<RideIllustration variant={step}/>}</div>}
   </div>
   <div className="sekka-entry__footer">
    <button type="button" className={"sekka-entry__primary"+(!roleScreen?' phase-start':' phase-role-next')}
      onClick={next}>{roleScreen?tr.chooseButton:step===0?tr.welcomeButton:step===1?tr.explainerButton:tr.detailsButton}
      <span aria-hidden="true">{language==='en'?'→':'←'}</span></button>
    {!roleScreen&&step===0&&<p className="sekka-entry__signin">{tr.signinPrompt}{' '}
      <button type="button" onClick={()=>go(4)}>{tr.signinAction}</button>
    </p>}
   </div>
  </main>
 </div>;
}
