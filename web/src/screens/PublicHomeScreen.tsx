import "./public-home-screen.css";
import PwaInstallPrompt from "./PwaInstallPrompt";

export default function PublicHomeScreen() {
  return (
    <main className="sekka-welcome" dir="rtl" lang="ar">
      <section className="welcome-screen" aria-labelledby="welcome-title">
        <div className="welcome-sky" aria-hidden="true" />
        <div className="welcome-photo" role="img" aria-label="أفق القاهرة ونهر النيل وقت الغروب" />

        <div className="welcome-brand-lockup">
          <img src="/brand/sekka-mark.png" alt="" />
          <strong>سِكّة</strong>
        </div>

        <header className="welcome-copy">
          <h1 id="welcome-title">رحلتك .. أسهل</h1>
          <p>اكتشف عروض التنقل المنتظم، قارنها وتواصل مباشرة مع الكابتن. سِكّة تسهّل الوصول ولا تضمن تنفيذ الرحلة.</p>
        </header>

        <div className="welcome-actions">
          <a className="welcome-primary" href="/register">ابدأ الآن <span aria-hidden="true">←</span></a>
          <p>لديك حساب بالفعل؟ <a href="/login">تسجيل الدخول</a></p>
        </div>

        <div className="welcome-route-mark" aria-hidden="true"><i /><span>◆</span><i /></div>
      </section>
      <PwaInstallPrompt />
    </main>
  );
}
