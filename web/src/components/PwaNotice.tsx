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
  const reloadAfterUpdate = useRef(false);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);
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

  if (online && !installPrompt && !updateAvailable) return null;

  return (
    <aside className="pwa-notice-wrap" aria-live="polite" aria-atomic="true">
      {!online ? (
        <div className="pwa-notice" role="status">
          <span><strong>الاتصال غير متاح</strong><small>يمكنك استخدام الصفحة المحفوظة، لكن الحجز ومتابعة الرحلات يحتاجان إلى الإنترنت.</small></span>
          <button type="button" onClick={() => window.location.reload()}>إعادة المحاولة</button>
        </div>
      ) : updateAvailable ? (
        <div className="pwa-notice" role="status">
          <span><strong>تحديث سِكّة جاهز</strong><small>حدّث التطبيق لتحصل على الإصلاحات الجديدة.</small></span>
          <button type="button" onClick={() => void applyUpdate()}>تحديث</button>
        </div>
      ) : installPrompt ? (
        <div className="pwa-notice" role="status">
          <span><strong>ثبّت سِكّة على جهازك</strong><small>افتح التطبيق بسرعة من الشاشة الرئيسية.</small></span>
          <button type="button" onClick={() => void installApp()}>تثبيت</button>
          <button className="pwa-dismiss" type="button" aria-label="إخفاء رسالة التثبيت" onClick={() => setInstallPrompt(null)}>×</button>
        </div>
      ) : null}
    </aside>
  );
}
