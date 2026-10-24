import SekkaMark from "./SekkaMark";

export default function SekkaSplash({ title, tagline, accessibleLabel }: { title: string; tagline: string; accessibleLabel: string }) {
  return <div
    className="sekka-splash"
    role="status"
    aria-label={accessibleLabel}
  >
    <div className="splash-atmosphere" aria-hidden="true"><i /><i /><i /></div>
    <div className="splash-track" aria-hidden="true" />
    <div className="splash-content">
      <div className="splash-emblem"><SekkaMark className="splash-main-mark" variant="splash" /></div>
      <h1 className="splash-title">{title}</h1>
      <p className="splash-tagline">{tagline}</p>
    </div>
  </div>;
}
