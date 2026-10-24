import SekkaMark from "./SekkaMark";

export default function SekkaSplash({ title, tagline, accessibleLabel, variant = "brand" }: { title: string; tagline: string; accessibleLabel: string; variant?: "brand" | "refresh" }) {
  const isRefresh = variant === "refresh";
  return <div
    className={`sekka-splash${isRefresh ? " is-refresh-splash" : ""}`}
    role="status"
    aria-label={accessibleLabel}
  >
    {isRefresh ? <div className="refresh-splash-scene" aria-hidden="true">
      <div className="refresh-road"><i /><i /><i /></div>
      <svg className="refresh-car" viewBox="0 0 320 150" role="presentation">
        <ellipse cx="158" cy="132" rx="126" ry="10" fill="var(--splash-line-soft)" />
        <path d="M28 99c2-13 12-22 29-27l37-11 29-32c7-8 16-12 28-12h54c13 0 22 5 30 15l23 31 27 9c13 4 21 14 22 27l1 12H28V99Z" fill="var(--splash-accent)" />
        <path d="m105 61 27-29c5-5 11-8 20-8h52c9 0 16 4 21 11l18 26H105Z" fill="var(--surface)" opacity=".9" />
        <path d="M187 27h17c9 0 16 4 21 11l18 23h-56V27Z" fill="color-mix(in srgb, var(--splash-accent) 22%, var(--surface))" />
        <path d="M194 35c11-3 23 2 27 12" fill="none" stroke="var(--color-text-primary)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="208" cy="40" r="11" fill="var(--color-text-primary)" />
        <circle cx="211" cy="38" r="1.5" fill="var(--surface)" />
        <path d="M210 44q3 2 5-1" fill="none" stroke="var(--surface)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M201 52c8-2 15 1 20 7l7 8h-30V52Z" fill="var(--color-text-primary)" />
        <g className="refresh-driver-wave" fill="none" stroke="var(--color-text-primary)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M226 57c7-9 12-15 16-23" />
          <path d="m242 34-4-9m4 9 9-7m-9 7 10 2" />
        </g>
        <path d="M32 94h18m231 0h12" stroke="var(--surface)" strokeWidth="6" strokeLinecap="round" opacity=".7" />
        <circle cx="91" cy="111" r="22" fill="var(--color-background)" />
        <circle cx="91" cy="111" r="10" fill="var(--surface)" />
        <circle cx="258" cy="111" r="22" fill="var(--color-background)" />
        <circle cx="258" cy="111" r="10" fill="var(--surface)" />
        <path d="M66 86h19" stroke="var(--surface)" strokeWidth="5" strokeLinecap="round" opacity=".8" />
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
