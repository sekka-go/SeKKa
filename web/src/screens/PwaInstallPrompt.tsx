import { useEffect, useRef, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "sekka-install-prompt-dismissed-until";
const DISMISS_FOR_MS = 30 * 24 * 60 * 60 * 1000;

let deferredPrompt: InstallPromptEvent | null = null;
const installListeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    installListeners.forEach((listener) => listener());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installListeners.forEach((listener) => listener());
  });
}

function subscribeToInstallEvents(listener: () => void) {
  installListeners.add(listener);
  return () => {
    installListeners.delete(listener);
  };
}

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

function getInstallInstructions() {
  const userAgent = navigator.userAgent;
  const openedInsideAnotherApp = /FBAN|FBAV|Instagram|Line\/|Twitter|Telegram|WhatsApp/i.test(userAgent);
  const isAppleMobile = /iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (openedInsideAnotherApp) {
    return isAppleMobile
      ? "افتح الرابط في Safari أولًا، ثم اضغط زر المشاركة واختر «إضافة إلى الشاشة الرئيسية»."
      : "افتح الرابط في Chrome أولًا، ثم من القائمة اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».";
  }
  if (isAppleMobile) {
    return "في Safari اضغط زر المشاركة، ثم «إضافة إلى الشاشة الرئيسية»، وبعدها اضغط «إضافة».";
  }
  if (/Android/i.test(userAgent)) {
    return "افتح قائمة المتصفح ⋮ ثم اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».";
  }
  return "افتح قائمة المتصفح، أو رمز التثبيت بجوار شريط العنوان، ثم اختر «تثبيت سِكّة».";
}

function wasDismissed() {
  try {
    return Number(window.localStorage.getItem(DISMISS_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_FOR_MS));
  } catch {
    // The invitation remains dismissible for this visit when storage is unavailable.
  }
}

export default function PwaInstallPrompt() {
  const [open, setOpen] = useState(() => !isInstalled() && !wasDismissed());
  const [canInstall, setCanInstall] = useState(() => deferredPrompt !== null);
  const [showInstructions, setShowInstructions] = useState(() => deferredPrompt === null);
  const [message, setMessage] = useState("");
  const dialogRef = useRef<HTMLElement | null>(null);

  useEffect(() => subscribeToInstallEvents(() => {
    const installed = isInstalled();
    const installAvailable = deferredPrompt !== null;
    setCanInstall(installAvailable);
    if (installAvailable) setShowInstructions(false);
    if (installed) setOpen(false);
  }), []);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        rememberDismissal();
        setOpen(false);
        return;
      }
      if (event.key === "Tab") {
        const buttons = dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
        if (!buttons?.length) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  if (!open || isInstalled()) return null;

  async function install() {
    if (!deferredPrompt) {
      setShowInstructions(true);
      return;
    }
    try {
      const prompt = deferredPrompt;
      deferredPrompt = null;
      setCanInstall(false);
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") {
        rememberDismissal();
        setOpen(false);
      } else {
        setMessage("لم يتم التثبيت الآن. يمكنك متابعة الموقع وتثبيته لاحقًا من قائمة المتصفح.");
      }
    } catch {
      setMessage("لم نتمكن من فتح نافذة التثبيت. استخدم خطوات التثبيت الظاهرة أدناه.");
      setShowInstructions(true);
    }
  }

  function continueOnWeb() {
    rememberDismissal();
    setOpen(false);
  }

  return (
    <div className="pwa-install-backdrop" role="presentation">
      <section ref={dialogRef} className="pwa-install-dialog" role="dialog" aria-modal="true" aria-labelledby="pwa-install-title" aria-describedby="pwa-install-description">
        <div className="pwa-install-handle" aria-hidden="true" />
        <img className="pwa-install-logo" src="/brand/sekka-mark.png" alt="" />
        <p className="pwa-install-kicker">تجربة سِكّة على هاتفك</p>
        <h2 id="pwa-install-title">ثبّت تطبيق سِكّة</h2>
        <p id="pwa-install-description" className="pwa-install-description">
          افتحه بسرعة من الشاشة الرئيسية واستمتع بتجربة أسهل، من غير تنزيل من متجر التطبيقات.
        </p>

        {message && <p className="pwa-install-message" role="status">{message}</p>}
        {(showInstructions || !canInstall) && (
          <p className="pwa-install-instructions"><span aria-hidden="true">ⓘ</span>{getInstallInstructions()}</p>
        )}

        <div className="pwa-install-actions">
          {canInstall ? (
            <button className="pwa-install-primary" type="button" onClick={install}>تثبيت التطبيق <span aria-hidden="true">↓</span></button>
          ) : (
            <button className="pwa-install-primary" type="button" onClick={continueOnWeb}>متابعة على الموقع <span aria-hidden="true">←</span></button>
          )}
          {canInstall ? (
            <button className="pwa-install-secondary" type="button" onClick={continueOnWeb}>متابعة على الموقع</button>
          ) : (
            <button className="pwa-install-secondary" type="button" onClick={() => setShowInstructions((value) => !value)}>
              {showInstructions ? "إخفاء خطوات التثبيت" : "طريقة تثبيت التطبيق"}
            </button>
          )}
        </div>
        <p className="pwa-install-footnote">التثبيت مجاني، ويمكنك استخدام سِكّة من المتصفح أيضًا.</p>
      </section>
    </div>
  );
}
