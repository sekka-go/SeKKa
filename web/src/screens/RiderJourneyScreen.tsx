import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
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
const entries: Array<[RiderJourneyKey, string]> = [["group", "تفاصيل المجموعة"],["subscriptions", "اشتراكاتي"],["subscription", "تفاصيل الاشتراك"],["receipt", "إيصال سِكّة"],["payment-method", "وسيلة الدفع"],["proof", "إثبات التحويل"],["captain-confirmation", "تأكيد الكابتن"],["payment-code", "كود الدفع"],["payment-result", "نتيجة الدفع"],["renewal", "التجديد الشهري"],["replacement-captain", "كابتن بديل"],["conversations", "المحادثات"],["conversation", "تفاصيل المحادثة"],["notifications", "الإشعارات"],["ratings", "التقييمات"],["complaint", "تقديم شكوى"],["complaint-status", "متابعة الشكوى"],["profile", "الملف الشخصي"]];
const entryGroups: Array<[string, RiderJourneyKey[]]> = [["الرحلة والاشتراك", ["group", "subscriptions", "subscription", "renewal", "replacement-captain"]], ["الدفع", ["receipt", "payment-method", "proof", "captain-confirmation", "payment-code", "payment-result"]], ["التواصل والمساندة", ["conversations", "conversation", "notifications", "ratings", "complaint", "complaint-status"]], ["الحساب", ["profile"]]];

