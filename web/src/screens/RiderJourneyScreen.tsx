import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sekkaApi, sekkaApiForm, logoutSekkaSession } from "../lib/sekka-api";
import "./rider-journey-screen.css";

export type RiderJourneyKey = "group" | "subscriptions" | "subscription" | "receipt" | "payment-method" | "proof" | "captain-confirmation" | "payment-code" | "payment-result" | "renewal" | "replacement-captain" | "conversations" | "conversation" | "notifications" | "ratings" | "complaint" | "complaint-status" | "profile";
type Props = { supabase: SupabaseClient | null; screen: RiderJourneyKey; onNavigate: (path: string) => void };
type ScreenMeta = { title: string; eyebrow: string; intro: string; icon: string };
const screens: Record<RiderJourneyKey, ScreenMeta> = {
  group: { title: "تفاصيل المجموعة", eyebrow: "رحلتك المنتظمة", intro: "تابع حالة مجموعتك وجدول الرحلة والمقاعد من مكان واحد.", icon: "⌂" },
  subscriptions: { title: "اشتراكاتي", eyebrow: "إدارة رحلاتك", intro: "اشتراكاتك الحالية والسابقة وحالاتها كما سُجلت في حسابك.", icon: "▤" },
  subscription: { title: "تفاصيل الاشتراك", eyebrow: "بيانات الاشتراك", intro: "تفاصيل المجموعة والسعر وفترة الاشتراك وحالة الدفع.", icon: "▧" },
  receipt: { title: "إيصال سِكّة", eyebrow: "تفاصيل الاشتراك", intro: "مرجع واضح لتفاصيل الاشتراك وطريقة إتمام الدفع مباشرة مع الكابتن.", icon: "▤" },
  "payment-method": { title: "اختيار وسيلة الدفع", eyebrow: "الدفع مباشرة للكابتن", intro: "اختر من الوسائل المتاحة لهذا العرض فقط.", icon: "◈" },
  proof: { title: "رفع إثبات التحويل", eyebrow: "التحويل الإلكتروني", intro: "أرفق إثبات التحويل ليراجعه الكابتن ويتحقق من وصول المبلغ.", icon: "⇧" },
  "captain-confirmation": { title: "انتظار تأكيد الكابتن", eyebrow: "حالة الدفع", intro: "يبقى الدفع قيد الانتظار إلى أن يؤكد الكابتن استلام المبلغ فعليًا.", icon: "◷" },
  "payment-code": { title: "تأكيد كود الدفع", eyebrow: "توثيق العملية", intro: "يعرض النظام كود العملية بعد تأكيد الكابتن الاستلام. هذا ليس رمز تسجيل الدخول.", icon: "▣" },
  "payment-result": { title: "نتيجة الدفع وتفعيل الاشتراك", eyebrow: "تحديث الاشتراك", intro: "تعرض هذه الصفحة النتيجة التي أكدها النظام فقط.", icon: "✓" },
  renewal: { title: "التجديد الشهري", eyebrow: "استمرار الرحلة", intro: "راجع حالة التجديد والمهلة قبل اتخاذ قرارك.", icon: "↻" },
  "replacement-captain": { title: "البحث عن كابتن بديل", eyebrow: "تحديث المجموعة", intro: "تابع حالة البحث عن بديل متوافق مع مسار مجموعتك ومواعيدها.", icon: "⌕" },
  conversations: { title: "المحادثات", eyebrow: "تواصل الرحلة", intro: "محادثاتك المرتبطة بالمجموعات التي تستطيع الوصول إليها.", icon: "☏" },
  conversation: { title: "تفاصيل المحادثة", eyebrow: "رسائل المجموعة", intro: "تابع رسائل المحادثة المرتبطة برحلتك.", icon: "☏" },
  notifications: { title: "الإشعارات", eyebrow: "آخر المستجدات", intro: "تنبيهات الحجز والمجموعة والدفع والتجديد والشكاوى.", icon: "♧" },
  ratings: { title: "التقييمات", eyebrow: "تجربتك تهمنا", intro: "تقييماتك المسجلة والرحلات المؤهلة للتقييم.", icon: "★" },
  complaint: { title: "تقديم شكوى أو بلاغ", eyebrow: "الدعم والمساندة", intro: "أرسل تفاصيل المشكلة المتعلقة برحلة أو اشتراك.", icon: "!" },
  "complaint-status": { title: "متابعة الشكوى", eyebrow: "طلب الدعم", intro: "تابع حالة الشكوى والقرار بعد تحديثه.", icon: "◎" },
  profile: { title: "الملف الشخصي والإعدادات", eyebrow: "حسابك في سِكّة", intro: "بيانات الحساب وخيارات الخصوصية والإشعارات والمساعدة.", icon: "◉" },
};

