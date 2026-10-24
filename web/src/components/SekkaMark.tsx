import type { CSSProperties } from "react";

export default function SekkaMark({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <img className={className} style={style} src="/brand/sekka-mark.png" alt="" aria-hidden="true" draggable={false} />;
}
