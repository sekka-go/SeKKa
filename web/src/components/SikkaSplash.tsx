import { t } from "../i18n/runtime";
import { useEffect, useMemo, useState } from "react";
import SikkaMark from "./SikkaMark";

type FloatingMark = { x: number; y: number; size: number; duration: number; delay: number; glow: number };
const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

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

  return <div className={`sikka-splash ${closing ? "is-closing" : ""}`} role="status" aria-label={t("جاري فتح سِكّة")}>
    <div className="splash-atmosphere" aria-hidden="true"><i /><i /><i /></div>
    <div className="splash-track" aria-hidden="true" />
    <div className="splash-floating-marks" aria-hidden="true">{marks.map((mark, index) => <SikkaMark key={index} className={`splash-floating-mark ${mark.glow ? "has-glow" : ""}`} style={{
      left: `${mark.x}%`, top: `${mark.y}%`, width: `${mark.size}px`, height: `${mark.size}px`,
      animationDuration: `${mark.duration}s`, animationDelay: `${mark.delay}s`,
    }} />)}</div>
    <div className="splash-content">
      <div className="splash-emblem"><SikkaMark className="splash-main-mark" /></div>
      <div className={`splash-title ${arabicTitle ? "is-arabic" : "is-english"}`} aria-live="polite">
        <span className="splash-title-english" lang="en">Sikka</span>
        <span className="splash-title-arabic" lang="ar" dir="rtl">{t("سِكّة")}</span>
      </div>
      <p className="splash-tagline">{t("طريقك أسهل مع سِكّة")}</p>
      <div className="splash-loading" aria-hidden="true"><i /></div>
    </div>
    <span className="splash-corner-brand" aria-hidden="true">SeKKa</span>
  </div>;
}