export default function RiderJourneyScreen({ screen, onNavigate }: Props) {
  const meta = screens[screen];
  const [records, setRecords] = useState<Record<string, any>[]>([]);
  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Record<string, any> | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [reportType, setReportType] = useState<"user" | "offer" | "behavior">("behavior");
  const [reportTargetType, setReportTargetType] = useState<"user" | "offer">("user");
  const [reportTargetId, setReportTargetId] = useState("");
  const [reportCategory, setReportCategory] = useState("fraud");
  const [reportDescription, setReportDescription] = useState("");
  const [reportFiles, setReportFiles] = useState<File[]>([]);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [notificationActionId, setNotificationActionId] = useState<string | null>(null);
  const sendLock = useRef(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError(""); setNotice(""); setMessageError(""); setMessageDraft("");
      try {
        const { user } = await sekkaApi<{ user: any }>("/auth/me");
        if (user?.role !== "rider") { onNavigate(user?.role === "captain" ? "/captain/home" : "/login"); return; }
        if (active) setProfile({ ...user, phone: user.phone_number });
        let result: Record<string, any>[] = [];
        if (screen === "profile") {
          result = [];
        } else if (screen === "notifications") {
          const { notifications } = await sekkaApi<{ notifications: any[] }>("/pool/notifications");
          result = (notifications ?? []).map((item) => ({ ...item, type: item.kind ?? "إشعار", payload: { message: item.body ?? item.title } }));
        } else if (screen === "complaint-status") {
          const { reports } = await sekkaApi<{ reports: any[] }>("/reports/mine"); result = reports ?? [];
        } else if (screen === "conversations") {
          const { conversations } = await sekkaApi<{ conversations: any[] }>("/messages/conversations"); result = conversations ?? [];
          if (active) setSelectedConversation(null);
        } else if (screen === "conversation") {
          const id = new URLSearchParams(window.location.search).get("id");
          if (!id || !/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) { setNotice("اختر محادثة من قائمة المحادثات أولًا."); }
          else {
            if (active) setSelectedConversation(null);
            const [conversationResult, messageResult] = await Promise.all([
              sekkaApi<{ conversations: any[] }>("/messages/conversations"),
              sekkaApi<{ messages: any[] }>(`/messages/conversations/${id}/messages`),
            ]);
            result = messageResult.messages ?? [];
            const conversation = (conversationResult.conversations ?? []).find((item) => String(item.id) === id);
            if (active) setSelectedConversation(conversation ?? null);
            try { await sekkaApi(`/messages/conversations/${id}/read`, { method: "POST" }); }
            catch { if (active) setNotice("تم تحميل الرسائل، لكن تعذر تحديث حالة القراءة."); }
          }
        } else if (screen === "subscriptions") {
          setNotice("لا يتوفر حاليًا endpoint لقراءة اشتراكات الراكب؛ لم نستخدم طلبات الرحلات كبديل عن بيانات الاشتراك.");
        } else if (["subscription", "receipt", "payment-method", "proof", "captain-confirmation", "payment-code", "payment-result", "renewal", "group", "replacement-captain"].includes(screen)) {
          const { requests } = await sekkaApi<{ requests: any[] }>("/rider/demand-requests");
          result = (requests ?? []).map((item) => ({ ...item, id: String(item.id), joined_at: item.created_at, group: { status: item.demand_groups?.status ?? item.status, starts_on: item.trip_date, line: { origin_name: item.pickup_label, destination_name: item.dropoff_label, departure_time: item.arrival_time, return_time: item.return_arrival_time, price_per_seat: item.line?.price_per_seat ?? null, currency: "EGP", payment_methods: [], vehicle_details: null, vehicle: null } } }));
          if (["subscription", "receipt", "payment-method", "proof", "captain-confirmation", "payment-code", "payment-result", "renewal", "replacement-captain"].includes(screen)) setNotice("واجهة الطلبات تعرض طلبات المسار الفعلية. إدارة الاشتراك والدفع غير متاحة من API الحالي، ولم نعرضها كعمليات مكتملة.");
        } else {
          setNotice("لا توجد واجهة API مفعّلة لهذه الشاشة بعد. لم يتم إنشاء بيانات أو إرسال طلب غير مدعوم.");
        }
        if (active) setRecords(result);
      } catch (cause) { if (active) setError(journeyApiError(cause)); }
      finally { if (active) setLoading(false); }
    }
    void load(); return () => { active = false; };
  }, [screen]);

  async function markRead(id: string) {
    try { await sekkaApi(`/pool/notifications/${id}/read`, { method: "POST" }); setRecords((items) => items.map((item) => String(item.id) === id ? { ...item, read_at: new Date().toISOString() } : item)); }
    catch { setError("تعذر تحديث الإشعار. حاول مرة أخرى."); }
  }
  async function deleteNotification(id: string) {
    if (notificationActionId) return;
    setNotificationActionId(id); setError(""); setNotice("");
    try {
      const result = await sekkaApi<{ deleted: boolean }>(`/pool/notifications/${id}/delete`, { method: "POST" });
      if (!result.deleted) throw new Error("لم يؤكد الخادم حذف الإشعار.");
      setRecords((items) => items.filter((item) => String(item.id) !== id));
      setNotice("تم حذف الإشعار من قائمتك.");
    } catch (cause) { setError(journeyApiError(cause)); }
    finally { setNotificationActionId(null); }
  }
  async function muteNotificationGroup(id: string) {
    if (notificationActionId) return;
    setNotificationActionId(id); setError(""); setNotice("");
    try {
      const result = await sekkaApi<{ muted: boolean }>(`/pool/notifications/${id}/mute`, { method: "POST" });
      if (!result.muted) throw new Error("لم يؤكد الخادم إيقاف إشعارات المجموعة.");
      setNotice("تم إيقاف إشعارات هذه المجموعة.");
    } catch (cause) { setError(journeyApiError(cause)); }
    finally { setNotificationActionId(null); }
  }
  async function sendMessage() {
    const id = new URLSearchParams(window.location.search).get("id");
    const body = messageDraft.trim();
    if (!id || !/^\d+$/.test(id) || !body || body.length > 2000 || sendLock.current) return;
    sendLock.current = true; setSendingMessage(true); setMessageError("");
    try {
      const { message } = await sekkaApi<{ message: Record<string, any> }>(`/messages/conversations/${id}/messages`, { method: "POST", body: { body } });
      if (!message?.id) throw new Error("لم يؤكد الخادم حفظ الرسالة.");
      setRecords((items) => [...items, message]); setMessageDraft("");
    } catch (cause) { setMessageError(journeyApiError(cause)); }
    finally { sendLock.current = false; setSendingMessage(false); }
  }
  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reportSubmitting) return;
    const targetId = Number(reportTargetId);
    if (!Number.isSafeInteger(targetId) || targetId < 1) { setError("أدخل رقم المستخدم أو العرض المرتبط بالبلاغ."); return; }
    if (reportDescription.trim().length < 20) { setError("اكتب وصفًا لا يقل عن 20 حرفًا."); return; }
    if (reportFiles.length > 3 || reportFiles.some((item) => item.size > 5 * 1024 * 1024 || !/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(item.type))) { setError("يمكن إرفاق 3 ملفات JPEG أو PNG أو WebP أو PDF، بحجم 5 ميجابايت لكل ملف."); return; }
    const form = new FormData();
    form.set("subject_type", reportType); form.set("category", reportCategory); form.set("description", reportDescription.trim());
    const targetKind = reportType === "user" ? "user" : reportType === "offer" ? "offer" : reportTargetType;
    if (targetKind === "user") form.set("subject_user_id", String(targetId)); else form.set("captain_line_id", String(targetId));
    for (const item of reportFiles) form.append("evidence", item);
    setReportSubmitting(true); setError(""); setNotice("");
    try {
      const { report } = await sekkaApiForm<{ report: any }>("/reports", form);
      if (!report?.id || report.status !== "submitted") throw new Error("لم يؤكد الخادم تسجيل البلاغ.");
      setReportDescription(""); setReportFiles([]); setReportTargetId("");
      setNotice(`تم تسجيل البلاغ رقم ${report.id}. ستراجعه الإدارة؛ لا ينتج عن البلاغ حظر تلقائي.`);
    } catch (cause) { setError(journeyApiError(cause)); }
    finally { setReportSubmitting(false); }
  }
  async function signOut() { try { await logoutSekkaSession(); } finally { onNavigate("/login"); } }

  const membership = records[0];
  const subscription = records.find((item) => item.subscription)?.subscription;
  const group = membership?.group;
  const line = group?.line;
  const unavailableWrite = "هذه الخطوة تحتاج إلى تفعيل إجراء آمن على الخادم؛ لم يتم إرسال أو تسجيل أي طلب.";

  return <main className="rider-journey" dir="rtl" lang="ar">
    <header className="journey-topbar"><button className="journey-back" onClick={() => { if (document.referrer.startsWith(window.location.origin)) window.history.back(); else onNavigate("/home"); }} aria-label="رجوع">‹</button><a href="/home" className="journey-brand"><img src="/brand/sekka-mark.png" alt="سِكّة" /></a><button className="journey-avatar" onClick={() => onNavigate("/journey/profile")} aria-label="الملف الشخصي">{profile?.full_name?.slice(0, 1) ?? "س"}</button></header>
    <section className="journey-hero"><span className="journey-eyebrow">{meta.eyebrow}</span><h1>{meta.title}</h1><p>{meta.intro}</p><div className="journey-hero-icon" aria-hidden="true">{meta.icon}</div></section>
        <section className="journey-content">
      {loading && <div className="journey-state"><span className="journey-spinner"/> جارٍ تحميل بيانات حسابك…</div>}
      {error && !loading && <div className="journey-alert error" role="alert">{error}<button onClick={() => window.location.reload()}>إعادة المحاولة</button></div>}
      {notice && <div className="journey-alert">{notice}</div>}
      {!loading && !error && <>
        {(screen === "subscriptions" || screen === "group" || screen === "subscription" || screen === "receipt" || screen === "payment-method" || screen === "proof" || screen === "captain-confirmation" || screen === "payment-code" || screen === "payment-result" || screen === "renewal" || screen === "replacement-captain" || screen === "ratings") && <>
          {records.length === 0 ? <Empty icon="▤" title={screen === "subscriptions" ? "لا توجد بيانات اشتراك مؤكدة" : "لا توجد مجموعة مرتبطة بحسابك بعد"} body={screen === "subscriptions" ? "لا يوفر API الحالي سجلًا للاشتراكات الشهرية. لن نعرض طلب رحلة أو سعر المقعد على أنه اشتراك." : "ستظهر هنا بيانات مجموعتك فور توفر سجل مرتبط بحسابك."} action={screen === "subscriptions" ? undefined : "/trips"} actionLabel={screen === "subscriptions" ? undefined : "استكشف الرحلات"} navigate={onNavigate}/> : <>
            <DataCard title={line ? `${line.origin_name} ← ${line.destination_name}` : "تفاصيل المجموعة"} badge={group?.status ?? membership?.status ?? "بانتظار التحديث"}>
              <Info label="حالة المجموعة" value={statusLabel(group?.status ?? membership?.status)} /><Info label="المركبة" value={line?.vehicle?.name_ar ?? "—"}/><Info label="المقاعد" value={line?.seat_count ? `${line.seat_count} مقاعد` : "—"}/><Info label="الأيام" value={(line?.operating_days ?? []).map((d: number) => ["أحد","اثنين","ثلاثاء","أربعاء","خميس","جمعة","سبت"][d]).join("، ") || "—"}/><Info label="موعد الانطلاق" value={line?.departure_time?.slice(0,5) ?? "—"}/><Info label="السعر المعلن لكل رحلة لكل مقعد" value={money(line?.price_per_seat, "EGP")}/><Info label="سعر الاشتراك الشهري المتفق عليه" value={subscription ? money(subscription.monthly_price, subscription.currency) : "لا يوجد اتفاق شهري مسجل"}/><Info label="فترة الاشتراك" value={subscription ? `${subscription.starts_on ?? "—"} — ${subscription.ends_on ?? "—"}` : "لا يوجد اشتراك مسجل"}/><Info label="حالة الاشتراك" value={statusLabel(subscription?.status)}/>
            </DataCard>
            {screen === "receipt" && <p className="journey-note">هذا إيصال بتفاصيل الاشتراك، وليس إثباتًا على استلام المبلغ. يتم الدفع مباشرة بين الراكب والكابتن، وعمولة سِكّة في MVP تساوي 0%.</p>}
            {screen === "payment-method" && <div className="journey-methods">{(line?.payment_methods ?? []).map((method: string) => <button key={method} onClick={() => setNotice(unavailableWrite)}>{methodLabel(method)} <span>اختيار</span></button>)}{!line?.payment_methods?.length && <p className="journey-note">لا توجد وسيلة دفع مسجلة لهذا العرض.</p>}</div>}
            {screen === "proof" && <div className="journey-data-card"><label className="journey-upload">{selectedFile ? `تم اختيار: ${selectedFile.name}` : "اختيار صورة أو ملف الإثبات"}<input type="file" accept="image/*,.pdf" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}/></label><button className="journey-primary" onClick={() => setNotice(unavailableWrite)} disabled={!selectedFile}>إرسال الإثبات للمراجعة</button></div>}
            {screen === "captain-confirmation" && <div className="journey-note">لا يظهر الدفع كمكتمل قبل أن يؤكد الكابتن استلام المبلغ فعليًا. إيصال سِكّة وصورة التحويل وحدهما لا يثبتان الاستلام.</div>}
            {screen === "payment-code" && <div className="journey-note">لا يوجد كود دفع متاح. يصدر الكود من الخادم بعد تأكيد الكابتن الاستلام.</div>}
            {screen === "payment-result" && <div className="journey-note">حالة النظام الحالية: {statusLabel(subscription?.status)}. لن نعرض تفعيلًا ناجحًا قبل تسجيل نتيجة موثوقة.</div>}
            {screen === "renewal" && <div className="journey-note">لا توجد مهلة تجديد مؤكدة في بيانات اشتراكك. عدم الرد لا يُسجل كموافقة تلقائية.</div>}
            {screen === "replacement-captain" && <div className="journey-note">لا يوجد طلب بحث عن كابتن بديل مرتبط بالمجموعة حتى الآن.</div>}
            <div className="journey-actions"><a className="journey-secondary" href={`/journey/${screen === "receipt" ? "payment-method" : screen === "payment-method" ? "proof" : screen === "subscription" ? "receipt" : "subscriptions"}`}>{screen === "subscription" ? "عرض إيصال سِكّة" : screen === "receipt" ? "متابعة لوسيلة الدفع" : "العودة إلى اشتراكاتي"}</a></div>
          </>}
        </>}
        {(screen === "conversations" || screen === "conversation") && <>{screen === "conversation" ? selectedConversation ? <section className="journey-chat"><header className="journey-data-card journey-chat-header"><button className="journey-secondary" onClick={() => onNavigate("/journey/conversations")}>رجوع للمحادثات</button><strong>{selectedConversation.other_user?.full_name ?? "محادثة الرحلة"}</strong><span>{selectedConversation.other_user?.role === "captain" ? "كابتن" : "راكب"}</span></header><div className="journey-chat-messages" aria-live="polite">{records.length ? records.map((message) => <article key={message.id} className={`journey-chat-message ${String(message.sender_user_id) === String(profile?.id) ? "mine" : "theirs"}`}><p>{message.body}</p><time>{dateLabel(message.created_at)}</time></article>) : <Empty icon="☏" title="ابدأ المحادثة" body="اكتب رسالتك للتواصل مع الطرف الآخر."/>}</div>{messageError && <div className="journey-alert error" role="alert">{messageError}</div>}<form className="journey-chat-compose" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}><textarea aria-label="اكتب رسالة" maxLength={2000} value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} placeholder="اكتب رسالتك هنا"/><button className="journey-primary" disabled={sendingMessage || !messageDraft.trim()}>{sendingMessage ? "جارٍ الإرسال…" : "إرسال الرسالة"}</button></form></section> : <Empty icon="☏" title="المحادثة غير متاحة" body="افتح المحادثة من قائمة محادثاتك للتحقق من صلاحية الوصول."/> : records.length ? <div className="journey-list">{records.map((item) => <a className="journey-data-card journey-conversation" key={item.id} href={`/journey/conversation?id=${item.id}`}><span className="journey-card-icon">☏</span><div><strong>{item.other_user?.full_name ?? "محادثة الرحلة"}</strong><p>{item.last_message_body ?? item.latest?.body ?? "لا توجد رسائل بعد"}</p></div><time>{dateLabel(item.last_message_at ?? item.latest?.created_at ?? item.created_at)}</time></a>)}</div> : <Empty icon="☏" title="لا توجد محادثات بعد" body="ستظهر محادثات المجموعة هنا عندما تكون متاحة لحسابك."/>}</>}
        {screen === "notifications" && <>{records.length ? <div className="journey-list">{records.map((item) => <article key={item.id} className={`journey-data-card journey-notification ${item.read_at ? "read" : "unread"}`}><span className="journey-card-icon">♧</span><div><strong>{notificationTitle(item.type)}</strong><p>{item.payload?.message ?? item.payload?.title ?? "لديك تحديث جديد في سِكّة."}</p><time>{dateLabel(item.created_at)}</time></div><div className="journey-notification-actions">{!item.read_at && <button onClick={() => void markRead(String(item.id))}>تمت القراءة</button>}{item.group_id != null && <button disabled={notificationActionId === String(item.id)} onClick={() => void muteNotificationGroup(String(item.id))}>إيقاف إشعارات المجموعة</button>}<button disabled={notificationActionId === String(item.id)} onClick={() => void deleteNotification(String(item.id))}>{notificationActionId === String(item.id) ? "جارٍ التحديث…" : "حذف"}</button></div></article>)}</div> : <Empty icon="♧" title="أنت على اطلاع" body="لا توجد إشعارات جديدة في الوقت الحالي."/>}</>}
        {screen === "complaint-status" && <>{records.length ? <div className="journey-list">{records.map((item) => <DataCard key={item.id} title={`بلاغ #${item.id}`} badge={statusLabel(item.status)}><p>{item.description}</p>{item.resolution_note && <Info label="نتيجة المراجعة" value={item.resolution_note}/>}<Info label="التصنيف" value={reportCategoryLabel(item.category)}/><Info label="تاريخ الإرسال" value={dateLabel(item.created_at)}/></DataCard>)}</div> : <Empty icon="◎" title="لا توجد بلاغات مسجلة" body="إذا أرسلت بلاغًا، ستظهر حالته هنا." action="/journey/complaint" actionLabel="تقديم بلاغ" navigate={onNavigate}/>}</>}
        {screen === "complaint" && <form className="journey-data-card" onSubmit={(event) => void submitReport(event)}>
          <label className="journey-form-label">موضوع البلاغ<select value={reportType} onChange={(event) => setReportType(event.target.value as typeof reportType)}><option value="behavior">سلوك مخالف</option><option value="user">حساب مستخدم</option><option value="offer">عرض رحلة</option></select></label>
          <label className="journey-form-label">التصنيف<select value={reportCategory} onChange={(event) => setReportCategory(event.target.value)}><option value="fraud">اشتباه احتيال</option><option value="harassment">مضايقة أو إساءة</option><option value="unsafe_behavior">سلوك غير آمن</option><option value="misleading_offer">معلومات مضللة في عرض</option><option value="other">أخرى</option></select></label>
          {reportType === "behavior" && <label className="journey-form-label">البلاغ متعلق بـ<select value={reportTargetType} onChange={(event) => setReportTargetType(event.target.value as typeof reportTargetType)}><option value="user">مستخدم</option><option value="offer">عرض رحلة</option></select></label>}
          <label className="journey-form-label">رقم {reportType === "offer" || (reportType === "behavior" && reportTargetType === "offer") ? "العرض" : "المستخدم"}<input inputMode="numeric" value={reportTargetId} onChange={(event) => setReportTargetId(event.target.value)} placeholder="المعرّف الظاهر في تفاصيل العنصر"/></label>
          <label className="journey-form-label">وصف الواقعة<textarea rows={5} minLength={20} maxLength={5000} required value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} placeholder="اكتب ما حدث بوضوح (20 حرفًا على الأقل)"/></label>
          <label className="journey-upload">{reportFiles.length ? `المرفقات: ${reportFiles.map((item) => item.name).join("، ")}` : "إرفاق أدلة اختياريًا (حتى 3 ملفات)"}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={(event) => setReportFiles(Array.from(event.target.files ?? []).slice(0, 3))}/></label>
          <p className="journey-note">تُحفظ الأدلة في مساحة خاصة ولا تظهر إلا لمسؤول مخوّل. البلاغ يخضع للمراجعة ولا يوقف الحساب تلقائيًا.</p>
          <button className="journey-primary" disabled={reportSubmitting}>{reportSubmitting ? "جارٍ إرسال البلاغ…" : "إرسال البلاغ"}</button><a className="journey-inline-link" href="/journey/complaint-status">متابعة بلاغ سابق</a>
        </form>}
        {screen === "ratings" && <>{records.length ? records.map((item) => <DataCard key={item.id} title={`تقييم الرحلة • ${dateLabel(item.created_at)}`} badge={`${item.score} من 5`}>{item.comment && <p>{item.comment}</p>}</DataCard>) : <Empty icon="★" title="لا توجد تقييمات مسجلة" body="ستظهر تقييماتك هنا بعد انتهاء الرحلة وتسجيل التقييم."/>}<p className="journey-note">لا يمكن إضافة تقييم قبل تفعيل التحقق من أهلية الرحلة ونقطة الحفظ الآمنة.</p></>}
        {screen === "profile" && <div className="journey-data-card profile-card"><span className="profile-initial">{profile?.full_name?.slice(0,1) ?? "س"}</span><h2>{profile?.full_name ?? "مستخدم سِكّة"}</h2><p>{profile?.phone ?? "رقم الهاتف غير متاح للعرض"}</p><div className="journey-info-grid"><Info label="نوع الحساب" value={profile?.role === "rider" ? "راكب" : profile?.role === "captain" ? "كابتن" : profile?.role === "admin" ? "إدارة" : "—"}/><Info label="اللغة" value={profile?.locale === "en" ? "English" : "العربية"}/></div><button className="journey-secondary" onClick={signOut}>تسجيل الخروج</button><div className="profile-links"><a href="/privacy">سياسة الخصوصية</a><a href="/terms">الشروط والأحكام</a><a href="/journey/notifications">إعدادات الإشعارات</a></div></div>}
      </>}
    </section>
    <nav className="journey-bottom-nav" aria-label="التنقل الرئيسي"><a href="/home">⌂<span>الرئيسية</span></a><a href="/trips">⌕<span>البحث</span></a><a href="/my-trips">▤<span>طلباتي</span></a><a className={screen === "conversations" || screen === "conversation" ? "active" : ""} aria-current={screen === "conversations" || screen === "conversation" ? "page" : undefined} href="/journey/conversations">☏<span>المحادثات</span></a><a className={screen !== "conversations" && screen !== "conversation" ? "active" : ""} aria-current={screen !== "conversations" && screen !== "conversation" ? "page" : undefined} href="/journey/profile">⋯<span>المزيد</span></a></nav>
  </main>;
}

