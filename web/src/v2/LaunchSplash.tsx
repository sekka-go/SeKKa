import {useEffect,useState,type ReactNode} from "react";
import "./launch-splash.css";

// Keep auth callbacks and dev gallery free of decorative launch delays.
export const LAUNCH_SEQUENCE_MS=5150;
export function shouldPlayLaunchSplash(){
 const current=new URL(window.location.href);
 if(current.pathname.startsWith("/dev/screens")||current.searchParams.has("code")||
    current.searchParams.has("error")||current.hash.includes("access_token="))return false;
 const entry=performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming|undefined;
 return !entry||entry.type==="navigate"||entry.type==="reload";
}
function Skyline(){
 return <svg className="sekka-launch__skyline" viewBox="0 0 480 230"
  preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
  <defs>
   <linearGradient id="sk-sand" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#FFE6A0"/><stop offset="1" stopColor="#F7BB75"/></linearGradient>
   <linearGradient id="sk-river" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#67E9F2"/><stop offset="1" stopColor="#11A4E1"/></linearGradient>
  </defs>
  <g fill="#FFFFFF" opacity=".86"><ellipse cx="58" cy="45" rx="49" ry="15"/><circle cx="49" cy="31" r="23"/>
   <ellipse cx="421" cy="36" rx="48" ry="12"/><circle cx="431" cy="24" r="19"/></g>
  <g fill="#A5D7EA">
   <path d="M0 151V103h18V82h29v69h18V97h25v54h11V85h27v66h14V112h31v39h17V94h26v57h23V111h29v40h17V81h29v70h21V103h20v48h23V93h31v58h17V119h24v32h25V88h29v63h20V98h31v53h21V111h37v40z"/>
  </g>
  <g fill="#74BBDD" opacity=".9">
   <path d="M0 174v-51h22v-30h19v81h19v-38h37v38h19v-56h17v56h34v-46h27v46h28v-38h23v38h32v-44h24v44h34v-36h31v36h18v-54h29v54h27v-41h20v41h21v-48h31v48h30z"/>
  </g>
  <path d="M191 174h11L211 47l9 127h12l-9-132h-3l-3-18-3 18h-3z" fill="#D1AF87"/>
  <path d="M201 61h25M203 89h22M202 118h22M202 146h24" stroke="#805F65" strokeWidth="2" opacity=".65"/>
  <path d="M291 174 359 78l72 96z" fill="url(#sk-sand)"/>
  <path d="M342 174 398 100l55 74z" fill="#EFC08C"/>
  <path d="M359 78l-21 28 20-8 22 9z" fill="#FFF0CF"/>
  <path d="M398 100l-15 21 15-7 17 10z" fill="#FFEDD3"/>
  <path d="M0 181q120-18 238 0t242-8v57H0Z" fill="#67C992"/>
  <path d="M0 194q140-7 240 4t240-7v39H0Z" fill="url(#sk-river)"/>
  <g stroke="#D8FFFF" strokeWidth="2" opacity=".64"><path d="M15 212h68M118 220h49M238 207h51M343 218h81"/></g>
  <g fill="#2EAC78"><circle cx="16" cy="168" r="15"/><circle cx="43" cy="169" r="18"/>
   <circle cx="462" cy="170" r="18"/><circle cx="435" cy="169" r="13"/></g>
 </svg>
}
function Road(){
 return <svg className="sekka-launch__road-scene" viewBox="0 0 480 410"
  preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <defs>
   <linearGradient id="sk-asphalt" x1="0" y1="1" x2=".9" y2="0"><stop stopColor="#334F77"/>
    <stop offset=".55" stopColor="#4A6689"/><stop offset="1" stopColor="#6B84A0"/></linearGradient>
  </defs>
  <path d="M-100 410C160 395 278 279 333 199C380 130 423 100 536 65L552 175C474 194 433 242 399 293C358 359 259 424 174 465Z"
   fill="url(#sk-asphalt)"/>
  <path d="M-80 405C159 384 283 276 336 199C384 130 423 102 533 67"
   fill="none" stroke="#FFE86B" strokeWidth="7"/>
  <path d="M164 430C270 377 352 322 389 257C426 195 456 163 540 143"
   fill="none" stroke="#FFFFFF" strokeWidth="9"/>
  <path className="sekka-launch__road-markings" d="M32 405C195 359 288 306 347 235C389 181 423 154 495 126"
   fill="none" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" strokeDasharray="32 43"/>
  <path className="sekka-launch__road-markings sekka-launch__road-markings--near"
   d="M-20 432C137 393 269 331 330 282"
   fill="none" stroke="#FFFDF8" strokeWidth="11" strokeDasharray="37 54"/>
 </svg>;
}
function SUV(){
 return <svg className="sekka-launch__suv" viewBox="0 0 480 292" role="img" aria-label="عربية سِكَّة البيضاء">
 <defs>
  <linearGradient id="sk-body" x1=".2" y1="0" x2=".7" y2="1"><stop stopColor="#FFFFFF"/>
   <stop offset=".57" stopColor="#F4F8FF"/><stop offset="1" stopColor="#CADBEA"/></linearGradient>
  <linearGradient id="sk-side" x1=".25" y1="0" x2="1" y2="1"><stop stopColor="#FDFEFF"/>
   <stop offset="1" stopColor="#AFC7DF"/></linearGradient>
  <linearGradient id="sk-glass" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#10243C"/>
   <stop offset="1" stopColor="#315D82"/></linearGradient>
  <filter id="sk-shadow" x="-20%" y="-20%" width="145%" height="150%">
   <feDropShadow dx="2" dy="6" stdDeviation="5" floodColor="#203D5C" floodOpacity=".26"/>
  </filter>
 </defs>
 <ellipse cx="211" cy="255" rx="190" ry="21" fill="#173957" opacity=".29"/>
 <g filter="url(#sk-shadow)">
  <path d="M286 217l90-25 16 30-9 18-80 10-24-10Z" fill="#182A3E"/>
  <ellipse cx="343" cy="228" rx="29" ry="38" fill="#152236" stroke="#43596A" strokeWidth="5"/>
  <ellipse cx="343" cy="228" rx="18" ry="25" fill="#C9D9E7" stroke="#F6FBFF" strokeWidth="4"/>
  <path d="M85 224l70-11 15 29-22 18-59-1-18-14Z" fill="#1C2B3C"/>
  <ellipse cx="118" cy="232" rx="36" ry="43" fill="#152236" stroke="#3D5367" strokeWidth="5"/>
  <ellipse cx="118" cy="232" rx="23" ry="28" fill="#DCE7F4" stroke="#FFFFFF" strokeWidth="4"/>
  <path d="M78 76l60-30c44-17 140-19 185-2l81 69 28 63-15 52-72 21-44-12-133 13-117-20-10-22 5-76 15-56Z"
   fill="url(#sk-body)" stroke="#A6BACB" strokeWidth="4"/>
  <path d="M254 49c30-6 59-4 76 5l72 62 22 61-21 33-96 24-7-111-46-74Z"
   fill="url(#sk-side)" stroke="#A1B8CA" strokeWidth="3"/>
  <path d="M94 87q18-35 70-40h107l-5 94-179-5Z"
   fill="url(#sk-glass)" stroke="#8CA9C1" strokeWidth="7"/>
  <path d="M277 57q41-4 56 7l63 57 11 29-111-10-19-83Z" fill="url(#sk-glass)" stroke="#8DADC7" strokeWidth="6"/>
  <path d="M333 70l7 80M278 141l20 98M90 138l-6 61" fill="none" stroke="#86A1B8" strokeWidth="3"/>
  <path d="M69 152q82 22 222 2l2 67q-123 25-236-5Z" fill="#F3F9FF" stroke="#B6C9D9" strokeWidth="3"/>
  <path d="M66 167l59 9 2 17-63-7Z" fill="#F94138" stroke="#F88B69" strokeWidth="4"/>
  <path d="M224 174l61-10 4 18-61 14Z" fill="#F94138" stroke="#F88B69" strokeWidth="4"/>
  <path d="M64 198q106 24 226 2l-3 29q-108 22-236-2Z" fill="#DCE7F1" stroke="#A4B8CB" strokeWidth="3"/>
  <path d="M57 225q119 24 244 1l-11 21-111 15-112-15Z" fill="#243D57"/>
  <path d="M311 174l91-6-4 24-89 12Z" fill="#E8F2F8" opacity=".7"/>
  <path d="M344 156l65-2" stroke="#F8FBFF" strokeWidth="5" opacity=".68"/>
  <path d="M76 76q85-24 181-20" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" opacity=".8"/>
  <rect x="146" y="189" width="69" height="34" rx="8" fill="#00AFC0"/>
  <text x="180.5" y="211" textAnchor="middle" fill="#FFFFFF"
   style={{font:"900 19px Tajawal,Tahoma,sans-serif"}}>سِكَّة</text>
  <path d="M404 153l18 6-3 22-16 4Z" fill="#173A50"/>
 </g>
 </svg>;
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
    <Skyline/>
    <Road/>
    <div className="sekka-launch__car"><SUV/></div>
    <div className="sekka-launch__destination" aria-hidden="true"/>
    <div className="sekka-launch__wave sekka-launch__wave--bottom" aria-hidden="true"/>
   </div>
   <div className="sekka-launch__wave-wipe" aria-hidden="true"/>
  </div>}</>;
}
