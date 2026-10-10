import { t } from "../i18n/runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type VerificationDocument, type VerificationDocumentType } from "../api";
import type { Session } from "../types";

type Snapshot = {
  role: "rider" | "captain";
  phone_verified: boolean;
  documents: VerificationDocument[];
  grace_period_expires_at: string | null;
  requirements: {
    rider: VerificationDocumentType[];
    captain_immediate: VerificationDocumentType[];
    captain_deferred: VerificationDocumentType[];
    labels: Record<string, string>;
  };
};

type MissingItem = { target: "phone" | VerificationDocumentType; label: string; deferred?: boolean };
const REMINDER_INTERVAL = 7 * 24 * 60 * 60 * 1000;

export default function VerificationReminder({ session, onOpen, visible = true }: {
  session: Session;
  onOpen: (target: MissingItem["target"]) => void;
  visible?: boolean;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [show, setShow] = useState(false);
  const previousTarget = useRef<MissingItem["target"] | null>(null);
  const reminderTimer = useRef<number | null>(null);
  const reminderKey = `sekka.verification.reminder.${session.user.id}`;

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await api<Snapshot>("/verification", { token: session.token }));
    } catch {
      // التذكير مساعد فقط؛ تعذر تحميله لا يعطل استخدام بقية التطبيق.
    }
  }, [session.token]);

  useEffect(() => {
    void refresh();
    const onRefresh = () => { void refresh(); };
    window.addEventListener("sekka:verification-refresh", onRefresh);
    return () => window.removeEventListener("sekka:verification-refresh", onRefresh);
  }, [refresh]);

  useEffect(() => {
    const dueAt = Number(localStorage.getItem(reminderKey) || 0);
    setShow(Date.now() >= dueAt);
    if (dueAt <= Date.now()) return;
    reminderTimer.current = window.setTimeout(() => setShow(true), Math.min(dueAt - Date.now(), 2_147_000_000));
    return () => { if (reminderTimer.current !== null) window.clearTimeout(reminderTimer.current); };
  }, [reminderKey]);

  const missing = getFirstMissing(snapshot);
  useEffect(() => {
    if (!missing) { previousTarget.current = null; return; }
    if (previousTarget.current && previousTarget.current !== missing.target) setShow(true);
    previousTarget.current = missing.target;
  }, [missing?.target]);
  if (!visible || !snapshot || !missing || !show) return null;

  const remindLater = () => {
    const dueAt = Date.now() + REMINDER_INTERVAL;
    localStorage.setItem(reminderKey, String(dueAt));
    setShow(false);
    if (reminderTimer.current !== null) window.clearTimeout(reminderTimer.current);
    reminderTimer.current = window.setTimeout(() => setShow(true), REMINDER_INTERVAL);
  };

  return <aside className={`verification-reminder ${missing.deferred ? "is-deferred" : ""}`} aria-live="polite">
    <span className="verification-reminder-icon" aria-hidden="true">!</span>
    <div className="verification-reminder-copy">
      <strong>{missing.deferred ? t("اقترب موعد استكمال ملف الكابتن") : t("أكمل بيانات التوثيق الناقصة")}</strong>
      <p>{missing.deferred ? `المستند المطلوب: ${missing.label}. ارفعه قبل انتهاء المهلة.` : `المطلوب الآن: ${missing.label}. أكمل هذه الخطوة لمتابعة تفعيل حسابك.`}</p>
    </div>
    <div className="verification-reminder-actions">
      <button type="button" className="button button-primary button-small" onClick={() => onOpen(missing.target)}>
        {missing.target === "phone" ? t("وثّق رقم الهاتف") : `أكمل ${missing.label}`}
      </button>
      <button type="button" className="button button-quiet button-small" onClick={remindLater} aria-label={t("ذكّرني بعد أسبوع")}>{t("ذكّرني لاحقًا")}</button>
    </div>
  </aside>;
}

function getFirstMissing(snapshot: Snapshot | null): MissingItem | null {
  if (!snapshot) return null;
  if (!snapshot.phone_verified) return { target: "phone", label: "توثيق رقم الهاتف" };

  const documents = new Map(snapshot.documents.map((doc) => [doc.document_type, doc]));
  const immediate = snapshot.role === "rider" ? snapshot.requirements.rider : snapshot.requirements.captain_immediate;
  const missingImmediate = immediate.find((type) => documents.get(type)?.status !== "approved" && documents.get(type)?.status !== "pending");
  if (missingImmediate) return { target: missingImmediate, label: snapshot.requirements.labels[missingImmediate] ?? "المستند المطلوب" };

  if (snapshot.role !== "captain" || !snapshot.grace_period_expires_at) return null;
  const remainingDays = Math.ceil((Date.parse(snapshot.grace_period_expires_at) - Date.now()) / 86_400_000);
  if (remainingDays > 7) return null;
  const missingDeferred = snapshot.requirements.captain_deferred.find((type) => documents.get(type)?.status !== "approved" && documents.get(type)?.status !== "pending");
  return missingDeferred ? { target: missingDeferred, label: snapshot.requirements.labels[missingDeferred] ?? "المستند المؤجل", deferred: true } : null;
}

