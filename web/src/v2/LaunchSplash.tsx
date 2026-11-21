import { useEffect, useState, type ReactNode } from "react";
import "./launch-splash.css";

export const LAUNCH_SEQUENCE_MS = 3650;

/* A launch-only animation. OAuth callbacks and back navigation must never be
 * blocked, and the existing Google session and selected tab stay untouched. */
export function shouldPlayLaunchSplash() {
  const current = new URL(window.location.href);
  if ((current.pathname === "/dev/screens" || current.pathname === "/dev/screens/") ||
      current.searchParams.has("code") ||
      current.searchParams.has("error") ||
      current.hash.includes("access_token=")) return false;

  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (navigation) return navigation.type === "navigate" || navigation.type === "reload";
  const legacy = (performance as Performance & { navigation?: { type: number } }).navigation;
  return legacy?.type !== 2;
}

/** Vector side-view of a Hiace-style shared minibus, never a motorcycle.
 * SVG is bundled locally: no third-party asset request, no extra animation JS. */
function HiaceArtwork() {
  return <svg className="sekka-launch__hiace" viewBox="0 0 450 228"
    xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="sekka-hiace-body" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stopColor="#AC82D3"/>
        <stop offset="57%" stopColor="#8756BC"/>
        <stop offset="100%" stopColor="#67419A"/>
      </linearGradient>
      <linearGradient id="sekka-hiace-glass" x1="0" x2="0" y1="0" y2="1">
        <stop stopColor="#25212D"/><stop offset="100%" stopColor="#4B425A"/>
      </linearGradient>
    </defs>
    <ellipse cx="222" cy="191" rx="180" ry="14" fill="#171519" opacity=".12"/>
    {/* Rounded roof / wide sliding-door minibus body */}
    <path d="M34 91 Q38 47 92 42 L315 42 Q350 42 370 67 L412 109
       Q423 125 423 148 L423 172 Q423 180 413 180 L35 180
       Q19 180 19 165 L19 111 Q19 96 34 91Z"
       fill="url(#sekka-hiace-body)" stroke="#231E28" strokeWidth="5" strokeLinejoin="round"/>
    {/* Continuous body highlight */}
    <path d="M42 91 Q45 59 91 56 L320 56 Q345 56 360 75"
      stroke="#D7B5EE" strokeWidth="6" fill="none" opacity=".8" strokeLinecap="round"/>
    <path d="M39 139 H413" stroke="#E4C3F4" strokeWidth="5" opacity=".6"/>
    {/* Rear, middle and front passenger windows */}
    <path d="M55 77 Q58 65 89 63 H135 V112 H47 Z"
      fill="url(#sekka-hiace-glass)" stroke="#D8C9E1" strokeWidth="3"/>
    <path d="M146 63 H221 V112 H146 Z"
      fill="url(#sekka-hiace-glass)" stroke="#D8C9E1" strokeWidth="3"/>
    <path d="M231 63 H300 Q325 63 338 78 L350 112 H231 Z"
      fill="url(#sekka-hiace-glass)" stroke="#D8C9E1" strokeWidth="3"/>
    <path d="M347 91 L376 113 L403 126 L403 138 L351 138 Z"
      fill="#27232F" stroke="#D9C6E6" strokeWidth="3"/>
    <path d="M142 62 V171 M224 62 V171 M351 104 V171"
      stroke="#3A2947" strokeWidth="2.5" opacity=".8"/>
    <path d="M177 136 H201 M258 136 H284" stroke="#EFE5F6" strokeWidth="6" strokeLinecap="round"/>
    <rect x="390" y="146" width="31" height="17" rx="5" fill="#F9E9C9"/>
    <path d="M21 150 H33" stroke="#FDC5B3" strokeWidth="11" strokeLinecap="round"/>
    <path d="M34 166 H417" stroke="#302638" strokeWidth="4" opacity=".7"/>
    {/* Two wheels, painted separately to animate rotation */}
    <g className="sekka-launch__wheel" style={{transformOrigin:"105px 180px"}}>
      <circle cx="105" cy="180" r="29" fill="#171519" stroke="#F2E7DB" strokeWidth="2"/>
      <circle cx="105" cy="180" r="14" fill="#EEE6E0"/>
      <path d="M105 167 V193 M92 180 H118" stroke="#5A5060" strokeWidth="4"/>
    </g>
    <g className="sekka-launch__wheel" style={{transformOrigin:"348px 180px"}}>
      <circle cx="348" cy="180" r="29" fill="#171519" stroke="#F2E7DB" strokeWidth="2"/>
      <circle cx="348" cy="180" r="14" fill="#EEE6E0"/>
      <path d="M348 167 V193 M335 180 H361" stroke="#5A5060" strokeWidth="4"/>
    </g>
    <rect x="193" y="151" width="81" height="18" rx="9" fill="#F3EBDD" opacity=".9"/>
    <text x="234" y="164" fill="#27212D" textAnchor="middle"
      style={{fontFamily:"Tahoma, Arial, sans-serif",fontSize:12,fontWeight:900}}>سِكّة</text>
  </svg>;
}

export default function LaunchSplash({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(shouldPlayLaunchSplash);

  useEffect(() => {
    if (!visible) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const timer = window.setTimeout(() => setVisible(false), reduced ? 250 : LAUNCH_SEQUENCE_MS);
    return () => window.clearTimeout(timer);
  }, [visible]);

  return <>
    {children}
    {visible && <div className="sekka-launch" role="status"
      aria-label="جاري فتح سِكّة" aria-live="off">
      <div className="sekka-launch__stage">
        <div className="sekka-launch__road" aria-hidden="true"/>
        <div className="sekka-launch__vehicle"><HiaceArtwork/></div>
        <div className="sekka-launch__copy">
          <span className="sekka-launch__wordmark">سِكّة</span>
          <span className="sekka-launch__subline">SEKKA GO</span>
        </div>
      </div>
      <div className="sekka-launch__black-wipe" aria-hidden="true"/>
    </div>}
  </>;
}
