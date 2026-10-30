import type { AnimationEvent } from "react";
import SekkaMark from "./SekkaMark";

export default function SekkaSplash({ accessibleLabel, exiting = false, onAnimationEnd }: {
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
    <SekkaMark className="splash-main-mark" />
  </div>;
}
