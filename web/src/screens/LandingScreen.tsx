import BrandLogo from "../components/BrandLogo";

const benefits = [
  { number: "01", title: "خطّط لمشاويرك", description: "رتّب أيامك ومواعيدك من مكان واحد، وخلي تنقّلك أوضح وأسهل." },
  { number: "02", title: "اختار اللي يناسبك", description: "قارن بين الفئات المتاحة وحدد المقعد المناسب لمشوارك." },
  { number: "03", title: "شارك الطريق", description: "اتنقّل مع ناس رايحة في نفس اتجاهك، وخلّي الطريق أريح." },
];

const steps = [
  { number: "١", title: "أنشئ حسابك", description: "سجّل برقم هاتفك واختار طريقة استخدامك لسِكّة." },
  { number: "٢", title: "اختار مشوارك", description: "حدّد خط سيرك والأيام والفئة المناسبة ليك." },
  { number: "٣", title: "ابدأ رحلتك", description: "تابع تفاصيل مشوارك من حسابك بكل سهولة." },
];

export default function LandingScreen() {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <a className="landing-brand" href="/" aria-label="سِكّة، الرئيسية"><BrandLogo variant="light" /></a>
        <nav className="landing-nav" aria-label="التنقل الرئيسي">
          <a href="#benefits">المميزات</a>
          <a href="#how-it-works">طريقة الاستخدام</a>
        </nav>
        <div className="landing-actions">
          <a className="landing-login" href="/login">تسجيل الدخول</a>
          <a className="button landing-header-cta" href="/register">ابدأ رحلتك</a>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="eyebrow">تنقّل أذكى وأسرع</span>
          <h1>مشوارك اليومي،<br /><em>على سِكّة أسهل.</em></h1>
          <p>شارك الطريق مع ناس رايحة في نفس اتجاهك. خطّط لأيامك، اختار مقعدك، وخلي تنقّلك أبسط.</p>
          <div className="landing-hero-actions">
            <a className="button landing-primary-cta" href="/register">ابدأ رحلتك <span aria-hidden="true">←</span></a>
            <a className="landing-secondary-cta" href="#how-it-works">اعرف سِكّة بتشتغل إزاي</a>
          </div>
          <div className="landing-trust"><span className="landing-trust-dot" />متاحة للتنقل المشترك في القاهرة والجيزة</div>
        </div>

        <div className="landing-route-card" aria-label="رحلتك على سِكّة">
          <div className="landing-route-top"><span>رحلتك الجاية</span><span className="landing-route-status">جاهز تبدأ</span></div>
          <div className="landing-route-map">
            <span className="landing-route-line" />
            <span className="landing-route-point landing-route-start">أ</span>
            <span className="landing-route-point landing-route-end">ب</span>
          </div>
          <div className="landing-route-labels"><span><small>من</small><strong>اختار نقطة البداية</strong></span><span><small>إلى</small><strong>حدد وجهتك</strong></span></div>
          <div className="landing-route-divider" />
          <div className="landing-route-bottom"><span>خطتك، مقعدك، وطريقك</span><span className="landing-route-spark" aria-hidden="true">✦</span></div>
        </div>
      </section>

      <section className="landing-benefits" id="benefits">
        <div className="landing-section-heading">
          <span className="eyebrow">كل مشوار له سِكّة</span>
          <h2>تنقّل أريح، من أول خطوة</h2>
          <p>أدوات بسيطة تساعدك ترتّب مشاويرك وتشارك الطريق بثقة.</p>
        </div>
        <div className="landing-benefit-grid">
          {benefits.map((item) => <article className="landing-benefit-card" key={item.number}>
            <span className="landing-card-number">{item.number}</span>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </article>)}
        </div>
      </section>

      <section className="landing-how" id="how-it-works">
        <div className="landing-section-heading">
          <span className="eyebrow">ثلاث خطوات وتكون جاهز</span>
          <h2>سِكّة بتبدأ معاك</h2>
        </div>
        <div className="landing-steps">
          {steps.map((step) => <article className="landing-step" key={step.number}>
            <span className="landing-step-number">{step.number}</span>
            <div><h3>{step.title}</h3><p>{step.description}</p></div>
          </article>)}
        </div>
      </section>

      <section className="landing-bottom-cta">
        <div><span className="eyebrow">معاك في السكة</span><h2>خلّي مشوارك الجاي أسهل.</h2></div>
        <a className="button landing-primary-cta" href="/register">أنشئ حسابك <span aria-hidden="true">←</span></a>
      </section>

      <footer className="landing-footer">
        <BrandLogo variant="light" />
        <span>© سِكّة للتنقل المشترك</span>
        <a href="/login">تسجيل الدخول</a>
      </footer>
    </main>
  );
}
