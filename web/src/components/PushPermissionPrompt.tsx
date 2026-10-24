import { useEffect, useState } from "react";
import type { Session, Toast } from "../types";
import { t } from "../i18n/runtime";
import { errorText } from "../lib/formatters";
import { getConfiguredPushPublicKey, getPushPromptChoice, hasPushSubscription, setPushPromptChoice, subscribeToPush } from "../lib/push";

export default function PushPermissionPrompt({ session, notify }: {
  session: Session;
  notify: (text: string, tone?: Toast["tone"]) => void;
}) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (getPushPromptChoice() || !import.meta.env.PROD) return;
    if (!("Notification" in window) || !("PushManager" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission === "denied") {
      setPushPromptChoice("declined");
      return;
    }

    let active = true;
    void Promise.all([getConfiguredPushPublicKey(), hasPushSubscription()])
      .then(([key, enabled]) => {
        if (!active) return;
        if (enabled) {
          setPushPromptChoice("accepted");
          return;
        }
        if (key) {
          setPublicKey(key);
          setVisible(true);
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const dismiss = () => {
    setPushPromptChoice("declined");
    setVisible(false);
  };

  const enable = async () => {
    if (!publicKey || busy) return;
    setBusy(true);
    try {
      await subscribeToPush(session.token, publicKey);
      setPushPromptChoice("accepted");
      setVisible(false);
      notify(t("تم تفعيل إشعارات سِكّة على هذا الجهاز."), "success");
    } catch (error) {
      if ("Notification" in window && Notification.permission === "denied") {
        setPushPromptChoice("declined");
        setVisible(false);
      } else {
        notify(errorText(error), "error");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;
  return <section className="surface push-permission-prompt" aria-labelledby="push-permission-title">
    <div>
      <strong id="push-permission-title">{t("فعّل إشعارات سِكّة على جهازك")}</strong>
      <p>{t("استقبل تحديثات الرحلات والمجموعات على هذا الجهاز، ويمكنك تغيير اختيارك لاحقًا من الإعدادات.")}</p>
    </div>
    <div className="push-permission-actions">
      <button type="button" className="button button-primary button-small" onClick={() => void enable()} disabled={busy}>
        {t(busy ? "جارٍ تحديث إعدادات الإشعارات" : "تفعيل الإشعارات")}
      </button>
      <button type="button" className="button button-outline button-small push-prompt-dismiss" onClick={dismiss} disabled={busy}>{t("ليس الآن")}</button>
    </div>
  </section>;
}
