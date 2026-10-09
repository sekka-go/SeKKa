import type { CSSProperties } from "react";

export default function SikkaMark({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <svg className={className} style={style} viewBox="0 0 512 512" fill="none" aria-hidden="true" focusable="false">
    <path d="M142 389C221 368 319 347 357 313C399 273 279 254 210 225C141 196 231 166 356 145" stroke="currentColor" strokeWidth="15" strokeLinecap="round" />
    <path d="M138 408C235 384 340 360 382 320C429 274 293 239 227 210C177 188 274 158 364 137" stroke="#67D6D4" strokeOpacity=".72" strokeWidth="5" strokeLinecap="round" />
    <path d="M361 70C341.1 70 325 86.1 325 106C325 131.3 361 158 361 158C361 158 397 131.3 397 106C397 86.1 380.9 70 361 70Z" fill="#F5BD08" />
    <circle cx="361" cy="103" r="11" fill="#101827" />
    <path d="M143.5 323C125.6 323 111 337.6 111 355.5C111 378.5 143.5 402 143.5 402C143.5 402 176 378.5 176 355.5C176 337.6 161.4 323 143.5 323Z" fill="#F5BD08" />
    <circle cx="143.5" cy="353" r="10" fill="#101827" />
  </svg>;
}
