import { useEffect, useState, type ReactNode } from "react";
import "./launch-splash.css";

/** The opening animation is 5.15 seconds total, 1.5 seconds longer than the previous 3.65s motion. Other application screens
 * are mounted beneath it and remain completely unchanged. */
export const LAUNCH_SEQUENCE_MS = 5150;

export function shouldPlayLaunchSplash() {
  const current = new URL(window.location.href);
  if (current.pathname === "/dev/screens" || current.pathname === "/dev/screens/" ||
      current.searchParams.has("code") || current.searchParams.has("error") ||
      current.hash.includes("access_token=")) return false;
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (navigation) return navigation.type === "navigate" || navigation.type === "reload";
  const legacy = (performance as Performance & { navigation?: { type: number } }).navigation;
  return legacy?.type !== 2;
}

/** A premium cream Hiace-like shared minibus with lilac wave graphics.
 * Drawn locally in SVG so the wheels/body can animate independently without
 * video downloads or altering any of the existing app's internal UI. */
function HiaceArtwork() {
  return <svg className="sekka-launch__hiace" viewBox="0 0 530 276"
    xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="sekka-hiace-cream" x1="0" y1="0" x2=".18" y2="1">
        <stop offset="0" stopColor="#FFFCF7"/>
        <stop offset=".48" stopColor="#F5EDE3"/>
        <stop offset="1" stopColor="#D9C6B8"/>
      </linearGradient>
      <linearGradient id="sekka-hiace-side" x1="0" y1="0" x2=".3" y2="1">
        <stop offset="0" stopColor="#FBF4EB"/>
        <stop offset="1" stopColor="#E1CDC1"/>
      </linearGradient>
      <linearGradient id="sekka-hiace-windshield" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#332D3D"/>
        <stop offset=".6" stopColor="#463B4B"/>
        <stop offset="1" stopColor="#756579"/>
      </linearGradient>
      <linearGradient id="sekka-hiace-mauve" x1="0" y1="0" x2=".8" y2=".7">
        <stop offset="0" stopColor="#9F719E"/>
        <stop offset="1" stopColor="#633D73"/>
      </linearGradient>
      <filter id="sekka-hiace-sheen" x="-10%" y="-20%" width="120%" height="140%">
        <feDropShadow dx="0" dy="7" stdDeviation="5" floodColor="#281627" floodOpacity=".21"/>
      </filter>
    </defs>
    <ellipse cx="263" cy="251" rx="221" ry="12" fill="#271A29" opacity=".15"/>
    <g filter="url(#sekka-hiace-sheen)">
      {/* Roof follows the real van's long, nearly flat silhouette. */}
      <path d="M32 96 Q38 61 84 56 L340 54 Q366 56 389 77
       L457 114 Q482 125 493 150 L506 177 Q509 187 507 209
       L502 220 Q494 228 479 228 L46 228 Q22 228 20 208
       L22 127 Q23 104 32 96Z"
       fill="url(#sekka-hiace-cream)" stroke="#7F6975" strokeWidth="2.4"/>
      <path d="M52 76 Q73 64 101 63 L342 63 Q365 63 382 80"
        stroke="#FFFFFF" strokeWidth="6" fill="none" opacity=".95" strokeLinecap="round"/>
      {/* Large tinted passenger windows, doors and front cabin. */}
      <path d="M50 91 Q52 75 79 72 H123 V148 H43Z"
       fill="url(#sekka-hiace-windshield)" stroke="#9C9198" strokeWidth="3"/>
      <path d="M134 72 H217 V148 H134Z" fill="url(#sekka-hiace-windshield)"
       stroke="#9C9198" strokeWidth="3"/>
      <path d="M227 72 H317 V148 H227Z" fill="url(#sekka-hiace-windshield)"
       stroke="#9C9198" strokeWidth="3"/>
      <path d="M328 72 H343 Q367 73 385 96 L411 149 H328Z"
       fill="url(#sekka-hiace-windshield)" stroke="#9C9198" strokeWidth="3"/>
      <path d="M399 114 Q435 121 462 144 L481 166 L426 166Z"
       fill="url(#sekka-hiace-windshield)" stroke="#A99BA4" strokeWidth="3"/>
      {/* Warm glass reflections. */}
      <path d="M57 85 L89 76 M143 79 L184 79 M235 81 L275 81 M341 81 L365 95"
        stroke="#CFC3D4" strokeWidth="3" opacity=".55" strokeLinecap="round"/>
      <path d="M126 72 V215 M223 72 V215 M322 72 V217"
        stroke="#7E6A76" strokeWidth="2.6" opacity=".78"/>
      <rect x="238" y="168" width="15" height="5" rx="2" fill="#665C62"/>
      <rect x="151" y="168" width="15" height="5" rx="2" fill="#665C62"/>
      <path d="M385 157 L412 159 L417 166 L385 166Z" fill="#514751"/>
      <path d="M29 158 H497" stroke="#FDF9F2" strokeWidth="3" opacity=".8"/>
      {/* Flowing mauve wave at the bottom matches the chosen splash art. */}
      <path d="M21 185 C91 160 153 170 219 189
        C298 217 353 214 420 187
        L491 183 L506 208 Q501 222 479 227
        H45 Q24 225 21 211Z" fill="url(#sekka-hiace-mauve)" opacity=".96"/>
      <path d="M30 190 C106 169 164 176 225 195
        C305 218 365 207 421 187" stroke="#EBD4E8"
        strokeWidth="5" fill="none" opacity=".9" strokeLinecap="round"/>
      <path d="M37 210 H496" stroke="#5A435C" strokeWidth="3" opacity=".65"/>
      {/* Rear lamp, white front headlight and detailed bumper. */}
      <rect x="19" y="167" width="11" height="31" rx="4" fill="#D75765"/>
      <path d="M466 174 Q489 171 501 178 L505 190
        L470 190 Q461 187 466 174Z" fill="#FFEECE" stroke="#997681" strokeWidth="2"/>
      <path d="M463 184 L499 184" stroke="#FFFDFC" strokeWidth="5" opacity=".85"/>
      <path d="M481 196 H508 V211 H482Z" fill="#E7D8CC" stroke="#8B7981"/>
      <path d="M469 195 L494 196 L494 215 L463 215Z"
        fill="#2D252E" stroke="#B4A8AE"/>
      <path d="M473 201 H488 M471 206 H488 M468 211 H488"
        stroke="#A69AA0" strokeWidth="2"/>
      <circle cx="481" cy="190" r="5" fill="#CCB9B8"/>
      {/* Two wheels, independent rotation, silver alloy spokes. */}
      {[120,403].map(cx=><g key={cx} className="sekka-launch__wheel"
        style={{transformOrigin:cx+"px 222px"}}>
        <circle cx={cx} cy="222" r="35" fill="#1E1B21" stroke="#443B43" strokeWidth="3"/>
        <circle cx={cx} cy="222" r="24" fill="#C9C2C5" stroke="#E7E0E0" strokeWidth="3"/>
        <circle cx={cx} cy="222" r="17" fill="#89838B"/>
        {[0,60,120,180,240,300].map(deg=>
          <path key={deg} d={`M${cx} 203 L${cx+5} 214 L${cx} 224 L${cx-5} 214Z`}
            fill="#EAE3E5" transform={`rotate(${deg} ${cx} 222)`}/>)}
        <circle cx={cx} cy="222" r="5" fill="#71656F"/>
      </g>)}
      <rect x="251" y="201" width="58" height="13" rx="6" fill="#F9F1E4" opacity=".88"/>
      <text x="280" y="211" textAnchor="middle"
        style={{font:"900 11px Tahoma,Arial,sans-serif"}} fill="#6A426D">سِكّة</text>
    </g>
  </svg>;
}

function CairoScenery() {
  return <svg className="sekka-launch__scenery" viewBox="0 0 390 700"
    preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="sekka-scene-sand" x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#E4B8A3" stopOpacity=".2"/>
        <stop offset="1" stopColor="#91617C" stopOpacity=".62"/>
      </linearGradient>
    </defs>
    <g stroke="#B88C9B" strokeWidth="1.6" opacity=".18" fill="none">
      <path d="M-70 30 L190 210 L430 42 M-60 190 L200 70 L448 240 M-40 275 L250 125 L420 350"/>
      <path d="M30 0 L105 245 L310 285 M300 -30 L255 170 L355 310"/>
      <path d="M0 104 L390 171 M0 245 L390 291"/>
    </g>
    <g fill="#B98597" opacity=".4">
      <circle cx="75" cy="70" r="4"/><circle cx="323" cy="117" r="5"/>
      <circle cx="203" cy="221" r="4"/><circle cx="115" cy="168" r="4"/>
    </g>
    {/* A subtle Cairo silhouette and pyramids behind the drive. */}
    <g fill="url(#sekka-scene-sand)" opacity=".64">
      <path d="M-30 405 L42 333 L111 405Z"/>
      <path d="M65 406 L105 353 L148 406Z"/>
      <path d="M115 406 L153 370 L190 406Z"/>
      <path d="M194 402 H209 V347 H215 V323 H219 V309 H222 V323 H225 V346 H231 V402Z"/>
      <path d="M235 401 H252 V378 Q263 345 278 378 H296 V401Z"/>
      <path d="M259 364 Q273 335 288 364 L284 370 H264Z"/>
      <path d="M310 401 H320 V346 H325 V329 H329 V346 H336 V401Z"/>
      <path d="M341 404 H348 V351 H356 V317 H360 V351 H370 V404Z"/>
    </g>
    <path d="M-40 424 Q90 400 203 431 T443 415" fill="none"
      stroke="#97718B" strokeWidth="1" opacity=".3"/>
    <path d="M-60 455 Q120 432 205 455 Q322 474 450 447"
      stroke="#936783" strokeWidth="70" fill="none" opacity=".06"/>
    <g fill="none" stroke="#A7769C" strokeWidth="3" opacity=".43" strokeLinecap="round">
      <path d="M4 300 C72 282 76 365 143 338 S248 312 284 341 S348 351 391 320"
        strokeDasharray="8 13"/>
    </g>
    <g transform="translate(276 294)" opacity=".75">
      <path d="M0 0 C-14 0 -22 11 -22 23 C-22 39 0 61 0 61
       S22 39 22 23 C22 11 14 0 0 0Z" fill="#7C4C83"/>
      <circle cy="23" r="8" fill="#FBF3E8"/>
    </g>
  </svg>;
}

export default function LaunchSplash({children}:{children:ReactNode}) {
  const [visible,setVisible]=useState(shouldPlayLaunchSplash);
  useEffect(()=>{
    if(!visible)return;
    const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches??false;
    const timer=window.setTimeout(()=>setVisible(false),reduced?200:LAUNCH_SEQUENCE_MS);
    return()=>window.clearTimeout(timer);
  },[visible]);

  return <>
    {children}
    {visible&&<div className="sekka-launch" role="status" aria-label="جاري فتح سِكّة" aria-live="off">
      <div className="sekka-launch__stage">
        <CairoScenery/>
        <div className="sekka-launch__logo" dir="rtl">
          <span className="sekka-launch__wordmark">سِكّة</span>
          <span className="sekka-launch__accent" aria-hidden="true"/>
          <span className="sekka-launch__subline">SEKKA GO</span>
        </div>
        <div className="sekka-launch__road" aria-hidden="true"/>
        <div className="sekka-launch__vehicle"><HiaceArtwork/></div>
      </div>
      <div className="sekka-launch__black-wipe" aria-hidden="true"/>
    </div>}
  </>;
}
