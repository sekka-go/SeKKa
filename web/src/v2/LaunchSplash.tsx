import {useEffect,useState,type ReactNode} from "react";
import {approvedSplashSceneUri} from "./approvedSplashScene";
import "./launch-splash.css";

// Production-only splash. Auth callbacks and the developer gallery bypass it.
export const LAUNCH_SEQUENCE_MS=5150;
export function shouldPlayLaunchSplash(){
 const current=new URL(window.location.href);
 if(current.pathname.startsWith("/dev/screens")||current.searchParams.has("code")||
    current.searchParams.has("error")||current.hash.includes("access_token="))return false;
 const entry=performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming|undefined;
 return !entry||entry.type==="navigate"||entry.type==="reload";
}
export default function LaunchSplash({children}:{children:ReactNode}){
 const [visible,setVisible]=useState(shouldPlayLaunchSplash);
 useEffect(()=>{
  if(!visible)return;
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches??false;
  const id=window.setTimeout(()=>setVisible(false),reduced?180:LAUNCH_SEQUENCE_MS);
  return()=>window.clearTimeout(id);
 },[visible]);
 return <>{children}{visible&&<div className="sekka-launch" role="status"
  aria-label="جاري فتح سِكَّة" aria-live="off">
   <div className="sekka-launch__stage">
    <div className="sekka-launch__wave sekka-launch__wave--top" aria-hidden="true"/>
    <div className="sekka-launch__brand" dir="rtl">
     <strong className="sekka-launch__brand-name">سِكَّة</strong>
     <p className="sekka-launch__tagline">معاك في <b>السِكَّة</b></p>
    </div>
    <img className="sekka-launch__approved-scene" src={approvedSplashSceneUri} alt=""
     draggable={false} aria-hidden="true"/>
    {/* All positions share the approved 700×697 artwork's coordinate
        space. The road cues follow the painted lanes; rotating wheel hubs
        overlay the stationary body instead of moving or deforming the SUV. */}
    <svg className="sekka-launch__motion" viewBox="0 0 700 697"
     preserveAspectRatio="xMidYMax slice" focusable="false" aria-hidden="true">
     <defs>
      <linearGradient id="sk-chrome-rim" x1="0" y1="0" x2="1" y2="1">
       <stop offset="0%" stopColor="#ECF8FF"/>
       <stop offset="44%" stopColor="#788AA4"/>
       <stop offset="80%" stopColor="#DAEAF5"/>
       <stop offset="100%" stopColor="#52647B"/>
      </linearGradient>
      <linearGradient id="sk-chrome-spoke" x1="0" y1="0" x2="1" y2="0">
       <stop offset="0%" stopColor="#58677F"/>
       <stop offset="44%" stopColor="#F6FAFF"/>
       <stop offset="100%" stopColor="#A9BBCE"/>
      </linearGradient>
      <linearGradient id="sk-road-glint" x1="1" y1="0" x2="0" y2="1">
       <stop offset="0%" stopColor="#FFFFFF" stopOpacity=".12"/>
       <stop offset="40%" stopColor="#FFFFFF" stopOpacity=".55"/>
       <stop offset="100%" stopColor="#FFFFFF" stopOpacity=".14"/>
      </linearGradient>
      <clipPath id="sk-near-lane">
       <path d="M0 561 C177 574 350 535 547 424 L700 443 700 630 0 697Z"/>
      </clipPath>
      <clipPath id="sk-far-lane">
       <path d="M554 479 Q630 434 654 377 Q665 322 603 280 L700 248 700 530 552 530Z"/>
      </clipPath>
     </defs>
     {/* The near side retreats toward lower left, following its actual
         curved lane. The far markings move slower with perspective. */}
     <g clipPath="url(#sk-near-lane)" className="sekka-launch__road-cues">
      <path d="M82 620 C215 602 394 551 543 449"
       className="sekka-launch__lane-cue sekka-launch__lane-cue--near"
       fill="none" stroke="url(#sk-road-glint)" strokeWidth="8"
       strokeLinecap="round" strokeDasharray="18 82"/>
     </g>
     <g clipPath="url(#sk-far-lane)" className="sekka-launch__road-cues">
      <path d="M551 484 C598 450 640 411 650 359 Q648 310 599 287"
       className="sekka-launch__lane-cue sekka-launch__lane-cue--far"
       fill="none" stroke="url(#sk-road-glint)" strokeWidth="4.5"
       strokeLinecap="round" strokeDasharray="13 57"/>
     </g>
     {/* Only the silver hubs rotate. Both dark rubber tire silhouettes
         stay in the original approved illustration. */}
     <g className="sekka-launch__wheel" transform="translate(394 447) scale(.36 1)">
      <circle r="40" fill="#172033" stroke="#2B394D" strokeWidth="2"/>
      <circle r="35" fill="url(#sk-chrome-rim)" stroke="#B4C9D8" strokeWidth="2.8"/>
      <circle r="29.5" fill="#202B3F"/>
      <g className="sekka-launch__wheel-spinner">
       <circle r="27.5" fill="#263248"/>
       {Array.from({length:5},(_,i)=><path key={i} transform={`rotate(${i*72})`}
        d="M-5 -6 L-8 -26 Q0 -29 8 -26 L5 -6Z"
        fill="url(#sk-chrome-spoke)" stroke="#B7C7D9" strokeWidth=".8"/>)}
       <circle r="8" fill="#C4D2DF" stroke="#65778B" strokeWidth="2"/>
       <circle r="3.5" fill="#43546A"/>
      </g>
      <ellipse rx="34" ry="34" fill="none" stroke="#E9F3FA"
       strokeOpacity=".45" strokeWidth="1.4"/>
     </g>
     <g className="sekka-launch__wheel sekka-launch__wheel--front"
      transform="translate(530 407) scale(.33 1)">
      <circle r="34" fill="#172033" stroke="#253349" strokeWidth="2"/>
      <circle r="30" fill="url(#sk-chrome-rim)" stroke="#B4C9D8" strokeWidth="2.7"/>
      <circle r="25" fill="#202B3F"/>
      <g className="sekka-launch__wheel-spinner">
       <circle r="23.5" fill="#263248"/>
       {Array.from({length:5},(_,i)=><path key={i} transform={`rotate(${i*72})`}
        d="M-4 -5 L-7 -22 Q0 -25 7 -22 L4 -5Z"
        fill="url(#sk-chrome-spoke)" stroke="#B7C7D9" strokeWidth=".8"/>)}
       <circle r="7" fill="#C4D2DF" stroke="#65778B" strokeWidth="1.6"/>
       <circle r="3" fill="#43546A"/>
      </g>
      <circle r="30" fill="none" stroke="#E9F3FA"
       strokeOpacity=".3" strokeWidth="1.5"/>
     </g>
    </svg>
    <div className="sekka-launch__wave sekka-launch__wave--bottom" aria-hidden="true"/>
   </div>
   <div className="sekka-launch__wave-wipe" aria-hidden="true"/>
  </div>}</>;
}
