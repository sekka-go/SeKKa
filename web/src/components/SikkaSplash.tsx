import { useEffect, useMemo, useState, type CSSProperties } from "react";

type FloatingMark = { x: number; y: number; size: number; duration: number; delay: number; glow: number };
const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

function RouteMark({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <svg className={className} style={style} viewBox="0 0 100 100" fill="none" aria-hidden="true">
    <path d="M25 77c21-5 46-12 46-25 0-12-39-11-39-24 0-7 12-12 32-16" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
    <path d="M28 86c27-6 56-17 56-34 0-16-42-16-42-25 0-5 7-9 20-12" stroke="currentColor" strokeOpacity=".55" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M67 7c-7.2 0-13 5.8-13 13 0 9.2 13 22 13 22s13-12.8 13-22c0-7.2-5.8-13-13-13Z" fill="var(--splash-gold)" />
    <circle cx="67" cy="20" r="4" fill="#101827" />
    <path d="M28 61c-6.1 0-11 4.9-11 11 0 7.8 11 18 11 18s11-10.2 11-18c0-6.1-4.9-11-11-11Z" fill="var(--splash-gold)" />
    <circle cx="28" cy="72" r="3.5" fill="#101827" />
  </svg>;
}

export default function SikkaSplash({ onComplete }: { onComplete: () => void }) {
  const marks = useMemo<FloatingMark[]>(() => Array.from({ length: 9 }, (_, index) => ({
    x: randomBetween(6, 94),
    y: randomBetween(9, 91),
    size: randomBetween(22, 62),
    duration: randomBetween(3.8, 7.6),
    delay: randomBetween(-5, 0),
    glow: index % 3 === 0 ? 1 : 0,
  })), []);
  const [arabicTitle, setArabicTitle] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const titleTimer = window.setInterval(() => setArabicTitle((current) => !current), 1050);
    const closeTimer = window.setTimeout(() => setClosing(true), 2780);
    const finishTimer = window.setTimeout(onComplete, 3120);
    return () => { window.clearInterval(titleTimer); window.clearTimeout(closeTimer); window.clearTimeout(finishTimer); };
  }, [onComplete]);

  return <div className={`sikka-splash ${closing ? "is-closing" : ""}`} role="status" aria-label="جاري فتح سِكّة">
    <div className="splash-atmosphere" aria-hidden="true"><i /><i /><i /></div>
    <div className="splash-track" aria-hidden="true" />
    <div className="splash-floating-marks" aria-hidden="true">{marks.map((mark, index) => <RouteMark key={index} className={`splash-floating-mark ${mark.glow ? "has-glow" : ""}`} style={{
      left: `${mark.x}%`, top: `${mark.y}%`, width: `${mark.size}px`, height: `${mark.size}px`,
      animationDuration: `${mark.duration}s`, animationDelay: `${mark.delay}s`,
    }} />)}</div>
    <div className="splash-content">
      <div className="splash-emblem"><RouteMark className="splash-main-mark" /></div>
      <div className={`splash-title ${arabicTitle ? "is-arabic" : "is-english"}`} aria-live="polite">
        <span className="splash-title-english" lang="en">Sikka</span>
        <span className="splash-title-arabic" lang="ar" dir="rtl">سِكّة</span>
      </div>
      <p className="splash-tagline">طريقك أسهل مع سِكّة</p>
      <div className="splash-loading" aria-hidden="true"><i /></div>
    </div>
    <span className="splash-corner-brand" aria-hidden="true">SeKKa</span>
  </div>;
}
