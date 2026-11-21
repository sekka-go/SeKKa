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
    <svg className="sekka-launch__road-flow" viewBox="0 0 390 844"
     preserveAspectRatio="none" focusable="false" aria-hidden="true">
     <path d="M 10 735 Q 90 733 170 709" className="sekka-launch__road-flow-mark"
      fill="none" stroke="#FFFDFC" strokeWidth="6" strokeLinecap="round" strokeDasharray="20 35"/>
     <path d="M 352 711 Q 374 679 394 646" className="sekka-launch__road-flow-mark sekka-launch__road-flow-mark--far"
      fill="none" stroke="#FFFDFC" strokeWidth="4" strokeLinecap="round" strokeDasharray="14 28"/>
    </svg>
    <div className="sekka-launch__wave sekka-launch__wave--bottom" aria-hidden="true"/>
   </div>
   <div className="sekka-launch__wave-wipe" aria-hidden="true"/>
  </div>}</>;
}
