import type { CSSProperties } from "react";
import markSource from "../brand/sekka-mark.svg?raw";

const viewBox = markSource.match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 512 512";
const transform = markSource.match(/<g transform="([^"]+)"/)?.[1] ?? "";
const route = markSource.match(/<path id="sekka-mark-route"[^>]*d="([^"]+)"/)?.[1];
if (!route) throw new Error("The SeKKa mark source SVG is missing its route path.");
const dots = [...markSource.matchAll(/<circle id="sekka-mark-dot" cx="([^"]+)" cy="([^"]+)"/g)]
  .map(([, cx, cy]) => ({ cx, cy }));

export default function SekkaMark({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <svg className={className} style={style} viewBox={viewBox} fill="none" aria-hidden="true" focusable="false">
    <g transform={transform}>
      <path d={route} stroke="var(--color-background)" strokeWidth="27" strokeLinecap="round" />
      <path d={route} stroke="var(--color-text-primary)" strokeWidth="21" strokeLinecap="round" />
      <path d={route} stroke="var(--brand-green)" strokeWidth="14" strokeLinecap="round" />
      {dots.map((dot) => <g key={`${dot.cx}-${dot.cy}`}>
        <circle cx={dot.cx} cy={dot.cy} r="17" fill="var(--color-background)" />
        <circle cx={dot.cx} cy={dot.cy} r="14" fill="var(--color-text-primary)" />
        <circle cx={dot.cx} cy={dot.cy} r="10" fill="var(--brand-green)" />
      </g>)}
    </g>
  </svg>;
}
