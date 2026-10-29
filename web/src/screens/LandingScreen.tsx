import { lazy, Suspense } from "react";
import { t } from "../i18n/runtime";
import BrandLogo from "../components/BrandLogo";
import PublicLanguageToggle from "../components/PublicLanguageToggle";

const LandingStory = lazy(() => import("../components/LandingStory"));

export default function LandingScreen() {
  return (
    <main className="landing-page stitch-welcome-page">
      <header className="landing-header stitch-welcome-header">
        <a className="landing-brand" href="/" aria-label={t("سِكَّة، الرئيسية")}><BrandLogo /></a>
        <span className="stitch-welcome-availability"><i />{t("متاح في القاهرة والجيزة")}</span>
        <PublicLanguageToggle />
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="eyebrow">{t("تنقّل أسرع بطريقة أذكى")}</span>
          <h1>{t("مشوارك اليومي،")}<br /><em>{t("على سِكَّة أسهل.")}</em></h1>
          <p>{t("شارك الطريق مع ناس رايحة في نفس اتجاهك، وخلي مشاويرك أسهل.")}</p>
          <div className="landing-hero-actions">
            <a className="button landing-primary-cta" href="/register">{t("ابدأ رحلتك الآن")} <span aria-hidden="true">←</span></a>
            <a className="stitch-welcome-login-link" href="/login">{t("لدي حساب بالفعل")}</a>
          </div>
          <div className="landing-trust"><span className="landing-trust-dot" />{t("رحلات مشتركة موثوقة في القاهرة الكبرى")}</div>
        </div>

        <Suspense fallback={<div className="landing-story" aria-hidden="true" />}><LandingStory /></Suspense>
      </section>

      <section className="stitch-welcome-benefits" aria-label={t("مميزات سِكّة")}>
        <div><span aria-hidden="true">◉</span><strong>{t("ادفع مباشرة للكابتن")}</strong><p>{t("بدون محفظة أو عمولات وسيطة")}</p></div>
        <div><span aria-hidden="true">⌁</span><strong>{t("تجميع ذكي للطلبات")}</strong><p>{t("نوصلك بركاب على نفس المسار")}</p></div>
        <div><span aria-hidden="true">✓</span><strong>{t("ابدأ بدون توثيق البطاقة")}</strong><p>{t("توثيق الراكب اختياري")}</p></div>
      </section>

      <section className="landing-how-it-works" aria-label={t("كيف تعمل سِكّة")}>
        <div className="landing-how-heading"><span className="eyebrow">{t("خطوات بسيطة")}</span><h2>{t("من البحث إلى مشوار واضح")}</h2></div>
        <div className="landing-how-grid">
          <article><span>١</span><div><strong>{t("حدد طريقك ومواعيدك")}</strong><p>{t("اختر نقطتي الركوب والوصول ومواعيد الذهاب والعودة.")}</p></div></article>
          <article><span>٢</span><div><strong>{t("راجع الرحلات المناسبة")}</strong><p>{t("قارن الرحلات المنشورة والسعر قبل طلب الانضمام.")}</p></div></article>
          <article><span>٣</span><div><strong>{t("اتفق مباشرة مع الكابتن")}</strong><p>{t("تابع مجموعتك ورحلاتك من حسابك، والدفع يتم مباشرة للكابتن.")}</p></div></article>
        </div>
      </section>

    </main>
  );
}
