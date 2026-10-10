import { useEffect, useState } from "react";
import type { Session, Toast } from "../types";
import { t } from "../i18n/runtime";
import { errorText } from "../lib/formatters";
import { getConfiguredPushPublicKey, hasPushSubscription, subscribeToPush, unsubscribeFromPush } from "../lib/push";
import AppIcon from "./AppIcon";
import LanguageSelector from "./LanguageSelector";
import ThemePreferenceCard, { type ThemePreference } from "./ThemePreferenceCard";

export default function AppSettings({ session, themePreference, resolvedTheme, onThemePreferenceChange, notify }: {
  session: Session;
  themePreference: ThemePreference;
  resolvedTheme: "light" | "dark";
  onThemePreferenceChange: (value: ThemePreference) => void;
  notify: (text: string, tone?: Toast["tone"]) => void;
}) {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushReady, setPushReady] = useState(false);
  const [pushLoading, setPushLoading] = useState(true);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([getConfiguredPushPublicKey(), hasPushSubscription()])
      .then(([publicKey, enabled]) => {
        if (!active) return;
        setPushReady(Boolean(publicKey));
        setPushEnabled(Boolean(publicKey) && enabled);
      })
      .catch(() => { if (active) setPushReady(false); })
      .finally(() => { if (active) setPushLoading(false); });
    return () => { active = false; };
  }, []);

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (pushEnabled) {
        await unsubscribeFromPush(session.token);
        setPushEnabled(false);
        notify(t("تم إيقاف إشعارات سِكّة على هذا الجهاز."), "success");
      } else {
        await subscribeToPush(session.token);
        setPushEnabled(true);
        notify(t("تم تفعيل إشعارات سِكّة على هذا الجهاز."), "success");
      }
    } catch (error) { notify(errorText(error), "error"); }
    finally { setPushBusy(false); }
  };

  const pushStatus = pushLoading
    ? t("جارٍ تحديث إعدادات الإشعارات")
    : !pushReady
      ? t("إشعارات الجهاز غير مهيأة حاليًا")
      : t(pushEnabled ? "مفعّلة على هذا الجهاز" : "غير مفعّلة على هذا الجهاز");

  return <div className="app-settings-stack">
    <section className="app-settings-section" aria-labelledby="app-preferences-title">
      <div className="app-settings-section-heading">
        <h2 id="app-preferences-title">{t("تفضيلات التطبيق")}</h2>
        <p>{t("خصص طريقة عرض التطبيق واللغة المستخدمة في كل الصفحات.")}</p>
      </div>
      <ThemePreferenceCard value={themePreference} resolvedTheme={resolvedTheme} onChange={onThemePreferenceChange} />
      <LanguageSelector />
    </section>
    <section className="surface app-settings-notifications" aria-labelledby="app-notifications-title">
      <div className="app-settings-notifications-copy">
        <span className="app-settings-icon"><AppIcon name="bell" size={20} /></span>
        <div>
          <h2 id="app-notifications-title">{t("إشعارات هذا الجهاز")}</h2>
          <p>{t("تصل إليك تنبيهات الرحلات والمجموعات على هذا الجهاز.")}</p>
          <small className={`app-settings-status ${pushEnabled && pushReady ? "is-enabled" : ""}`} role="status">{pushStatus}</small>
        </div>
      </div>
      <button type="button" className={`button ${pushEnabled ? "button-outline" : "button-primary"} button-small`} onClick={() => void togglePush()} disabled={!pushReady || pushLoading || pushBusy} aria-pressed={pushEnabled}>
        {pushBusy ? t("جارٍ تحديث إعدادات الإشعارات") : t(pushEnabled ? "إيقاف إشعارات هذا الجهاز" : "تفعيل إشعارات هذا الجهاز")}
      </button>
    </section>
  </div>;
}