export default function RiderJourneyScreen({ supabase, screen, onNavigate }: Props) {
  const meta = screens[screen];
  const [userId, setUserId] = useState("");
  const [records, setRecords] = useState<Record<string, any>[]>([]);
  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError(""); setNotice("");
      try {
        if (!supabase) throw new Error("إعدادات الاتصال بالخدمة غير مكتملة.");
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!auth.user) { onNavigate("/login"); return; }
        if (!active) return;
        setUserId(auth.user.id);
        if (screen === "notifications") {
          const { data, error: queryError } = await supabase.from("notifications").select("id,type,payload,read_at,created_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(50);
          if (queryError) throw queryError; if (active) setRecords(data ?? []);
        } else if (screen === "conversations" || screen === "conversation") {
          const { data, error: queryError } = await supabase.from("conversations").select("id,group_id,created_at,rider_id,captain_id").eq("rider_id", auth.user.id).order("created_at", { ascending: false });
          if (queryError) throw queryError;
          const wantedConversation = new URLSearchParams(window.location.search).get("id");
          const convos = (data ?? []).filter((item: any) => screen !== "conversation" || !wantedConversation || item.id === wantedConversation);
          if (convos.length) {
            const ids = convos.map((item: any) => item.id);
            const { data: messages, error: messageError } = await supabase.from("messages").select("id,conversation_id,sender_id,body,created_at,read_at").in("conversation_id", ids).order("created_at", { ascending: false }).limit(100);
            if (messageError) throw messageError;
            setRecords(convos.map((conversation: any) => ({ ...conversation, latest: messages?.find((m: any) => m.conversation_id === conversation.id) })));
          } else setRecords([]);
        } else if (["subscriptions", "subscription", "receipt", "payment-method", "proof", "captain-confirmation", "payment-code", "payment-result", "renewal", "group", "replacement-captain"].includes(screen)) {
          const { data, error: queryError } = await supabase.from("ride_group_members").select("id,status,joined_at,group:ride_groups(id,status,group_minimum,capacity_definition,starts_on,ends_on,line:captain_lines(id,captain_id,origin_name,destination_name,operating_days,departure_time,return_time,seat_count,monthly_price,currency,payment_methods,vehicle_details,vehicle:vehicle_types(name_ar,capacity_max)))").eq("rider_id", auth.user.id).order("joined_at", { ascending: false });
          if (queryError) throw queryError;
          let memberships = data ?? [];
          const subIds = memberships.map((m: any) => m.id);
          if (subIds.length) {
            const { data: subs, error: subError } = await supabase.from("subscriptions").select("id,group_member_id,monthly_price,currency,starts_on,ends_on,status,created_at").in("group_member_id", subIds).order("created_at", { ascending: false });
            if (subError) throw subError;
            memberships = memberships.map((m: any) => ({ ...m, subscription: subs?.find((s: any) => s.group_member_id === m.id) }));
          }
          setRecords(memberships);
        } else if (screen === "complaint-status") {
          const { data, error: queryError } = await supabase.from("complaints").select("id,description,status,resolution_note,created_at,resolved_at").eq("reporter_id", auth.user.id).order("created_at", { ascending: false });
          if (queryError) throw queryError; setRecords(data ?? []);
        } else if (screen === "profile") {
          const { data, error: queryError } = await supabase.from("profiles").select("id,full_name,role,phone,locale,avatar_url,created_at").eq("id", auth.user.id).maybeSingle();
          if (queryError) throw queryError; setProfile(data);
        } else if (screen === "ratings") {
          const { data, error: queryError } = await supabase.from("ratings").select("id,group_id,score,comment,created_at").eq("reviewer_id", auth.user.id).order("created_at", { ascending: false });
          if (queryError) throw queryError; setRecords(data ?? []);
        } else setRecords([]);
      } catch (cause) { if (active) setError(cause instanceof Error && cause.message.includes("إعدادات الاتصال") ? cause.message : "تعذر تحميل بيانات حسابك. تحقق من الاتصال أو سجّل الدخول مجددًا ثم حاول مرة أخرى."); }
      finally { if (active) setLoading(false); }
    }
    void load(); return () => { active = false; };
  }, [supabase, screen]);

  async function markRead(id: string) {
    if (!supabase) return;
    const { error: updateError } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId);
    if (updateError) setError("تعذر تحديث الإشعار. حاول مرة أخرى."); else setRecords((items) => items.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
  }
  async function signOut() { if (!supabase) return; const { error: signOutError } = await supabase.auth.signOut(); if (!signOutError) onNavigate("/login"); }

  const membership = records[0];
  const subscription = records.find((item) => item.subscription)?.subscription;
  const group = membership?.group;
  const line = group?.line;
  const unavailableWrite = "هذه الخطوة تحتاج إلى تفعيل إجراء آمن على الخادم؛ لم يتم إرسال أو تسجيل أي طلب.";

  return <main className="rider-journey" dir="rtl" lang="ar">
    <header className="journey-topbar"><button className="journey-back" onClick={() => { if (document.referrer.startsWith(window.location.origin)) window.history.back(); else onNavigate("/home"); }} aria-label="رجوع">‹</button><a href="/home" className="journey-brand"><img src="/brand/sekka-mark.png" alt="سِكّة" /></a><button className="journey-avatar" onClick={() => onNavigate("/journey/profile")} aria-label="الملف الشخصي">{profile?.full_name?.slice(0, 1) ?? "س"}</button></header>
    <section className="journey-hero"><span className="journey-eyebrow">{meta.eyebrow}</span><h1>{meta.title}</h1><p>{meta.intro}</p><div className="journey-hero-icon" aria-hidden="true">{meta.icon}</div></section>
    <details className="journey-directory"><summary>خدمات الراكب <span>استعرض الأقسام</span></summary><nav className="journey-shortcuts" aria-label="أقسام الراكب">{entryGroups.map(([group, keys]) => <section className="journey-link-group" key={group}><h2>{group}</h2><div>{entries.filter(([key]) => keys.includes(key)).map(([key, label]) => <a key={key} className={key === screen ? "active" : ""} aria-current={key === screen ? "page" : undefined} href={`/journey/${key}`}>{label}</a>)}</div></section>)}</nav></details>
    <section className="journey-content">
      {loading && <div className="journey-state"><span className="journey-spinner"/> جارٍ تحميل بيانات حسابك…</div>}
      {error && !loading && <div className="journey-alert error" role="alert">{error}<button onClick={() => window.location.reload()}>إعادة المحاولة</button></div>}
      {notice && <div className="journey-alert">{notice}</div>}
      {!loading && !error && <>
        {(screen === "subscriptions" || screen === "group" || screen === "subscription" || screen === "receipt" || screen === "payment-method" || screen === "proof" || screen === "captain-confirmation" || screen === "payment-code" || screen === "payment-result" || screen === "renewal" || screen === "replacement-captain" || screen === "ratings") && <>
          {records.length === 0 ? <Empty icon="▤" title="لا توجد مجموعة مرتبطة بحسابك بعد" body="ستظهر هنا بيانات مجموعتك واشتراكك فور اعتماد طلب الانضمام." action="/trips" actionLabel="استكشف الرحلات" navigate={onNavigate}/> : screen === "subscriptions" ? <div className="journey-list">{records.map((item) => <MembershipCard key={item.id} item={item} onNavigate={onNavigate}/>)}</div> : <>
            <DataCard title={line ? `${line.origin_name} ← ${line.destination_name}` : "تفاصيل المجموعة"} badge={group?.status ?? membership?.status ?? "بانتظار التحديث"}>
              <Info label="حالة المجموعة" value={statusLabel(group?.status ?? membership?.status)} /><Info label="المركبة" value={line?.vehicle?.name_ar ?? "—"}/><Info label="المقاعد" value={line?.seat_count ? `${line.seat_count} مقاعد` : "—"}/><Info label="الأيام" value={(line?.operating_days ?? []).map((d: number) => ["أحد","اثنين","ثلاثاء","أربعاء","خميس","جمعة","سبت"][d]).join("، ") || "—"}/><Info label="موعد الانطلاق" value={line?.departure_time?.slice(0,5) ?? "—"}/><Info label="السعر الشهري" value={money(subscription?.monthly_price ?? line?.monthly_price, subscription?.currency ?? line?.currency)}/><Info label="فترة الاشتراك" value={subscription ? `${subscription.starts_on ?? "—"} — ${subscription.ends_on ?? "—"}` : "لا يوجد اشتراك مسجل"}/><Info label="حالة الاشتراك" value={statusLabel(subscription?.status)}/>
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
        {(screen === "conversations" || screen === "conversation") && <>{records.length ? screen === "conversation" ? <><DataCard title="محادثة المجموعة" badge="محادثة آمنة"><Info label="أحدث رسالة" value={records[0].latest?.body ?? "لا توجد رسائل بعد"}/><Info label="آخر تحديث" value={dateLabel(records[0].latest?.created_at ?? records[0].created_at)}/></DataCard><button className="journey-secondary" onClick={() => onNavigate("/journey/conversations")}>العودة إلى المحادثات</button></> : <div className="journey-list">{records.map((item) => <a className="journey-data-card journey-conversation" key={item.id} href={`/journey/conversation?id=${item.id}`}><span className="journey-card-icon">☏</span><div><strong>محادثة الرحلة</strong><p>{item.latest?.body ?? "ابدأ متابعة رسائل مجموعتك"}</p></div><time>{item.latest ? dateLabel(item.latest.created_at) : dateLabel(item.created_at)}</time></a>)}</div> : <Empty icon="☏" title={screen === "conversation" ? "المحادثة غير متاحة" : "لا توجد محادثات بعد"} body="ستظهر محادثات المجموعة هنا عندما تكون متاحة لحسابك."/>}<p className="journey-note">إرسال الرسائل غير متاح حتى تفعيل نقطة الكتابة الآمنة على الخادم.</p></>}
        {screen === "notifications" && <>{records.length ? <div className="journey-list">{records.map((item) => <article key={item.id} className={`journey-data-card journey-notification ${item.read_at ? "read" : "unread"}`}><span className="journey-card-icon">♧</span><div><strong>{notificationTitle(item.type)}</strong><p>{item.payload?.message ?? item.payload?.title ?? "لديك تحديث جديد في سِكّة."}</p><time>{dateLabel(item.created_at)}</time></div>{!item.read_at && <button onClick={() => void markRead(item.id)}>تمت القراءة</button>}</article>)}</div> : <Empty icon="♧" title="أنت على اطلاع" body="لا توجد إشعارات جديدة في الوقت الحالي."/>}</>}
        {screen === "complaint-status" && <>{records.length ? <div className="journey-list">{records.map((item) => <DataCard key={item.id} title={`بلاغ #${item.id.slice(0,8)}`} badge={statusLabel(item.status)}><p>{item.description}</p>{item.resolution_note && <Info label="الرد" value={item.resolution_note}/>}<Info label="تاريخ الإرسال" value={dateLabel(item.created_at)}/></DataCard>)}</div> : <Empty icon="◎" title="لا توجد شكاوى مسجلة" body="إذا أرسلت بلاغًا، ستظهر حالته هنا." action="/journey/complaint" actionLabel="تقديم شكوى" navigate={onNavigate}/>}</>}
        {screen === "complaint" && <div className="journey-data-card"><label className="journey-form-label">نوع البلاغ<select><option>مشكلة في رحلة</option><option>مشكلة دفع</option><option>سلوك غير مناسب</option><option>أخرى</option></select></label><label className="journey-form-label">تفاصيل المشكلة<textarea rows={5} placeholder="اكتب ما حدث والتفاصيل التي تساعدنا على المراجعة"/></label><button className="journey-primary" onClick={() => setNotice("تعذر الإرسال: لم تُفعّل صلاحية إنشاء الشكاوى من التطبيق بعد. لم يتم تسجيل البلاغ.")}>إرسال الشكوى</button><a className="journey-inline-link" href="/journey/complaint-status">متابعة شكوى سابقة</a></div>}
        {screen === "ratings" && <>{records.length ? records.map((item) => <DataCard key={item.id} title={`تقييم الرحلة • ${dateLabel(item.created_at)}`} badge={`${item.score} من 5`}>{item.comment && <p>{item.comment}</p>}</DataCard>) : <Empty icon="★" title="لا توجد تقييمات مسجلة" body="ستظهر تقييماتك هنا بعد انتهاء الرحلة وتسجيل التقييم."/>}<p className="journey-note">لا يمكن إضافة تقييم قبل تفعيل التحقق من أهلية الرحلة ونقطة الحفظ الآمنة.</p></>}
        {screen === "profile" && <div className="journey-data-card profile-card"><span className="profile-initial">{profile?.full_name?.slice(0,1) ?? "س"}</span><h2>{profile?.full_name ?? "مستخدم سِكّة"}</h2><p>{profile?.phone ?? "رقم الهاتف غير متاح للعرض"}</p><div className="journey-info-grid"><Info label="نوع الحساب" value={profile?.role === "rider" ? "راكب" : profile?.role === "captain" ? "كابتن" : profile?.role === "admin" ? "إدارة" : "—"}/><Info label="اللغة" value={profile?.locale === "en" ? "English" : "العربية"}/></div><button className="journey-secondary" onClick={signOut}>تسجيل الخروج</button><div className="profile-links"><a href="/privacy">سياسة الخصوصية</a><a href="/terms">الشروط والأحكام</a><a href="/journey/notifications">إعدادات الإشعارات</a></div></div>}
      </>}
    </section>
    <nav className="journey-bottom-nav" aria-label="التنقل الرئيسي"><a href="/home">⌂<span>الرئيسية</span></a><a href="/trips">⌕<span>البحث</span></a><a href="/my-trips">▤<span>طلباتي</span></a><a className={screen === "conversations" || screen === "conversation" ? "active" : ""} aria-current={screen === "conversations" || screen === "conversation" ? "page" : undefined} href="/journey/conversations">☏<span>المحادثات</span></a><a className={screen !== "conversations" && screen !== "conversation" ? "active" : ""} aria-current={screen !== "conversations" && screen !== "conversation" ? "page" : undefined} href="/journey/profile">⋯<span>المزيد</span></a></nav>
  </main>;
}

function DataCard({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) { return <article className="journey-data-card"><header className="journey-card-heading"><h2>{title}</h2>{badge && <span className="journey-badge">{badge}</span>}</header>{children}</article>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="journey-info"><span>{label}</span><strong>{value}</strong></div>; }
function Empty({ icon, title, body, action, actionLabel, navigate }: { icon: string; title: string; body: string; action?: string; actionLabel?: string; navigate?: (path: string) => void }) { return <div className="journey-empty"><span>{icon}</span><h2>{title}</h2><p>{body}</p>{action && <button className="journey-primary" onClick={() => navigate?.(action)}>{actionLabel}</button>}</div>; }
function MembershipCard({ item, onNavigate }: { item: any; onNavigate: (path: string) => void }) { const line = item.group?.line; return <article className="journey-data-card journey-membership"><div className="journey-card-heading"><span className="journey-card-icon">⌂</span><span className="journey-badge">{statusLabel(item.subscription?.status ?? item.status)}</span></div><h2>{line ? `${line.origin_name} ← ${line.destination_name}` : "مجموعة الرحلة"}</h2><p>{line?.vehicle?.name_ar ?? "مجموعة سِكّة"} • {line?.departure_time?.slice(0,5) ?? "موعد الرحلة"}</p><div className="journey-membership-footer"><strong>{money(item.subscription?.monthly_price ?? line?.monthly_price, item.subscription?.currency ?? line?.currency)}</strong><button className="journey-secondary" onClick={() => onNavigate("/journey/subscription")}>التفاصيل <span>←</span></button></div></article>; }
function statusLabel(status?: string) { const labels: Record<string,string> = { active:"نشط",pending:"قيد الانتظار",initiated:"بدأت العملية",paid:"تم الدفع",confirmed:"مؤكد",forming:"قيد الاكتمال",open:"مفتوحة",resolved:"تمت المعالجة",closed:"مغلقة",cancelled:"ملغاة",rejected:"مرفوض",searching:"جارٍ البحث" }; return status ? labels[status] ?? status : "غير متاح"; }
function money(amount?: number | null, currency?: string) { return amount == null ? "السعر غير محدد" : `${new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(amount)} ${currency === "EGP" || !currency ? "ج.م" : currency}`; }
function dateLabel(value?: string) { if (!value) return ""; return new Intl.DateTimeFormat("ar-EG", { dateStyle:"medium", timeStyle:"short" }).format(new Date(value)); }
function methodLabel(method: string) { return ({cash:"كاش",ewallet:"محفظة إلكترونية",instapay:"InstaPay"} as Record<string,string>)[method] ?? method; }
function notificationTitle(type: string) { return ({payment:"تحديث الدفع",subscription:"تحديث الاشتراك",group:"تحديث المجموعة",renewal:"تجديد الاشتراك",complaint:"تحديث الشكوى",booking:"طلب انضمام",match:"رحلة مناسبة"} as Record<string,string>)[type] ?? "إشعار جديد"; }
