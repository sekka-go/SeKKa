import SekkaMark from "./SekkaMark";
import type { AnimationEvent } from "react";

export default function SekkaSplash({ title, tagline, accessibleLabel, variant = "brand", exiting = false, onAnimationEnd }: { title: string; tagline: string; accessibleLabel: string; variant?: "brand" | "refresh"; exiting?: boolean; onAnimationEnd?: (event: AnimationEvent<HTMLDivElement>) => void }) {
  const isRefresh = variant === "refresh";
  return <div
    className={`sekka-splash${isRefresh ? " is-refresh-splash" : ""}${exiting && isRefresh ? " is-exiting" : ""}`}
    role="status"
    aria-label={accessibleLabel}
    onAnimationEnd={onAnimationEnd}
  >
    <>
      <div className="splash-atmosphere" aria-hidden="true"><i /><i /><i /></div>
      <div className="splash-track" aria-hidden="true" />
    </>
    <div className="splash-content">
      <div className="splash-emblem"><SekkaMark className="splash-main-mark" variant="splash" /></div>
      <h1 className="splash-title">{title}</h1>
      <p className="splash-tagline">{tagline}</p>
    </div>
  </div>;
}
