import { useEffect, useRef, useState, type PointerEvent } from "react";
import { t, useLanguage } from "../i18n/runtime";

const captions = [
  "كل صباح، هل ستأتي الرحلة؟ وكم ستكلف؟",
  "كابتن يسلك الطريق نفسه ومقاعده فارغة.",
  "مسار وموعد ومقاعد متاحة، على سِكّة واحدة.",
  "شاركوا الرحلة والحديث والتكلفة.",
  "صل في موعدك. طريقك أسهل مع سِكّة.",
];

function StoryArt({ scene }: { scene: number }) {
  return <svg className={`landing-story-art landing-story-art--${scene + 1}`} viewBox="0 0 420 280" fill="none" aria-hidden="true">
    <rect x="16" y="14" width="388" height="252" rx="34" fill="var(--color-surface-elevated)" />
    <circle cx="342" cy="58" r="18" fill="color-mix(in srgb, var(--brand-green) 22%, var(--color-surface))" />
    <path d="M42 218H378" stroke="var(--color-border)" strokeWidth="4" strokeLinecap="round" />
    {scene === 0 && <>
      <path d="M96 202V105H180V202M84 105H192" stroke="var(--color-text-secondary)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M110 182H166M110 182v20M166 182v20" stroke="var(--brand-green)" strokeWidth="8" strokeLinecap="round" />
      <path d="M240 218c3-32 13-48 32-48s30 16 33 48" fill="var(--brand-green)" />
      <path d="M257 159c0-18 8-29 20-29s20 11 20 29v10h-40z" fill="var(--color-text-secondary)" />
      <path d="M254 160c1-22 10-35 23-35s22 13 23 35c-11-1-20-7-25-16-4 9-11 14-21 16" fill="var(--color-text-primary)" />
      <circle cx="267" cy="160" r="2.5" fill="var(--color-background)" /><circle cx="284" cy="160" r="2.5" fill="var(--color-background)" />
      <path d="M266 178v13m21-13v13" stroke="var(--color-text-primary)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="212" cy="204" r="5" fill="var(--brand-green)" /><circle cx="212" cy="204" r="12" stroke="var(--brand-green)" strokeOpacity=".4" strokeWidth="2" />
    </>}
    {scene === 1 && <>
      <path d="M86 180c4-23 20-37 45-41l33-33h90c21 0 36 11 48 32l24 6c15 4 23 15 24 36v13H86v-13Z" fill="var(--brand-green)" />
      <path d="m174 135 20-22h57c13 0 22 7 30 22h-107Z" fill="var(--color-surface)" />
      <path d="M216 114h34c13 0 22 7 30 22h-64z" fill="var(--color-surface-elevated)" />
      <circle cx="143" cy="192" r="22" fill="var(--color-text-primary)" /><circle cx="143" cy="192" r="10" fill="var(--color-surface-elevated)" />
      <circle cx="317" cy="192" r="22" fill="var(--color-text-primary)" /><circle cx="317" cy="192" r="10" fill="var(--color-surface-elevated)" />
      <circle cx="225" cy="144" r="11" fill="var(--color-text-secondary)" /><path d="M207 174c2-21 8-31 18-31s16 10 18 31" fill="var(--color-text-secondary)" />
      <circle cx="264" cy="163" r="3" fill="var(--color-background)" /><circle cx="284" cy="163" r="3" fill="var(--color-background)" />
      <circle cx="188" cy="176" r="4" fill="var(--color-surface)" /><circle cx="257" cy="176" r="4" fill="var(--color-surface)" />
      <circle cx="286" cy="176" r="4" fill="var(--color-surface)" />
    </>}
    {scene === 2 && <>
      <path d="M72 198c0-46 31-75 75-75h126c33 0 57 24 57 57v18H72Z" fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth="5" />
      <path d="M116 180c4-26 17-42 39-42h86c20 0 34 15 39 42H116Z" fill="var(--color-surface-elevated)" />
      <path d="M214 138v42" stroke="var(--color-border)" strokeWidth="4" />
      <circle cx="136" cy="189" r="21" fill="var(--brand-green)" /><circle cx="284" cy="189" r="21" fill="var(--brand-green)" />
      <circle cx="136" cy="189" r="8" fill="var(--color-surface)" /><circle cx="284" cy="189" r="8" fill="var(--color-surface)" />
      <path d="M172 109c0-16 9-25 21-25s21 9 21 25v24h-42z" fill="var(--color-text-secondary)" />
      <path d="M167 108c1-20 10-31 26-31s25 11 26 31c-12-1-21-6-26-14-5 8-14 13-26 14" fill="var(--color-text-primary)" />
      <circle cx="185" cy="111" r="2.5" fill="var(--color-background)" /><circle cx="201" cy="111" r="2.5" fill="var(--color-background)" />
      <path d="M250 151h22" stroke="var(--brand-green)" strokeWidth="5" strokeLinecap="round" /><path d="M261 140v22" stroke="var(--brand-green)" strokeWidth="5" strokeLinecap="round" />
    </>}
    {scene === 3 && <>
      <path d="M58 194c48-1 61-56 107-55 44 1 44 39 87 37 38-2 47-40 110-43" stroke="var(--brand-green)" strokeOpacity=".3" strokeWidth="18" strokeLinecap="round" />
      <path d="M58 194c48-1 61-56 107-55 44 1 44 39 87 37 38-2 47-40 110-43" stroke="var(--brand-green)" strokeWidth="6" strokeLinecap="round" />
      <circle cx="58" cy="194" r="12" fill="var(--color-surface)" stroke="var(--brand-green)" strokeWidth="6" />
      <circle cx="362" cy="133" r="12" fill="var(--color-surface)" stroke="var(--brand-green)" strokeWidth="6" />
      <path d="M132 216c3-29 12-43 29-43s26 14 29 43" fill="var(--color-text-secondary)" />
      <circle cx="161" cy="163" r="17" fill="var(--color-text-secondary)" />
      <path d="M244 216c3-29 12-43 29-43s26 14 29 43" fill="var(--brand-green)" />
      <path d="M263 147c0-16 8-25 18-25s18 9 18 25v10h-36z" fill="var(--color-text-primary)" />
      <circle cx="274" cy="157" r="2.5" fill="var(--color-background)" /><circle cx="288" cy="157" r="2.5" fill="var(--color-background)" />
    </>}
    {scene === 4 && <>
      <path d="M88 207h233" stroke="var(--brand-green)" strokeOpacity=".35" strokeWidth="8" strokeLinecap="round" />
      <path d="M206 193c0-38 29-68 65-68s65 30 65 68" stroke="var(--brand-green)" strokeWidth="8" strokeLinecap="round" />
      <path d="M246 193v-38h49v38" stroke="var(--brand-green)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M102 194c3-26 14-39 31-39s28 13 31 39" fill="var(--color-text-secondary)" />
      <circle cx="133" cy="142" r="18" fill="var(--color-text-secondary)" />
      <path d="M151 152c8-10 15-17 21-22" stroke="var(--color-text-secondary)" strokeWidth="7" strokeLinecap="round" />
      <path d="M335 220v-42" stroke="var(--color-text-primary)" strokeWidth="6" strokeLinecap="round" />
      <path d="M323 178h24l-12-25z" fill="var(--brand-green)" />
      <circle cx="334" cy="142" r="7" fill="var(--brand-green)" />
    </>}
  </svg>;
}

