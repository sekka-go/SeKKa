import BrandLogo from "../components/BrandLogo";

export default function LandingScreen() {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <a className="landing-brand" href="/" aria-label="سِكَّة، الرئيسية"><BrandLogo /></a>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="eyebrow">تنقّل أسرع بطريقة أذكى</span>
          <h1>مشوارك اليومي،<br /><em>على سِكَّة أسهل.</em></h1>
          <p>شارك الطريق مع ناس رايحة في نفس اتجاهك، وخلي مشاويرك أسهل.</p>
          <div className="landing-hero-actions">
            <a className="button landing-primary-cta" href="/login">ابدأ رحلتك الآن <span aria-hidden="true">←</span></a>
          </div>
          <div className="landing-trust"><span className="landing-trust-dot" />متاح في القاهرة والجيزة</div>
        </div>

        <div className="landing-route-card" aria-hidden="true">
          <svg className="landing-route-illustration" viewBox="0 0 420 300" fill="none">
            <path className="landing-map-street" d="M22 65H116L148 39H220M250 39H327L390 81M23 128H94L119 151M339 131H395M23 203H89L111 229M323 214H392M56 273H121L145 248M212 273H294L321 246" />
            <path className="landing-map-street" d="M61 36V105M171 35V78M362 108V174M49 154V211M164 238V275M267 226V272" />
            <path className="landing-route-edge" d="M49 247C105 238 116 215 143 190C170 164 197 175 222 194C249 215 283 204 286 176C289 149 260 136 275 108C289 82 322 72 368 57" />
            <path className="landing-route-surface" d="M49 247C105 238 116 215 143 190C170 164 197 175 222 194C249 215 283 204 286 176C289 149 260 136 275 108C289 82 322 72 368 57" />
            <path className="landing-route-centerline" d="M49 247C105 238 116 215 143 190C170 164 197 175 222 194C249 215 283 204 286 176C289 149 260 136 275 108C289 82 322 72 368 57" />
            <circle className="landing-route-stop-ring" cx="222" cy="194" r="14" />
            <circle className="landing-route-stop" cx="222" cy="194" r="4.5" />
            <g className="landing-route-car" transform="translate(143 190) rotate(-32)">
              <path className="landing-car-body" d="M-22 3L-18-8Q-16-13-10-13H10Q16-13 18-8L22 3V12H-22V3Z" />
              <path className="landing-car-window" d="M-13-8H13L17 1H-17L-13-8Z" />
              <path className="landing-car-wheel" d="M-16 10V14M16 10V14" />
            </g>
            <g className="landing-route-pin landing-route-pin-start" transform="translate(49 247)">
              <path d="M0 18C-4 12-15 1-15-8A15 15 0 1 1 15-8C15 1 4 12 0 18Z" />
              <circle cx="0" cy="-8" r="5" />
            </g>
            <g className="landing-route-pin landing-route-pin-end" transform="translate(368 57)">
              <path d="M0 18C-4 12-15 1-15-8A15 15 0 1 1 15-8C15 1 4 12 0 18Z" />
              <circle cx="0" cy="-8" r="5" />
            </g>
          </svg>
        </div>
      </section>

    </main>
  );
}
