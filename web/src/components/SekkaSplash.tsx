import SekkaMark from "./SekkaMark";

export default function SekkaSplash({ title, tagline, accessibleLabel, variant = "brand" }: { title: string; tagline: string; accessibleLabel: string; variant?: "brand" | "refresh" }) {
  const isRefresh = variant === "refresh";
  return <div
    className={`sekka-splash${isRefresh ? " is-refresh-splash" : ""}`}
    role="status"
    aria-label={accessibleLabel}
  >
    {isRefresh ? <div className="refresh-splash-scene" aria-hidden="true">
      <svg className="refresh-person" viewBox="0 0 260 250" role="presentation">
        <ellipse cx="130" cy="238" rx="83" ry="8" fill="var(--splash-line-soft)" />
        <g className="refresh-person-rise">
          <g className="refresh-wait-hands" fill="none" stroke="#f1c7a5" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round">
            <path d="M91 163c-10-13-21-27-32-44V96" />
            <path d="M169 163c10-13 21-27 32-44V96" />
            <path d="M58 101V79m0 22-9-16m9 16 10-17m-10 17 17-13" />
            <path d="M202 101V79m0 22-9-16m9 16 10-17m-10 17 17-13" />
          </g>
          <path d="M77 250c1-51 12-83 53-83s52 32 53 83" fill="var(--splash-accent)" />
          <path d="m115 171 15 18 15-18" fill="none" stroke="var(--surface)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M119 151h22v25c-6 8-16 8-22 0z" fill="#eab895" />
          <path d="M87 76c0-29 18-48 43-48s43 19 43 48v35c0 28-19 47-43 47s-43-19-43-47z" fill="#f1c7a5" />
          <path d="M86 84c-4-34 13-58 45-58 29 0 45 19 43 53-8-1-16-8-23-19-15 12-37 18-65 17z" fill="#283344" />
          <path d="M104 91q8-7 16 0m20 0q8-7 16 0" fill="none" stroke="#283344" strokeWidth="4" strokeLinecap="round" />
          <circle cx="112" cy="99" r="3.5" fill="#172033" />
          <circle cx="148" cy="99" r="3.5" fill="#172033" />
          <path d="M117 119q13 13 26 0" fill="none" stroke="#8e493b" strokeWidth="4" strokeLinecap="round" />
          <g className="refresh-wave-arm" fill="none" stroke="#f1c7a5" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round">
            <path d="M166 174c13-13 25-30 31-49l2-24" />
            <path d="M199 103V78m0 25-10-16m10 16 10-17m-10 17 17-13" />
          </g>
          <path d="M105 213h50" stroke="color-mix(in srgb, var(--surface) 40%, transparent)" strokeWidth="4" strokeLinecap="round" />
        </g>
      </svg>
    </div> : <>
      <div className="splash-atmosphere" aria-hidden="true"><i /><i /><i /></div>
      <div className="splash-track" aria-hidden="true" />
    </>}
    <div className="splash-content">
      {!isRefresh && <div className="splash-emblem"><SekkaMark className="splash-main-mark" variant="splash" /></div>}
      <h1 className="splash-title">{title}</h1>
      <p className="splash-tagline">{tagline}</p>
    </div>
  </div>;
}