function journeyApiError(cause: unknown) {
  if (cause && typeof cause === "object" && "status" in cause && (cause as any).status === 401) return "انتهت جلسة الدخول. سجّل الدخول مجددًا.";
  const message = cause instanceof Error ? cause.message : "";
  if (message.includes("تعذر الاتصال") || message.includes("الإنترنت")) return "تعذر الاتصال بخدمة سِكّة. تحقق من الإنترنت ثم حاول مجددًا.";
  return message || "تعذر تحميل بيانات حسابك الآن. حاول مرة أخرى.";
}
function DataCard({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) { return <article className="journey-data-card"><header className="journey-card-heading"><h2>{title}</h2>{badge && <span className="journey-badge">{badge}</span>}</header>{children}</article>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="journey-info"><span>{label}</span><strong>{value}</strong></div>; }
function Empty({ icon, title, body, action, actionLabel, navigate }: { icon: string; title: string; body: string; action?: string; actionLabel?: string; navigate?: (path: string) => void }) { return <div className="journey-empty"><span>{icon}</span><h2>{title}</h2><p>{body}</p>{action && <button className="journey-primary" onClick={() => navigate?.(action)}>{actionLabel}</button>}</div>; }
function statusLabel(status?: string) { const labels: Record<string,string> = { active:"نشط",pending:"قيد الانتظار",initiated:"بدأت العملية",paid:"تم الدفع",confirmed:"مؤكد",forming:"قيد الاكتمال",open:"مفتوحة",resolved:"تمت المعالجة",closed:"مغلقة",cancelled:"ملغاة",rejected:"مرفوض",searching:"جارٍ البحث",submitted:"تم الإرسال",in_review:"قيد مراجعة الإدارة",reviewed:"تمت المراجعة" }; return status ? labels[status] ?? status : "غير متاح"; }
function reportCategoryLabel(category?: string) { return ({fraud:"اشتباه احتيال",harassment:"مضايقة أو إساءة",unsafe_behavior:"سلوك غير آمن",misleading_offer:"معلومات مضللة في عرض",other:"أخرى"} as Record<string,string>)[category ?? ""] ?? category ?? "—"; }
function money(amount?: number | null, currency?: string) { return amount == null ? "السعر غير محدد" : `${new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(amount)} ${currency === "EGP" || !currency ? "ج.م" : currency}`; }
function dateLabel(value?: string) { if (!value) return ""; return new Intl.DateTimeFormat("ar-EG", { dateStyle:"medium", timeStyle:"short" }).format(new Date(value)); }
function methodLabel(method: string) { return ({cash:"كاش",wallet:"محفظة إلكترونية خارجية",ewallet:"محفظة إلكترونية خارجية",instapay:"InstaPay"} as Record<string,string>)[method] ?? method; }
function notificationTitle(type: string) { return ({payment:"تحديث الدفع",subscription:"تحديث الاشتراك",group:"تحديث المجموعة",renewal:"تجديد الاشتراك",complaint:"تحديث الشكوى",booking:"طلب انضمام",match:"رحلة مناسبة"} as Record<string,string>)[type] ?? "إشعار جديد"; }
