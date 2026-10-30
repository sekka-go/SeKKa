import "./public-home-screen.css";

export default function PublicHomeScreen() {
  return (
    <main className="sekka-public-home" dir="rtl" lang="ar">
      <header className="sekka-public-header">
        <a className="sekka-public-brand" href="/" aria-label="سِكّة، الرئيسية">
          <img src="/brand/sekka-mark.png" alt="" />
          <span>سِكّة</span>
        </a>
        <a className="sekka-public-login" href="/login">تسجيل الدخول</a>
      </header>

      <section className="sekka-public-hero" aria-labelledby="sekka-public-title">
        <div className="sekka-public-hero-copy">
          <span className="sekka-public-kicker">تنقّل منتظم، أوضح وأسهل</span>
          <h1 id="sekka-public-title">مشوارك المتكرر،<br /><em>على سِكّة واحدة.</em></h1>
          <p>سِكّة تساعدك على تنظيم تنقلك المتكرر بين البيت والعمل أو الدراسة، وفق مسار ومواعيد واضحة.</p>
          <div className="sekka-public-actions">
            <a className="sekka-public-primary" href="/register">ابدأ كراكب <span aria-hidden="true">←</span></a>
            <a className="sekka-public-secondary" href="/login">لديك حساب؟ سجّل الدخول</a>
          </div>
        </div>
        <div className="sekka-public-visual" aria-hidden="true">
          <div className="sekka-public-route-line"><span /><span /></div>
          <div className="sekka-public-visual-caption"><span className="sekka-public-dot" /> مشاويرك المعتادة، بخطوات مرتبة</div>
        </div>
      </section>

      <section className="sekka-public-how" id="how-it-works" aria-labelledby="sekka-how-title">
        <div className="sekka-public-section-heading">
          <span className="sekka-public-kicker">طريقة الاستخدام</span>
          <h2 id="sekka-how-title">من احتياجك إلى مشوار منظم</h2>
        </div>
        <ol className="sekka-public-steps">
          <li><span>١</span><div><h3>حدّد مسارك ومواعيدك</h3><p>أدخل تفاصيل تنقلك المتكرر وما يناسب جدولك.</p></div></li>
          <li><span>٢</span><div><h3>استعرض الخيارات المناسبة</h3><p>راجع تفاصيل العرض والمسار والسعر قبل اتخاذ قرارك.</p></div></li>
          <li><span>٣</span><div><h3>أرسل طلب الانضمام</h3><p>تابع حالة طلبك وتواصل ضمن المجموعة عند توفرها.</p></div></li>
        </ol>
      </section>

      <section className="sekka-public-captain" aria-label="التسجيل للكابتن">
        <div><span className="sekka-public-kicker">للكباتن</span><h2>نظّم رحلاتك المتكررة مع سِكّة</h2><p>أنشئ حساب كابتن وابدأ باستكمال بياناتك المطلوبة.</p></div>
        <a className="sekka-public-secondary" href="/register?role=captain">التسجيل ككابتن <span aria-hidden="true">←</span></a>
      </section>

      <footer className="sekka-public-footer"><span>سِكّة · مشوارك المتكرر، على سِكّة واحدة</span><a href="/login">تسجيل الدخول</a></footer>
    </main>
  );
}
