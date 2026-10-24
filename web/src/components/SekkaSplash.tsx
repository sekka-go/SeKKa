import type { AnimationEvent } from "react";
import SekkaMark from "./SekkaMark";

export default function SekkaSplash({ title, tagline, accessibleLabel, exiting = false, onAnimationEnd }: {
  title: string;
  tagline: string;
  accessibleLabel: string;
  exiting?: boolean;
  onAnimationEnd?: (event: AnimationEvent<HTMLDivElement>) => void;
}) {
  return <div
    className={`sekka-splash${exiting ? " is-exiting" : ""}`}
    role="status"
    aria-label={accessibleLabel}
    onAnimationEnd={onAnimationEnd}
  >
    <div className="startup-car-scene" aria-hidden="true">
      <div className="startup-road"><i /><i /><i /></div>
      <svg className="startup-car" viewBox="0 0 320 150" fill="none">
        <defs>
          <clipPath id="startup-rear-window-clip">
            <path d="M105 61 132 32c5-5 11-8 20-8h42v37h-89Z" />
          </clipPath>
          <clipPath id="startup-front-window-clip">
            <path d="M194 24h10c9 0 16 4 21 11l18 26h-49V24Z" />
          </clipPath>
        </defs>
        <ellipse cx="158" cy="132" rx="126" ry="10" fill="var(--splash-line-soft)" />
        <path d="M28 99c2-13 12-22 29-27l37-11 32-32c7-8 16-12 28-12h54c13 0 22 5 30 15l23 31 27 9c13 4 21 14 22 27l1 12H28V99Z" fill="var(--splash-accent)" />
        <path d="m105 61 27-29c5-5 11-8 20-8h52c9 0 16 4 21 11l18 26H105Z" fill="var(--surface)" opacity=".92" />
        <path d="M194 24h10c9 0 16 4 21 11l18 26h-49V24Z" fill="color-mix(in srgb, var(--splash-accent) 20%, var(--surface))" />
        <g clipPath="url(#startup-rear-window-clip)">
          <circle cx="157" cy="38" r="7.5" fill="var(--color-text-primary)" />
          <circle cx="160" cy="36.5" r="1.2" fill="var(--surface)" />
          <path d="M157 41q3 2.5 6-1" stroke="var(--surface)" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M150 49c3-3 6-4.5 10-4.5s8 1.5 11 4.5l3 9h-29l5-9Z" fill="var(--splash-accent)" />
        </g>
        <path d="M194 35c11-3 23 2 27 12" stroke="var(--color-text-primary)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="208" cy="40" r="11" fill="var(--color-text-primary)" />
        <circle cx="211" cy="38" r="1.5" fill="var(--surface)" />
        <path d="M208 44q4 3 8-1" stroke="var(--surface)" strokeWidth="1.5" strokeLinecap="round" />
        <path clipPath="url(#startup-front-window-clip)" d="M201 52c8-2 15 1 20 7l7 8h-30V52Z" fill="var(--color-text-primary)" />
        <g className="startup-driver-wave" stroke="var(--color-text-primary)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M226 57c7-9 12-15 16-23" />
          <path d="m242 34-4-9m4 9 9-7m-9 7 10 2" />
        </g>
        <path d="M32 94h18m231 0h12" stroke="var(--surface)" strokeWidth="6" strokeLinecap="round" opacity=".8" />
        <circle cx="91" cy="111" r="22" fill="var(--color-text-primary)" />
        <circle cx="91" cy="111" r="10" fill="var(--surface)" />
        <circle cx="258" cy="111" r="22" fill="var(--color-text-primary)" />
        <circle cx="258" cy="111" r="10" fill="var(--surface)" />
        <path d="M66 86h19" stroke="var(--surface)" strokeWidth="5" strokeLinecap="round" opacity=".8" />
      </svg>
    </div>
    <div className="splash-content">
      <div className="splash-emblem"><SekkaMark className="splash-main-mark" /></div>
      <h1 className="splash-title">{title}</h1>
      <p className="splash-tagline">{tagline}</p>
    </div>
  </div>;
}
