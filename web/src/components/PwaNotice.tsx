import { t } from "../i18n/runtime";
import { useEffect, useRef, useState } from "react";
import { PWA_UPDATE_EVENT } from "../pwa";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PwaNotice() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [showIosHint, setShowIosHint] = useState(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    return ios && !window.matchMedia("(display-mode: standalone)").matches;
  });
  const reloadAfterUpdate = useRef(false);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => { setInstallPrompt(null); setShowIosHint(false); };
    const onUpdate = () => setUpdateAvailable(true);
    const onControllerChange = () => {
      if (reloadAfterUpdate.current) window.location.reload();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener(PWA_UPDATE_EVENT, onUpdate);
    navigator.serviceWorker?.addEventListener("controllerchange", onControllerChange);

    let disposed = false;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        if (!disposed && registration.waiting && navigator.serviceWorker.controller) setUpdateAvailable(true);
      }).catch(() => undefined);
    }

    return () => {
      disposed = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener(PWA_UPDATE_EVENT, onUpdate);
      navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  async function applyUpdate() {
    const registration = await navigator.serviceWorker.getRegistration();
    const waiting = registration?.waiting;
    if (!waiting) {
      window.location.reload();
      return;
    }
    reloadAfterUpdate.current = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
  }

  if (online && !installPrompt && !updateAvailable && !showIosHint) return null;

  return (
    <aside className="pwa-notice-wrap" aria-live="polite" aria-atomic="true">
      {!online ? (
        <div className="pwa-notice" role="status">
          <span><strong>{t("الاتصال غير متاح")}</strong><small>{t("يمكنك استخدام الصفحة المحفوظة، لكن الحجز ومتابعة الرحلات يحتاجان إلى الإنترنت.")}</small></span>
          <button type="button" onClick={() => window.location.reload()}>{t("إعادة المحاولة")}</button>
        </div>
      ) : updateAvailable ? (
        <div className="pwa-notice" role="status">
          <span><strong>{t("تحديث سِكّة جاهز")}</strong><small>{t("حدّث التطبيق لتحصل على الإصلاحات الجديدة.")}</small></span>
          <button type="button" onClick={() => void applyUpdate()}>{t("تحديث")}</button>
        </div>
      ) : installPrompt ? (
        <div className="pwa-notice" role="status">
          <span><strong>{t("ثبّت سِكّة على جهازك")}</strong><small>{t("افتح التطبيق بسرعة من الشاشة الرئيسية.")}</small></span>
          <button type="button" onClick={() => void installApp()}>{t("تثبيت")}</button>
          <button className="pwa-dismiss" type="button" aria-label={t("إخفاء رسالة التثبيت")} onClick={() => setInstallPrompt(null)}>×</button>
        </div>
      ) : showIosHint ? (
        <div className="pwa-notice" role="status">
          <span><strong>{t("أضف سِكّة إلى الشاشة الرئيسية")}</strong><small>{t("اضغط «مشاركة» في المتصفح، ثم اختر «إضافة إلى الشاشة الرئيسية».")}</small></span>
          <button className="pwa-dismiss" type="button" aria-label={t("إخفاء تعليمات التثبيت")} onClick={() => setShowIosHint(false)}>×</button>
        </div>
      ) : null}
    </aside>
  );
}
