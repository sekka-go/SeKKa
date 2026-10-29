import { useState } from "react";
import "./fresh-app.css";

type Role = "rider" | "captain";
type Screen = "home" | "trips" | "account" | "help";

const roleLabels: Record<Role, string> = {
  rider: "راكب",
  captain: "كابتن",
};

const navItems: { id: Screen; label: string; icon: string }[] = [
  { id: "home", label: "الرئيسية", icon: "⌂" },
  { id: "trips", label: "الرحلات", icon: "↗" },
  { id: "account", label: "حسابي", icon: "◉" },
  { id: "help", label: "المساعدة", icon: "?" },
];

export default function FreshApp() {
  const [role, setRole] = useState<Role>("rider");
  const [screen, setScreen] = useState<Screen>("home");

  return (
    <main className="fresh-shell" dir="rtl" lang="ar">
      <header className="fresh-header">
        <a className="fresh-brand" href="#" onClick={(event) => { event.preventDefault(); setScreen("home"); }} aria-label="سِكّة - الرئيسية">
          <span className="fresh-brand-mark">س</span>
          <span><strong>سِكّة</strong><small>طريقك أسهل معانا</small></span>
        </a>
        <button className="fresh-help-button" onClick={() => setScreen("help")}>المساعدة <span aria-hidden="true">↗</span></button>
      </header>

      <section className="fresh-role-switch" aria-label="معاينة مساحة المستخدم">
        <span className="fresh-role-caption">عرض مساحة</span>
        {(Object.keys(roleLabels) as Role[]).map((item) => (
          <button key={item} className={role === item ? "fresh-role active" : "fresh-role"} onClick={() => { setRole(item); setScreen("home"); }} aria-pressed={role === item}>
            {roleLabels[item]}
          </button>
        ))}
      </section>

      <section className="fresh-content">
        {screen === "home" && (
          <>
            <div className="fresh-hero">
              <div className="fresh-hero-copy">
                <span className="fresh-eyebrow">سِكّة — تنقّل أذكى</span>
                <h1>{role === "rider" ? "مشوارك يبدأ من هنا." : "خلّي كل مشوار فرصة جديدة."}</h1>
                <p>{role === "rider" ? "خطّط لرحلتك، واعرف تفاصيلها قبل ما تبعت طلبك." : "نظّم عروض رحلاتك وتابع طلبات الانضمام من مساحة واحدة."}</p>
                <button className="fresh-primary-button" onClick={() => setScreen("trips")}>{role === "rider" ? "استكشف الرحلات" : "إدارة الرحلات"} <span aria-hidden="true">←</span></button>
              </div>
              <div className="fresh-route-art" aria-hidden="true">
                <div className="fresh-route-orbit orbit-one"></div><div className="fresh-route-orbit orbit-two"></div>
                <div className="fresh-route-line"></div>
                <span className="fresh-route-pin pin-start">●</span><span className="fresh-route-pin pin-end">◆</span>
                <div className="fresh-route-card"><span>وجهتك القادمة</span><strong>على سِكّتك</strong><small>خطوة بخطوة</small></div>
              </div>
            </div>
            <div className="fresh-section-heading"><div><span className="fresh-eyebrow">ابدأ بسهولة</span><h2>تحتاج تعمل إيه النهارده؟</h2></div><span className="fresh-section-note">اختار الخطوة المناسبة</span></div>
            <div className="fresh-action-grid">
              {(role === "rider"
                ? [{ icon: "⌕", title: "ابحث عن رحلة", body: "استعرض الرحلات المتاحة وتفاصيلها.", action: "استعراض الرحلات" }, { icon: "◎", title: "تابع طلباتك", body: "اعرف حالة طلبات الانضمام والرحلات.", action: "عرض الرحلات" }, { icon: "▤", title: "تفاصيل حسابك", body: "راجع بيانات حسابك وإعداداته.", action: "حسابي" }]
                : [{ icon: "＋", title: "عروض الرحلات", body: "انتقل لمساحة إدارة عروضك.", action: "إدارة العروض" }, { icon: "▣", title: "طلبات الانضمام", body: "تابع الطلبات الواردة وحالتها.", action: "عرض الطلبات" }, { icon: "◷", title: "مواعيد الرحلات", body: "راجع المواعيد المسجلة.", action: "عرض المواعيد" }]
              ).map((item, index) => (
                <button className="fresh-action-card" key={item.title} onClick={() => setScreen(index === 2 && role === "rider" ? "account" : "trips")}>
                  <span className="fresh-action-icon">{item.icon}</span><strong>{item.title}</strong><p>{item.body}</p><span className="fresh-card-link">{item.action} <span aria-hidden="true">←</span></span>
                </button>
              ))}
            </div>
            <p className="fresh-foundation-note"><span aria-hidden="true">ⓘ</span> دي نقطة البداية الجديدة للواجهة. الوظائف والبيانات الحقيقية هتتربط وتُختبر مرحلة بمرحلة قبل اعتمادها.</p>
          </>
        )}

        {screen === "trips" && (
          <div className="fresh-placeholder-panel">
            <span className="fresh-large-icon">↗</span><span className="fresh-eyebrow">مساحة {roleLabels[role]}</span>
            <h1>{role === "rider" ? "الرحلات" : "إدارة الرحلات"}</h1>
            <p>تم إنشاء نقطة دخول واضحة لهذه المساحة. الخطوة التالية هي ربط كل حالة بالـ API والصلاحيات والبيانات الفعلية، بدل عرض بيانات تجريبية أو نتائج غير مؤكدة.</p>
            <button className="fresh-secondary-button" onClick={() => setScreen("home")}>العودة للرئيسية</button>
          </div>
        )}
        {screen === "account" && (
          <div className="fresh-placeholder-panel"><span className="fresh-large-icon">◉</span><span className="fresh-eyebrow">الحساب</span><h1>إعدادات حسابك</h1><p>ستُبنى تفاصيل الحساب والجلسة والصلاحيات بعد مراجعة آلية المصادقة الحالية وربطها بالواجهة الجديدة.</p><button className="fresh-secondary-button" onClick={() => setScreen("home")}>العودة للرئيسية</button></div>
        )}
        {screen === "help" && (
          <div className="fresh-placeholder-panel"><span className="fresh-large-icon">?</span><span className="fresh-eyebrow">مركز المساعدة</span><h1>إحنا معاك على سِكّة</h1><p>سيتم هنا تجميع المساعدة والتواصل والسياسات المعتمدة. لن نعرض قنوات أو إجراءات غير متصلة فعليًا.</p><button className="fresh-secondary-button" onClick={() => setScreen("home")}>العودة للرئيسية</button></div>
        )}
      </section>

      <nav className="fresh-bottom-nav" aria-label="التنقل الرئيسي">
        {navItems.map((item) => <button key={item.id} onClick={() => setScreen(item.id)} className={screen === item.id ? "fresh-nav-item active" : "fresh-nav-item"} aria-current={screen === item.id ? "page" : undefined}><span>{item.icon}</span><small>{item.label}</small></button>)}
      </nav>
      <footer className="fresh-footer"><span>سِكّة</span><span>نسخة إعادة البناء — أساس الواجهة</span></footer>
    </main>
  );
}
