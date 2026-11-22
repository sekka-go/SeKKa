import {useEffect,useState,type ReactNode} from "react";
import {approvedSplashSceneUri} from "./approvedSplashScene";
import LaunchWheelMotion from "./LaunchWheelMotion";
import "./launch-splash.css";

// Production-only splash. Auth callbacks and the developer gallery bypass it.
export const LAUNCH_SEQUENCE_MS=5150;
export function shouldPlayLaunchSplash(){
 const current=new URL(window.location.href);
 if(current.pathname.startsWith("/dev/screens")||current.searchParams.has("code")||
    current.searchParams.has("error")||current.hash.includes("access_token="))return false;
 const entry=performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming|undefined;
 if(entry?.type==="reload")return false;
 try{
  const key="sekka.launch.seen.v1";
  if(sessionStorage.getItem(key)==="1")return false;
 }catch{/* Private browsing still permits the initial launch. */}
 return !entry||entry.type==="navigate";
}
export default function LaunchSplash({children}:{children:ReactNode}){
 const [visible,setVisible]=useState(shouldPlayLaunchSplash);
 useEffect(()=>{
  if(!visible)return;
  try{sessionStorage.setItem("sekka.launch.seen.v1","1");}catch{/* Session storage is optional. */}
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
    {/* The road glints follow the painted lanes at the approved scene's
        own perspective. The real wheel pixels are rotated by a separate
        canvas, preserving the SUV's original design. */}
    <svg className="sekka-launch__motion" viewBox="0 0 700 697"
     preserveAspectRatio="xMidYMax slice" focusable="false" aria-hidden="true">
     <defs>
      <linearGradient id="sk-road-glint" x1="1" y1="0" x2="0" y2="1">
       <stop offset="0%" stopColor="#FFFFFF" stopOpacity=".12"/>
       <stop offset="40%" stopColor="#FFFFFF" stopOpacity=".55"/>
       <stop offset="100%" stopColor="#FFFFFF" stopOpacity=".14"/>
      </linearGradient>
      <clipPath id="sk-near-lane">
       <path d="M214 546 C349 520 456 474 547 424 L636 446 545 520 Q391 583 214 611Z"/>
      </clipPath>
      <clipPath id="sk-far-lane">
       <path d="M554 479 Q630 434 654 377 Q665 322 603 280 L700 248 700 530 552 530Z"/>
      </clipPath>
     </defs>
     {/* The near side retreats toward lower left, following its actual
         curved lane. The far markings move slower with perspective. */}
     <g clipPath="url(#sk-near-lane)" className="sekka-launch__road-cues">
      <path d="M225 550 C344 534 442 496 540 451"
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
    </svg>
    <LaunchWheelMotion/>
    <div className="sekka-launch__wave sekka-launch__wave--bottom" aria-hidden="true"/>
   </div>
   <div className="sekka-launch__wave-wipe" aria-hidden="true"/>
  </div>}</>;
}
