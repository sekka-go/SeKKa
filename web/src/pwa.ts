export const PWA_UPDATE_EVENT = "sekka:pwa-update";

export function registerPwa() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((registration) => {
      const notifyWaitingWorker = () => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          window.dispatchEvent(new Event(PWA_UPDATE_EVENT));
        }
      };

      notifyWaitingWorker();
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        installing?.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            window.dispatchEvent(new Event(PWA_UPDATE_EVENT));
          }
        });
      });
    }).catch((error: unknown) => {
      console.warn("SeKKa offline support is unavailable.", error);
    });
  });
}