export default function LandingStory() {
  const { direction } = useLanguage();
  const [activeScene, setActiveScene] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const pointerStart = useRef<number | null>(null);
  const storyCaptions = captions.map((caption) => t(caption));

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setInterval(() => setActiveScene((current) => (current + 1) % captions.length), 4000);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion]);

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    if (pointerStart.current === null) return;
    const movement = event.clientX - pointerStart.current;
    pointerStart.current = null;
    if (Math.abs(movement) > 48) {
      const next = direction === "rtl" ? movement > 0 : movement < 0;
      setActiveScene((current) => (current + (next ? 1 : captions.length - 1)) % captions.length);
    }
    setPaused(false);
  };

  return <section className="landing-story" role="region" aria-roledescription="carousel" aria-label={storyCaptions[activeScene]} dir={direction}
    onPointerDown={(event) => { pointerStart.current = event.clientX; setPaused(true); }}
    onPointerUp={handlePointerUp}
    onPointerCancel={() => { pointerStart.current = null; setPaused(false); }}
    onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
    onFocus={() => setPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false); }}>
    <div className="landing-story-stage" data-direction={direction}>
      <StoryArt scene={activeScene} key={activeScene} />
      <p className="landing-story-caption" key={`caption-${activeScene}`}>{storyCaptions[activeScene]}</p>
    </div>
    <div className="landing-story-dots" role="group">
      {storyCaptions.map((caption, index) => <button key={caption} type="button" className={index === activeScene ? "is-active" : ""}
        aria-label={caption} aria-current={index === activeScene ? "true" : undefined}
        onClick={() => setActiveScene(index)} />)}
    </div>
  </section>;
}
