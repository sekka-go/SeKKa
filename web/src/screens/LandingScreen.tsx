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
          <div className="landing-route-orbit" />
          <div className="landing-route-map">
            <span className="landing-route-line" />
            <span className="landing-route-point landing-route-start" />
            <span className="landing-route-point landing-route-end" />
          </div>
          <span className="landing-route-spark landing-route-spark-one">✦</span>
          <span className="landing-route-spark landing-route-spark-two">✦</span>
        </div>
      </section>

    </main>
  );
}
